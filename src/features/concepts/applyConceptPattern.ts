import { createEightStepAnimation } from '@/features/eight-step/createEightStepAnimation'
import { createQstAnimation } from '@/features/quarter-space-tech/createQstAnimation'
import {
  isEightStepPatternSelection,
  isQstPatternSelection,
  isQtrPatternSelection,
} from '@/features/concepts/types'
import type { ConceptPatternSelection } from '@/features/concepts/types'
import { createQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { createVtgAnimation } from '@/features/vtg/createVtgAnimation'
import type { RootDataFinal } from '@/types/AnimTypes'

export interface ApplyConceptPatternOptions {
  minimumVtgCycleCount?: 1 | 2
}

export const applyConceptPattern = (
  root: RootDataFinal,
  selection: ConceptPatternSelection,
  options: ApplyConceptPatternOptions = {},
): RootDataFinal | undefined =>
  isEightStepPatternSelection(selection)
    ? createEightStepAnimation(root, selection)
    : isQstPatternSelection(selection)
      ? createQstAnimation(root, selection)
      : isQtrPatternSelection(selection)
        ? createQtrAnimation(root, selection)
        : createVtgAnimation(root, selection, {
            minimumCycleCount: options.minimumVtgCycleCount,
          })
