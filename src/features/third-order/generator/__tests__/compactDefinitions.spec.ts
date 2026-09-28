import { beforeAll, describe, expect, it } from 'vitest'
import { thirdOrderDefinitions } from '@/features/third-order/data/generatedDefinitions'
import {
  createAnimationFromThirdOrderDefinition,
  getThirdOrderDefinitionRecipe,
  getThirdOrderDefinitionVersionCount,
} from '@/features/third-order/definitionCatalog'
import type { ThirdOrderDefinitionRequest } from '@/features/third-order/definitionCatalog'
import {
  compactThirdOrderDefinitions,
  getPublishedThirdOrderVersions,
  serializeThirdOrderDefinitions,
} from '../compactDefinitions'
import { generateThirdOrderDefinitions } from '../generateDefinitions'

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
    // Compaction itself checks complete animation equality for every representative.
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

  it('fails rather than dropping future generator controls that schema 1 cannot represent', () => {
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
                  selection: { ...firstVersion.representative.recipe.selection, orientation: 45 },
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
