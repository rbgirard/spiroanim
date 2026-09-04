import {
  appendVtgBuilderPattern,
  insertVtgBuilderPattern,
  type VtgBuilderPatternOptions,
} from '@/features/builder/appendVtgBuilderPattern'
import type { VtgBuilderPatternSelection } from '@/features/builder/types'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { createVtgTransitionPreviewAnimations } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { prepareVtg45TransitionPattern } from '@/features/vtg/math/prepareVtg45TransitionPattern'
import { applyVtgThirdOrderSettings } from '@/features/vtg/thirdOrder'
import type { RootDataFinal } from '@/types/AnimTypes'

/** Builds the portion a VTG selection would create at one Builder drop target. */
export const createVtgBuilderDropPreview = (
  source: RootDataFinal,
  selection: VtgBuilderPatternSelection,
  targetIndex: number,
  options: VtgBuilderPatternOptions = {},
): RootDataFinal | undefined => {
  if (targetIndex === 0) {
    const animation =
      'quarters' in selection
        ? createDefaultQtrAnimation(selection)
        : createDefaultVtgAnimation(selection, options)
    return animation && options.thirdOrder
      ? applyVtgThirdOrderSettings(animation, options.thirdOrder.settings, {
          mirror: options.thirdOrder.mirror,
          opposed: options.thirdOrder.opposed,
        })
      : animation
  }

  const prepared = prepareVtg45TransitionPattern(source)
  if (!prepared.supported) return undefined
  const previewCount = createVtgTransitionPreviewAnimations(prepared.pattern)?.length
  if (previewCount === undefined || targetIndex > previewCount) return undefined

  const updated =
    targetIndex === previewCount
      ? appendVtgBuilderPattern(prepared.pattern, selection, options)
      : insertVtgBuilderPattern(prepared.pattern, selection, targetIndex, options)
  return updated === undefined
    ? undefined
    : createVtgTransitionPreviewAnimations(updated)?.[targetIndex]
}
