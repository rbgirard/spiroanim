import { rootCompile } from '@/math/animation/AnimFunc'
import { findExplicitPlaneOrTurnsFrameIndices } from '@/math/animation/findExplicitPlaneOrTurnsFrameIndices'
import type { AnimData, RootDataFinal } from '@/types/AnimTypes'

export type VtgBuilderPortionPropertyKey =
  | 'scale'
  | 'twist'
  | 'yaw'
  | 'rotate'
  | 'warp'
  | 'strength'

const inheritedPortionPropertyKeys = [
  'scale',
  'twist',
  'yaw',
  'warp',
  'strength',
] as const satisfies readonly VtgBuilderPortionPropertyKey[]

export interface VtgBuilderPortionRange {
  startFrameIndex: number
  firstOwnedFrameIndex: number
  endFrameIndex: number
  successorFirstOwnedFrameIndex?: number
}

export const getVtgBuilderPortionRanges = (
  animation: RootDataFinal,
): readonly VtgBuilderPortionRange[] => {
  const frameCount = animation.props[0]?.anim.length ?? 0
  if (frameCount === 0) return []

  const sliceStarts = [
    0,
    ...findExplicitPlaneOrTurnsFrameIndices(animation, 2).map((frameIndex) => frameIndex - 1),
  ]

  return sliceStarts.flatMap((startFrameIndex, portionIndex) => {
    const nextStartFrameIndex = sliceStarts[portionIndex + 1]
    const endFrameIndex = nextStartFrameIndex ?? frameCount - 1
    const firstOwnedFrameIndex = portionIndex === 0 ? startFrameIndex : startFrameIndex + 1
    if (firstOwnedFrameIndex > endFrameIndex) return []

    return [
      {
        startFrameIndex,
        firstOwnedFrameIndex,
        endFrameIndex,
        ...(nextStartFrameIndex === undefined
          ? undefined
          : { successorFirstOwnedFrameIndex: nextStartFrameIndex + 1 }),
      },
    ]
  })
}

const cloneAnimation = (animation: RootDataFinal): RootDataFinal => ({
  ...animation,
  props: animation.props.map((prop) => ({
    ...prop,
    anim: prop.anim.map((frame) => ({ ...frame })),
  })),
})

const withoutFrameProperty = (
  animation: RootDataFinal,
  frameIndex: number,
  key: (typeof inheritedPortionPropertyKeys)[number],
): RootDataFinal => ({
  ...animation,
  props: animation.props.map((prop) => ({
    ...prop,
    anim: prop.anim.map((frame, index) => {
      if (index !== frameIndex || frame[key] === undefined) return frame
      const nextFrame = { ...frame }
      delete nextFrame[key]
      return nextFrame
    }),
  })),
})

const withMinimalSuccessorGuards = (
  source: RootDataFinal,
  candidate: RootDataFinal,
  successorFrameIndex: number,
  keys: readonly VtgBuilderPortionPropertyKey[],
): RootDataFinal => {
  const inheritedKeys = inheritedPortionPropertyKeys.filter((key) => keys.includes(key))
  if (inheritedKeys.length === 0) return candidate

  const expected = rootCompile(source)
  let guarded = candidate

  for (const key of inheritedKeys) {
    const withoutGuard = withoutFrameProperty(guarded, successorFrameIndex, key)
    const compiledWithoutGuard = rootCompile(withoutGuard)
    guarded = {
      ...withoutGuard,
      props: withoutGuard.props.map((prop, propIndex) => {
        const expectedValue = expected.props[propIndex]?.anim[successorFrameIndex]?.[key]
        const inheritedValue =
          compiledWithoutGuard.props[propIndex]?.anim[successorFrameIndex]?.[key]
        const frame = prop.anim[successorFrameIndex]
        if (
          frame === undefined ||
          expectedValue === inheritedValue ||
          expectedValue === undefined
        ) {
          return prop
        }

        return {
          ...prop,
          anim: prop.anim.map((item, frameIndex) =>
            frameIndex === successorFrameIndex ? { ...item, [key]: expectedValue } : item,
          ),
        }
      }),
    }
  }

  return guarded
}

/**
 * Replaces selected property channels on one Builder portion. A later portion's local frame zero
 * is context-only and is never copied back. Effective inherited values are materialized on the
 * successor only when omitting them would change the successor's prior behavior.
 */
export const applyVtgBuilderPortionProperties = (
  source: RootDataFinal,
  portionIndex: number,
  workingPortion: RootDataFinal,
  keys: readonly VtgBuilderPortionPropertyKey[],
): RootDataFinal | undefined => {
  const range = getVtgBuilderPortionRanges(source)[portionIndex]
  if (!range || source.props.length !== workingPortion.props.length) return undefined

  const expectedLocalFrameCount = range.endFrameIndex - range.startFrameIndex + 1
  if (workingPortion.props.some((prop) => prop.anim.length !== expectedLocalFrameCount)) {
    return undefined
  }

  const candidate = cloneAnimation(source)
  for (const [propIndex, prop] of candidate.props.entries()) {
    const workingProp = workingPortion.props[propIndex]
    if (!workingProp) return undefined

    for (
      let frameIndex = range.firstOwnedFrameIndex;
      frameIndex <= range.endFrameIndex;
      frameIndex += 1
    ) {
      const frame = prop.anim[frameIndex]
      const workingFrame = workingProp.anim[frameIndex - range.startFrameIndex]
      if (!frame || !workingFrame) return undefined

      for (const key of keys) {
        const value = workingFrame[key]
        if (value === undefined) delete frame[key]
        else frame[key] = value
      }
    }
  }

  return range.successorFirstOwnedFrameIndex === undefined
    ? candidate
    : withMinimalSuccessorGuards(source, candidate, range.successorFirstOwnedFrameIndex, keys)
}

export const getVtgBuilderPortionAuthoredValues = <TKey extends VtgBuilderPortionPropertyKey>(
  animation: RootDataFinal,
  portionIndex: number,
  localBeats: readonly number[],
  key: TKey,
): [Record<string, AnimData[TKey]>, Record<string, AnimData[TKey]>] | undefined => {
  const range = getVtgBuilderPortionRanges(animation)[portionIndex]
  if (!range) return undefined

  return [0, 1].map((propIndex) => {
    const values: Record<string, AnimData[TKey]> = {}
    const prop = animation.props[propIndex]
    if (!prop) return values

    for (
      let frameIndex = range.firstOwnedFrameIndex;
      frameIndex <= range.endFrameIndex;
      frameIndex += 1
    ) {
      const value = prop.anim[frameIndex]?.[key]
      const beat = localBeats[frameIndex - range.startFrameIndex]
      if (value !== undefined && beat !== undefined) values[String(beat)] = value
    }
    return values
  }) as [Record<string, AnimData[TKey]>, Record<string, AnimData[TKey]>]
}

export const getVtgBuilderPortionEffectiveValues = <
  TKey extends (typeof inheritedPortionPropertyKeys)[number],
>(
  animation: RootDataFinal,
  portionIndex: number,
  localBeats: readonly number[],
  key: TKey,
): [Record<string, number>, Record<string, number>] | undefined => {
  const range = getVtgBuilderPortionRanges(animation)[portionIndex]
  if (!range) return undefined
  const compiled = rootCompile(animation)

  return [0, 1].map((propIndex) => {
    const values: Record<string, number> = {}
    for (
      let frameIndex = range.firstOwnedFrameIndex;
      frameIndex <= range.endFrameIndex;
      frameIndex += 1
    ) {
      const value = compiled.props[propIndex]?.anim[frameIndex]?.[key]
      const beat = localBeats[frameIndex - range.startFrameIndex]
      if (value !== undefined && beat !== undefined) values[String(beat)] = value
    }
    return values
  }) as [Record<string, number>, Record<string, number>]
}
