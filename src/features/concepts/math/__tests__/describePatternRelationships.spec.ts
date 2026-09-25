import { describe, expect, it, vi } from 'vitest'

import {
  classifyDirectedTiming,
  describePatternRelationships,
} from '@/features/concepts/math/describePatternRelationships'
import type { PatternRelationshipLabel } from '@/features/concepts/math/describePatternRelationships'
import {
  describePatternSelectionRelationships,
  describePatternSelectionRelationshipsAcrossBeats,
  isPatternPropTimingBeatInvariant,
} from '@/features/concepts/math/describePatternSelectionRelationships'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { qtrModes } from '@/features/vtg/types'
import {
  applyVtgPropRotationOffsets,
  createDefaultVtgAnimation,
} from '@/features/vtg/createVtgAnimation'
import { findVtgPatternMatch } from '@/features/vtg/matchVtgAnimation'
import type { VtgCellReference, VtgPatternLabel, VtgRuleNumber } from '@/features/vtg/types'
import { vtgSpeedRatios } from '@/features/vtg/types'
import { getVtgBeats } from '@/features/vtg/types'

const ruleNumbers = [1, 2, 3, 4, 5, 6] as const satisfies readonly VtgRuleNumber[]
const booleanOptions = [false, true] as const
const spinToggleCells: ReadonlySet<VtgCellReference> = new Set(['5-6', '6-6', '5-5', '6-5'])

const expectedLabelsByRow = {
  1: ['TS / TS', 'SO / SO', 'TS / TS', 'SO / SO', 'TS / SO', 'SO / TS'],
  2: ['TO / TO', 'SS / SS', 'TO / TO', 'SS / SS', 'TO / SS', 'SS / TO'],
  3: ['TS / TS', 'SO / SO', 'TS / TS', 'SO / SO', 'TS / SO', 'SO / TS'],
  4: ['TO / TO', 'SS / SS', 'TO / TO', 'SS / SS', 'TO / SS', 'SS / TO'],
  5: ['TS / TO', 'SO / SS', 'TS / TO', 'SO / SS', 'TS / SS', 'SO / TO'],
  6: ['TO / TS', 'SS / SO', 'TO / TS', 'SS / SO', 'TO / SO', 'SS / TS'],
} as const satisfies Readonly<Record<VtgRuleNumber, readonly VtgPatternLabel[]>>

const expectedDescription = (label: PatternRelationshipLabel): string => {
  const timingDescriptions = { T: 'Together', S: 'Split', Q: 'Quarter' } as const
  const directionDescriptions = { S: 'Same', O: 'Opposite' } as const
  const [hands, props] = label.split(' / ')
  if (!hands || !props) throw new Error(`Invalid expected relationship label: ${label}`)

  return `Hands: ${timingDescriptions[hands[0] as keyof typeof timingDescriptions]} / ${directionDescriptions[hands[1] as keyof typeof directionDescriptions]}\nProps: ${timingDescriptions[props[0] as keyof typeof timingDescriptions]} / ${directionDescriptions[props[1] as keyof typeof directionDescriptions]}`
}

describe('describePatternRelationships', () => {
  it('uses directed phase rather than Cartesian spacing', () => {
    const bottom = [0, -1, 0] as const
    const right = [1, 0, 0] as const
    const left = [-1, 0, 0] as const
    const positiveAxis = [0, 0, 1] as const
    const negativeAxis = [0, 0, -1] as const

    expect(classifyDirectedTiming(bottom, positiveAxis, bottom, positiveAxis)).toBe('T')
    expect(classifyDirectedTiming(bottom, positiveAxis, right, positiveAxis)).toBe('Q')
    expect(classifyDirectedTiming(right, positiveAxis, left, negativeAxis)).toBe('T')
    expect(classifyDirectedTiming(right, positiveAxis, right, negativeAxis)).toBe('S')
  })

  it('keeps Quarter Spacing independent from prop Quarter Time', () => {
    expect(
      describePatternSelectionRelationships({
        reference: '1-1',
        speedRatio: '1:3',
        propRotationOffsets: [-90, 0],
      }).label,
    ).toBe('TS / QS')

    expect(
      describePatternSelectionRelationships({
        reference: '1-1',
        speedRatio: '1:3',
        quarters: 1,
        propRotationOffsets: [90, 0],
      }).label,
    ).toBe('QS / SS')

    expect(
      describePatternSelectionRelationships({
        reference: '6-3',
        speedRatio: '1:3',
        quarters: 1,
      }).label,
    ).toBe('QO / QS')
  })

  it('returns an obvious label without logging when the complete classification fails', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Missing VTG animation')
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(describePatternRelationships({ ...animation, props: [] })).toMatchObject({
      label: 'XX / XX',
      description: expect.stringContaining('Pattern relationship error:'),
      handsIndeterminate: true,
      propsIndeterminate: true,
    })
    expect(warning).not.toHaveBeenCalled()
    warning.mockRestore()
  })

  it('keeps the calculable side when only one relationship is indeterminate', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Missing VTG animation')

    expect(
      describePatternRelationships(applyVtgPropRotationOffsets(animation, [45, 0])),
    ).toMatchObject({
      label: 'TS / XS',
      hands: { timing: 'T', direction: 'S' },
      props: { timing: 'X', direction: 'S' },
      handsIndeterminate: false,
      propsIndeterminate: true,
    })
  })

  it('derives even-ratio labels from local path phase without changing 1:3', () => {
    expect(
      describePatternSelectionRelationships({ reference: '2-1', speedRatio: '1:3' }).label,
    ).toBe('TO / TO')
    expect(
      describePatternSelectionRelationships({
        reference: '1-2',
        speedRatio: '1:2',
        orientation: -90,
      }).label,
    ).toBe('TO / TO')
    expect(
      describePatternSelectionRelationships({
        reference: '1-2',
        speedRatio: '1:4',
        orientation: -90,
      }).label,
    ).toBe('TO / TO')
  })

  it('keeps equal-rate VTG timing invariant while reclassifying unequal-rate hybrids', () => {
    for (const speedRatio of vtgSpeedRatios) {
      for (const row of ruleNumbers) {
        for (const column of ruleNumbers) {
          const reference: VtgCellReference = `${row}-${column}`
          const startingRelationships = describePatternSelectionRelationships({
            reference,
            speedRatio,
            beat: 1,
          })

          for (const beat of getVtgBeats(speedRatio)) {
            const currentRelationships = describePatternSelectionRelationships({
              reference,
              speedRatio,
              beat,
            })
            const transitionRelationships = describePatternSelectionRelationships({
              reference,
              speedRatio,
              beat,
              transition: true,
            })

            expect(transitionRelationships).toEqual(currentRelationships)
            expect(currentRelationships).toEqual(startingRelationships)
          }
        }
      }
    }

    expect(
      describePatternSelectionRelationships({
        reference: '1-2',
        speedRatio: '1:3',
        beat: 1.5,
      }).label,
    ).toBe('SO / SO')
    expect(
      getVtgBeats('1:1v1:3').map(
        (beat) =>
          describePatternSelectionRelationships({
            reference: '1-1',
            speedRatio: '1:1v1:3',
            beat,
          }).label,
      ),
    ).toEqual([
      'TS / TS',
      'TS / QS',
      'TS / SS',
      'TS / QS',
      'TS / TS',
      'TS / QS',
      'TS / SS',
      'TS / QS',
    ])
  })

  it('preserves hybrid direction when timing varies by Beat', () => {
    expect(isPatternPropTimingBeatInvariant('1:1v1:3', 'T')).toBe(false)
    expect(isPatternPropTimingBeatInvariant('1:1v1:3', 'Q')).toBe(false)
    expect(isPatternPropTimingBeatInvariant('1:1v1:5', 'T')).toBe(false)
    expect(isPatternPropTimingBeatInvariant('1:1v1:5', 'Q')).toBe(true)
    expect(isPatternPropTimingBeatInvariant('1:1v1:9', 'T')).toBe(true)

    expect(
      describePatternSelectionRelationshipsAcrossBeats({
        reference: '1-1',
        speedRatio: '1:1v1:3',
        beat: 1.5,
      }),
    ).toMatchObject({
      label: 'TS / XS',
      description: 'Hands: Together / Same\nProps: Indeterminate / Same',
      props: { timing: 'X', direction: 'S' },
      propsIndeterminate: true,
    })
  })

  it('preserves prop direction throughout the 2:1v1:2 hybrid grid', () => {
    for (const row of ruleNumbers) {
      for (const column of ruleNumbers) {
        const reference = `${row}-${column}` as const
        for (const beat of getVtgBeats('2:1v1:2')) {
          const relationships = describePatternSelectionRelationshipsAcrossBeats({
            reference,
            speedRatio: '2:1v1:2',
            beat,
          })
          expect(relationships.props?.direction, `${reference} Beat ${beat}`).toMatch(/^[SO]$/)
          expect(relationships.label, `${reference} Beat ${beat}`).not.toContain('/ XX')
        }
      }
    }
  })

  it('keeps the supplied URL phase alignment stable across every Beat', () => {
    const selection = {
      reference: '4-3',
      speedRatio: '1:3',
      orientation: 135,
      swapProps: true,
      propRotationOffsets: [90, 0],
    } as const

    expect(
      getVtgBeats(selection.speedRatio).map(
        (beat) => describePatternSelectionRelationships({ ...selection, beat }).label,
      ),
    ).toEqual(Array.from({ length: 8 }, () => 'QO / TO'))
    expect(
      getVtgBeats(selection.speedRatio).map(
        (beat) => describePatternSelectionRelationshipsAcrossBeats({ ...selection, beat }).label,
      ),
    ).toEqual(Array.from({ length: 8 }, () => 'QO / TO'))
  })

  it.each([
    [45, 0],
    [0, -45],
  ] as const)('ignores hidden prop rotation alignment %s/%s', (leftOffset, rightOffset) => {
    const selection = { reference: '1-1', speedRatio: '2:3' } as const

    expect(
      describePatternSelectionRelationships({
        ...selection,
        propRotationOffsets: [leftOffset, rightOffset],
      }),
    ).toEqual(describePatternSelectionRelationships(selection))
  })

  it('classifies a retained half-turn prop rotation', () => {
    expect(
      describePatternSelectionRelationships({
        reference: '1-1',
        speedRatio: '2:3',
        propRotationOffsets: [180, 0],
      }).label,
    ).toBe('TS / SS')
  })

  it.each([
    ['1-1', [-90, 0], 'TS / QS'],
    ['2-1', [90, 0], 'TO / QO'],
  ] as const)(
    'keeps retained prop rotation relationships across cell %s',
    (reference, propRotationOffsets, expected) => {
      expect(
        describePatternSelectionRelationships({
          reference,
          speedRatio: '1:3',
          propRotationOffsets,
        }).label,
      ).toBe(expected)
    },
  )

  it('classifies a retained rotation relationship at the selected beat', () => {
    const selection = {
      reference: '1-2',
      speedRatio: '1:3',
      beat: 1.5,
      propRotationOffsets: [-90, 0],
    } as const
    const animation = createDefaultVtgAnimation(selection)
    if (!animation) throw new Error('Missing rotated VTG animation')
    const match = findVtgPatternMatch(animation)
    if (!match) throw new Error('Rotated VTG animation did not match')

    expect(describePatternSelectionRelationships(selection).label).toBe('SO / QO')
    expect(describePatternSelectionRelationships(match).label).toBe('SO / QO')
  })

  it('applies retained quarter-turn relationships to every cell at its selected beat', () => {
    for (const row of ruleNumbers) {
      for (const column of ruleNumbers) {
        const reference: VtgCellReference = `${row}-${column}`
        for (const beat of getVtgBeats('1:3')) {
          for (const propRotationOffsets of [
            [-90, 0],
            [90, 0],
          ] as const) {
            const base = describePatternSelectionRelationships({
              reference,
              speedRatio: '1:3',
              beat,
            })
            const rotated = describePatternSelectionRelationships({
              reference,
              speedRatio: '1:3',
              beat,
              propRotationOffsets,
            })
            expect(rotated.hands).toEqual(base.hands)
            expect(rotated.props, `${reference}/${beat}/${propRotationOffsets.join('/')}`).toEqual({
              ...base.props,
              timing: 'Q',
            })
          }
        }
      }
    }
  })

  it.each(['1:2', '1:4'] as const)(
    'transposes the relationship matrix at rotated %s orientations',
    (speedRatio) => {
      for (const orientation of [-90, 90] as const) {
        for (const row of ruleNumbers) {
          for (const column of ruleNumbers) {
            const reference: VtgCellReference = `${row}-${column}`
            const expected = expectedLabelsByRow[column][row - 1]
            if (!expected) throw new Error(`Missing transposed label for ${reference}`)

            expect(
              describePatternSelectionRelationships({ reference, speedRatio, orientation }).label,
            ).toBe(expected)
          }
        }
      }
    },
  )

  it.each(['1:2', '1:4'] as const)(
    'keeps the established relationship matrix at the 180-degree %s orientation',
    (speedRatio) => {
      for (const row of ruleNumbers) {
        for (const column of ruleNumbers) {
          const reference: VtgCellReference = `${row}-${column}`
          const expected = expectedLabelsByRow[row][column - 1]
          if (!expected) throw new Error(`Missing established label for ${reference}`)

          expect(
            describePatternSelectionRelationships({ reference, speedRatio, orientation: 180 })
              .label,
          ).toBe(expected)
        }
      }
    },
  )

  it('keeps every equal-rate Qtr relationship invariant across Beats', () => {
    const mismatches: string[] = []

    for (const speedRatio of vtgSpeedRatios) {
      for (const row of ruleNumbers) {
        for (const column of ruleNumbers) {
          const reference: VtgCellReference = `${row}-${column}`
          for (const quarters of qtrModes) {
            const expected = describePatternSelectionRelationships({
              reference,
              speedRatio,
              quarters,
            }).label
            for (const beat of getVtgBeats(speedRatio)) {
              for (const transition of booleanOptions) {
                const actual = describePatternSelectionRelationships({
                  reference,
                  speedRatio,
                  quarters,
                  beat,
                  transition,
                }).label
                if (actual !== expected) {
                  mismatches.push(
                    `${reference}/${speedRatio}/${quarters}/${beat}/${transition}: ${expected} -> ${actual}`,
                  )
                }
              }
            }
          }
        }
      }
    }

    expect(mismatches).toEqual([])
  })

  it('toggles only prop Quarter timing for a retained quarter-turn across the Qtr grid', () => {
    const orientations = [-90, -45, 0, 45, 90, 180] as const

    for (const row of ruleNumbers) {
      for (const column of ruleNumbers) {
        const reference: VtgCellReference = `${row}-${column}`
        for (const quarters of qtrModes) {
          for (const orientation of orientations) {
            const base = describePatternSelectionRelationships({
              reference,
              speedRatio: '1:3',
              quarters,
              orientation,
            })
            const rotated = describePatternSelectionRelationships({
              reference,
              speedRatio: '1:3',
              quarters,
              orientation,
              propRotationOffsets: [90, 0],
            })

            expect(rotated.hands).toEqual(base.hands)
            expect(rotated.props?.direction).toBe(base.props?.direction)
            expect(rotated.props?.timing === 'Q').toBe(base.props?.timing !== 'Q')
          }
        }
      }
    }
  })

  it('derives every established VTG label and tooltip across supported settings', () => {
    for (const row of ruleNumbers) {
      for (const column of ruleNumbers) {
        const reference: VtgCellReference = `${row}-${column}`
        const establishedLabel = expectedLabelsByRow[row][column - 1]
        if (!establishedLabel) throw new Error(`Missing expected label for ${reference}`)
        const antiOptions = spinToggleCells.has(reference) ? booleanOptions : ([false] as const)

        for (const speedRatio of vtgSpeedRatios) {
          for (const isAnti of antiOptions) {
            const orientations =
              speedRatio === '1:2' || speedRatio === '1:4'
                ? ([-90, 0, 90, 180] as const)
                : ([0] as const)
            for (const orientation of orientations) {
              for (const swapProps of booleanOptions) {
                for (const reversePlane of booleanOptions) {
                  const animation = createDefaultVtgAnimation({
                    reference,
                    speedRatio,
                    isAnti,
                    swapProps,
                    reversePlane,
                    orientation,
                  })
                  if (!animation) throw new Error(`Missing VTG animation for ${reference}`)

                  const quarterTurn = orientation === -90 || orientation === 90
                  const expectedOrientationLabel = quarterTurn
                    ? expectedLabelsByRow[column][row - 1]
                    : establishedLabel
                  if (!expectedOrientationLabel) {
                    throw new Error(`Missing rotated label for ${reference}`)
                  }
                  expect(
                    describePatternRelationships(animation, quarterTurn ? 'source' : 'destination'),
                  ).toMatchObject({
                    label: expectedOrientationLabel,
                    description: expectedDescription(expectedOrientationLabel),
                  })
                }
              }
            }
          }
        }
      }
    }
  })

  it('derives relative Qtr timing while preserving every direction comparison', () => {
    for (const row of ruleNumbers) {
      for (const column of ruleNumbers) {
        const reference: VtgCellReference = `${row}-${column}`
        const establishedLabel = expectedLabelsByRow[row][column - 1]
        if (!establishedLabel) throw new Error(`Missing expected label for ${reference}`)
        const antiOptions = spinToggleCells.has(reference) ? booleanOptions : ([false] as const)

        for (const speedRatio of vtgSpeedRatios) {
          for (const isAnti of antiOptions) {
            const orientations =
              speedRatio === '1:2' || speedRatio === '1:4'
                ? ([-90, 0, 90, 180] as const)
                : ([0] as const)

            for (const orientation of orientations) {
              for (const swapProps of booleanOptions) {
                for (const reversePlane of booleanOptions) {
                  for (const quarters of qtrModes) {
                    const animation = createDefaultQtrAnimation({
                      reference,
                      speedRatio,
                      isAnti,
                      swapProps,
                      reversePlane,
                      quarters,
                      orientation,
                    })
                    if (!animation) throw new Error(`Missing Qtr animation for ${reference}`)

                    const quarterTurn = orientation === -90 || orientation === 90
                    const expectedOrientationLabel = quarterTurn
                      ? expectedLabelsByRow[column][row - 1]
                      : establishedLabel
                    if (!expectedOrientationLabel) {
                      throw new Error(`Missing rotated Qtr label for ${reference}`)
                    }
                    const expectedLabel = describePatternSelectionRelationships({
                      reference,
                      speedRatio,
                      isAnti,
                      swapProps,
                      reversePlane,
                      quarters,
                      orientation,
                    }).label
                    if (expectedLabel === 'XX / XX') {
                      throw new Error(`Missing relative Qtr label for ${reference}`)
                    }
                    expect(
                      describePatternRelationships(
                        animation,
                        quarterTurn ? 'source' : 'destination',
                      ),
                    ).toMatchObject({
                      label: expectedLabel,
                      description: expectedDescription(expectedLabel),
                    })
                  }
                }
              }
            }
          }
        }
      }
    }
  })
})
