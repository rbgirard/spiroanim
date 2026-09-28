import { useConceptPreviewRenderer } from '@/features/concepts/composables/useConceptPreviewRenderer'
import {
  createThirdOrderPreviewAnimation,
  isThirdOrderSelectionSupported,
} from '@/features/third-order/createThirdOrderAnimation'
import { thirdOrderCells, thirdOrderHandRatios } from '@/features/third-order/data/thirdOrderMatrix'
import type { ThirdOrderPatternSelection } from '@/features/third-order/types'

export const useThirdOrderCellPreviews = (
  selection: Readonly<Ref<Omit<ThirdOrderPatternSelection, 'handRatio' | 'propRatio'>>>,
  width: Readonly<Ref<number>>,
) => {
  const supported = computed(() =>
    thirdOrderCells.map((cell) => isThirdOrderSelectionSupported({ ...selection.value, ...cell })),
  )
  const activeIndexes = computed(() =>
    supported.value.flatMap((available, index) => (available ? [index] : [])),
  )
  const dimensions = reactive(thirdOrderCells.map(() => ({ width: 0, height: 0 })))
  const renderer = useConceptPreviewRenderer({
    label: 'Third Order cells',
    dimensions,
    references: thirdOrderCells.map((_, index) => String(index)),
    activeIndexes,
    createAnimation: (reference) => {
      const cell = thirdOrderCells[Number(reference)]
      return cell ? createThirdOrderPreviewAnimation({ ...selection.value, ...cell }) : undefined
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
  watch(selection, renderer.requestPreviews)
  return { supported, previewUrls: renderer.previewUrls }
}
