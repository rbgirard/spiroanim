import type { ConceptPreviewDimensions } from '@/features/concepts/composables/useConceptPreviewRenderer'
import { useConceptPreviewRenderer } from '@/features/concepts/composables/useConceptPreviewRenderer'
import { createEightStepPreviewAnimation } from '@/features/eight-step/createEightStepAnimation'
import type {
  EightStepCellReference,
  EightStepPatternSelection,
  EightStepShape,
} from '@/features/eight-step/types'
import type { PatternPropColor } from '@/features/concepts/patternPropColors'
import type { PropInd } from '@/types/AnimTypes'
import { eightStepPatternDefinitions } from '@/features/eight-step/data/eightStepPatternDefinitions'
import { getEightStepThumbnailSourceReference } from '@/features/eight-step/getEightStepThumbnailSourceReference'

interface UseEightStepPreviewsOptions {
  dimensions: readonly ConceptPreviewDimensions[]
  swapProps: Ref<boolean>
  reversePlane: Ref<boolean>
  scale: Ref<number>
  spacing: Ref<number>
  shape: Ref<EightStepShape>
  halve: Ref<boolean>
  leftPropColor: Ref<PatternPropColor>
  rightPropColor: Ref<PatternPropColor>
  prop: Ref<PropInd>
}

export const eightStepPreviewReferences = eightStepPatternDefinitions.map(
  ({ reference }) => reference,
)

export const useEightStepPreviews = ({
  dimensions,
  swapProps,
  reversePlane,
  scale,
  spacing,
  shape,
  halve,
  leftPropColor,
  rightPropColor,
  prop,
}: UseEightStepPreviewsOptions) => {
  const referenceIndexes = new Map(
    eightStepPreviewReferences.map((reference, index) => [reference, index]),
  )
  const activeIndexes = computed(() =>
    Array.from(
      new Set(
        eightStepPreviewReferences.map((reference) =>
          getEightStepThumbnailSourceReference(reference, halve.value),
        ),
      ),
    ).flatMap((reference) => {
      const index = referenceIndexes.get(reference)
      return index === undefined ? [] : [index]
    }),
  )
  const renderer = useConceptPreviewRenderer({
    dimensions,
    references: eightStepPreviewReferences,
    label: 'Eight Step',
    activeIndexes,
    createAnimation: (reference) => {
      const selection: EightStepPatternSelection = {
        concept: '8stp',
        reference,
        scale: scale.value,
        spacing: spacing.value,
        shape: shape.value,
        ...(halve.value ? { halve: true } : undefined),
        propColors: [leftPropColor.value, rightPropColor.value],
        prop: prop.value,
      }

      if (swapProps.value) selection.swapProps = true
      if (reversePlane.value) selection.reversePlane = true
      return createEightStepPreviewAnimation(selection)
    },
  })

  // BPM affects timing only; visual controls use the same fixed preview presentation as VTG/QTR.
  watch(
    [swapProps, reversePlane, scale, spacing, shape, halve, leftPropColor, rightPropColor, prop],
    renderer.requestPreviews,
  )

  return {
    previewUrls: renderer.previewUrls,
    requestPreviews: renderer.requestPreviews,
    getPreviewUrl: (reference: EightStepCellReference) => {
      const source = getEightStepThumbnailSourceReference(reference, halve.value)
      const index = referenceIndexes.get(source)
      return index === undefined ? '' : (renderer.previewUrls.value[index] ?? '')
    },
    getPreviewReference: (reference: EightStepCellReference) =>
      getEightStepThumbnailSourceReference(reference, halve.value),
  }
}
