import { describe, expect, it } from 'vitest'

import {
  buildComposerUrl,
  composerPatternOrientations,
  composerSpeedRatios,
  isComposerPatternOrientation,
  isComposerSpeedRatio,
  type ComposerCell,
  type ComposerSpeedRatio,
} from '@/features/kinetic-alphabet/composerBridge'
import { eightStepPatternDefinitions } from '@/features/eight-step/data/eightStepPatternDefinitions'
import { vtgRowPatterns } from '@/features/vtg/data/patterns/rows'
import type { VtgCellReference } from '@/features/vtg/types'
import { patternShapes } from '@/types/PatternTypes'

/**
 * The Composer route is keyed by cell identity, so a silent change to any field would send users
 * to a dead link rather than fail a build. Every catalog cell is enumerated here and compared
 * against the key spelled out literally, which pins the origin, the field order, the separator,
 * the ratio spelling, and the lowercasing.
 */
const expectedUrl = (key: string) => `https://tkaflowarts.com/from/spiroanim/${key}`

const vtgReferences = Object.keys(vtgRowPatterns) as readonly VtgCellReference[]
const antiVariants = [false, true] as const

describe('buildComposerUrl', () => {
  it('covers the whole VTG catalog', () => {
    const actual: string[] = []
    const expected: string[] = []

    for (const reference of vtgReferences) {
      for (const speedRatio of composerSpeedRatios) {
        for (const isAnti of antiVariants) {
          actual.push(buildComposerUrl({ concept: 'vtg', reference, speedRatio, isAnti }))
          expected.push(
            expectedUrl(
              `vtg.${reference}.${speedRatio.replace(':', 'x')}.diamond.${isAnti ? 'anti' : 'base'}`,
            ),
          )
        }
      }
    }

    expect(actual).toHaveLength(504)
    expect(actual).toEqual(expected)
  })

  it('covers the whole QTR catalog', () => {
    const actual: string[] = []
    const expected: string[] = []

    for (const reference of vtgReferences) {
      for (const speedRatio of composerSpeedRatios) {
        for (const isAnti of antiVariants) {
          actual.push(buildComposerUrl({ concept: 'qtr', reference, speedRatio, isAnti }))
          expected.push(
            expectedUrl(
              `qtr.${reference}.${speedRatio.replace(':', 'x')}.diamond.${isAnti ? 'anti' : 'base'}`,
            ),
          )
        }
      }
    }

    expect(actual).toHaveLength(504)
    expect(actual).toEqual(expected)
  })

  it('covers the whole Eight Step catalog and lowercases its uppercase rows', () => {
    const actual: string[] = []
    const expected: string[] = []

    for (const { reference } of eightStepPatternDefinitions) {
      for (const shape of patternShapes) {
        for (const isAnti of antiVariants) {
          actual.push(buildComposerUrl({ concept: '8stp', reference, shape, isAnti }))
          expected.push(
            expectedUrl(`8stp.${reference.toLowerCase()}.1x1.${shape}.${isAnti ? 'anti' : 'base'}`),
          )
        }
      }
    }

    expect(actual).toHaveLength(288)
    expect(actual).toEqual(expected)
    expect(actual).toContain(expectedUrl('8stp.4-ii.1x1.diamond.base'))
    expect(actual).toContain(expectedUrl('8stp.1-ae.1x1.box.anti'))
  })

  it('produces a distinct key for every catalog cell', () => {
    const urls = [
      ...vtgReferences.flatMap((reference) =>
        composerSpeedRatios.flatMap((speedRatio) =>
          antiVariants.flatMap((isAnti) =>
            (['vtg', 'qtr'] as const).map((concept) =>
              buildComposerUrl({ concept, reference, speedRatio, isAnti }),
            ),
          ),
        ),
      ),
      ...eightStepPatternDefinitions.flatMap(({ reference }) =>
        patternShapes.flatMap((shape) =>
          antiVariants.map((isAnti) =>
            buildComposerUrl({ concept: '8stp', reference, shape, isAnti }),
          ),
        ),
      ),
    ]

    expect(new Set(urls).size).toBe(urls.length)
  })

  it('defaults the shape to diamond, the ratio to 1:1, and the variant to base', () => {
    const cell: ComposerCell = { concept: 'vtg', reference: '1-1' }

    expect(buildComposerUrl(cell)).toBe(expectedUrl('vtg.1-1.1x1.diamond.base'))
  })

  it('forces the Eight Step ratio field to 1x1 even when a ratio is supplied', () => {
    expect(buildComposerUrl({ concept: '8stp', reference: '1-AA', speedRatio: '1:5' })).toBe(
      expectedUrl('8stp.1-aa.1x1.diamond.base'),
    )
  })

  it('appends the displayed pattern orientation for vtg and qtr', () => {
    for (const orientation of composerPatternOrientations) {
      expect(
        buildComposerUrl({ concept: 'vtg', reference: '3-4', speedRatio: '1:3', orientation }),
      ).toBe(expectedUrl(`vtg.3-4.1x3.diamond.base.o${orientation}`))
    }

    expect(
      buildComposerUrl({
        concept: 'qtr',
        reference: '1-1',
        speedRatio: '1:1',
        isAnti: true,
        orientation: -90,
      }),
    ).toBe(expectedUrl('qtr.1-1.1x1.diamond.anti.o-90'))
  })

  it('omits the orientation field when none is supplied', () => {
    expect(buildComposerUrl({ concept: 'vtg', reference: '3-4', speedRatio: '1:3' })).toBe(
      expectedUrl('vtg.3-4.1x3.diamond.base'),
    )
  })

  it('never emits an orientation for Eight Step, which has no orientation axis', () => {
    expect(buildComposerUrl({ concept: '8stp', reference: '1-AA', orientation: 90 })).toBe(
      expectedUrl('8stp.1-aa.1x1.diamond.base'),
    )
  })
})

describe('isComposerPatternOrientation', () => {
  it('accepts only the orientations the Composer key grammar carries', () => {
    for (const orientation of composerPatternOrientations) {
      expect(isComposerPatternOrientation(orientation)).toBe(true)
    }

    // An off-axis orientation (a hydration-inferred in-between angle) matches no catalog view,
    // so callers report no cell rather than emit a token the Composer would reject.
    expect([30, -180, 360, 135, 22.5].filter(isComposerPatternOrientation)).toEqual([])
  })
})

describe('isComposerSpeedRatio', () => {
  it('accepts only the ratios the Composer transcription covers', () => {
    for (const ratio of composerSpeedRatios) {
      expect(isComposerSpeedRatio(ratio)).toBe(true)
    }

    // 2:1 is the one picker ratio with no Kinetic Alphabet reading.
    const unbridgeable = ['2:1', '1:3v5', '']
    expect(unbridgeable.filter(isComposerSpeedRatio)).toEqual([])
  })

  it('narrows a checked string to the Composer ratio union', () => {
    const candidate: string = '1:3'
    if (!isComposerSpeedRatio(candidate)) throw new Error('Expected a Composer speed ratio')
    const narrowed: ComposerSpeedRatio = candidate

    expect(narrowed).toBe('1:3')
  })
})
