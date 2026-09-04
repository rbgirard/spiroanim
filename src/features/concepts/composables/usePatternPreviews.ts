import {
  useConceptPreviewRenderer,
  type ConceptPreviewDimensions,
} from '@/features/concepts/composables/useConceptPreviewRenderer'
import { createQtrPreviewAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import type { QtrMode, QtrPatternSelection } from '@/features/vtg/types'
import { createVtgPreviewAnimation } from '@/features/vtg/createVtgAnimation'
import type {
  VtgBeat,
  VtgCellReference,
  VtgPatternSelection,
  VtgSpeedRatio,
  VtgPatternOrientation,
  VtgTransitionInitialTurnsOffset,
} from '@/features/vtg/types'
import type { PatternPropColor } from '@/features/concepts/patternPropColors'
import type { PropInd, RootDataFinal } from '@/types/AnimTypes'

interface UseVtgPreviewsOptions {
  dimensions: readonly ConceptPreviewDimensions[]
  speedRatio: Ref<VtgSpeedRatio>
  isAnti: Ref<boolean>
  swapProps: Ref<boolean>
  reversePlane: Ref<boolean>
  beat: Ref<VtgBeat>
  scale: Ref<number>
  spacing: Ref<number>
  hands: Ref<boolean>
  quarters: Ref<QtrMode | false>
  leftPropColor: Ref<PatternPropColor>
  rightPropColor: Ref<PatternPropColor>
  prop: Ref<PropInd>
  orientation: Ref<VtgPatternOrientation>
  propRotationOffsets: Ref<readonly [number, number] | undefined>
  initialTurnsOffset: Ref<VtgTransitionInitialTurnsOffset | undefined>
  initialTurnsOffsetBeat: Ref<VtgBeat | undefined>
  activeReferences: Readonly<Ref<readonly VtgCellReference[]>>
  active?: Readonly<Ref<boolean>>
  previewContext?: Readonly<Ref<unknown>>
  createVtgPreview?: (
    selection: VtgPatternSelection | QtrPatternSelection,
  ) => RootDataFinal | undefined
}

export const pairedPatternPreviewReferences = [1, 2, 3, 4, 5, 6].flatMap((row) =>
  [1, 3, 5].map((column) => `${row}-${column}` as VtgCellReference),
)

export const patternPreviewReferences = pairedPatternPreviewReferences.filter((reference) => {
  const row = Number(reference.split('-')[0])
  return row % 2 === 1
})

export const builderPatternPreviewReferences = [
  '1-1',
  '1-3',
  '6-1',
  '6-3',
] as const satisfies readonly VtgCellReference[]

const spinToggleCells: ReadonlySet<VtgCellReference> = new Set(['5-6', '6-6', '5-5', '6-5'])
const spinPreviewIndexes = pairedPatternPreviewReferences.flatMap((reference, index) =>
  spinToggleCells.has(reference) ? [index] : [],
)

export const usePatternPreviews = ({
  dimensions,
  speedRatio,
  isAnti,
  swapProps,
  reversePlane,
  beat,
  scale,
  spacing,
  hands,
  quarters,
  leftPropColor,
  rightPropColor,
  prop,
  orientation,
  propRotationOffsets,
  initialTurnsOffset,
  initialTurnsOffsetBeat,
  activeReferences,
  active,
  previewContext,
  createVtgPreview,
}: UseVtgPreviewsOptions) => {
  const activePreviewIndexes = computed(() => {
    return activeReferences.value.map((reference) =>
      pairedPatternPreviewReferences.indexOf(reference),
    )
  })

  const buildSelection = (
    reference: VtgCellReference,
  ): VtgPatternSelection | QtrPatternSelection => {
    const selection: VtgPatternSelection = {
      reference,
      speedRatio: speedRatio.value,
      scale: scale.value,
      spacing: spacing.value,
      propColors: [leftPropColor.value, rightPropColor.value],
      prop: prop.value,
      hands: hands.value,
    }

    if (spinToggleCells.has(reference)) selection.isAnti = isAnti.value
    if (swapProps.value) selection.swapProps = true
    if (reversePlane.value) selection.reversePlane = true
    if (beat.value !== 1) selection.beat = beat.value
    if (initialTurnsOffset.value !== undefined) {
      selection.initialTurnsOffset = initialTurnsOffset.value
      selection.initialTurnsOffsetBeat = initialTurnsOffsetBeat.value
    }
    if (orientation.value !== 0) {
      selection.orientation = orientation.value
    }
    if (propRotationOffsets.value !== undefined) {
      selection.propRotationOffsets = propRotationOffsets.value
    }
    return quarters.value ? { ...selection, quarters: quarters.value } : selection
  }

  const renderer = useConceptPreviewRenderer({
    dimensions,
    references: pairedPatternPreviewReferences,
    label: 'VTG',
    partialIndexes: spinPreviewIndexes,
    activeIndexes: activePreviewIndexes,
    active,
    createAnimation: (reference) => {
      const selection = buildSelection(reference)
      if (createVtgPreview) return createVtgPreview(selection)
      return 'quarters' in selection
        ? createQtrPreviewAnimation(selection)
        : createVtgPreviewAnimation(selection)
    },
  })

  // BPM changes animation timing only, so it intentionally does not invalidate still previews.
  watch(
    [
      speedRatio,
      swapProps,
      reversePlane,
      beat,
      scale,
      spacing,
      hands,
      quarters,
      leftPropColor,
      rightPropColor,
      prop,
      orientation,
      propRotationOffsets,
      initialTurnsOffset,
      initialTurnsOffsetBeat,
      activeReferences,
      ...(previewContext === undefined ? [] : [previewContext]),
    ],
    renderer.requestPreviews,
  )
  watch(isAnti, renderer.requestPartialPreviews)

  return {
    previewUrls: renderer.previewUrls,
    requestPreviews: renderer.requestPreviews,
  }
}
