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
  const recipe = getThirdOrderDefinitionRecipe(thirdOrderDefinitions, selection)
  if (!animation || !recipe) return undefined
  const inputDriver = recipe.reversed ? 1 : 0
  const driver = recipe.swapProps ? 1 - inputDriver : inputDriver
  const preview = toConceptPreviewAnimation(animation)
  // Hide the small top-timing prop after preview defaults enable paths. Keep both tracks
  // intact so the player data, timing, colors, and warped prop's identity remain unchanged.
  return {
    ...preview,
    props: preview.props.map((prop, index) =>
      index === driver
        ? { ...prop, paths: false, hands: false, arms: false, visible: false }
        : prop,
    ),
  }
}
