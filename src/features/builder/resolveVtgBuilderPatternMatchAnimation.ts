import { resizeVtgTransitionPatternPreview } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { getVtgQuickSlotBeatCount } from '@/features/vtg/math/getVtgQuickSlotBeatCount'
import type { RootDataFinal } from '@/types/AnimTypes'

export const resolveVtgBuilderPatternMatchAnimation = (
  previews: readonly RootDataFinal[] | undefined,
  selectedIndex: number | undefined,
): RootDataFinal | undefined => {
  if (!previews?.length || selectedIndex === undefined) return undefined
  const dropPlaceholderSelected = selectedIndex === previews.length
  const preview = dropPlaceholderSelected ? previews.at(-1) : previews[selectedIndex]
  if (!preview) return undefined

  // Drop candidates need the actual trailing endpoint. Normalizing its length would erase beat
  // edits when the pattern contains only one portion.
  if (dropPlaceholderSelected) return preview

  return resizeVtgTransitionPatternPreview(preview, 0, getVtgQuickSlotBeatCount(preview)) ?? preview
}
