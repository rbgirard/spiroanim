import { toConceptPreviewAnimation } from '@/features/concepts/data/toConceptPreviewAnimation'
import type { ThirdOrderPatternSelection } from '@/features/third-order/types'
import { thirdOrderDefinitions } from '@/features/third-order/data/generatedDefinitions'
import {
  createAnimationFromThirdOrderDefinition,
  getThirdOrderDefinitionRecipe,
  type ThirdOrderDefinitionRequest,
} from '@/features/third-order/definitionCatalog'
import type { RootDataFinal } from '@/types/AnimTypes'

export const isThirdOrderSelectionSupported = (selection: ThirdOrderDefinitionRequest): boolean =>
  getThirdOrderDefinitionRecipe(thirdOrderDefinitions, selection) !== undefined

/** Player and thumbnails share the compact catalog; missing definitions have no pattern. */
export const createThirdOrderAnimation = (
  current: RootDataFinal | undefined,
  selection: ThirdOrderPatternSelection,
): RootDataFinal | undefined =>
  createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, selection, current, selection)

export const createThirdOrderPreviewAnimation = (
  selection: ThirdOrderPatternSelection,
): RootDataFinal | undefined => {
  const animation = createThirdOrderAnimation(undefined, selection)
  return animation ? toConceptPreviewAnimation(animation) : undefined
}
