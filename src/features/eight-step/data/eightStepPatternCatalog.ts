import { getEightStepPatternDefinition } from '@/features/eight-step/data/eightStepPatternDefinitions'
import type {
  EightStepPatternSelection,
  EightStepReadableAnimation,
} from '@/features/eight-step/types'
import {
  clampVtgBpm,
  getVtgDistanceForScale,
  toVtgInternalScale,
  vtgPlayerSettings,
  vtgScaleControl,
} from '@/features/vtg/data/vtgPlayerSettings'

export const buildEightStepPattern = (
  selection: EightStepPatternSelection,
): EightStepReadableAnimation | undefined => {
  const definition = getEightStepPatternDefinition(selection.reference)
  if (!definition) return undefined

  const transformedProps = definition.props.map((prop) => {
    const initialArc = prop.anim[0]?.arc ?? 0
    const initialPlane = prop.anim[0]?.plane ?? 0
    const orientationArcDelta =
      (selection.shape === 'turned' ? 90 : 45) * (Math.abs(initialPlane) === 180 ? -1 : 1)
    const firstContinuationArc = prop.anim[1]?.arc ?? initialArc

    return {
      ...prop,
      anim: prop.anim.map((frame, frameIndex) => ({
        ...frame,
        ...(selection.shape !== undefined && selection.shape !== 'diamond' && frameIndex === 0
          ? { arc: (initialArc + orientationArcDelta + 360) % 360 }
          : undefined),
        ...(selection.shape !== undefined && selection.shape !== 'diamond' && frameIndex === 1
          ? { arc: firstContinuationArc }
          : undefined),
        ...(frameIndex === 0 && selection.scale !== undefined
          ? { scale: toVtgInternalScale(selection.scale) }
          : undefined),
      })),
    }
  })

  return {
    ...vtgPlayerSettings,
    ...(selection.bpm !== undefined ? { bpm: clampVtgBpm(selection.bpm) } : undefined),
    distance: getVtgDistanceForScale(selection.scale ?? vtgScaleControl.default),
    props: transformedProps,
  }
}
