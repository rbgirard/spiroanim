import { describe, expect, it } from 'vitest'

import { createDefaultQstAnimation } from '@/features/quarter-space-tech/createQstAnimation'
import {
  getQstCatalogPages,
  getQstCollectionPatternCount,
  getQstPatternSwapPair,
  qstCollections,
  qstPatternDefinitions,
} from '@/features/quarter-space-tech/data/qstPatternCatalog'
import {
  analyzeQstPositionPairs,
  analyzeQstSequence,
} from '@/features/quarter-space-tech/math/analyzeQstAnimation'

describe('QST pattern catalog', () => {
  it('preserves the active library order, page boundaries, and all 228 patterns', () => {
    expect(qstCollections.map(({ key }) => key)).toEqual(['breaks', 'advanced', 'beyond'])
    expect(qstCollections.map(getQstCollectionPatternCount)).toEqual([56, 64, 108])
    expect(qstCollections.map(({ pages }) => pages.length)).toEqual([7, 8, 14])
    expect(qstCollections[0]?.pages.map(({ patterns }) => patterns.length)).toEqual(
      Array.from({ length: 7 }, () => 8),
    )
    expect(qstCollections[1]?.pages.every(({ patterns }) => patterns.length === 8)).toBe(true)
    expect(
      qstCollections[2]?.pages.slice(0, -1).every(({ patterns }) => patterns.length === 8),
    ).toBe(true)
    expect(qstCollections[2]?.pages.at(-1)?.patterns).toHaveLength(4)
    expect(qstPatternDefinitions).toHaveLength(228)
    expect(new Set(qstPatternDefinitions.map(({ reference }) => reference)).size).toBe(228)
  })

  it('compiles every stored animation into closed QST positions and configured lines', () => {
    for (const pattern of qstPatternDefinitions) {
      expect(pattern.props.every(({ anim }) => anim[0]?.scale === 80)).toBe(true)
      const animation = createDefaultQstAnimation({
        concept: 'qst',
        reference: pattern.reference,
      })
      expect({ reference: pattern.reference, defined: animation !== undefined }).toEqual({
        reference: pattern.reference,
        defined: true,
      })
      if (!animation) continue

      const pairs = analyzeQstPositionPairs(animation)
      expect({ reference: pattern.reference, last: pairs.at(-1) }).toEqual({
        reference: pattern.reference,
        last: pairs[0],
      })
      expect(
        analyzeQstSequence(animation, pattern.lineBeats).flatMap(({ tiles }) => tiles),
      ).toHaveLength(pairs.length - 1)
      expect({
        reference: pattern.reference,
        allTurnsAreAntiSpin: pattern.props.every(({ anim }) =>
          anim.slice(1).every(({ turns }) => turns === -360),
        ),
      }).toEqual({ reference: pattern.reference, allTurnsAreAntiSpin: true })
    }
  })

  it('splits Advanced and Beyond patterns into two four-beat lines', () => {
    for (const collection of qstCollections.slice(1)) {
      for (const page of collection.pages) {
        for (const pattern of page.patterns) {
          const animation = createDefaultQstAnimation({
            concept: 'qst',
            reference: pattern.reference,
          })
          if (!animation) throw new Error(`Missing ${pattern.reference}`)
          const lineBeats = 'lineBeats' in pattern ? pattern.lineBeats : undefined
          expect(lineBeats).toBe(4)
          expect(analyzeQstSequence(animation, lineBeats).map(({ tiles }) => tiles.length)).toEqual(
            [4, 4],
          )
        }
      }
    }
  })

  it('uses Swap to paginate one member of every QST pair', () => {
    const [breaks, advanced, beyond] = qstCollections
    if (!breaks || !advanced || !beyond) throw new Error('Missing QST collections')

    const breaksFirstPages = getQstCatalogPages(breaks, false)
    const breaksSecondPages = getQstCatalogPages(breaks, true)
    expect(breaksFirstPages.map(({ patterns }) => patterns.length)).toEqual([8, 8, 6, 4, 4])
    expect(breaksSecondPages.map(({ patterns }) => patterns.length)).toEqual([8, 8, 6, 4, 4])
    expect(breaksFirstPages[0]?.patterns.map(({ reference }) => reference)).toEqual([
      'breaks-1',
      'breaks-2',
      'breaks-5',
      'breaks-6',
      'breaks-9',
      'breaks-11',
      'breaks-13',
      'breaks-15',
    ])
    expect(breaksSecondPages[0]?.patterns.map(({ reference }) => reference)).toEqual([
      'breaks-3',
      'breaks-4',
      'breaks-7',
      'breaks-8',
      'breaks-10',
      'breaks-12',
      'breaks-14',
      'breaks-16',
    ])
    expect(breaksFirstPages[2]?.patterns.at(-1)?.caption).toMatch(/^Part 5:/)
    expect(breaksSecondPages[2]?.patterns.at(-1)?.caption).toMatch(/^Part 5:/)
    expect(breaksFirstPages[3]?.patterns[0]?.caption).toMatch(/^Part 6:/)
    expect(breaksSecondPages[3]?.patterns[0]?.caption).toMatch(/^Part 6:/)
    expect(breaksFirstPages[3]?.patterns.at(-1)?.caption).toMatch(/^Part 6:/)
    expect(breaksSecondPages[3]?.patterns.at(-1)?.caption).toMatch(/^Part 6:/)
    expect(breaksFirstPages[4]?.patterns[0]?.caption).toMatch(/^Part 7:/)
    expect(breaksSecondPages[4]?.patterns[0]?.caption).toMatch(/^Part 7:/)

    const advancedFirstPages = getQstCatalogPages(advanced, false)
    const advancedSecondPages = getQstCatalogPages(advanced, true)
    expect(advancedFirstPages).toHaveLength(4)
    expect(advancedSecondPages).toHaveLength(4)
    expect(advancedFirstPages.every(({ patterns }) => patterns.length === 8)).toBe(true)
    expect(advancedSecondPages.every(({ patterns }) => patterns.length === 8)).toBe(true)
    expect(advancedFirstPages[0]?.patterns.map(({ reference }) => reference)).toEqual([
      'advanced-1',
      'advanced-3',
      'advanced-5',
      'advanced-7',
      'advanced-9',
      'advanced-11',
      'advanced-13',
      'advanced-15',
    ])
    expect(advancedSecondPages[0]?.patterns.map(({ reference }) => reference)).toEqual([
      'advanced-2',
      'advanced-4',
      'advanced-6',
      'advanced-8',
      'advanced-10',
      'advanced-12',
      'advanced-14',
      'advanced-16',
    ])

    const beyondFirstPages = getQstCatalogPages(beyond, false)
    const beyondSecondPages = getQstCatalogPages(beyond, true)
    expect(beyondFirstPages.map(({ patterns }) => patterns.length)).toEqual([
      8, 6, 4, 8, 8, 8, 8, 4, 8, 8,
    ])
    expect(beyondSecondPages.map(({ patterns }) => patterns.length)).toEqual([
      8, 6, 4, 8, 8, 8, 8, 4, 8, 8,
    ])
    expect(beyondFirstPages[1]?.patterns.at(-1)?.caption).toMatch(/^Part 2:/)
    expect(beyondFirstPages[2]?.patterns[0]?.caption).toMatch(/^Part 3:/)
    expect(beyondFirstPages[2]?.patterns.at(-1)?.caption).toMatch(/^Part 3:/)
    expect(beyondFirstPages[3]?.patterns[0]?.caption).toMatch(/^Part 4:/)
    expect(beyondSecondPages[1]?.patterns.at(-1)?.caption).toMatch(/^Part 2:/)
    expect(beyondSecondPages[2]?.patterns[0]?.caption).toMatch(/^Part 3:/)
    expect(beyondSecondPages[2]?.patterns.at(-1)?.caption).toMatch(/^Part 3:/)
    expect(beyondSecondPages[3]?.patterns[0]?.caption).toMatch(/^Part 4:/)
    expect(beyondFirstPages[7]?.patterns.at(-1)?.caption).toMatch(/^Part 10:/)
    expect(beyondFirstPages[8]?.patterns[0]?.caption).toMatch(/^Part 11(?: |:)/)
    expect(beyondSecondPages[7]?.patterns.at(-1)?.caption).toMatch(/^Part 10:/)
    expect(beyondSecondPages[8]?.patterns[0]?.caption).toMatch(/^Part 11(?: |:)/)
    expect(
      beyondFirstPages.flatMap(({ patterns }) => patterns).map(({ reference }) => reference),
    ).toContain('beyond-1')
    expect(
      beyondSecondPages.flatMap(({ patterns }) => patterns).map(({ reference }) => reference),
    ).toContain('beyond-1')
    expect(getQstPatternSwapPair('beyond-105')).toMatchObject({
      first: { reference: 'beyond-105' },
      second: { reference: 'beyond-108' },
    })
  })

  it('keeps every pattern closed after 180-degree and Swap transforms', () => {
    for (const pattern of qstPatternDefinitions) {
      for (const swapProps of [false, true]) {
        for (const reversePlane of [false, true]) {
          const animation = createDefaultQstAnimation({
            concept: 'qst',
            reference: pattern.reference,
            swapProps,
            reversePlane,
          })
          if (!animation) throw new Error(`Missing ${pattern.reference}`)

          const pairs = analyzeQstPositionPairs(animation)
          expect({
            reference: pattern.reference,
            swapProps,
            reversePlane,
            closed: pairs.at(-1),
          }).toEqual({
            reference: pattern.reference,
            swapProps,
            reversePlane,
            closed: pairs[0],
          })
        }
      }
    }
  })
})
