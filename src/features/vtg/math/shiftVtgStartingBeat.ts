import type { VtgBeat } from '@/features/vtg/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import {
  shiftAnimationFrameRange,
  type ShiftAnimationRangeOptions,
} from '@/math/animation/shiftAnimationFrames'
import type { RootDataFinal } from '@/types/AnimTypes'

/** Applies semantic Shift in one pass; closed-cycle validation is the default for catalog callers. */
export const shiftVtgStartingFrames = (
  animation: RootDataFinal,
  shiftCount: number,
  options: Omit<ShiftAnimationRangeOptions, 'shiftCount'> = {},
): RootDataFinal | undefined => {
  if (shiftCount === 0) return animation

  const compiled = rootCompile(animation)
  const shiftedProps = []
  for (const [propIndex, prop] of animation.props.entries()) {
    const compiledProp = compiled.props[propIndex]
    if (!compiledProp) return undefined
    const shiftedFrames = shiftAnimationFrameRange(
      prop.anim,
      compiledProp.anim,
      0,
      prop.anim.length - 1,
      {
        ...options,
        shiftCount,
      },
    )
    if (!shiftedFrames) return undefined
    shiftedProps.push({ ...prop, anim: shiftedFrames })
  }
  return { ...animation, props: shiftedProps }
}

/** Applies Shift until the selected VTG/QTR beat becomes beat 1. */
export const shiftVtgStartingBeat = (
  animation: RootDataFinal,
  beat: VtgBeat,
): RootDataFinal | undefined => shiftVtgStartingFrames(animation, (beat - 1) * 2)
