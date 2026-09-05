import { resizeVtgTransitionPatternPreview } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { getVtgQuickSlotBeatCount } from '@/features/vtg/math/getVtgQuickSlotBeatCount'
import type { RootDataFinal } from '@/types/AnimTypes'

const firstAdditionalPortionFrameIndex = 2

const hasAdditionalPortion = (animation: RootDataFinal): boolean =>
  animation.props.some((prop) =>
    prop.anim.some(
      (frame, frameIndex) =>
        frameIndex >= firstAdditionalPortionFrameIndex &&
        (frame.turns !== undefined || frame.plane !== undefined),
    ),
  )

/** Resizes a single authored portion to one complete timing cycle for catalog matching only. */
export const normalizeVtgPatternMatchCycle = (
  animation: RootDataFinal,
): RootDataFinal | undefined => {
  if (hasAdditionalPortion(animation)) return undefined

  const normalized = resizeVtgTransitionPatternPreview(
    animation,
    0,
    getVtgQuickSlotBeatCount(animation),
  )
  return normalized === animation ? undefined : normalized
}
