import { createEightStepAnimation } from '@/features/eight-step/createEightStepAnimation'
import { createQstAnimation } from '@/features/quarter-space-tech/createQstAnimation'
import { createThirdOrderAnimation } from '@/features/third-order/createThirdOrderAnimation'
import {
  isEightStepPatternSelection,
  isQstPatternSelection,
  isQtrPatternSelection,
  isThirdOrderPatternSelection,
} from '@/features/concepts/types'
import type { ConceptPatternSelection } from '@/features/concepts/types'
import { createQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { createVtgAnimation } from '@/features/vtg/createVtgAnimation'
import type { RootDataFinal } from '@/types/AnimTypes'
import type { VtgPropertySettings } from '@/features/vtg/propertySettings'

export interface ApplyConceptPatternOptions {
  minimumVtgCycleCount?: 1 | 2
  vtgProperties?: VtgPropertySettings
}

export const applyConceptPattern = (
  root: RootDataFinal,
  selection: ConceptPatternSelection,
  options: ApplyConceptPatternOptions = {},
): RootDataFinal | undefined =>
  isThirdOrderPatternSelection(selection)
    ? createThirdOrderAnimation(root, selection)
    : isEightStepPatternSelection(selection)
      ? createEightStepAnimation(root, selection)
      : isQstPatternSelection(selection)
        ? createQstAnimation(root, selection)
        : isQtrPatternSelection(selection)
          ? createQtrAnimation(root, selection, {
              minimumCycleCount: options.minimumVtgCycleCount,
              properties: options.vtgProperties,
            })
          : createVtgAnimation(root, selection, {
              minimumCycleCount: options.minimumVtgCycleCount,
              properties: options.vtgProperties,
            })
