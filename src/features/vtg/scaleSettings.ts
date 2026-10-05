import { toDisplayScale } from '@/domain/animation/scale'
import { resolveAnimationFrames } from '@/math/animation/frameSemantics'
import { applyPatternScaleSettings } from '@/features/concepts/applyPatternScaleSettings'
import {
  getAdjustedVtgScale,
  getVtgDistanceForScale,
  getVtgScaleControlValue,
  vtgScaleControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import type { RootDataFinal } from '@/types/AnimTypes'
import type { PatternScaleValues, VtgScaleSettings } from '@/types/AnimationScale'
import type { VtgSpeedRatio } from '@/features/vtg/types'

/** Includes inherited/default Scale and every frame, not just the first authored values. */
export const readUniformPatternScale = (animation: RootDataFinal): number | undefined => {
  if (animation.props.length !== 2) return undefined
  let scale: number | undefined
  for (const prop of animation.props) {
    if (prop.anim.length === 0) return undefined
    for (const frame of resolveAnimationFrames(prop.anim)) {
      if (!Number.isFinite(frame.scale)) return undefined
      scale ??= frame.scale
      if (frame.scale !== scale) return undefined
    }
  }
  return scale === undefined ? undefined : toDisplayScale(scale)
}

/** Recognizes Auto by reproducing the data, without changing frames or remembering authoring intent.
 * At clamped boundaries the existing inverse selects a deterministic equivalent base.
 */
export const detectVtgAutoScale = (
  animation: RootDataFinal,
  ratio: VtgSpeedRatio,
): number | undefined => {
  const scale = readUniformPatternScale(animation)
  if (scale === undefined) return undefined
  const base = getVtgScaleControlValue(scale, ratio)
  return base >= vtgScaleControl.min &&
    base <= vtgScaleControl.max &&
    getAdjustedVtgScale(base, ratio) === scale
    ? base
    : undefined
}

export const readPatternScaleValues = (
  animation: RootDataFinal,
  effective = false,
): PatternScaleValues => {
  const read = (index: number): Record<string, number> => {
    const authored = animation.props[index]?.anim ?? []
    const frames = effective ? resolveAnimationFrames(authored) : authored
    let beat = 0
    const values: Record<string, number> = {}
    frames.forEach((frame, index) => {
      if (frame.scale !== undefined) values[String(beat)] = toDisplayScale(frame.scale)
      beat += authored[index]?.beats ?? 0.5
    })
    return values
  }
  return [read(0), read(1)]
}

/** Apply Scale in authored path order, before the final VTG/QTR Swap assignment. */
export const applyVtgScaleSettings = (
  animation: RootDataFinal,
  settings: VtgScaleSettings,
  ratio: VtgSpeedRatio,
): RootDataFinal => {
  const automatic = getAdjustedVtgScale(settings.base, ratio)
  const scaled = applyPatternScaleSettings(
    animation,
    settings.auto ? 'simple' : settings.mode,
    settings.auto ? [{ '0': automatic }, { '0': automatic }] : settings.values,
  )
  const effectiveValues = readPatternScaleValues(scaled, true)
  const maximum = Math.max(0, ...effectiveValues.flatMap((side) => Object.values(side)))
  return {
    ...scaled,
    camera: scaled.camera.map((frame, index) =>
      index === 0
        ? { ...frame, orbit: { ...frame.orbit, distance: getVtgDistanceForScale(maximum) } }
        : frame,
    ),
  }
}
