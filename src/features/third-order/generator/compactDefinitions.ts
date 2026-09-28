import { createAnimationFromThirdOrderDefinition } from '@/features/third-order/definitionCatalog'
import type {
  ThirdOrderDefinitionCatalog,
  ThirdOrderDefinitionRecipe,
} from '@/features/third-order/definitionCatalog'
import type { GeneratedCell, GeneratedVersion } from './generateDefinitions'
import { createGeneratedThirdOrderAnimation } from './generateDefinitions'
import type { VtgIndividualSpeedRatio } from '@/features/vtg/types'

interface DefinitionSource {
  scope: {
    handRatios: readonly VtgIndividualSpeedRatio[]
    propRatios: readonly VtgIndividualSpeedRatio[]
  }
  cells: readonly GeneratedCell[]
}

export interface ThirdOrderPublicationOptions {
  /** Include forms with the full-size warped prop on the Left color. Defaults to false. */
  includeSwappedPropAssignments?: boolean
}

/** Keep the reviewed #1/#4 pair for the one four-result cell, published as Versions 1/2. */
export const getPublishedThirdOrderVersions = (
  cell: GeneratedCell,
): readonly GeneratedVersion[] => {
  if (
    cell.handRatio !== '1:1' ||
    cell.propRatio !== '1:1' ||
    cell.hand !== 'spin' ||
    cell.prop !== 'spin'
  )
    return cell.versions
  const retained = cell.versions.filter((_, index) => index === 0 || index === 3)
  if (
    cell.versions.length !== 4 ||
    retained[0]?.representative.recipe.selection.reference !== '3-3' ||
    retained[0]?.representative.recipe.thirdOrder.initial !== 180 ||
    retained[1]?.representative.recipe.selection.reference !== '1-1' ||
    retained[1]?.representative.recipe.thirdOrder.initial !== 0 ||
    retained.some(
      ({ representative: { recipe } }) =>
        recipe.timingOrder !== 'direct' || recipe.selection.swapProps,
    )
  )
    throw new Error('Review the curated 1:1 Spin / Spin versions after generator changes')
  return retained.map((version, index) => ({ ...version, version: index + 1 }))
}

/** Keep the small driver on the Left color and the full-size warped prop on the Right color.
 * Filter after both timing order and Swap: reversed + Swap still has the desired assignment.
 * Discovery evidence retains the omitted alternatives so this publication policy is reversible.
 */
export const getPublishedThirdOrderDuplicates = (
  version: GeneratedVersion,
  options: ThirdOrderPublicationOptions = {},
): readonly GeneratedVersion['representative'][] => {
  const candidates = [version.representative, ...version.equivalentCandidates].filter(
    ({ recipe }) => options.includeSwappedPropAssignments || recipe.driverIndex === 0,
  )
  if (!candidates.length)
    throw new Error('No Third Order duplicate with the published prop assignment')
  return candidates
}

/** Build interned recipes/version lists without depending on incidental generator cell order. */
export const compactThirdOrderDefinitions = (
  source: DefinitionSource,
  options: ThirdOrderPublicationOptions = {},
): ThirdOrderDefinitionCatalog => {
  const recipes: ThirdOrderDefinitionRecipe[] = []
  const duplicateSets: number[][] = []
  const duplicateSetIds = new Map<string, number>()
  const versionSets: number[][] = []
  const cells: number[] = []
  const recipeIds = new Map<string, number>()
  const setIds = new Map<string, number>()
  const sourceCells = new Map(
    source.cells.map((cell) => [
      `${cell.handRatio}/${cell.propRatio}/${cell.hand}/${cell.prop}`,
      cell,
    ]),
  )
  if (sourceCells.size !== source.cells.length) throw new Error('Duplicate Third Order cell')
  for (const handRatio of source.scope.handRatios)
    for (const propRatio of source.scope.propRatios) {
      for (const hand of ['anti', 'spin'] as const)
        for (const prop of ['anti', 'spin'] as const) {
          const cell = sourceCells.get(`${handRatio}/${propRatio}/${hand}/${prop}`)
          if (!cell)
            throw new Error(`Missing Third Order cell ${handRatio}/${propRatio}/${hand}/${prop}`)
          const versions = getPublishedThirdOrderVersions(cell).map((version, index) => {
            if (version.version !== index + 1) throw new Error('Nonsequential Third Order versions')
            const duplicates = getPublishedThirdOrderDuplicates(version, options).map(
              (candidate) => {
                const { selection, timingOrder, thirdOrder } = candidate.recipe
                const recipe: ThirdOrderDefinitionRecipe = {
                  reference: selection.reference,
                  ...(selection.isAnti ? { isAnti: true } : {}),
                  ...(selection.reversePlane ? { reversePlane: true } : {}),
                  ...(selection.swapProps ? { swapProps: true } : {}),
                  ...(timingOrder === 'reversed' ? { reversed: true } : {}),
                  adjust: thirdOrder.initial,
                  ...(selection.orientation ? { rotation: selection.orientation } : {}),
                }
                const key = JSON.stringify(recipe)
                let id = recipeIds.get(key)
                if (id === undefined) {
                  id = recipes.length
                  recipes.push(recipe)
                  recipeIds.set(key, id)
                }
                return id
              },
            )
            const key = JSON.stringify(duplicates)
            let id = duplicateSetIds.get(key)
            if (id === undefined) {
              id = duplicateSets.length
              duplicateSets.push(duplicates)
              duplicateSetIds.set(key, id)
            }
            return id
          })
          const key = JSON.stringify(versions)
          let set = setIds.get(key)
          if (set === undefined) {
            set = versionSets.length
            versionSets.push(versions)
            setIds.set(key, set)
          }
          cells.push(set)
        }
    }
  const catalog: ThirdOrderDefinitionCatalog = {
    schemaVersion: 2,
    handRatios: source.scope.handRatios,
    propRatios: source.scope.propRatios,
    recipes,
    duplicateSets,
    versionSets,
    cells,
  }
  // Fail before writing if future generator changes add information not represented by schema 2.
  // Compare complete animation data, not just visual equivalence: preserve authoring and controls.
  for (const cell of source.cells)
    for (const version of getPublishedThirdOrderVersions(cell)) {
      for (const [index, candidate] of getPublishedThirdOrderDuplicates(
        version,
        options,
      ).entries()) {
        const actual = createAnimationFromThirdOrderDefinition(catalog, {
          handRatio: cell.handRatio,
          propRatio: cell.propRatio,
          handDirection: cell.hand,
          propDirection: cell.prop,
          version: version.version,
          duplicate: index + 1,
        })
        const expected = createGeneratedThirdOrderAnimation(candidate.recipe)
        if (JSON.stringify(actual) !== JSON.stringify(expected))
          throw new Error('Compact Third Order recipe lost animation data')
      }
    }
  return catalog
}

/** Typed generated source is readable while keeping repeated data interned. */
export const serializeThirdOrderDefinitions = (catalog: ThirdOrderDefinitionCatalog): string => {
  const rows = Array.from({ length: catalog.handRatios.length }, (_, index) =>
    catalog.cells.slice(
      index * catalog.propRatios.length * 4,
      (index + 1) * catalog.propRatios.length * 4,
    ),
  )
  return `// Generated by npm run generate:third-order. Do not edit manually.
import type { ThirdOrderDefinitionCatalog } from '../definitionCatalog'

// prettier-ignore
export const thirdOrderDefinitions = {
  schemaVersion: 2,
  handRatios: ${JSON.stringify(catalog.handRatios)},
  propRatios: ${JSON.stringify(catalog.propRatios)},
  recipes: [
${catalog.recipes.map((recipe) => `    ${JSON.stringify(recipe)},`).join('\n')}
  ],
  duplicateSets: ${JSON.stringify(catalog.duplicateSets)},
  versionSets: ${JSON.stringify(catalog.versionSets)},
  // One row per top timing; each left timing contributes AA, AS, SA, SS.
  cells: [
${rows.map((row) => `    ${row.join(',')},`).join('\n')}
  ],
} as const satisfies ThirdOrderDefinitionCatalog
`
}
