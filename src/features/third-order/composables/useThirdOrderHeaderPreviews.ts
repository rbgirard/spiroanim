import { useConceptPreviewRenderer } from '@/features/concepts/composables/useConceptPreviewRenderer'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { createThirdOrderHeaderAnimation } from '@/features/third-order/createThirdOrderHeaderAnimation'
import {
  thirdOrderHandRatios,
  thirdOrderPropRatios,
  type ThirdOrderDirection,
} from '@/features/third-order/data/thirdOrderMatrix'

export const useThirdOrderHeaderPreviews = (
  handDirection: Ref<ThirdOrderDirection>,
  propDirection: Ref<ThirdOrderDirection>,
  width: Readonly<Ref<number>>,
) => {
  const { leftPropColor, rightPropColor, prop } = storeToRefs(useConceptsStore())
  const headers = [
    ...thirdOrderHandRatios.map((ratio) => ({ axis: 'hand' as const, ratio, scale: 0.5 as const })),
    ...thirdOrderPropRatios.map((ratio) => ({ axis: 'prop' as const, ratio, scale: 1 as const })),
  ]
  const dimensions = reactive(headers.map(() => ({ width: 0, height: 0 })))
  const renderer = useConceptPreviewRenderer({
    label: 'Third Order headers',
    dimensions,
    references: headers.map((_, index) => String(index)),
    createAnimation: (reference) => {
      const header = headers[Number(reference)]
      if (!header) return undefined
      const hand = header.axis === 'hand'
      return createThirdOrderHeaderAnimation({
        ratio: header.ratio,
        scale: header.scale,
        direction: hand ? handDirection.value : propDirection.value,
        color: hand ? leftPropColor.value : rightPropColor.value,
        prop: prop.value,
      })
    },
  })

  watch(
    width,
    (value) => {
      const size = Math.max(0, value / 9)
      dimensions.forEach((dimension) => {
        dimension.width = size
        dimension.height = size
      })
      renderer.requestPreviews()
    },
    { immediate: true },
  )
  watch(
    [handDirection, propDirection, leftPropColor, rightPropColor, prop],
    renderer.requestPreviews,
  )

  return { previewUrls: renderer.previewUrls }
}
