import { resolveAnimationFrames } from '@/math/animation/frameSemantics'
import { normalizeTimingAngle } from '@/domain/animation/timingAngle'
import {
  parseVtgIndividualSpeedRatio,
  vtgRatioPickerRatios,
  type VtgIndividualSpeedRatio,
} from '@/features/vtg/types'
import type { RootDataFinal } from '@/types/AnimTypes'

export type VtgThirdOrderDirection = 'anti' | 'pro'
export type VtgThirdOrderTiming = `${VtgIndividualSpeedRatio}-${VtgThirdOrderDirection}`
export type VtgThirdOrderInitial = VtgThirdOrderTiming | number

export interface VtgThirdOrderSideSettings {
  initial?: VtgThirdOrderInitial
  strength?: number
  timing?: VtgThirdOrderTiming
}

export type VtgThirdOrderSettings = [VtgThirdOrderSideSettings, VtgThirdOrderSideSettings]

const vtgThirdOrderInitialArc = 45

const getEffectiveVtgThirdOrderTiming = (
  settings: VtgThirdOrderSideSettings,
): VtgThirdOrderTiming | undefined =>
  settings.timing ?? (typeof settings.initial === 'string' ? settings.initial : undefined)

/** Number of hand-path cycles required to close every active continuing Third Order timing. */
export const getVtgThirdOrderCycleCount = (
  settings: VtgThirdOrderSettings,
  mirror = false,
): 1 | 2 => {
  const activeSides = mirror ? [settings[0]] : settings
  return activeSides.some((side) => {
    const timing = getEffectiveVtgThirdOrderTiming(side)
    if (timing === undefined) return false
    const ratio = parseVtgIndividualSpeedRatio(timing.slice(0, timing.lastIndexOf('-')))
    return ratio?.numerator === 2
  })
    ? 2
    : 1
}

export const vtgThirdOrderTimingOptions = vtgRatioPickerRatios.flatMap((ratio) => [
  { value: `${ratio}-anti` as const, label: `${ratio} Anti` },
  { value: `${ratio}-pro` as const, label: `${ratio} Pro` },
])

export const createVtgThirdOrderWarp = (arc: number, timing: VtgThirdOrderTiming): number => {
  const separator = timing.lastIndexOf('-')
  const ratio = parseVtgIndividualSpeedRatio(timing.slice(0, separator))
  const direction = timing.slice(separator + 1)
  if (!ratio || (direction !== 'anti' && direction !== 'pro')) {
    throw new RangeError(`Invalid Third Order timing: ${timing}`)
  }

  const relativeRate =
    direction === 'anti'
      ? -(ratio.numerator + ratio.denominator) / ratio.numerator
      : (ratio.denominator - ratio.numerator) / ratio.numerator
  return normalizeTimingAngle(arc * relativeRate)
}

export const detectVtgThirdOrderTiming = (
  arc: number,
  warp: number,
): VtgThirdOrderTiming | undefined =>
  vtgThirdOrderTimingOptions.find(
    ({ value }) => Math.abs(createVtgThirdOrderWarp(arc, value) - warp) < 1e-9,
  )?.value

export const createVtgThirdOrderInitialWarp = (timing: VtgThirdOrderTiming): number =>
  createVtgThirdOrderWarp(vtgThirdOrderInitialArc, timing)

export const detectVtgThirdOrderInitialTiming = (warp: number): VtgThirdOrderTiming | undefined =>
  detectVtgThirdOrderTiming(vtgThirdOrderInitialArc, warp)

const copySettings = (settings: VtgThirdOrderSettings): VtgThirdOrderSettings => [
  { ...settings[0] },
  { ...settings[1] },
]

export interface ApplyVtgThirdOrderSettingsOptions {
  firstEditableFrameIndex?: number
  mirror?: boolean
  opposed?: boolean
}

export interface VtgThirdOrderRelationship {
  mirror: boolean
  opposed: boolean
}

export const opposeVtgThirdOrderTiming = (timing: VtgThirdOrderTiming): VtgThirdOrderTiming =>
  timing.endsWith('-anti')
    ? (`${timing.slice(0, -5)}-pro` as VtgThirdOrderTiming)
    : (`${timing.slice(0, -4)}-anti` as VtgThirdOrderTiming)

const createRelatedSideSettings = (
  settings: VtgThirdOrderSideSettings,
  opposed: boolean,
): VtgThirdOrderSideSettings => ({
  ...(settings.initial === undefined
    ? undefined
    : {
        initial:
          opposed && typeof settings.initial === 'string'
            ? opposeVtgThirdOrderTiming(settings.initial)
            : settings.initial,
      }),
  ...(settings.strength === undefined ? undefined : { strength: settings.strength }),
  ...(settings.timing === undefined
    ? undefined
    : {
        timing: opposed ? opposeVtgThirdOrderTiming(settings.timing) : settings.timing,
      }),
})

/** Applies Third Order controls without mutating the supplied animation. */
export const applyVtgThirdOrderSettings = (
  animation: RootDataFinal,
  settings: VtgThirdOrderSettings,
  options: ApplyVtgThirdOrderSettingsOptions = {},
): RootDataFinal => {
  const relatedRight = createRelatedSideSettings(settings[0], options.opposed === true)
  if (settings[0].timing !== undefined && typeof settings[0].initial === 'string') {
    relatedRight.initial = createVtgThirdOrderInitialWarp(settings[0].initial)
  }

  return {
    ...animation,
    props: animation.props.map((prop, propIndex) => {
      const side = options.mirror === true && propIndex === 1 ? relatedRight : settings[propIndex]
      if (!side) return prop
      const resolved = resolveAnimationFrames(prop.anim)
      const firstEditableFrameIndex = options.firstEditableFrameIndex ?? 0
      const timingStartIndex = Math.max(1, firstEditableFrameIndex)
      let previousTimingWarp: number | undefined

      return {
        ...prop,
        anim: prop.anim.map((frame, frameIndex) => {
          const nextFrame = { ...frame }
          if (frameIndex < firstEditableFrameIndex) return nextFrame

          if (frameIndex === firstEditableFrameIndex) {
            delete nextFrame.strength
            if (side.strength !== undefined) nextFrame.strength = Math.round(side.strength * 10)
          } else {
            delete nextFrame.strength
          }

          if (frameIndex === 0) {
            delete nextFrame.warp
            if (typeof side.initial === 'number') {
              nextFrame.warp = normalizeTimingAngle(side.initial)
            } else if (side.initial !== undefined) {
              nextFrame.warp = createVtgThirdOrderInitialWarp(side.initial)
            }
          } else if (frameIndex >= timingStartIndex) {
            delete nextFrame.warp
            if (side.timing !== undefined) {
              const timingWarp = createVtgThirdOrderWarp(resolved[frameIndex]!.arc, side.timing)
              if (frameIndex === timingStartIndex || timingWarp !== previousTimingWarp) {
                nextFrame.warp = timingWarp
              }
              previousTimingWarp = timingWarp
            }
          }

          return nextFrame
        }),
      }
    }),
  }
}

const detectTimingAcrossFrames = (
  animation: RootDataFinal,
  propIndex: 0 | 1,
  startFrameIndex: number,
  authoredOnly: boolean,
): VtgThirdOrderTiming | undefined => {
  const frames = animation.props[propIndex]?.anim ?? []
  const resolved = resolveAnimationFrames(frames)
  let detected: VtgThirdOrderTiming | undefined
  let found = false

  for (let frameIndex = startFrameIndex; frameIndex < frames.length; frameIndex++) {
    const frame = frames[frameIndex]!
    if (authoredOnly && frame.warp === undefined) continue
    const timing = detectVtgThirdOrderTiming(
      resolved[frameIndex]!.arc,
      authoredOnly ? frame.warp! : resolved[frameIndex]!.warp,
    )
    if (timing === undefined || (found && timing !== detected)) return undefined
    detected = timing
    found = true
  }
  return found ? detected : undefined
}

export const extractVtgThirdOrderSettings = (
  animation: RootDataFinal,
  firstEditableFrameIndex = 0,
): VtgThirdOrderSettings =>
  ([0, 1] as const).map((propIndex) => {
    const prop = animation.props[propIndex]
    if (!prop) return {}
    const timingStartIndex = Math.max(1, firstEditableFrameIndex)
    const timing = detectTimingAcrossFrames(animation, propIndex, timingStartIndex, true)
    const firstFrame = prop.anim[firstEditableFrameIndex]
    const initialFrame = prop.anim[0]
    const resolved = resolveAnimationFrames(prop.anim)
    const initialWarp = initialFrame?.warp

    return {
      ...(initialWarp === undefined
        ? undefined
        : {
            initial:
              timing === undefined
                ? (detectVtgThirdOrderInitialTiming(initialWarp) ?? initialWarp)
                : initialWarp,
          }),
      ...(firstFrame?.strength === undefined ? undefined : { strength: firstFrame.strength / 10 }),
      ...(timing === undefined ? undefined : { timing }),
    }
  }) as VtgThirdOrderSettings

const sidesMatch = (
  left: VtgThirdOrderSideSettings,
  right: VtgThirdOrderSideSettings,
  opposed: boolean,
  compareInitial: boolean,
) => {
  const expected = createRelatedSideSettings(left, opposed)
  return (
    (!compareInitial || expected.initial === right.initial) &&
    expected.strength === right.strength &&
    expected.timing === right.timing
  )
}

/** Detects whether the right side can be reproduced exactly from the left side. */
export const detectVtgThirdOrderRelationship = (
  animation: RootDataFinal,
  firstEditableFrameIndex = 0,
): VtgThirdOrderRelationship => {
  const settings = extractVtgThirdOrderSettings(animation, firstEditableFrameIndex)
  const compareInitial = firstEditableFrameIndex === 0
  if (sidesMatch(settings[0], settings[1], false, compareInitial)) {
    return { mirror: true, opposed: false }
  }
  if (sidesMatch(settings[0], settings[1], true, compareInitial)) {
    return { mirror: true, opposed: true }
  }
  return { mirror: false, opposed: false }
}

export interface VtgThirdOrderDisplaySettings {
  initial: readonly [VtgThirdOrderInitial | undefined, VtgThirdOrderInitial | undefined]
  strength: readonly [number, number]
  timing: readonly [VtgThirdOrderTiming | undefined, VtgThirdOrderTiming | undefined]
}

export const getVtgThirdOrderDisplaySettings = (
  animation: RootDataFinal,
  settings: VtgThirdOrderSettings,
  firstEditableFrameIndex = 0,
): VtgThirdOrderDisplaySettings => {
  const initial: Array<VtgThirdOrderInitial | undefined> = []
  const strength: number[] = []
  const timing: Array<VtgThirdOrderTiming | undefined> = []

  for (const propIndex of [0, 1] as const) {
    const frames = animation.props[propIndex]?.anim ?? []
    const resolved = resolveAnimationFrames(frames)
    const side = settings[propIndex]
    const initialResolved = resolved[0]
    const timingStartIndex = Math.max(1, firstEditableFrameIndex)
    const hasAuthoredContinuationWarp = frames
      .slice(timingStartIndex)
      .some((frame) => frame.warp !== undefined)
    const inheritedInitialTiming =
      typeof side.initial === 'string'
        ? side.initial
        : initialResolved
          ? detectVtgThirdOrderInitialTiming(initialResolved.warp)
          : undefined
    initial[propIndex] =
      side.timing !== undefined
        ? initialResolved?.warp
        : initialResolved && detectVtgThirdOrderInitialTiming(initialResolved.warp)
    strength[propIndex] = (resolved[firstEditableFrameIndex]?.strength ?? 1000) / 10
    timing[propIndex] =
      side.timing ??
      (!hasAuthoredContinuationWarp && inheritedInitialTiming !== undefined
        ? inheritedInitialTiming
        : detectTimingAcrossFrames(animation, propIndex, timingStartIndex, false))
  }

  return {
    initial: initial as [VtgThirdOrderInitial | undefined, VtgThirdOrderInitial | undefined],
    strength: strength as [number, number],
    timing: timing as [VtgThirdOrderTiming | undefined, VtgThirdOrderTiming | undefined],
  }
}

export const updateVtgThirdOrderSettings = (
  settings: VtgThirdOrderSettings,
  propIndex: 0 | 1,
  update: Partial<VtgThirdOrderSideSettings>,
): VtgThirdOrderSettings => {
  const next = copySettings(settings)
  const side = next[propIndex]
  if ('initial' in update) {
    if (update.initial === undefined) delete side.initial
    else side.initial = update.initial
  }
  if ('strength' in update) {
    if (update.strength === undefined) delete side.strength
    else side.strength = update.strength
  }
  if ('timing' in update) {
    if (update.timing === undefined) delete side.timing
    else side.timing = update.timing
  }
  return next
}
