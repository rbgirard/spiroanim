import { describe, expect, it } from 'vitest'

import {
  formatVtgSpeedRatio,
  getDefaultVtgPatternOrientation,
  getVtgBeats,
  getVtgTimingCycleCount,
  getVtgPropSpeedRatios,
  isVtgSpeedRatio,
  vtgMoreRatioPickerRatios,
  vtgRatioPickerRatios,
  parseVtgIndividualSpeedRatio,
} from '@/features/vtg/types'

describe('VTG speed ratio helpers', () => {
  it('extends the More picker without changing the established ratio controls', () => {
    expect(vtgMoreRatioPickerRatios.slice(0, vtgRatioPickerRatios.length)).toEqual(
      vtgRatioPickerRatios,
    )
    expect(vtgMoreRatioPickerRatios.slice(vtgRatioPickerRatios.length)).toEqual([
      '1:7',
      '2:7',
      '1:9',
      '2:9',
      '1:11',
      '2:11',
      '1:13',
      '2:13',
    ])
  })

  it.each([
    ['2:1', ['2:1', '2:1']],
    ['2:3v5', ['2:3', '2:5']],
    ['2:5v3', ['2:5', '2:3']],
    ['1:1v2:3', ['1:1', '2:3']],
    ['2:3v1:1', ['2:3', '1:1']],
  ] as const)('parses canonical timing %s', (timing, expected) => {
    expect(isVtgSpeedRatio(timing)).toBe(true)
    expect(getVtgPropSpeedRatios(timing)).toEqual(expected)
  })

  it.each(['2:2', '2:4', '2:3v3', '2:3v2:5', '0:1', '1:0', '-1:2', '1.5:2'])(
    'rejects noncanonical timing %s',
    (timing) => {
      expect(isVtgSpeedRatio(timing)).toBe(false)
    },
  )

  it('formats compound timings according to their numerators', () => {
    expect(formatVtgSpeedRatio('2:3', '2:5')).toBe('2:3v5')
    expect(formatVtgSpeedRatio('1:1', '2:3')).toBe('1:1v2:3')
    expect(parseVtgIndividualSpeedRatio('2:4')).toBeUndefined()
  })

  it('uses the shared-numerator cycle length for curated ratios', () => {
    expect(getVtgTimingCycleCount('1:3v2')).toBe(1)
    expect(getVtgTimingCycleCount('2:3v5')).toBe(2)
    expect(getVtgTimingCycleCount('1:1v2:3')).toBe(2)
  })

  it('offers starting beats across the complete timing cycle', () => {
    expect(getVtgBeats('1:3').at(-1)).toBe(4.5)
    expect(getVtgBeats('2:1').at(-1)).toBe(8.5)
    expect(getVtgBeats('2:1v1:1').at(-1)).toBe(8.5)
  })

  it.each(['2:1', '2:3', '2:5'] as const)('defaults %s to -90 degrees', (speedRatio) => {
    expect(getDefaultVtgPatternOrientation(speedRatio)).toBe(-90)
  })
})
