import { toInternalScale } from '@/domain/animation/scale'
import type { RootDataFinal } from '@/types/AnimTypes'
import type { PatternScaleMode, PatternScaleValues } from '@/types/AnimationScale'

/** Applies authored Scale without mutating the source or changing frames before the boundary. */
export const applyPatternScaleSettings = (
  animation: RootDataFinal,
  mode: PatternScaleMode,
  values: PatternScaleValues,
  firstEditableFrameIndex = 0,
): RootDataFinal => ({
  ...animation,
  ...(animation.vtgScale ? { vtgScale: { ...animation.vtgScale, auto: false, mode } } : undefined),
  props: animation.props.map((prop, propIndex) => {
    let beat = 0
    return {
      ...prop,
      anim: prop.anim.map((frame, frameIndex) => {
        const nextFrame = { ...frame }
        if (frameIndex >= firstEditableFrameIndex) {
          delete nextFrame.scale
          const value = values[propIndex]?.[String(beat)]
          if (
            (mode === 'advanced' || frameIndex === firstEditableFrameIndex) &&
            value !== undefined
          ) {
            nextFrame.scale = toInternalScale(value)
          }
        }
        beat += frame.beats ?? 0.5
        return nextFrame
      }),
    }
  }),
})
