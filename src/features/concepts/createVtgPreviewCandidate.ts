import { createVtgBuilderDropPreview } from '@/features/builder/createVtgBuilderDropPreview'
import type { VtgBuilderPatternSelection } from '@/features/builder/types'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import {
  applyVtgPropertySettings,
  getVtgPropertyCycleCount,
  type VtgPropertySettings,
} from '@/features/vtg/propertySettings'
import type { RootDataFinal } from '@/types/AnimTypes'

interface VtgPreviewCandidateOptions {
  source?: RootDataFinal
  builderInsertionIndex?: number
  properties?: VtgPropertySettings
}

/** Generates the same final VTG candidate used by both thumbnails and layout comparison. */
export const createVtgPreviewCandidate = (
  selection: VtgBuilderPatternSelection,
  options: VtgPreviewCandidateOptions = {},
): RootDataFinal | undefined => {
  const minimumCycleCount = options.properties ? getVtgPropertyCycleCount(options.properties) : 1
  if (options.source !== undefined && options.builderInsertionIndex !== undefined) {
    return createVtgBuilderDropPreview(options.source, selection, options.builderInsertionIndex, {
      minimumCycleCount,
      properties: options.properties,
    })
  }

  const animation =
    'quarters' in selection
      ? createDefaultQtrAnimation(selection)
      : createDefaultVtgAnimation(selection, { minimumCycleCount })
  return animation && options.properties
    ? applyVtgPropertySettings(animation, options.properties)
    : animation
}
