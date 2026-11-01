import { createDefaultVtgAnimation, createVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { applyVtgThirdOrderSettings } from '@/features/vtg/thirdOrder'
import { formatVtgSpeedRatio } from '@/features/vtg/types'
import type {
  VtgCellReference,
  VtgIndividualSpeedRatio,
  VtgPatternSelection,
} from '@/features/vtg/types'
import type { ThirdOrderDirection } from '@/features/third-order/data/thirdOrderMatrix'
import type { ThirdOrderDisplaySettings } from '@/features/third-order/types'
import type { RootDataFinal } from '@/types/AnimTypes'

/** Only varying authoring controls are stored; omitted switches are false. */
export interface ThirdOrderDefinitionRecipe {
  reference: VtgCellReference
  isAnti?: true
  reversePlane?: true
  swapProps?: true
  reversed?: true
  adjust: number
  /** Global source-pattern rotation in degrees; omitted means zero. */
  rotation?: number
}

/** Schema 2 fixes scales 0.5/1, full warp strength, and Hand-owned warp direction. */
export interface ThirdOrderDefinitionCatalog {
  schemaVersion: 2
  handRatios: readonly VtgIndividualSpeedRatio[]
  propRatios: readonly VtgIndividualSpeedRatio[]
  recipes: readonly ThirdOrderDefinitionRecipe[]
  /** Recipe indices in one-based Duplicate order; the representative is always first. */
  duplicateSets: readonly (readonly number[])[]
  /** Each list contains duplicate-set indices in one-based Version order. */
  versionSets: readonly (readonly number[])[]
  /** Version-set indices, flattened by top timing, left timing, then AA/AS/SA/SS. */
  cells: readonly number[]
}

export interface ThirdOrderDefinitionRequest {
  handRatio: VtgIndividualSpeedRatio
  propRatio: VtgIndividualSpeedRatio
  handDirection: ThirdOrderDirection
  propDirection: ThirdOrderDirection
  version: number
  duplicate?: number
}

const getVersionSet = (
  catalog: ThirdOrderDefinitionCatalog,
  request: Omit<ThirdOrderDefinitionRequest, 'version'>,
): readonly number[] => {
  const hand = catalog.handRatios.indexOf(request.handRatio)
  const prop = catalog.propRatios.indexOf(request.propRatio)
  if (hand < 0 || prop < 0) return []
  const direction =
    (request.handDirection === 'anti' ? 0 : 2) + (request.propDirection === 'anti' ? 0 : 1)
  const set = catalog.cells[(hand * catalog.propRatios.length + prop) * 4 + direction]
  return set === undefined ? [] : (catalog.versionSets[set] ?? [])
}

export const getThirdOrderDefinitionVersionCount = (
  catalog: ThirdOrderDefinitionCatalog,
  request: Omit<ThirdOrderDefinitionRequest, 'version'>,
): number => getVersionSet(catalog, request).length

export const getThirdOrderDefinitionRecipe = (
  catalog: ThirdOrderDefinitionCatalog,
  request: ThirdOrderDefinitionRequest,
): ThirdOrderDefinitionRecipe | undefined => {
  const duplicate = request.duplicate ?? 1
  if (!Number.isInteger(duplicate) || duplicate < 1) return undefined
  const index = getDuplicateSet(catalog, request)[duplicate - 1]
  return index === undefined ? undefined : catalog.recipes[index]
}

const getDuplicateSet = (
  catalog: ThirdOrderDefinitionCatalog,
  request: ThirdOrderDefinitionRequest,
): readonly number[] => {
  if (!Number.isInteger(request.version) || request.version < 1) return []
  const index = getVersionSet(catalog, request)[request.version - 1]
  return index === undefined ? [] : (catalog.duplicateSets[index] ?? [])
}

export const getThirdOrderDefinitionDuplicateCount = (
  catalog: ThirdOrderDefinitionCatalog,
  request: ThirdOrderDefinitionRequest,
): number => getDuplicateSet(catalog, request).length

/** Runtime reconstruction imports no generator, signatures, reports, or URL codec. */
export const createAnimationFromThirdOrderDefinition = (
  catalog: ThirdOrderDefinitionCatalog,
  request: ThirdOrderDefinitionRequest,
  current?: RootDataFinal,
  display: ThirdOrderDisplaySettings = {},
): RootDataFinal | undefined => {
  const recipe = getThirdOrderDefinitionRecipe(catalog, request)
  if (!recipe) return undefined
  const inputDriver = recipe.reversed ? 1 : 0
  const driver = recipe.swapProps ? (inputDriver === 0 ? 1 : 0) : inputDriver
  const selection: VtgPatternSelection = {
    reference: recipe.reference,
    isAnti: recipe.isAnti === true,
    reversePlane: recipe.reversePlane === true,
    swapProps: recipe.swapProps === true,
    speedRatio: recipe.reversed
      ? formatVtgSpeedRatio(request.propRatio, request.handRatio)
      : formatVtgSpeedRatio(request.handRatio, request.propRatio),
    orientation: recipe.rotation ?? 0,
    bpm: display.bpm,
    thick: display.thick,
    spacing: display.spacing ?? 0,
    paths: display.paths,
    hands: display.hands,
    arms: display.arms,
    left: display.left,
    right: display.right,
    propColors: display.propColors,
    prop: display.prop ?? 2,
    scaleSettings: {
      auto: false,
      base: 1,
      mode: 'simple',
      values: inputDriver === 0 ? [{ '0': 0.5 }, { '0': 1 }] : [{ '0': 1 }, { '0': 0.5 }],
    },
  }
  const base = current
    ? createVtgAnimation(current, selection)
    : createDefaultVtgAnimation(selection)
  if (!base) return undefined
  const warp = {
    initial: recipe.adjust,
    timing: `${request.handRatio}-${request.handDirection === 'anti' ? 'anti' : 'pro'}` as const,
  }
  return applyVtgThirdOrderSettings(base, driver === 0 ? [{}, warp] : [warp, {}])
}
