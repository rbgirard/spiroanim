import type { EightStepPatternSelection } from '@/features/eight-step/types'
import type { QstPatternSelection } from '@/features/quarter-space-tech/types'
import type { QtrPatternSelection, VtgPatternSelection } from '@/features/vtg/types'

export const conceptKeys = ['vtg', '8stp', 'qst', 'tka'] as const

export type ConceptKey = (typeof conceptKeys)[number]
export type ConceptPatternSelection =
  | VtgPatternSelection
  | QtrPatternSelection
  | EightStepPatternSelection
  | QstPatternSelection

export const isVtgPatternSelection = (
  selection: ConceptPatternSelection,
): selection is VtgPatternSelection => !('quarters' in selection) && !('concept' in selection)

export const isQtrPatternSelection = (
  selection: ConceptPatternSelection,
): selection is QtrPatternSelection => 'quarters' in selection

export const isEightStepPatternSelection = (
  selection: ConceptPatternSelection,
): selection is EightStepPatternSelection => 'concept' in selection && selection.concept === '8stp'

export const isQstPatternSelection = (
  selection: ConceptPatternSelection,
): selection is QstPatternSelection => 'concept' in selection && selection.concept === 'qst'
