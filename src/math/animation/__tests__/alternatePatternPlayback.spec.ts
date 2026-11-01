import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { findVtgPatternMatch } from '@/features/vtg/matchVtgAnimation'
import { findQtrPatternMatch } from '@/features/vtg/qtr/matchQtrAnimation'
import type { QtrPatternSelection } from '@/features/vtg/types'
import { vtgSpeedRatios } from '@/features/vtg/types'
import {
  analyzeAlternatingPatternPlayback,
  alternatePatternPlayback,
} from '@/math/animation/alternatePatternPlayback'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CHARSET, VDEF } from '@/services/query/versions/SpiroAnimQSv5'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'

describe('alternatePatternPlayback', () => {
  const createDoubledQtrAnimation = (selection: QtrPatternSelection) =>
    createDefaultQtrAnimation(selection)

  it('transitions both props at each interval boundary by default', () => {
    const base = createDoubledQtrAnimation({
      reference: '1-1',
      speedRatio: '1:3',
      quarters: 1,
    })
    if (!base) throw new Error('Expected doubled QTR animation')

    const animation = alternatePatternPlayback(base)
    if (!animation) throw new Error('Expected alternating animation')

    expect(animation.props.map((prop) => prop.anim.length)).toEqual([33, 33])
    expect(animation.props[0]!.anim[8]).toEqual({ turns: 90, plane: 180 })
    expect(animation.props[1]!.anim[8]).toEqual({ turns: 90, plane: 180 })
    expect(animation.props[0]!.anim[16]).toEqual({ turns: -180, plane: 180 })
    expect(animation.props[1]!.anim[16]).toEqual({ turns: -180, plane: 180 })
    expect(animation.props[0]!.anim[24]).toEqual({ turns: 90, plane: 180 })
    expect(animation.props[1]!.anim[24]).toEqual({ turns: 90, plane: 180 })
    expect(animation.props[0]!.anim[32]).toEqual({ turns: -180, plane: 180 })
    expect(animation.props[1]!.anim[32]).toEqual({ turns: -180, plane: 180 })
  })

  it.each(['2:1', '2:3', '2:5'] as const)(
    'uses eight reciprocal transition passes when %s is involved',
    (speedRatio) => {
      const base = createDefaultVtgAnimation({ reference: '1-1', speedRatio })
      if (!base) throw new Error(`Expected a ${speedRatio} VTG animation`)

      const animation = alternatePatternPlayback(base)
      if (!animation) throw new Error(`Expected an alternating ${speedRatio} animation`)

      const changeFrames = Array.from({ length: 8 }, (_, index) => (index + 1) * 8)
      for (const frameIndex of changeFrames) {
        expect(animation.props[0]?.anim[frameIndex]).toMatchObject({ plane: 180 })
        expect(animation.props[1]?.anim[frameIndex]).toMatchObject({ plane: 180 })
      }
      expect(analyzeAlternatingPatternPlayback(animation)?.base).toEqual(base)
    },
  )

  it.each(vtgSpeedRatios)('derives valid alternating turns for %s', (speedRatio) => {
    const base = createDoubledQtrAnimation({
      reference: '1-1',
      speedRatio,
      quarters: 1,
    })
    if (!base) throw new Error(`Expected doubled ${speedRatio} QTR animation`)

    const animation = alternatePatternPlayback(base)

    expect(animation).toBeDefined()
    expect(analyzeAlternatingPatternPlayback(animation!)?.base).toEqual(base)
  })

  it.each([
    { transitionBeats: 6, frameCount: 49, changeFrames: [12, 24, 36, 48] },
    { transitionBeats: 5, frameCount: 41, changeFrames: [10, 20, 30, 40] },
    { transitionBeats: 4, frameCount: 33, changeFrames: [8, 16, 24, 32] },
    { transitionBeats: 3, frameCount: 25, changeFrames: [6, 12, 18, 24] },
    { transitionBeats: 2, frameCount: 17, changeFrames: [4, 8, 12, 16] },
  ] as const)(
    'places reciprocal changes every $transitionBeats beats',
    ({ transitionBeats, frameCount, changeFrames }) => {
      const base = createDoubledQtrAnimation({
        reference: '1-1',
        speedRatio: '1:3',
        quarters: 1,
      })
      if (!base) throw new Error('Expected doubled QTR animation')

      const animation = alternatePatternPlayback(base, transitionBeats)
      if (!animation) throw new Error('Expected alternating animation')

      expect(animation.props.map((prop) => prop.anim.length)).toEqual([frameCount, frameCount])
      for (const frameIndex of changeFrames) {
        expect(animation.props[0]?.anim[frameIndex]).toMatchObject({ plane: 180 })
        expect(animation.props[1]?.anim[frameIndex]).toMatchObject({ plane: 180 })
      }
      expect(analyzeAlternatingPatternPlayback(animation)).toEqual({
        base,
        transitionBeats,
        transitionQuad: false,
        transitionSecond: false,
        transitionAfterBeat: false,
      })
    },
  )

  it('uses Quad to alternate four changes starting with the selected prop', () => {
    const base = createDoubledQtrAnimation({
      reference: '1-1',
      speedRatio: '1:3',
      quarters: 1,
    })
    if (!base) throw new Error('Expected doubled QTR animation')

    const animation = alternatePatternPlayback(base, 3, 1, true)
    if (!animation) throw new Error('Expected alternating animation')

    expect(animation.props[0]!.anim[6]).toEqual({})
    expect(animation.props[1]!.anim[6]).toMatchObject({ plane: 180 })
    expect(analyzeAlternatingPatternPlayback(animation)).toEqual({
      base,
      transitionBeats: 3,
      transitionQuad: true,
      transitionSecond: true,
      transitionAfterBeat: false,
    })
  })

  it('generates Quad transitions immediately after each completed interval', async () => {
    const animation = createDefaultVtgAnimation({
      reference: '2-2',
      speedRatio: '1:2',
      orientation: -90,
      transition: true,
      transitionAfterBeat: true,
      transitionBeats: 3,
      transitionQuad: true,
    })
    if (!animation) throw new Error('Expected a VTG Quad transition')
    expect(findVtgPatternMatch(animation)).toMatchObject({
      reference: '2-2',
      transition: true,
      transitionAfterBeat: true,
    })

    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const legacyScaleAnimation = {
      ...animation,
      props: animation.props.map((prop) => ({
        ...prop,
        anim: prop.anim.map((frame) => ({
          ...frame,
          ...(frame.scale === undefined ? undefined : { scale: frame.scale / 10 }),
        })),
      })),
    }
    expect(codec.encodeQS(legacyScaleAnimation, false)).toEqual({
      r: 'Ew08Yk11Y',
      p0: 'Q__.mBE_____q.5JEvF......_ZEsR............_ZEvF.....',
      m0: '_1_mxqv__',
      p1: 'N__.07______q.5L_vF............_ZEsR...........',
      c: '_f_bhq',
      v: '6',
    })
  })

  it('recovers a two-rotation Trans 6 Quad cycle after each completed interval', () => {
    const base = createDefaultVtgAnimation({
      reference: '5-6',
      speedRatio: '2:3',
      isAnti: true,
      swapProps: true,
      reversePlane: false,
      beat: 7.5,
      orientation: -45,
      propRotationOffsets: [-22.5, 157.5],
    })
    if (!base) throw new Error('Expected a two-rotation VTG animation')

    const animation = alternatePatternPlayback(base, 6, 0, true, true)
    if (!animation) throw new Error('Expected a Trans 6 Quad animation')

    expect(analyzeAlternatingPatternPlayback(animation)).toEqual({
      base,
      transitionBeats: 6,
      transitionQuad: true,
      transitionSecond: false,
      transitionAfterBeat: true,
    })
    const baseMatch = findVtgPatternMatch(base)
    const transitionMatch = findVtgPatternMatch(animation)
    expect(baseMatch).toBeDefined()
    expect(transitionMatch).toMatchObject(baseMatch!)
    expect(transitionMatch).toMatchObject({
      speedRatio: '2:3',
      transition: true,
      transitionBeats: 6,
      transitionQuad: true,
      transitionAfterBeat: true,
    })
  })

  it('matches the supplied serialized two-rotation Trans 6 Quad animation', async () => {
    const version = await loadSpiroAnimQSVersion(10)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      10,
    )
    const animation = codec.decodeQS({
      r: 'Ew68Yk11Y',
      p0: 'Q__.mD_Qpg.5E0QzP............_ZEQUV........................_ZEQzP........................_ZEQUV........................_ZEQzP...........',
      x0: '_p_',
      m0: '_1_mxqv__',
      p1: 'N__.bg0Rhw.5E0QzP........................_ZEQUV........................_ZEQzP........................_ZEQUV.......................',
      x1: '_p_',
      c: '_e_bhq',
      v: '10',
    })
    const base = codec.decodeQS({
      r: 'Ew08Yk11Y',
      p0: 'Q__.mD_Qpg.5E0QzP...............',
      x0: '_p_',
      m0: '_1_mxqv__',
      p1: 'N__.bg0Rhw.5E0QzP...............',
      x1: '_p_',
      c: '_e_bhq',
      v: '10',
    })

    const baseMatch = findVtgPatternMatch(base)
    const transitionMatch = findVtgPatternMatch(animation)
    expect(baseMatch).toBeDefined()
    expect(transitionMatch).toMatchObject(baseMatch!)
    expect(transitionMatch).toMatchObject({
      speedRatio: '2:3',
      transition: true,
      transitionBeats: 6,
      transitionQuad: true,
      transitionAfterBeat: true,
    })
  })

  it('ranks the supplied transition and its base animation identically', async () => {
    const version = await loadSpiroAnimQSVersion(10)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      10,
    )
    const transition = codec.decodeQS({
      r: 'Ew08Yk11Y',
      p0: 'Q__.mD_Qpg.5E0QzP........_ZEQUV................_ZEQzP................_ZEQUV................_ZEQzP.......',
      x0: '_p_',
      m0: '_1_mxqv__',
      p1: 'N__.bg0Rhw.5E0QzP................_ZEQUV................_ZEQzP................_ZEQUV...............',
      x1: '_p_',
      c: '_e_bhq',
      v: '10',
    })
    const base = codec.decodeQS({
      r: 'Ew08Yk11Y',
      p0: 'Q__.mD_Qpg.5E0QzP...............',
      x0: '_p_',
      m0: '_1_mxqv__',
      p1: 'N__.bg0Rhw.5E0QzP...............',
      x1: '_p_',
      c: '_e_bhq',
      v: '10',
    })

    const baseMatch = findVtgPatternMatch(base)
    const transitionMatch = findVtgPatternMatch(transition)
    expect(baseMatch).toBeDefined()
    expect(transitionMatch).toMatchObject(baseMatch!)
  })

  it('does not analyze an ordinary doubled cycle as alternating playback', () => {
    const base = createDoubledQtrAnimation({
      reference: '1-1',
      speedRatio: '1:3',
      quarters: 1,
    })
    if (!base) throw new Error('Expected doubled QTR animation')

    expect(analyzeAlternatingPatternPlayback(base)).toBeUndefined()
  })

  it('matches the supplied legacy boundary-timed QTR transition', async () => {
    const codec = await useSpiroAnimQS(VDEF, useBaseQS(VDEF, { charset: CHARSET }), 5)
    const suppliedQuery = {
      r: 'Ew09Aj11Y',
      p0: 'N__.mBE_____s.5JEs8........._ZEwm...................._ZEs8..........',
      p1: 'S__.blE_____s.5JEs8..................._ZEwm...................._U0s8',
      c: '_i_bhq~',
      v: '5',
    } as const
    const animation = codec.decodeQS(suppliedQuery)

    expect(findQtrPatternMatch(animation)).toMatchObject({
      reference: '1-1',
      speedRatio: '1:3',
      quarters: 1,
      transition: true,
    })

    const generated = createDefaultQtrAnimation({
      reference: '1-1',
      speedRatio: '1:3',
      quarters: 1,
      transition: true,
      transitionBeats: 5,
      transitionQuad: true,
    })
    if (!generated) throw new Error('Expected generated transition')
    expect(generated.props[0]?.anim[10]).toMatchObject({ plane: 180 })
    expect(generated.props[1]?.anim[20]).toMatchObject({ plane: 180 })
    expect(generated.props[0]?.anim[30]).toMatchObject({ plane: 180 })
    expect(generated.props[1]?.anim[40]).toMatchObject({ plane: 180 })
  })
})
