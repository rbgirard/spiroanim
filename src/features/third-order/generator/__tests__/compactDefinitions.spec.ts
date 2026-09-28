import { beforeAll, describe, expect, it } from 'vitest'
import { thirdOrderDefinitions } from '@/features/third-order/data/generatedDefinitions'
import { createThirdOrderHeaderAnimation } from '@/features/third-order/createThirdOrderHeaderAnimation'
import {
  createAnimationFromThirdOrderDefinition,
  getThirdOrderDefinitionRecipe,
  getThirdOrderDefinitionVersionCount,
  getThirdOrderDefinitionDuplicateCount,
} from '@/features/third-order/definitionCatalog'
import type { ThirdOrderDefinitionRequest } from '@/features/third-order/definitionCatalog'
import {
  compactThirdOrderDefinitions,
  getPublishedThirdOrderVersions,
  getPublishedThirdOrderDuplicates,
  serializeThirdOrderDefinitions,
} from '../compactDefinitions'
import { generateThirdOrderDefinitions } from '../generateDefinitions'
import { getThirdOrderHeaderAlignment } from '../alignToHeader'
import {
  combineSignals,
  extractPlanarPattern,
  rotatePlanarTerm,
  scaleSignal,
  signalErrorBound,
} from '../planarPattern'

const request: ThirdOrderDefinitionRequest = {
  handRatio: '1:2',
  propRatio: '2:5',
  handDirection: 'anti',
  propDirection: 'spin',
  version: 1,
}

describe('compact Third Order definitions', () => {
  let source: Awaited<ReturnType<typeof generateThirdOrderDefinitions>>
  beforeAll(async () => {
    source = await generateThirdOrderDefinitions()
  })

  it('reconstructs every complete animation and reproduces the checked-in compact catalog', () => {
    // Compaction itself checks complete animation equality for every duplicate, including D: 1.
    const compact = compactThirdOrderDefinitions(source)
    expect(compact).toEqual(thirdOrderDefinitions)
    let total = 0
    for (const cell of source.cells) {
      const count = getThirdOrderDefinitionVersionCount(compact, {
        handRatio: cell.handRatio,
        propRatio: cell.propRatio,
        handDirection: cell.hand,
        propDirection: cell.prop,
      })
      expect(count).toBe(getPublishedThirdOrderVersions(cell).length)
      expect(count).toBe(2)
      total += count
      for (const version of getPublishedThirdOrderVersions(cell)) {
        expect(
          getThirdOrderDefinitionDuplicateCount(compact, {
            handRatio: cell.handRatio,
            propRatio: cell.propRatio,
            handDirection: cell.hand,
            propDirection: cell.prop,
            version: version.version,
          }),
        ).toBe(getPublishedThirdOrderDuplicates(version).length)
        expect(getPublishedThirdOrderDuplicates(version)[0]).toBe(version.representative)
      }
    }
    expect(total).toBe(1088)
    expect(serializeThirdOrderDefinitions(compact)).toBe(
      serializeThirdOrderDefinitions(compactThirdOrderDefinitions(source)),
    )
  })

  it('publishes reviewed Spin / Spin versions 1 and 4 as versions 1 and 2', () => {
    const cell = source.cells.find(
      (cell) =>
        cell.handRatio === '1:1' &&
        cell.propRatio === '1:1' &&
        cell.hand === 'spin' &&
        cell.prop === 'spin',
    )!
    expect(cell.versions).toHaveLength(4)
    const published = getPublishedThirdOrderVersions(cell)
    expect(published.map((version) => version.representative)).toEqual([
      cell.versions[0]!.representative,
      cell.versions[3]!.representative,
    ])
    expect(published.map((version) => version.version)).toEqual([1, 2])
    expect(
      published.map(({ representative: { recipe } }) => ({
        reference: recipe.selection.reference,
        adjust: recipe.thirdOrder.initial,
        timingOrder: recipe.timingOrder,
      })),
    ).toEqual([
      { reference: '3-3', adjust: 180, timingOrder: 'direct' },
      { reference: '1-1', adjust: 0, timingOrder: 'direct' },
    ])
    expect(
      getThirdOrderDefinitionVersionCount(thirdOrderDefinitions, {
        handRatio: '1:1',
        propRatio: '1:1',
        handDirection: 'spin',
        propDirection: 'spin',
      }),
    ).toBe(2)
    expect(getThirdOrderDefinitionVersionCount(thirdOrderDefinitions, request)).toBe(2)
  })

  it('aligns every published top-prop outline while preserving hand-to-head alignment', () => {
    for (const cell of source.cells)
      for (const version of getPublishedThirdOrderVersions(cell)) {
        for (const [index, candidate] of getPublishedThirdOrderDuplicates(version).entries()) {
          const animation = createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, {
            handRatio: cell.handRatio,
            propRatio: cell.propRatio,
            handDirection: cell.hand,
            propDirection: cell.prop,
            version: version.version,
            duplicate: index + 1,
          })!
          const { driverIndex, followerIndex } = candidate.recipe
          expect(driverIndex).toBe(0)
          expect(followerIndex).toBe(1)
          const alignment = getThirdOrderHeaderAlignment(
            animation,
            driverIndex,
            cell.handRatio,
            cell.hand,
          )
          expect(Math.abs(alignment.rotation)).toBeLessThan(1e-7)
          const pattern = extractPlanarPattern(animation)
          const outlineErrors: number[] = []
          if (!alignment.circular) {
            const header = createThirdOrderHeaderAnimation({
              ratio: cell.handRatio,
              direction: cell.hand,
              scale: 0.5,
              color: 'Cyan',
              prop: 2,
            })
            const target = extractPlanarPattern({
              ...header,
              props: [header.props[0]!, header.props[0]!],
            })
            // Compare continuous coefficients after phase/traversal normalization, with no
            // further rotation. Both the hand orbit and head direction must match the header.
            for (const channel of [0, 1]) {
              const normalized = pattern[driverIndex * 2 + channel]!.map((term) => {
                const frequency = term.frequency * alignment.timeScale
                return rotatePlanarTerm({ ...term, frequency }, frequency * alignment.phase)
              })
              outlineErrors.push(signalErrorBound(normalized, target[channel]!))
            }
          }
          expect(outlineErrors.every((error) => error < 1e-7)).toBe(true)
          expect(
            signalErrorBound(
              combineSignals(
                pattern[driverIndex * 2]!,
                scaleSignal(pattern[driverIndex * 2 + 1]!, 0.5),
              ),
              pattern[followerIndex * 2]!,
            ),
          ).toBeLessThan(1e-7)
        }
      }
  })

  it('rotates the Spin / Spin v1 2:1 top shape to the header and leaves circles unchanged', () => {
    expect(
      getThirdOrderDefinitionRecipe(thirdOrderDefinitions, {
        handRatio: '2:1',
        propRatio: '1:1',
        handDirection: 'spin',
        propDirection: 'spin',
        version: 1,
      })?.rotation,
    ).toBe(90)
    for (const version of [1, 2])
      expect(
        getThirdOrderDefinitionRecipe(thirdOrderDefinitions, {
          handRatio: '1:1',
          propRatio: '1:1',
          handDirection: 'spin',
          propDirection: 'spin',
          version,
        })?.rotation,
      ).toBeUndefined()
  })

  it.each([0, -1, 1.5, 5])('returns no definition for unavailable duplicate %s', (duplicate) => {
    expect(
      getThirdOrderDefinitionRecipe(thirdOrderDefinitions, { ...request, duplicate }),
    ).toBeUndefined()
    expect(
      createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, { ...request, duplicate }),
    ).toBeUndefined()
  })

  it('defaults to the original representative and retains all alternate authoring controls', () => {
    const first = getThirdOrderDefinitionRecipe(thirdOrderDefinitions, request)
    expect(
      getThirdOrderDefinitionRecipe(thirdOrderDefinitions, { ...request, duplicate: 1 }),
    ).toEqual(first)
    const count = getThirdOrderDefinitionDuplicateCount(thirdOrderDefinitions, request)
    expect(count).toBe(4)
    const recipes = Array.from({ length: count }, (_, index) =>
      getThirdOrderDefinitionRecipe(thirdOrderDefinitions, { ...request, duplicate: index + 1 }),
    )
    expect(new Set(recipes.map((recipe) => JSON.stringify(recipe))).size).toBe(count)
    expect(recipes.some((recipe) => recipe?.swapProps)).toBe(true)
    expect(recipes.some((recipe) => recipe?.reversed)).toBe(true)
  })

  it('omits original duplicates 3-6 from 1:1 / 1:1 Anti / Anti V1 without deleting evidence', () => {
    const cell = source.cells.find(
      (cell) =>
        cell.handRatio === '1:1' &&
        cell.propRatio === '1:1' &&
        cell.hand === 'anti' &&
        cell.prop === 'anti',
    )!
    const version = cell.versions[0]!
    const all = [version.representative, ...version.equivalentCandidates]
    expect(all).toHaveLength(8)
    expect(getPublishedThirdOrderDuplicates(version)).toEqual([all[0], all[1], all[6], all[7]])
    expect(version.equivalentCandidates).toHaveLength(7)
    expect(
      getPublishedThirdOrderDuplicates(version, { includeSwappedPropAssignments: true }),
    ).toEqual(all)
    expect(
      getThirdOrderDefinitionDuplicateCount(thirdOrderDefinitions, {
        ...request,
        handRatio: '1:1',
        propRatio: '1:1',
        propDirection: 'anti',
      }),
    ).toBe(4)
    expect(() =>
      getPublishedThirdOrderDuplicates({
        ...version,
        representative: all[2]!,
        equivalentCandidates: [all[3]!],
      }),
    ).toThrow('published prop assignment')
  })

  it('can restore every equivalent candidate through the publication option', () => {
    const restored = compactThirdOrderDefinitions(source, { includeSwappedPropAssignments: true })
    for (const cell of source.cells)
      for (const version of getPublishedThirdOrderVersions(cell)) {
        expect(
          getThirdOrderDefinitionDuplicateCount(restored, {
            handRatio: cell.handRatio,
            propRatio: cell.propRatio,
            handDirection: cell.hand,
            propDirection: cell.prop,
            version: version.version,
          }),
        ).toBe(1 + version.equivalentCandidates.length)
      }
  })

  it.each([0, -1, 1.5, 3])('returns no definition for unavailable version %s', (version) => {
    expect(
      getThirdOrderDefinitionRecipe(thirdOrderDefinitions, { ...request, version }),
    ).toBeUndefined()
    expect(
      createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, { ...request, version }),
    ).toBeUndefined()
  })

  it('handles unknown timings and empty version lists', () => {
    expect(
      getThirdOrderDefinitionVersionCount(thirdOrderDefinitions, { ...request, handRatio: '1:99' }),
    ).toBe(0)
    expect(
      createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, {
        ...request,
        propRatio: '1:99',
      }),
    ).toBeUndefined()
    const empty = {
      ...thirdOrderDefinitions,
      versionSets: thirdOrderDefinitions.versionSets.map(() => []),
    }
    expect(getThirdOrderDefinitionVersionCount(empty, request)).toBe(0)
    expect(createAnimationFromThirdOrderDefinition(empty, request)).toBeUndefined()
  })

  it('preserves playback speed without mutating the supplied animation', () => {
    const current = createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, request)!
    current.speed = 1.25
    const before = structuredClone(current)
    expect(
      createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, request, current)?.speed,
    ).toBe(1.25)
    expect(current).toEqual(before)
  })

  it('fails rather than dropping future generator controls that schema 2 cannot represent', () => {
    const firstCell = source.cells[0]!
    const firstVersion = firstCell.versions[0]!
    const changed = {
      ...source,
      cells: [
        {
          ...firstCell,
          versions: [
            {
              ...firstVersion,
              representative: {
                ...firstVersion.representative,
                recipe: {
                  ...firstVersion.representative.recipe,
                  selection: { ...firstVersion.representative.recipe.selection, bpm: 80 },
                },
              },
            },
            ...firstCell.versions.slice(1),
          ],
        },
        ...source.cells.slice(1),
      ],
    }
    expect(() => compactThirdOrderDefinitions(changed)).toThrow('lost animation data')
  })

  it('rejects missing and duplicate cells', () => {
    expect(() => compactThirdOrderDefinitions({ ...source, cells: source.cells.slice(1) })).toThrow(
      'Missing Third Order cell',
    )
    expect(() =>
      compactThirdOrderDefinitions({ ...source, cells: [...source.cells, source.cells[0]!] }),
    ).toThrow('Duplicate Third Order cell')
  })
})
