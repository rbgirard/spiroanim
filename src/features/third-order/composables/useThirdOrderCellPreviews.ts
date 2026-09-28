import { useConceptPreviewRenderer } from '@/features/concepts/composables/useConceptPreviewRenderer'
import {
  createThirdOrderPreviewAnimation,
  isThirdOrderSelectionSupported,
} from '@/features/third-order/createThirdOrderAnimation'
import { thirdOrderCells, thirdOrderHandRatios } from '@/features/third-order/data/thirdOrderMatrix'
import type { ThirdOrderPatternSelection } from '@/features/third-order/types'
import type { ThirdOrderCell } from '@/features/third-order/data/thirdOrderMatrix'

export const useThirdOrderCellPreviews = (
  selection: Readonly<Ref<Omit<ThirdOrderPatternSelection, 'handRatio' | 'propRatio'>>>,
  width: Readonly<Ref<number>>,
  selected: Readonly<Ref<(ThirdOrderCell & { duplicate: number }) | undefined>>,
) => {
  const supported = computed(() =>
    thirdOrderCells.map((cell) => isThirdOrderSelectionSupported({ ...selection.value, ...cell })),
  )
  const activeIndexes = computed(() =>
    supported.value.flatMap((available, index) => (available ? [index] : [])),
  )
  const dimensions = reactive(thirdOrderCells.map(() => ({ width: 0, height: 0 })))
  // Retain touched indices until a full refresh so rapid selections cannot leave stale previews.
  const partialIndexes: number[] = []
  const renderer = useConceptPreviewRenderer({
    label: 'Third Order cells',
    dimensions,
    references: thirdOrderCells.map((_, index) => String(index)),
    activeIndexes,
    partialIndexes,
    createAnimation: (reference) => {
      const cell = thirdOrderCells[Number(reference)]
      const duplicate =
        cell &&
        selected.value?.handRatio === cell.handRatio &&
        selected.value?.propRatio === cell.propRatio
          ? selected.value.duplicate
          : 1
      return cell
        ? createThirdOrderPreviewAnimation({ ...selection.value, ...cell, duplicate })
        : undefined
    },
  })
  watch(
    width,
    (value) => {
      const size = Math.max(0, value / (thirdOrderHandRatios.length + 1))
      dimensions.forEach((dimension) => {
        dimension.width = size
        dimension.height = size
      })
      renderer.requestPreviews()
    },
    { immediate: true },
  )
  watch(selection, () => {
    partialIndexes.length = 0
    renderer.requestPreviews()
  })
  watch(selected, (current, previous) => {
    for (const item of [previous, current]) {
      if (!item || item.duplicate === 1) continue
      const index = thirdOrderCells.findIndex(
        (cell) => cell.handRatio === item.handRatio && cell.propRatio === item.propRatio,
      )
      if (index >= 0 && !partialIndexes.includes(index)) partialIndexes.push(index)
    }
    if (partialIndexes.length) renderer.requestPartialPreviews()
  })
  return { supported, previewUrls: renderer.previewUrls }
}
