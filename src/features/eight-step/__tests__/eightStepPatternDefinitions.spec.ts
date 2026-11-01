import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { PNTIND, PPOS } from '@/domain/animation/AnimStruct'
import {
  createDefaultEightStepAnimation,
  eightStepPlaybackMultiplier,
} from '@/features/eight-step/createEightStepAnimation'
import {
  eightStepHandpathsByPage,
  eightStepPatternDefinitions,
} from '@/features/eight-step/data/eightStepPatternDefinitions'
import { eightStepColumns, eightStepPages, eightStepRows } from '@/features/eight-step/types'
import type { EightStepToken } from '@/features/eight-step/types'
import { rootCompile } from '@/math/animation/AnimFunc'

const tokenPoints: Readonly<Record<EightStepToken, Vector3>> = {
  T: PPOS[PNTIND.MTC]!,
  R: PPOS[PNTIND.MR]!,
  B: PPOS[PNTIND.MBC]!,
  L: PPOS[PNTIND.ML]!,
}

const flippedHandpaths = {
  2: {
    green: ['T', 'L', 'B', 'L', 'B', 'R', 'B', 'R', 'T', 'R', 'T', 'L'],
    orange: ['B', 'L', 'T', 'R', 'B', 'L', 'T', 'R', 'B', 'L', 'T', 'R'],
  },
  4: {
    green: ['B', 'L', 'T', 'L', 'T', 'R', 'T', 'R', 'B', 'R', 'B', 'L'],
    orange: ['B', 'R', 'T', 'L', 'B', 'R', 'T', 'L', 'B', 'R', 'T', 'L'],
  },
  6: {
    green: ['B', 'L', 'T', 'L', 'T', 'R', 'T', 'R', 'B', 'R', 'B', 'L'],
    orange: ['B', 'L', 'T', 'R', 'B', 'L', 'T', 'R', 'B', 'L', 'T', 'R'],
  },
  8: {
    green: ['T', 'L', 'B', 'L', 'B', 'R', 'B', 'R', 'T', 'R', 'T', 'L'],
    orange: ['B', 'R', 'T', 'L', 'B', 'R', 'T', 'L', 'B', 'R', 'T', 'L'],
  },
  16: {
    green: ['L', 'T', 'R', 'T', 'R', 'B', 'R', 'B', 'L', 'B', 'L', 'T'],
    orange: ['B', 'R', 'T', 'L', 'B', 'R', 'T', 'L', 'B', 'R', 'T', 'L'],
  },
  14: {
    green: ['R', 'B', 'L', 'B', 'L', 'T', 'L', 'T', 'R', 'T', 'R', 'B'],
    orange: ['B', 'R', 'T', 'L', 'B', 'R', 'T', 'L', 'B', 'R', 'T', 'L'],
  },
  12: {
    green: ['L', 'B', 'R', 'B', 'R', 'T', 'R', 'T', 'L', 'T', 'L', 'B'],
    orange: ['B', 'R', 'T', 'L', 'B', 'R', 'T', 'L', 'B', 'R', 'T', 'L'],
  },
  10: {
    green: ['R', 'T', 'L', 'T', 'L', 'B', 'L', 'B', 'R', 'B', 'R', 'T'],
    orange: ['B', 'R', 'T', 'L', 'B', 'R', 'T', 'L', 'B', 'R', 'T', 'L'],
  },
} as const satisfies Readonly<
  Record<number, { green: readonly EightStepToken[]; orange: readonly EightStepToken[] }>
>

const flippedPageBySource = {
  1: 2,
  3: 4,
  5: 6,
  7: 8,
  9: 10,
  11: 12,
  13: 14,
  15: 16,
} as const

const expectVector = (actual: readonly number[], expected: Vector3, context = 'vector') => {
  expect(actual[0], `${context} x`).toBeCloseTo(expected.x, 7)
  expect(actual[1], `${context} y`).toBeCloseTo(expected.y, 7)
  expect(actual[2], `${context} z`).toBeCloseTo(expected.z, 7)
}

describe('eightStepPatternDefinitions', () => {
  it('provides one independently owned 13-frame definition for every matrix cell', () => {
    expect(eightStepPatternDefinitions).toHaveLength(eightStepColumns.length * eightStepRows.length)
    expect(new Set(eightStepPatternDefinitions.map(({ reference }) => reference)).size).toBe(72)
    expect(new Set(eightStepPatternDefinitions.map(({ props }) => props)).size).toBe(72)
    expect(new Set(eightStepPatternDefinitions.flatMap(({ props }) => props)).size).toBe(144)

    const animations = eightStepPatternDefinitions.flatMap(({ props }) =>
      props.map(({ anim }) => anim),
    )
    expect(new Set(animations).size).toBe(144)
    expect(animations.every((anim) => anim.length === 13)).toBe(true)
    expect(new Set(animations.flat()).size).toBe(72 * 2 * 13)
  })

  it('maps columns to the corrected source pages', () => {
    expect(
      eightStepPatternDefinitions.slice(0, 8).map(({ reference, page }) => [reference, page]),
    ).toEqual([
      ['1-AA', 1],
      ['2-AA', 3],
      ['3-AA', 5],
      ['4-AA', 7],
      ['5-AA', 9],
      ['6-AA', 11],
      ['7-AA', 13],
      ['8-AA', 15],
    ])
    expect(eightStepPatternDefinitions.at(-1)?.reference).toBe('8-II')
  })

  it("stores Gage's corrected second-half page order with each opposite beside its source", () => {
    const mirrorToken = (token: EightStepToken): EightStepToken => {
      if (token === 'L') return 'R'
      if (token === 'R') return 'L'
      return token
    }

    for (const sourcePage of eightStepPages) {
      const source = eightStepHandpathsByPage[sourcePage]
      const flipped = eightStepHandpathsByPage[flippedPageBySource[sourcePage]]

      expect(flipped.green).toEqual(source.green.map(mirrorToken))
      expect(flipped.orange).toEqual(source.orange.map(mirrorToken))
    }
  })

  it('assigns the supplied capping and continual curve-family turn sequences', () => {
    const turns = (
      reference: (typeof eightStepPatternDefinitions)[number]['reference'],
      propIndex: 0 | 1,
    ) => {
      const animation = createDefaultEightStepAnimation({
        concept: '8stp',
        reference,
        swapProps: true,
      })
      if (!animation) return undefined
      const frames = rootCompile(animation).props[propIndex]!.anim
      return Array.from({ length: 3 }, (_, stepIndex) =>
        frames
          .slice(
            stepIndex * eightStepPlaybackMultiplier + 1,
            (stepIndex + 1) * eightStepPlaybackMultiplier + 1,
          )
          .reduce((total, frame) => total + frame.turns, 0),
      )
    }

    expect(turns('1-AA', 0)).toEqual([-360, -360, 0])
    expect(turns('1-AA', 1)).toEqual([-360, -360, -360])
    expect(turns('1-AE', 1)).toEqual([0, 0, 0])
    expect(turns('1-AI', 1)).toEqual([180, 180, 0])
    expect(turns('1-EA', 0)).toEqual([0, 0, -360])
    expect(turns('1-IA', 0)).toEqual([180, 180, -360])
  })

  it('stores sparse frames without changing each cell compiled geometry', () => {
    for (const definition of eightStepPatternDefinitions) {
      for (const prop of definition.props) {
        expect(prop.anim[0]?.scale).toBe(80)
        expect(prop.anim.every((frame) => frame.plane !== 0)).toBe(true)
        expect(
          prop.anim.every(
            (frame) =>
              (frame.plane === undefined || Number.isInteger(frame.plane)) &&
              (frame.axis === undefined || Number.isInteger(frame.axis)),
          ),
        ).toBe(true)
        expect(
          prop.anim.every((frame) => frame.axis === undefined || frame.axis !== frame.plane),
        ).toBe(true)
      }
    }
  })

  it('compiles every source track to its twelve cardinal positions and exact incoming axes', () => {
    for (const definition of eightStepPatternDefinitions) {
      const animation = createDefaultEightStepAnimation({
        concept: '8stp',
        reference: definition.reference,
        swapProps: true,
      })
      expect(animation).toBeDefined()
      if (!animation) continue

      const compiled = rootCompile(animation)
      const source = eightStepHandpathsByPage[definition.page]

      for (const [propIndex, tokens] of [source.green, source.orange].entries()) {
        const frames = compiled.props[propIndex]!.anim
        expect(frames).toHaveLength(25)
        expect(frames.slice(1).every((frame) => frame.arc === 45)).toBe(true)
        expectVector(frames[0]!.pos, tokenPoints[tokens[0]!]!)

        for (let stepIndex = 0; stepIndex < 12; stepIndex++) {
          const start = tokenPoints[tokens[stepIndex]!]!
          const end = tokenPoints[tokens[(stepIndex + 1) % 12]!]!
          const frame = frames[(stepIndex + 1) * eightStepPlaybackMultiplier]!
          const context = `${definition.reference} prop ${propIndex + 1} step ${stepIndex + 1}`
          expectVector(frame.pos, end, `${context} position`)
          expectVector(
            frame.posx,
            new Vector3().crossVectors(start, end).normalize(),
            `${context} axis`,
          )
        }

        expectVector(frames[0]!.rot, tokenPoints[tokens[0]!]!)
        expectVector(frames[12 * eightStepPlaybackMultiplier]!.rot, tokenPoints[tokens[0]!]!)
      }
    }
  })

  it('compiles FLIP to the eight authoritative paired-page handpaths', () => {
    for (const [columnIndex, sourcePage] of eightStepPages.entries()) {
      const definition = eightStepPatternDefinitions.find(
        ({ column, row }) => column === columnIndex + 1 && row === 'AA',
      )
      expect(definition?.page).toBe(sourcePage)
      if (!definition) continue

      const animation = createDefaultEightStepAnimation({
        concept: '8stp',
        reference: definition.reference,
        swapProps: true,
        reversePlane: true,
      })
      expect(animation).toBeDefined()
      if (!animation) continue

      const compiled = rootCompile(animation)
      const flippedPage = flippedPageBySource[sourcePage]
      const flippedHandpath = flippedHandpaths[flippedPage as keyof typeof flippedHandpaths]

      for (const [propIndex, tokens] of [flippedHandpath.green, flippedHandpath.orange].entries()) {
        const frames = compiled.props[propIndex]!.anim
        expectVector(frames[0]!.pos, tokenPoints[tokens[0]!]!)
        for (let stepIndex = 0; stepIndex < 12; stepIndex++) {
          const start = tokenPoints[tokens[stepIndex]!]!
          const end = tokenPoints[tokens[(stepIndex + 1) % 12]!]!
          const frame = frames[(stepIndex + 1) * eightStepPlaybackMultiplier]!
          const context = `page ${flippedPage} prop ${propIndex + 1} step ${stepIndex + 1}`
          expectVector(frame.pos, end, `${context} position`)
          expectVector(
            frame.posx,
            new Vector3().crossVectors(start, end).normalize(),
            `${context} axis`,
          )
        }
      }
    }
  })
})
