import { toConceptPreviewAnimation } from '@/features/concepts/data/toConceptPreviewAnimation'
import type { ThirdOrderPatternSelection } from '@/features/third-order/types'
import { createDefaultVtgAnimation, createVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { getVtgDefinitionSpeedRatio } from '@/features/vtg/data/patterns/rows'
import { applyVtgThirdOrderSettings } from '@/features/vtg/thirdOrder'
import { formatVtgSpeedRatio, type VtgPatternSelection } from '@/features/vtg/types'
import type { RootDataFinal } from '@/types/AnimTypes'

export const isThirdOrderSelectionSupported = (
  selection: Pick<ThirdOrderPatternSelection, 'handDirection' | 'propDirection'>,
): boolean => selection.handDirection === 'anti' && selection.propDirection === 'anti'

const createBaseSelection = (selection: ThirdOrderPatternSelection): VtgPatternSelection => ({
  reference:
    selection.version === 1
      ? '5-5'
      : getVtgDefinitionSpeedRatio(selection.handRatio) === '1:3'
        ? '3-3'
        : '1-3',
  isAnti: true,
  speedRatio: formatVtgSpeedRatio(selection.handRatio, selection.propRatio),
  orientation: selection.version === 1 || selection.handRatio === '1:4' ? 90 : -90,
  scaleSettings: { auto: false, base: 1, mode: 'simple', values: [{ '0': 0.5 }, { '0': 1 }] },
  bpm: selection.bpm,
  thick: selection.thick,
  spacing: selection.spacing,
  paths: selection.paths,
  hands: selection.hands,
  arms: selection.arms,
  left: selection.left,
  right: selection.right,
  propColors: selection.propColors,
  prop: selection.prop,
})

/** Shared generation for the player and thumbnails; unsupported direction pairs have no pattern. */
export const createThirdOrderAnimation = (
  current: RootDataFinal | undefined,
  selection: ThirdOrderPatternSelection,
): RootDataFinal | undefined => {
  if (!isThirdOrderSelectionSupported(selection)) return undefined
  const baseSelection = createBaseSelection(selection)
  const animation = current
    ? createVtgAnimation(current, baseSelection)
    : createDefaultVtgAnimation(baseSelection)
  if (!animation) return undefined

  // Adjust is explicit and independent of the continuing timing, so later definitions can
  // choose a different initial warp without changing how the timing is calculated.
  return applyVtgThirdOrderSettings(animation, [
    {},
    {
      initial:
        selection.version === 2 && getVtgDefinitionSpeedRatio(selection.handRatio) === '1:3'
          ? 180
          : 0,
      timing: `${selection.handRatio}-anti`,
    },
  ])
}

export const createThirdOrderPreviewAnimation = (
  selection: ThirdOrderPatternSelection,
): RootDataFinal | undefined => {
  const animation = createThirdOrderAnimation(undefined, selection)
  return animation ? toConceptPreviewAnimation(animation) : undefined
}
