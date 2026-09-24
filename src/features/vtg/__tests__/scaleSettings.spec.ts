import { describe, expect, it } from 'vitest'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { applyVtgScaleSettings, readPatternScaleValues } from '@/features/vtg/scaleSettings'
import { stripVtgPropertySettings } from '@/features/vtg/stripVtgPropertySettings'
import { findVtgPatternMatch } from '@/features/vtg/matchVtgAnimation'
import { findQtrPatternMatch } from '@/features/vtg/qtr/matchQtrAnimation'
import type { VtgScaleSettings } from '@/types/AnimationScale'
import type { VtgSpeedRatio } from '@/features/vtg/types'

describe('VTG Scale settings', () => {
  it.each<[VtgSpeedRatio, number]>([
    ['1:1', 0.9],
    ['1:2', 0.6],
    ['1:3', 0.8],
    ['2:3', 0.6],
    ['1:4', 0.9],
    ['1:5', 1],
    ['2:5', 0.9],
    ['1:3v2', 0.8],
  ])('preserves automatic sizing for %s in VTG and QTR', (speedRatio, expected) => {
    for (const animation of [
      createDefaultVtgAnimation({ reference: '1-1', speedRatio }),
      createDefaultQtrAnimation({ reference: '1-1', speedRatio, quarters: 1 }),
    ]) {
      expect(animation).toBeDefined()
      expect(animation!.vtgScale).toEqual({ auto: true, base: 0.8, mode: 'simple' })
      expect(readPatternScaleValues(animation!, true).map((side) => side['0'])).toEqual([
        expected,
        expected,
      ])
    }
  })

  it('uses each manual prop value after VTG and QTR transforms, without ratio offsets', () => {
    const scaleSettings: VtgScaleSettings = {
      auto: false,
      base: 0.8,
      mode: 'simple',
      values: [{ 0: 0 }, { 0: 1.2 }],
    }
    for (const speedRatio of ['1:2', '1:5'] as const) {
      const selection = {
        reference: '1-1' as const,
        speedRatio,
        swapProps: true,
        reversePlane: true,
        beat: 2 as const,
        scaleSettings,
      }
      const vtg = createDefaultVtgAnimation(selection)!
      const qtr = createDefaultQtrAnimation({ ...selection, quarters: 1 })!
      for (const animation of [vtg, qtr]) {
        const values = readPatternScaleValues(animation, true)
        expect(Object.values(values[0]).every((value) => value === 0)).toBe(true)
        expect(Object.values(values[1]).every((value) => value === 1.2)).toBe(true)
        expect(animation.vtgScale?.auto).toBe(false)
      }
      expect(findVtgPatternMatch(stripVtgPropertySettings(vtg))).toBeDefined()
      expect(findQtrPatternMatch(stripVtgPropertySettings(qtr))).toBeDefined()
    }
  })

  it('preserves sparse Advanced values and inheritance without mutating its source', () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })!
    const before = JSON.stringify(source)
    const manual = applyVtgScaleSettings(
      source,
      { auto: false, base: 0.8, mode: 'advanced', values: [{ 0: 0.4, 0.5: 0.7 }, { 0: 1.3 }] },
      '1:3',
    )
    expect(readPatternScaleValues(manual)).toEqual([{ 0: 0.4, 0.5: 0.7 }, { 0: 1.3 }])
    expect(readPatternScaleValues(manual, true)[0]['1']).toBe(0.7)
    expect(readPatternScaleValues(manual, true)[1]['1']).toBe(1.3)
    expect(JSON.stringify(source)).toBe(before)
    const auto = applyVtgScaleSettings(
      manual,
      { auto: true, base: 1.4, mode: 'simple', values: [{}, {}] },
      '1:5',
    )
    expect(readPatternScaleValues(auto)).toEqual([{ 0: 1.4 }, { 0: 1.4 }])
    expect(auto.vtgScale?.base).toBe(1.4)
  })
})
