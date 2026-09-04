import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import {
  exactlyMatchesQtrSelection,
  findQtrPatternMatch,
  findQtrPatternMatches,
} from '@/features/vtg/qtr/matchQtrAnimation'
import type { QtrPatternSelection } from '@/features/vtg/types'
import { getVtgPatternOrientations, vtgTransitionBeats } from '@/features/vtg/types'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CHARSET, VDEF } from '@/services/query/versions/SpiroAnimQSv12'

const booleanOptions = [false, true] as const

const createQtrAnimation = (selection: QtrPatternSelection) => {
  const animation = createDefaultQtrAnimation(selection)
  if (!animation) throw new Error(`Expected a QTR animation for ${selection.reference}`)
  return animation
}

describe('Qtr animation matching', () => {
  it('recovers arbitrary signed rotation offsets for both props', () => {
    const selection = {
      reference: '2-2',
      speedRatio: '1:3',
      quarters: 1,
      propRotationOffsets: [23, -37],
    } as const satisfies QtrPatternSelection
    const animation = createQtrAnimation(selection)
    const match = findQtrPatternMatch(animation, {
      swapProps: false,
      reversePlane: false,
      quarters: 1,
      orientation: 0,
    })

    expect(match).toMatchObject(selection)
    expect(match && exactlyMatchesQtrSelection(animation, match)).toBe(true)
  })

  it.each(['1:2', '1:4'] as const)(
    'recognizes every nonzero initial arc rotation after a beat shift at %s',
    (speedRatio) => {
      for (const orientation of getVtgPatternOrientations(speedRatio).filter(
        (option) => option !== 0,
      )) {
        const selection = {
          reference: '5-1',
          speedRatio,
          quarters: 1,
          orientation,
          beat: 3,
        } as const satisfies QtrPatternSelection

        expect(findQtrPatternMatches(createQtrAnimation(selection))).toContainEqual({
          ...selection,
          isAnti: false,
          swapProps: false,
          reversePlane: false,
          bpm: 40,
          scale: 0.8,
        })
      }
    },
  )

  it.each(['1:1', '1:3', '1:5'] as const)(
    'recognizes QTR animations using every added rotation at %s',
    (speedRatio) => {
      for (const orientation of getVtgPatternOrientations(speedRatio).filter(
        (option) => option !== 0,
      )) {
        const animation = createQtrAnimation({
          reference: '5-1',
          speedRatio,
          quarters: 1,
          orientation,
          beat: 3,
        })

        expect(findQtrPatternMatch(animation)).toMatchObject({ speedRatio, quarters: 1 })
      }
    },
  )

  it('retains a preferred equivalent rotation during control hydration', () => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      quarters: 1,
      orientation: -45,
    } as const satisfies QtrPatternSelection
    const animation = createQtrAnimation(selection)

    expect(
      findQtrPatternMatch(animation, {
        quarters: 1,
        swapProps: false,
        reversePlane: false,
        orientation: -45,
      }),
    ).toMatchObject({ orientation: -45 })
  })

  it.each(vtgTransitionBeats)('detects the %s-beat reciprocal transition', (transitionBeats) => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      quarters: 1,
      transition: true,
      transitionBeats,
    } as const satisfies QtrPatternSelection

    expect(findQtrPatternMatch(createQtrAnimation(selection))).toMatchObject({
      ...selection,
    })
  })

  it('detects when the reciprocal transition starts with the second prop after Swap', () => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      quarters: 1,
      swapProps: true,
      transition: true,
      transitionQuad: true,
      transitionSecond: true,
    } as const satisfies QtrPatternSelection

    expect(findQtrPatternMatch(createQtrAnimation(selection))).toMatchObject({
      ...selection,
    })
  })

  it('recognizes the Qtr transform', () => {
    const selection = {
      reference: '3-4',
      speedRatio: '1:5',
      quarters: 1,
    } as const satisfies QtrPatternSelection

    expect(findQtrPatternMatch(createQtrAnimation(selection))).toEqual({
      ...selection,
      isAnti: false,
      swapProps: false,
      reversePlane: false,
      bpm: 40,
      scale: 0.8,
    })
  })

  it('recognizes both Qtr orientations across the final Swap transform', () => {
    for (const swapProps of booleanOptions) {
      for (const reversePlane of booleanOptions) {
        const selection = {
          reference: '2-1',
          speedRatio: '1:3',
          swapProps,
          reversePlane,
          quarters: 1,
        } as const satisfies QtrPatternSelection

        expect(findQtrPatternMatches(createQtrAnimation(selection))).toContainEqual({
          ...selection,
          isAnti: false,
          bpm: 40,
          scale: 0.8,
        })
      }
    }
  })

  it('recovers Qtr controls after a complete shared-URL round trip', async () => {
    const selection = {
      reference: '5-6',
      speedRatio: '1:5',
      isAnti: true,
      swapProps: true,
      reversePlane: true,
      quarters: 1,
      bpm: 101,
      scale: 1.2,
    } as const satisfies QtrPatternSelection
    const codec = await useSpiroAnimQS(VDEF, useBaseQS(VDEF, { charset: CHARSET }), 12)
    const query = codec.encodeQS(createQtrAnimation(selection), false)
    const decoded = await codec.decodeVer(query)

    expect(findQtrPatternMatch(decoded)).toEqual(selection)
  })

  it('recovers the VTG transition by matching its shared doubled base cycle', () => {
    const selection = {
      reference: '1-1',
      speedRatio: '1:3',
      quarters: 1,
      beat: 2,
      transition: true,
      bpm: 79,
    } as const satisfies QtrPatternSelection

    expect(
      findQtrPatternMatches(createQtrAnimation({ ...selection, transitionBeats: 5 })),
    ).toContainEqual({
      ...selection,
      transitionBeats: 5,
      isAnti: false,
      swapProps: false,
      reversePlane: false,
      bpm: 79,
      scale: 0.8,
    })
  })

  it('uses the shared canonical ranking for Trans candidates', () => {
    for (const selection of [
      {
        reference: '2-2',
        speedRatio: '1:3',
        quarters: 1,
        beat: 3,
        swapProps: false,
        reversePlane: false,
        transition: true,
      },
      {
        reference: '2-2',
        speedRatio: '1:3',
        quarters: 1,
        beat: 4,
        swapProps: true,
        reversePlane: false,
        transition: true,
      },
    ] as const satisfies readonly QtrPatternSelection[]) {
      const preferences = {
        quarters: selection.quarters,
        swapProps: selection.swapProps,
        reversePlane: selection.reversePlane,
      }
      const animation = createQtrAnimation({ ...selection, transitionBeats: 5 })
      const matches = findQtrPatternMatches(animation)
      const match = findQtrPatternMatch(animation, preferences)

      expect(match).toBeDefined()
      expect(matches).toContainEqual(match)
      expect(match && exactlyMatchesQtrSelection(animation, match)).toBe(true)
    }
  })
})
