import { describe, expect, it } from 'vitest'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import {
  applyVtgScaleSettings,
  detectVtgAutoScale,
  readPatternScaleValues,
} from '@/features/vtg/scaleSettings'
import { stripVtgPropertySettings } from '@/features/vtg/stripVtgPropertySettings'
import { findVtgPatternMatch } from '@/features/vtg/matchVtgAnimation'
import { findQtrPatternMatch } from '@/features/vtg/qtr/matchQtrAnimation'
import type { VtgScaleSettings } from '@/types/AnimationScale'
import type { VtgSpeedRatio } from '@/features/vtg/types'

describe('VTG Scale settings', () => {
  it.each<[VtgSpeedRatio, number, number]>([
    ['1:3', 0.5, 0.5],
    ['1:3', 1.4, 1.4],
    ['1:5', 0.9, 0.9],
    ['1:5', 1.4, 1.2],
    ['1:2', 0.5, 0.7],
    ['1:3v2', 1.1, 1.1],
  ])(
    'detects an equivalent Auto base for %s at %s without rewriting frames',
    (speedRatio, base, expected) => {
      for (const animation of [
        createDefaultVtgAnimation({ reference: '1-1', speedRatio, scale: base, swapProps: true })!,
        createDefaultQtrAnimation({ reference: '1-1', speedRatio, scale: base, quarters: 1 })!,
      ]) {
        const before = JSON.stringify(animation)
        expect(detectVtgAutoScale(animation, speedRatio)).toBe(expected)
        expect(JSON.stringify(animation)).toBe(before)
      }
    },
  )

  it('recognizes default, inherited, and repeated equal scales from all frames', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })!
    for (const prop of animation.props) {
      for (const frame of prop.anim) delete frame.scale
      prop.anim[2]!.scale = 100
    }
    expect(detectVtgAutoScale(animation, '1:3')).toBe(1)
    animation.props[1]!.anim[3]!.scale = 90
    expect(detectVtgAutoScale(animation, '1:3')).toBeUndefined()
  })

  it.each([0, -0.5, 0.4, 1.5])(
    'keeps uniform %s manual and recognizes its underlying pattern',
    (scale) => {
      const source = createDefaultVtgAnimation({ reference: '1-2', speedRatio: '1:3' })!
      const manual = applyVtgScaleSettings(
        source,
        {
          auto: false,
          base: 0.8,
          mode: 'simple',
          values: [{ 0: scale }, { 0: scale }],
        },
        '1:3',
      )
      const before = JSON.stringify(manual)
      expect(detectVtgAutoScale(manual, '1:3')).toBeUndefined()
      expect(findVtgPatternMatch(stripVtgPropertySettings(manual))).toBeDefined()
      expect(JSON.stringify(manual)).toBe(before)
    },
  )

  it('rejects equal scales that the current ratio cannot generate with a valid base', () => {
    const animation = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:3',
      scale: 0.5,
    })!
    expect(detectVtgAutoScale(animation, '1:5')).toBeUndefined()
  })

  it('does not classify a rounded approximation as Auto', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })!
    for (const prop of animation.props) prop.anim[0]!.scale = 65.5
    expect(detectVtgAutoScale(animation, '1:3')).toBeUndefined()
  })

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
      expect(detectVtgAutoScale(animation!, speedRatio)).toBe(0.8)
      expect(readPatternScaleValues(animation!, true).map((side) => side['0'])).toEqual([
        expected,
        expected,
      ])
    }
  })

  it('keeps each manual value with its authored path through VTG and QTR Swap', () => {
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
        expect(Object.values(values[0]).every((value) => value === 1.2)).toBe(true)
        expect(Object.values(values[1]).every((value) => value === 0)).toBe(true)
        expect(detectVtgAutoScale(animation, speedRatio)).toBeUndefined()
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
    expect(detectVtgAutoScale(auto, '1:5')).toBe(1.2)
  })
})
