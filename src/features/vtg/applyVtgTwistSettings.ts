import type { VtgTwistMode, VtgTwistValues } from '@/features/vtg/propertyTypes'
import type { RootDataFinal } from '@/types/AnimTypes'

export interface ApplyVtgTwistSettingsOptions {
  firstEditableFrameIndex?: number
}

/** Applies generator Twist settings without mutating the generated VTG animation. */
export const applyVtgTwistSettings = (
  animation: RootDataFinal,
  mode: VtgTwistMode,
  values: VtgTwistValues,
  options: ApplyVtgTwistSettingsOptions = {},
): RootDataFinal => ({
  ...animation,
  props: animation.props.map((prop, propIndex) => {
    let beat = 0
    return {
      ...prop,
      anim: prop.anim.map((frame, frameIndex) => {
        const nextFrame = { ...frame }
        if (frameIndex < (options.firstEditableFrameIndex ?? 0)) {
          beat += frame.beats ?? 0.5
          return nextFrame
        }
        delete nextFrame.twist
        const value = values[propIndex]?.[String(beat)]
        if ((mode === 'advanced' || beat === 0.5) && value !== undefined) nextFrame.twist = value
        beat += frame.beats ?? 0.5
        return nextFrame
      }),
    }
  }),
})

/** Captures explicitly authored Twist values from the editable portion of an animation. */
export const extractVtgTwistValues = (
  animation: RootDataFinal,
  firstEditableFrameIndex = 0,
): VtgTwistValues => [
  extractPropTwistValues(animation, 0, firstEditableFrameIndex),
  extractPropTwistValues(animation, 1, firstEditableFrameIndex),
]

const extractPropTwistValues = (
  animation: RootDataFinal,
  propIndex: 0 | 1,
  firstEditableFrameIndex: number,
) => {
  const values: Record<string, number> = {}
  let beat = 0
  for (const [frameIndex, frame] of (animation.props[propIndex]?.anim ?? []).entries()) {
    if (frameIndex >= firstEditableFrameIndex && frame.twist !== undefined) {
      values[String(beat)] = frame.twist
    }
    beat += frame.beats ?? 0.5
  }
  return values
}

/** Simple Twist can faithfully represent only values authored at beat 0.5. */
export const detectVtgTwistMode = (values: VtgTwistValues): VtgTwistMode =>
  values.every((side) => Object.keys(side).every((beat) => Number(beat) === 0.5))
    ? 'simple'
    : 'advanced'
