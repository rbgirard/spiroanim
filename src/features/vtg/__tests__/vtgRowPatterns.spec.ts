import { describe, expect, it } from 'vitest'

import { buildVtgPattern } from '@/features/vtg/data/vtgPatternCatalog'
import { vtgSpeedRatios } from '@/features/vtg/types'
import type {
  VtgCellReference,
  VtgPatternSelection,
  VtgRuleNumber,
  VtgSpeedRatio,
} from '@/features/vtg/types'

const ruleNumbers = [1, 2, 3, 4, 5, 6] as const

const buildPattern = (reference: VtgCellReference, speedRatio: VtgSpeedRatio, isAnti = false) => {
  const selection: VtgPatternSelection = {
    reference,
    speedRatio,
    isAnti,
  }

  return buildVtgPattern(selection)
}

const createReference = (row: VtgRuleNumber, column: VtgRuleNumber): VtgCellReference =>
  `${row}-${column}`

describe('VTG row patterns', () => {
  it.each(vtgSpeedRatios)('shares each row starting frame across its %s columns', (speedRatio) => {
    for (const row of ruleNumbers) {
      const sharedStarts = buildPattern(createReference(row, 1), speedRatio)?.props.map(
        (prop) => prop.anim[0],
      )

      for (const column of ruleNumbers) {
        const pattern = buildPattern(createReference(row, column), speedRatio)
        expect(pattern).toBeDefined()
        expect(pattern?.props.map((prop) => prop.anim[0])).toEqual(sharedStarts)
      }
    }
  })

  it.each(vtgSpeedRatios)(
    'supports both variants only in the four special cells for %s',
    (speedRatio) => {
      for (const column of [5, 6] as const) {
        for (const row of [5, 6] as const) {
          const reference = createReference(column, row)
          expect(buildPattern(reference, speedRatio, true)).toBeDefined()
          expect(buildPattern(reference, speedRatio, true)).not.toEqual(
            buildPattern(reference, speedRatio, false),
          )
        }

        for (const row of [1, 2, 3, 4] as const) {
          const reference = createReference(column, row)
          expect(buildPattern(reference, speedRatio, true)).toEqual(
            buildPattern(reference, speedRatio, false),
          )
        }
      }
    },
  )

  it('restores the historical 1:1, 1:3, and 1:5 direction definitions', () => {
    expect(buildPattern('1-1', '1:1')?.props.map((prop) => prop.anim[1]?.turns ?? 0)).toEqual([
      0, 0,
    ])
    expect(buildPattern('1-1', '1:3')?.props.map((prop) => prop.anim[1]?.turns)).toEqual([
      -180, -180,
    ])
    expect(buildPattern('1-1', '1:5')?.props.map((prop) => prop.anim[1]?.turns)).toEqual([180, 180])

    expect(buildPattern('1-3', '1:1')?.props.map((prop) => prop.anim[1]?.turns)).toEqual([-90, -90])
    expect(buildPattern('1-3', '1:3')?.props.map((prop) => prop.anim[1]?.turns)).toEqual([90, 90])
    expect(buildPattern('1-3', '1:5')?.props.map((prop) => prop.anim[1]?.turns)).toEqual([
      -270, -270,
    ])
  })

  it.each([
    ['2:1', [-22.5, -22.5], [-67.5, -67.5]],
    ['2:3', [-112.5, -112.5], [22.5, 22.5]],
    ['2:5', [67.5, 67.5], [-157.5, -157.5]],
  ] as const)(
    'derives %s timing from its corresponding 1:x direction definitions',
    (speedRatio, firstCellTurns, thirdCellTurns) => {
      expect(buildPattern('1-1', speedRatio)?.props.map((prop) => prop.anim[1]?.turns)).toEqual(
        firstCellTurns,
      )
      expect(buildPattern('1-3', speedRatio)?.props.map((prop) => prop.anim[1]?.turns)).toEqual(
        thirdCellTurns,
      )
    },
  )

  it.each([
    ['1:2', [45, 45], [-135, -135]],
    ['1:4', [-225, -225], [135, 135]],
    ['2:7', [-202.5, -202.5], [112.5, 112.5]],
  ] as const)(
    'selects the denominator family definitions for %s',
    (speedRatio, firstCellTurns, thirdCellTurns) => {
      expect(buildPattern('1-1', speedRatio)?.props.map((prop) => prop.anim[1]?.turns)).toEqual(
        firstCellTurns,
      )
      expect(buildPattern('1-3', speedRatio)?.props.map((prop) => prop.anim[1]?.turns)).toEqual(
        thirdCellTurns,
      )
    },
  )

  it.each([
    ['1:2v4', [45, 135]],
    ['1:4v2', [-225, -135]],
    ['1:2v2:5', [45, 67.5]],
    ['2:5v1:4', [67.5, 135]],
    ['1:7v2:5', [-360, -157.5]],
  ] as const)(
    'uses the first prop definition family and preserves individual timing for %s',
    (speedRatio, turns) => {
      expect(buildPattern('1-1', speedRatio)?.props.map((prop) => prop.anim[1]?.turns)).toEqual(
        turns,
      )
    },
  )
})
