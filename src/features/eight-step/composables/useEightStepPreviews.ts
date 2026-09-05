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

export const eightStepPreviewReferences = [
  '1-AA',
  '1-AE',
  '1-AI',
  '1-EA',
  '1-EE',
  '1-EI',
  '1-IA',
  '1-IE',
  '1-II',
] as const satisfies readonly EightStepCellReference[]

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
  const renderer = useConceptPreviewRenderer({
    dimensions,
    references: eightStepPreviewReferences,
    label: 'Eight Step',
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
  }
}
