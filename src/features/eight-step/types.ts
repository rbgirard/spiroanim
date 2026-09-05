import type { PropInd, PropReadable, RootDataFinal, RootReadable } from '@/types/AnimTypes'
import { patternShapes } from '@/types/PatternTypes'
import type { PatternShape } from '@/types/PatternTypes'
import type { PatternPropVisibilitySelection } from '@/features/concepts/patternPropVisibility'
import type { PatternPropSpacingSelection } from '@/features/concepts/patternPropSpacing'
import type { PatternPropColorSelection } from '@/features/concepts/patternPropColors'

export const eightStepColumns = [1, 2, 3, 4, 5, 6, 7, 8] as const
export const eightStepRows = ['AA', 'AE', 'AI', 'EA', 'EE', 'EI', 'IA', 'IE', 'II'] as const
export const eightStepPages = [1, 3, 5, 7, 9, 11, 13, 15] as const
export const eightStepFlipPages = [2, 4, 6, 8, 10, 12, 14, 16] as const
export const eightStepAllPages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const
export const eightStepShapes = patternShapes

export type EightStepColumn = (typeof eightStepColumns)[number]
export type EightStepRow = (typeof eightStepRows)[number]
export type EightStepPage = (typeof eightStepAllPages)[number]
export type EightStepSourcePage = (typeof eightStepPages)[number]
export type EightStepFlipPage = (typeof eightStepFlipPages)[number]
export type EightStepToken = 'T' | 'R' | 'B' | 'L'
export type EightStepCurveFamily = 'antispin' | 'extension' | 'inspin' | 'outspin'
export type EightStepShape = PatternShape

/** Eight Step references use the top-header number first and the left-header code second. */
export type EightStepCellReference = `${EightStepColumn}-${EightStepRow}`

export interface EightStepPatternSelection
  extends PatternPropVisibilitySelection, PatternPropSpacingSelection, PatternPropColorSelection {
  concept: '8stp'
  reference: EightStepCellReference
  swapProps?: boolean
  reversePlane?: boolean
  shape?: EightStepShape
  halve?: boolean
  bpm?: number
  scale?: number
  propRotationOffsets?: readonly [number, number]
  thick?: number
  paths?: boolean
  hands?: boolean
  arms?: boolean
  prop?: PropInd
}

export interface EightStepPatternMatch {
  reference: EightStepCellReference
  swapProps: boolean
  reversePlane: boolean
  shape: EightStepShape
  halve?: boolean
  bpm: number
  scale: number
  propRotationOffsets?: readonly [number, number]
}

export type EightStepReadableAnimation = Partial<
  Omit<RootReadable, 'props'> & Pick<RootDataFinal, 'speed' | 'type' | 'turns' | 'depth'>
> & {
  props: PropReadable[]
}

export interface EightStepPatternDefinition {
  column: EightStepColumn
  page: EightStepSourcePage
  row: EightStepRow
  reference: EightStepCellReference
  props: readonly [PropReadable, PropReadable]
}
