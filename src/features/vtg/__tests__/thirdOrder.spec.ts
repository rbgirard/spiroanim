import { describe, expect, it } from 'vitest'

import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import {
  applyVtgThirdOrderSettings,
  createVtgThirdOrderInitialWarp,
  createVtgThirdOrderWarp,
  detectVtgThirdOrderRelationship,
  extractVtgThirdOrderSettings,
  getVtgThirdOrderCycleCount,
  getVtgThirdOrderDisplaySettings,
  opposeVtgThirdOrderTiming,
  vtgThirdOrderTimingOptions,
  type VtgThirdOrderSettings,
  type VtgThirdOrderTiming,
} from '@/features/vtg/thirdOrder'
import { resolveAnimationFrames } from '@/math/animation/frameSemantics'

const createAnimation = () => {
  const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
  if (!animation) throw new Error('Expected a supported VTG animation')
  return animation
}

describe('Third Order VTG settings', () => {
  it('requires two hand-path cycles when an active continuing timing has a 2 numerator', () => {
    expect(getVtgThirdOrderCycleCount([{ timing: '1:3-anti' }, {}])).toBe(1)
    expect(getVtgThirdOrderCycleCount([{ timing: '2:3-anti' }, {}])).toBe(2)
    expect(getVtgThirdOrderCycleCount([{ initial: '2:3-anti' }, {}])).toBe(2)
    expect(getVtgThirdOrderCycleCount([{ initial: '2:3-anti', timing: '1:3-pro' }, {}])).toBe(1)
    expect(getVtgThirdOrderCycleCount([{}, { timing: '2:5-pro' }])).toBe(2)
    expect(getVtgThirdOrderCycleCount([{}, { timing: '2:5-pro' }], true)).toBe(1)
  })

  it('offers every established timing in Anti then Pro order', () => {
    expect(vtgThirdOrderTimingOptions.map(({ label }) => label)).toEqual([
      '1:1 Anti',
      '1:1 Pro',
      '2:1 Anti',
      '2:1 Pro',
      '1:2 Anti',
      '1:2 Pro',
      '1:3 Anti',
      '1:3 Pro',
      '2:3 Anti',
      '2:3 Pro',
      '1:4 Anti',
      '1:4 Pro',
      '1:5 Anti',
      '1:5 Pro',
      '2:5 Anti',
      '2:5 Pro',
    ])
  })

  it.each([
    ['1:1-anti', -90],
    ['1:1-pro', 0],
    ['2:1-anti', -67.5],
    ['2:1-pro', -22.5],
    ['1:2-anti', -135],
    ['1:2-pro', 45],
    ['1:3-anti', -180],
    ['1:3-pro', 90],
    ['2:3-anti', -112.5],
    ['2:3-pro', 22.5],
    ['1:4-anti', -225],
    ['1:4-pro', 135],
    ['1:5-anti', -270],
    ['1:5-pro', 180],
    ['2:5-anti', -157.5],
    ['2:5-pro', 67.5],
  ] as const)('derives %s Warp from the frame Arc', (timing, expected) => {
    expect(createVtgThirdOrderWarp(45, timing)).toBe(expected)
  })

  it('uses each frame actual Arc and stores Strength in tenths of a percent', () => {
    const source = createAnimation()
    const sourceSnapshot = structuredClone(source)
    const resolvedSource = resolveAnimationFrames(source.props[0]!.anim)
    const timing = '2:3-pro' satisfies VtgThirdOrderTiming

    const applied = applyVtgThirdOrderSettings(source, [
      { initial: '1:3-anti', strength: 55, timing },
      {},
    ])

    expect(source).toEqual(sourceSnapshot)
    expect(applied.props[0]?.anim[0]?.warp).toBe(createVtgThirdOrderInitialWarp('1:3-anti'))
    expect(applied.props[0]?.anim[0]?.strength).toBe(550)
    const resolvedApplied = resolveAnimationFrames(applied.props[0]!.anim)
    for (let frameIndex = 1; frameIndex < resolvedApplied.length; frameIndex += 1) {
      expect(resolvedApplied[frameIndex]?.warp).toBe(
        createVtgThirdOrderWarp(resolvedSource[frameIndex]!.arc, timing),
      )
      expect(applied.props[0]?.anim[frameIndex]?.strength).toBeUndefined()
    }
    expect(applied.props[0]?.anim[1]?.warp).toBeTypeOf('number')
    expect(applied.props[0]?.anim.slice(2).every((frame) => frame.warp === undefined)).toBe(true)
  })

  it('authors a new Timing Warp only when the resolved Arc changes', () => {
    const source = createAnimation()
    source.props[0]!.anim[3] = { ...source.props[0]!.anim[3], arc: 90 }
    source.props[0]!.anim[5] = { ...source.props[0]!.anim[5], arc: 45 }
    const timing = '1:3-pro' satisfies VtgThirdOrderTiming
    const applied = applyVtgThirdOrderSettings(source, [{ timing }, {}])
    const resolved = resolveAnimationFrames(applied.props[0]!.anim)

    expect(
      applied.props[0]?.anim.flatMap((frame, index) => (frame.warp === undefined ? [] : [index])),
    ).toEqual([1, 3, 5])
    for (let frameIndex = 1; frameIndex < resolved.length; frameIndex += 1) {
      expect(resolved[frameIndex]?.warp).toBe(
        createVtgThirdOrderWarp(resolved[frameIndex]!.arc, timing),
      )
    }
  })

  it('mirrors Left onto Right and swaps Anti with Pro when Opposed', () => {
    const source = createAnimation()
    const resolvedRight = resolveAnimationFrames(source.props[1]!.anim)
    const applied = applyVtgThirdOrderSettings(
      source,
      [{ initial: 90, strength: 55, timing: '1:3-anti' }, {}],
      { mirror: true, opposed: true },
    )

    expect(opposeVtgThirdOrderTiming('1:3-anti')).toBe('1:3-pro')
    expect(opposeVtgThirdOrderTiming('2:5-pro')).toBe('2:5-anti')
    expect(applied.props[0]?.anim[0]).toMatchObject({ warp: 90, strength: 550 })
    expect(applied.props[1]?.anim[0]).toMatchObject({ warp: 90, strength: 550 })
    expect(applied.props[1]?.anim[1]?.warp).toBe(
      createVtgThirdOrderWarp(resolvedRight[1]!.arc, '1:3-pro'),
    )
    expect(detectVtgThirdOrderRelationship(applied)).toEqual({
      mirror: true,
      opposed: true,
    })
  })

  it('does not treat mirrored frame-zero Arc as a movement interval', () => {
    const source = createAnimation()
    source.props[0]!.anim[0] = { ...source.props[0]!.anim[0], arc: 180 }
    source.props[1]!.anim[0] = { ...source.props[1]!.anim[0], arc: 0 }

    const mirrored = applyVtgThirdOrderSettings(source, [{ initial: '1:3-anti' }, {}], {
      mirror: true,
    })

    expect(createVtgThirdOrderInitialWarp('1:3-anti')).toBe(-180)
    expect(mirrored.props[0]?.anim[0]?.warp).toBe(-180)
    expect(mirrored.props[1]?.anim[0]?.warp).toBe(-180)
    expect(mirrored.props[0]?.anim.slice(1).every((frame) => frame.warp === undefined)).toBe(true)
    expect(mirrored.props[1]?.anim.slice(1).every((frame) => frame.warp === undefined)).toBe(true)
  })

  it('uses canonical Initial values while calculating mirrored Timing from each prop own Arc', () => {
    const source = createAnimation()
    source.props[0]!.anim[0] = { ...source.props[0]!.anim[0], arc: 90 }
    source.props[1]!.anim[0] = { ...source.props[1]!.anim[0], arc: 45 }
    source.props[0]!.anim[1] = { ...source.props[0]!.anim[1], arc: 45 }
    source.props[1]!.anim[1] = { ...source.props[1]!.anim[1], arc: 90 }

    const mirrored = applyVtgThirdOrderSettings(
      source,
      [{ initial: '1:3-anti', strength: 55, timing: '2:3-pro' }, {}],
      { mirror: true },
    )

    expect(mirrored.props[0]?.anim[0]?.warp).toBe(createVtgThirdOrderInitialWarp('1:3-anti'))
    expect(mirrored.props[1]?.anim[0]?.warp).toBe(createVtgThirdOrderInitialWarp('1:3-anti'))
    expect(mirrored.props[0]?.anim[1]?.warp).toBe(createVtgThirdOrderWarp(45, '2:3-pro'))
    expect(mirrored.props[1]?.anim[1]?.warp).toBe(createVtgThirdOrderWarp(90, '2:3-pro'))
    expect(mirrored.props[1]?.anim[0]?.strength).toBe(550)
  })

  it('opposes an Initial timing dropdown while leaving undefined values undefined', () => {
    const source = createAnimation()
    const resolvedRight = resolveAnimationFrames(source.props[1]!.anim)
    const applied = applyVtgThirdOrderSettings(
      source,
      [{ initial: '2:3-anti' }, { strength: 25, timing: '1:5-pro' }],
      { mirror: true, opposed: true },
    )

    expect(applied.props[1]?.anim[0]?.warp).toBe(createVtgThirdOrderInitialWarp('2:3-pro'))
    expect(applied.props[1]?.anim.every((frame) => frame.strength === undefined)).toBe(true)
    expect(applied.props[1]?.anim.slice(1).every((frame) => frame.warp === undefined)).toBe(true)
    expect(detectVtgThirdOrderRelationship(applied)).toEqual({
      mirror: true,
      opposed: true,
    })
  })

  it('detects ordinary mirroring before opposed or independent sides', () => {
    const source = createAnimation()
    const mirrored = applyVtgThirdOrderSettings(
      source,
      [{ initial: '1:2-pro', strength: 40, timing: '2:5-anti' }, {}],
      { mirror: true },
    )
    const independent = applyVtgThirdOrderSettings(source, [
      { initial: '1:2-pro', strength: 40, timing: '2:5-anti' },
      { initial: '1:3-pro', strength: 65, timing: '1:4-anti' },
    ])

    expect(detectVtgThirdOrderRelationship(source)).toEqual({ mirror: true, opposed: false })
    expect(detectVtgThirdOrderRelationship(mirrored)).toEqual({
      mirror: true,
      opposed: false,
    })
    expect(detectVtgThirdOrderRelationship(independent)).toEqual({
      mirror: false,
      opposed: false,
    })
  })

  it('removes authored channels while inherited display values remain available', () => {
    const source = createAnimation()
    const authored = applyVtgThirdOrderSettings(source, [
      { initial: '1:2-pro', strength: 40, timing: '1:1-pro' },
      {},
    ])
    const cleared = applyVtgThirdOrderSettings(authored, [{}, {}])
    const display = getVtgThirdOrderDisplaySettings(cleared, [{}, {}])

    expect(cleared.props[0]?.anim.every((frame) => frame.warp === undefined)).toBe(true)
    expect(cleared.props[0]?.anim.every((frame) => frame.strength === undefined)).toBe(true)
    expect(display.initial[0]).toBe('1:1-pro')
    expect(display.strength[0]).toBe(100)
    expect(display.timing[0]).toBe('1:1-pro')
  })

  it('shows Initial as the inherited Timing without authoring continuation Warp', () => {
    const source = createAnimation()
    const settings: VtgThirdOrderSettings = [{ initial: '2:3-anti' }, {}]
    const applied = applyVtgThirdOrderSettings(source, settings)
    const display = getVtgThirdOrderDisplaySettings(applied, settings)
    const resolved = resolveAnimationFrames(applied.props[0]!.anim)

    expect(display.timing[0]).toBe('2:3-anti')
    expect(applied.props[0]?.anim.slice(1).every((frame) => frame.warp === undefined)).toBe(true)
    expect(resolved.slice(1).every((frame) => frame.warp === resolved[0]?.warp)).toBe(true)
  })

  it('leaves a later Builder portion context frame untouched', () => {
    const source = createAnimation()
    source.props[0]!.anim[0] = { ...source.props[0]!.anim[0], warp: 135, strength: 700 }
    const resolvedSource = resolveAnimationFrames(source.props[0]!.anim)
    const applied = applyVtgThirdOrderSettings(
      source,
      [{ initial: 45, strength: 25, timing: '1:2-pro' }, {}],
      { firstEditableFrameIndex: 1 },
    )

    expect(applied.props[0]?.anim[0]).toMatchObject({ warp: 135, strength: 700 })
    expect(applied.props[0]?.anim[1]?.strength).toBe(250)
    expect(applied.props[0]?.anim[1]?.warp).toBe(
      createVtgThirdOrderWarp(resolvedSource[1]!.arc, '1:2-pro'),
    )
    expect(applied.props[0]?.anim[2]?.strength).toBeUndefined()
  })

  it('extracts authored settings and switches Initial to a numeric Warp when Timing exists', () => {
    const source = createAnimation()
    const applied = applyVtgThirdOrderSettings(source, [
      { initial: '1:4-pro', strength: 65, timing: '2:5-anti' },
      { initial: '1:1-pro' },
    ])
    const extracted = extractVtgThirdOrderSettings(applied)

    expect(extracted[0]).toEqual({
      initial: applied.props[0]?.anim[0]?.warp,
      strength: 65,
      timing: '2:5-anti',
    })
    expect(extracted[1]).toEqual({ initial: '1:1-pro' })
  })
})
