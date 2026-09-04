import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { useBaseQS } from '@/services/query/createBaseQS'
import { VDEF } from '@/services/query/versions/SpiroAnimQSv1'
import { VDEF as VDEF_V2 } from '@/services/query/versions/SpiroAnimQSv2'
import { CHARSET as CHARSET_V3, VDEF as VDEF_V3 } from '@/services/query/versions/SpiroAnimQSv3'
import { CHARSET as CHARSET_V4, VDEF as VDEF_V4 } from '@/services/query/versions/SpiroAnimQSv4'
import { CHARSET as CHARSET_V5, VDEF as VDEF_V5 } from '@/services/query/versions/SpiroAnimQSv5'
import { CHARSET as CHARSET_V6, VDEF as VDEF_V6 } from '@/services/query/versions/SpiroAnimQSv6'
import { CHARSET as CHARSET_V7, VDEF as VDEF_V7 } from '@/services/query/versions/SpiroAnimQSv7'
import { CHARSET as CHARSET_V8, VDEF as VDEF_V8 } from '@/services/query/versions/SpiroAnimQSv8'
import { CHARSET as CHARSET_V9, VDEF as VDEF_V9 } from '@/services/query/versions/SpiroAnimQSv9'
import { CHARSET as CHARSET_V10, VDEF as VDEF_V10 } from '@/services/query/versions/SpiroAnimQSv10'
import {
  CHARSET as CHARSET_V11,
  VDEF as VDEF_V11,
  createExtendedAnimationConfig as createExtendedAnimationConfigV11,
  createRotationAnimationConfig as createRotationAnimationConfigV11,
} from '@/services/query/versions/SpiroAnimQSv11'
import {
  CHARSET as CHARSET_V12,
  VDEF as VDEF_V12,
  createExtendedAnimationConfig as createExtendedAnimationConfigV12,
} from '@/services/query/versions/SpiroAnimQSv12'
import { createDefaultCameraFrame } from '@/math/animation/MotionFunc'
import { doubleAnimationFrames } from '@/features/editor/manage/resampleAnimationFrames'
import type { RootDataFinal } from '@/types/AnimTypes'

const createRoot = (): RootDataFinal & { distance: number } => ({
  speed: 1,
  type: 0,
  turns: 0,
  depth: 0,
  smooth: true,
  bpm: 60,
  color: 1,
  prop: 1,
  guides: false,
  anchors: false,
  nodes: true,
  paths: true,
  travel: false,
  hands: true,
  arms: false,
  visible: true,
  aspectx: 16,
  aspecty: 9,
  distance: 22,
  camera: [createDefaultCameraFrame(22)],
  thick: 4,
  props: [
    {
      color: 2,
      anim: [{ arc: 90, plane: 0, turns: -540, move: [2, 0, 0] }],
      motion: [],
    },
  ],
})

describe('useSpiroAnimQS', () => {
  it('preserves the version-1 query representation', async () => {
    const query = await useSpiroAnimQS(VDEF, useBaseQS(VDEF), 1)
    const root = createRoot()

    const encoded = query.encodeQS(root, false)

    expect(encoded).toEqual({
      r: 'GE28EPi9g',
      p0: 'O--.biQmw-------wuu',
      v: '1',
    })
    const decoded = query.decodeQS(encoded)
    expect(decoded.arms).toBe(false)
    expect(query.encodeQS(decoded, false)).toEqual(encoded)
  })

  it('round-trips inherited Arms values in version 2', async () => {
    const query = await useSpiroAnimQS(VDEF_V2, useBaseQS(VDEF_V2), 2)
    const root = createRoot()
    root.arms = true
    root.props[0]!.arms = false

    const encoded = query.encodeQS(root, false)
    const decoded = query.decodeQS(encoded)

    expect(encoded).toEqual({
      r: 'GE28Eji9g',
      p0: 'O--f.biQmw-------wuu',
      v: '2',
    })
    expect(decoded.arms).toBe(true)
    expect(decoded.props[0]!.arms).toBe(false)
  })

  it('uses underscore padding in version 3 while retaining version 2 compatibility', async () => {
    const query = await useSpiroAnimQS(VDEF_V3, useBaseQS(VDEF_V3, { charset: CHARSET_V3 }), 3)
    const root = createRoot()
    root.arms = true
    root.props[0]!.arms = false

    const encoded = query.encodeQS(root, false)

    expect(encoded).toEqual({
      r: 'GE28Eji9g',
      p0: 'O__f.biQmw_______wuu',
      v: '3',
    })
    expect(query.decodeQS(encoded)).toEqual(
      expect.objectContaining({
        arms: true,
        props: [expect.objectContaining({ arms: false })],
      }),
    )

    const decodedV2 = await query.decodeVer({
      r: 'GE28Eji9g',
      p0: 'O--f.biQmw-------wuu',
      v: '2',
    })
    expect(decodedV2.arms).toBe(true)
    expect(decodedV2.props[0]!.arms).toBe(false)
  })

  it('stores Motion separately and omits unused Motion values in version 4', async () => {
    const query = await useSpiroAnimQS(VDEF_V4, useBaseQS(VDEF_V4, { charset: CHARSET_V4 }), 4)
    const root = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props[0]!.motion = [
      { beats: 2 },
      { plane: 0, arc: 90, distance: 2, shape: 1, axis: -45, amount: 75 },
    ]

    const encoded = query.encodeQS(root, false)
    expect(encoded.m0).toBe('.__1.Z2_mxqVq7')
    expect(encoded.v).toBe('4')

    const decoded = query.decodeQS(encoded)
    expect(decoded.props[0]!.anim[0]!.move).toBeUndefined()
    expect(decoded.props[0]!.motion).toEqual([
      { beats: 2 },
      { plane: 0, arc: 90, distance: 2, shape: 1, axis: -45, amount: 75 },
    ])
    expect(query.encodeQS(decoded, false)).toEqual(encoded)

    root.props[0]!.motion = []
    expect(query.encodeQS(root, false)).not.toHaveProperty('m0')

    root.props[0]!.motion = [{}, {}]
    const encodedEmptyFrames = query.encodeQS(root, false)
    expect(encodedEmptyFrames.m0).toBe('..')
    expect(query.decodeQS(encodedEmptyFrames).props[0]!.motion).toEqual([{}, {}])
  })

  it('migrates version 3 MOVE values into Motion when decoded by version 4', async () => {
    const query = await useSpiroAnimQS(VDEF_V4, useBaseQS(VDEF_V4, { charset: CHARSET_V4 }), 4)
    const migrated = await query.decodeVer({
      r: 'GE28Eji9g',
      p0: 'O__f.biQmw_______wuu',
      v: '3',
    })

    expect(migrated.travel).toBe(false)
    expect(migrated.props[0]!.anim[0]!.move).toBeUndefined()
    expect(migrated.props[0]!.motion).toEqual([{ plane: 0, arc: 90, distance: 2 }])
  })

  it('stores Camera under c and migrates legacy Distance in version 5', async () => {
    const query = await useSpiroAnimQS(VDEF_V5, useBaseQS(VDEF_V5, { charset: CHARSET_V5 }), 5)
    const { distance: _legacyDistance, ...root } = createRoot()
    root.camera = [
      createDefaultCameraFrame(22),
      {
        orbit: { beats: 2, shape: 2, amount: 100, distance: 22 },
        center: { arc: 90, distance: 4 },
      },
    ]

    const encoded = query.encodeQS(root, false)
    expect(encoded.c).toBeDefined()
    expect(encoded.r).toBeDefined()
    expect(encoded.v).toBe('5')

    const decoded = query.decodeQS(encoded)
    expect(decoded.camera).toEqual(root.camera)
    expect(query.encodeQS(decoded, false)).toEqual(encoded)

    const migrated = await query.decodeVer({ r: 'GE28Eji9g', v: '4' })
    expect(migrated.camera).toHaveLength(1)
    expect(migrated.camera[0]).toEqual(createDefaultCameraFrame(22))
  })

  it('uses dots only between Camera frames', async () => {
    const query = await useSpiroAnimQS(VDEF_V5, useBaseQS(VDEF_V5, { charset: CHARSET_V5 }), 5)
    const { distance: _legacyDistance, ...root } = createRoot()
    root.camera = [{ orbit: {}, center: {} }]

    const encoded = query.encodeQS(root, false)
    expect(encoded.c).toBe('~')
    expect(query.decodeQS(encoded).camera).toEqual(root.camera)

    root.camera.push({ orbit: {}, center: {} })
    const twoFrames = query.encodeQS(root, false)
    expect(twoFrames.c).toBe('.~.')
    expect(query.decodeQS(twoFrames).camera).toEqual(root.camera)

    const example = query.decodeQS({ ...encoded, c: '__7._m_sNR~.' })
    expect(example.camera).toHaveLength(2)
    expect(query.encodeQS(example, false).c).toBe('__7._m_sNR~.')
  })

  it('stores inherited Motion and Camera Precision in version 6', async () => {
    const query = await useSpiroAnimQS(VDEF_V6, useBaseQS(VDEF_V6, { charset: CHARSET_V6 }), 6)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props[0]!.motion = [
      { distance: 10, precision: true },
      { distance: 20 },
      { distance: 30, precision: false },
    ]
    root.camera = [
      {
        orbit: { distance: 22, precision: true },
        center: { arc: 90, distance: 10, precision: false },
      },
    ]

    const encoded = query.encodeQS(root, false)
    expect(encoded.m0).toBe('_a____v__._k_._u____f__')
    expect(encoded.c).toBe('_m____v__~_a__Vqf__')
    expect(encoded.v).toBe('6')

    const decoded = query.decodeQS(encoded)
    expect(decoded.props[0]!.motion).toEqual(root.props[0]!.motion)
    expect(decoded.camera).toEqual(root.camera)
    expect(query.encodeQS(decoded, false)).toEqual(encoded)
  })

  it('omits an empty trailing Camera Center track in version 6', async () => {
    const query = await useSpiroAnimQS(VDEF_V6, useBaseQS(VDEF_V6, { charset: CHARSET_V6 }), 6)
    const { distance: _legacyDistance, ...root } = createRoot()

    const encoded = query.encodeQS(root, false)

    expect(encoded.c).not.toContain('~')
    expect(query.decodeQS(encoded).camera).toEqual(root.camera)
    expect(query.encodeQS(query.decodeQS(encoded), false)).toEqual(encoded)
  })

  it('uses dots only between standalone Motion frames in version 6', async () => {
    const query = await useSpiroAnimQS(VDEF_V6, useBaseQS(VDEF_V6, { charset: CHARSET_V6 }), 6)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move

    root.props[0]!.motion = [{ distance: 10, precision: true }]
    const oneFrame = query.encodeQS(root, false)
    expect(oneFrame.m0).toBe('_a____v__')
    expect(query.decodeQS(oneFrame).props[0]!.motion).toEqual(root.props[0]!.motion)

    root.props[0]!.motion = [{}]
    const emptyTrack = query.encodeQS(root, false)
    expect(emptyTrack).not.toHaveProperty('m0')

    root.props[0]!.motion = [{}, {}]
    const twoEmptyFrames = query.encodeQS(root, false)
    expect(twoEmptyFrames.m0).toBe('.')
    expect(query.decodeQS(twoEmptyFrames).props[0]!.motion).toEqual(root.props[0]!.motion)
  })

  it('encodes the first two precise horizontal spacing moves in version 6', async () => {
    const query = await useSpiroAnimQS(VDEF_V6, useBaseQS(VDEF_V6, { charset: CHARSET_V6 }), 6)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props.push(structuredClone(root.props[0]!))
    root.props[0]!.motion = [{ precision: true, arc: 90, plane: 0, distance: 1 }]
    root.props[1]!.motion = [{ precision: true, arc: 90, plane: 180, distance: 1 }]

    const encoded = query.encodeQS(root, false)
    expect(encoded.m0).toBe('_1_mxqv__')
    expect(encoded.m1).toBe('_1_J1qv__')
    expect(query.decodeQS(encoded).props.map(({ motion }) => motion)).toEqual(
      root.props.map(({ motion }) => motion),
    )
  })

  it('stores Animation Turns to tenths in a 12-character version-7 frame', async () => {
    const query = await useSpiroAnimQS(VDEF_V7, useBaseQS(VDEF_V7, { charset: CHARSET_V7 }), 7)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props[0]!.anim = [
      {
        plane: -180,
        arc: 360,
        turns: -1980,
        type: 1,
        axis: 180,
        adjust: -180,
        beats: 63,
        scale: 40,
        depth: -30,
      },
      { turns: 12.5 },
      { turns: 1980 },
      {},
    ]

    const encoded = query.encodeQS(root, false)
    const frames = encoded.p0?.split('.').slice(1) ?? []

    expect(encoded).toEqual({
      r: 'GE28E39gY',
      p0: 'O__.J00g0005E0Y-.___QTl.___VGM.',
      c: '_m_bhq',
      v: '7',
    })
    expect(encoded.v).toBe('7')
    expect(frames[0]).toHaveLength(12)
    expect(frames[1]).toHaveLength(6)
    expect(query.decodeQS(encoded).props[0]!.anim).toEqual(root.props[0]!.anim)
    expect(query.encodeQS(query.decodeQS(encoded), false)).toEqual(encoded)
  })

  it('round-trips Juggling Clubs as prop index 2 in version 8', async () => {
    const query = await useSpiroAnimQS(VDEF_V8, useBaseQS(VDEF_V8, { charset: CHARSET_V8 }), 8)
    const { distance: _legacyDistance, ...root } = createRoot()
    root.prop = 2
    root.props[0]!.prop = 2

    const encoded = query.encodeQS(root, false)
    const decoded = query.decodeQS(encoded)

    expect(encoded.v).toBe('8')
    expect(decoded.prop).toBe(2)
    expect(decoded.props[0]!.prop).toBe(2)
  })

  it('round-trips Fans as prop index 3 in version 9', async () => {
    const query = await useSpiroAnimQS(VDEF_V9, useBaseQS(VDEF_V9, { charset: CHARSET_V9 }), 9)
    const { distance: _legacyDistance, ...root } = createRoot()
    root.prop = 3
    root.props[0]!.prop = 3

    const encoded = query.encodeQS(root, false)
    const decoded = query.decodeQS(encoded)

    expect(encoded.v).toBe('9')
    expect(decoded.prop).toBe(3)
    expect(decoded.props[0]!.prop).toBe(3)
  })

  it('stores extended Animation values in compact optional x tracks in version 10', async () => {
    const query = await useSpiroAnimQS(VDEF_V10, useBaseQS(VDEF_V10, { charset: CHARSET_V10 }), 10)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.prop = 3
    root.props[0]!.prop = 3
    root.props[0]!.anim = [
      { arc: 90, beats: 1, scale: 10, depth: 0 },
      { turns: 90, scale: 20, twist: 90 },
      {},
      { twist: 0 },
      {},
      {},
    ]

    const encoded = query.encodeQS(root, false)
    const baseFrames = encoded.p0?.split('.').slice(1) ?? []
    const extendedFrames = encoded.x0?.split('.') ?? []

    expect(encoded.v).toBe('10')
    expect(encoded.x0).toBeDefined()
    expect(encoded.x0).not.toMatch(/^\./)
    expect(encoded.x0).not.toMatch(/\.$/)
    expect(baseFrames).toHaveLength(root.props[0]!.anim.length)
    expect(baseFrames.every((frame) => frame.length <= 9)).toBe(true)
    expect(extendedFrames).toHaveLength(4)
    expect(query.decodeQS(encoded).props[0]!.anim).toEqual(root.props[0]!.anim)
    expect(query.encodeQS(query.decodeQS(encoded), false)).toEqual(encoded)
  })

  it('omits empty x tracks and avoids base-frame filler for Scale-only frames', async () => {
    const queryV9 = await useSpiroAnimQS(VDEF_V9, useBaseQS(VDEF_V9, { charset: CHARSET_V9 }), 9)
    const queryV10 = await useSpiroAnimQS(
      VDEF_V10,
      useBaseQS(VDEF_V10, { charset: CHARSET_V10 }),
      10,
    )
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props[0]!.anim = [{ scale: 10 }]

    const encodedV9 = queryV9.encodeQS(root, false)
    const encodedV10 = queryV10.encodeQS(root, false)
    const v9Frame = encodedV9.p0!.split('.')[1]!
    const v10Frame = encodedV10.p0!.split('.')[1]!

    expect(v10Frame).toBe('')
    expect(encodedV10.x0).toHaveLength(3)
    expect(encodedV10.x0!.length).toBeLessThan(v9Frame.length)

    delete root.props[0]!.anim[0]!.scale
    expect(queryV10.encodeQS(root, false)).not.toHaveProperty('x0')
  })

  it('round-trips the complete version 10 Twist range and undefined state', async () => {
    const query = await useSpiroAnimQS(VDEF_V10, useBaseQS(VDEF_V10, { charset: CHARSET_V10 }), 10)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props[0]!.anim = [
      { twist: -360 },
      { twist: -271 },
      { twist: -1 },
      { twist: 0 },
      { twist: 137 },
      { twist: 359 },
      { twist: 360 },
    ]

    const encoded = query.encodeQS(root, false)

    expect(encoded.x0).not.toMatch(/^\./)
    expect(encoded.x0).not.toMatch(/\.$/)
    expect(query.decodeQS(encoded).props[0]!.anim).toEqual(root.props[0]!.anim)
  })

  it('round-trips sparse v11 xN and rN animation tracks independently', async () => {
    const query = await useSpiroAnimQS(VDEF_V11, useBaseQS(VDEF_V11, { charset: CHARSET_V11 }), 11)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props[0]!.anim = [
      { beats: 2, yaw: -180, rotate: -360, twist: -360 },
      { scale: 11, yaw: 90, rotate: 180, twist: 45 },
      { depth: 1, yaw: 180, rotate: 360, twist: 360 },
      {},
    ]

    const encoded = query.encodeQS(root, false)

    expect(encoded.v).toBe('11')
    expect(encoded.x0).not.toMatch(/^\./)
    expect(encoded.x0).not.toMatch(/\.$/)
    expect(encoded.r0).not.toMatch(/^\./)
    expect(encoded.r0).not.toMatch(/\.$/)
    expect(encoded.x0!.split('.')[0]).toHaveLength(3)
    expect(encoded.r0!.split('.')[0]).toHaveLength(5)
    expect(query.decodeQS(encoded).props[0]!.anim).toEqual(root.props[0]!.anim)
    expect(query.encodeQS(query.decodeQS(encoded), false)).toEqual(encoded)
  })

  it('defines separate v11 xN and rN tracks with visible Yaw, Rotate, Twist order', () => {
    expect(createExtendedAnimationConfigV11()).toEqual([
      ['anim', 3, [['bits', 3, ['beats', 'scale', 'depth']]]],
    ])
    expect(createRotationAnimationConfigV11()).toEqual([
      ['anim', 5, [['bits', 5, ['twist', 'rotate', 'yaw']]]],
    ])
  })

  it('packs v12 Scale, Beats/Depth, Strength, and Warp groups and round-trips sparse frames', async () => {
    const query = await useSpiroAnimQS(VDEF_V12, useBaseQS(VDEF_V12, { charset: CHARSET_V12 }), 12)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props[0]!.anim = [
      { turns: -2160, scale: -200, warp: -2160, strength: 0, beats: 1, depth: -30 },
      { turns: 12.5, scale: 111, warp: 90.5, strength: 555 },
      { beats: 63, depth: 30 },
      { turns: 1440, scale: 400, warp: 1440, strength: 1000 },
    ]

    const encoded = query.encodeQS(root, false)

    expect(encoded.v).toBe('12')
    expect(encoded.x0!.split('.').map((frame) => frame.length)).toEqual([8, 8, 4, 8])
    expect(query.decodeQS(encoded).props[0]!.anim).toEqual(root.props[0]!.anim)
  })

  it('defines the reordered v12 xN groups', () => {
    expect(createExtendedAnimationConfigV12()).toEqual([
      [
        'anim',
        8,
        [
          ['bits', 2, ['scale']],
          ['bits', 2, ['beats', 'depth']],
          ['bits', 4, ['strength', 'warp']],
        ],
      ],
    ])
  })

  it('migrates historical Scale and Turns values into the v12 units', async () => {
    const query = await useSpiroAnimQS(VDEF_V12, useBaseQS(VDEF_V12, { charset: CHARSET_V12 }), 12)
    const decoded = await query.decodeVer({
      r: 'Ew68kk11Y',
      p0: 'N__.xT_.bn_..',
      x0: '_s_',
      c: '_j_bhq',
      v: '11',
    })

    expect(decoded.props[0]!.anim[0]!.scale).toBe(80)
    expect(decoded.props[0]!.anim[1]!.turns).toBe(180)
  })

  it('omits unused v11 rN tracks without affecting xN tracks', async () => {
    const query = await useSpiroAnimQS(VDEF_V11, useBaseQS(VDEF_V11, { charset: CHARSET_V11 }), 11)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props[0]!.anim = [{ scale: 11 }]

    const encoded = query.encodeQS(root, false)

    expect(encoded.x0).toBeDefined()
    expect(encoded).not.toHaveProperty('r0')
  })

  it('decodes the reported v11 Rotate animation', async () => {
    const query = await useSpiroAnimQS(VDEF_V11, useBaseQS(VDEF_V11, { charset: CHARSET_V11 }), 11)
    const decoded = query.decodeQS({
      r: 'Ew68kk11Y',
      p0: 'N__.xT_.bn_..',
      r0: '._-7f_',
      c: '_j_bhq',
      v: '11',
    })

    expect(decoded.props[0]!.anim).toEqual([{ arc: 270 }, { arc: 90, rotate: 180 }, {}, {}])
    expect(doubleAnimationFrames(decoded)).toBeDefined()
  })

  it('decodes the reported v11 Rotate animation with inherited Turns', async () => {
    const query = await useSpiroAnimQS(VDEF_V11, useBaseQS(VDEF_V11, { charset: CHARSET_V11 }), 11)
    const decoded = query.decodeQS({
      r: 'Ew68kk11Y',
      p0: 'N__.xT_.bn_Rhw..',
      r0: '._-7f_',
      c: '_j_bhq',
      v: '11',
    })

    expect(decoded.props[0]!.anim).toEqual([
      { arc: 270 },
      { arc: 90, turns: 180, rotate: 180 },
      {},
      {},
    ])
    expect(doubleAnimationFrames(decoded)).toBeDefined()
  })

  it('rounds version 10 whole-degree Animation angles instead of truncating floating noise', async () => {
    const query = await useSpiroAnimQS(VDEF_V10, useBaseQS(VDEF_V10, { charset: CHARSET_V10 }), 10)
    const { distance: _legacyDistance, ...root } = createRoot()
    delete root.props[0]!.anim[0]!.move
    root.props[0]!.anim = [
      {
        adjust: -44.999999146,
        arc: 89.999999146,
        plane: -0.000000854,
        axis: 179.999999146,
      },
    ]

    expect(query.decodeQS(query.encodeQS(root, false)).props[0]!.anim).toEqual([
      { adjust: -45, arc: 90, plane: 0, axis: 180 },
    ])
  })

  it('decodes version 9 URLs unchanged through the version 10 codec', async () => {
    const queryV10 = await useSpiroAnimQS(
      VDEF_V10,
      useBaseQS(VDEF_V10, { charset: CHARSET_V10 }),
      10,
    )
    const decoded = await queryV10.decodeVer({
      r: 'GE28E39gY',
      p0: 'O__.J00g0005E0Y-.___QTl.___VGM.',
      c: '_m_bhq',
      v: '7',
    })

    expect(decoded.props[0]!.anim[1]!.turns).toBe(12.5)
    expect(decoded.props[0]!.anim.every((frame) => frame.twist === undefined)).toBe(true)
  })

  it('migrates the existing multi-prop MOVE query into optional m values', async () => {
    const query = await useSpiroAnimQS(VDEF_V4, useBaseQS(VDEF_V4, { charset: CHARSET_V4 }), 4)
    const migrated = await query.decodeVer({
      r: 'GGw8Eje11',
      p0: 'N__.bjxuYHj_r_WQ.blExM_______uuI.____________uuI._____Hj_____uug.____________uug....',
      p1: 'S__.bjxuYBH_r_WQ.blEpk_______uuI.____________uuI._WQ__Hj_____uug.____________uug....',
      v: '3',
    })

    expect(migrated.props).toHaveLength(2)
    for (const prop of migrated.props) {
      expect(prop.anim.every((frame) => frame.move === undefined)).toBe(true)
      expect(prop.motion.length).toBeGreaterThan(0)
    }

    const encoded = query.encodeQS(migrated, false)
    expect(encoded).toMatchObject({
      r: 'GGw8Eje11Y',
      p0: 'N__.bjxuYHj_r_WQ.blExM.._____Hj.....',
      p1: 'S__.bjxuYBH_r_WQ.blEpk.._WQ__Hj.....',
      v: '4',
    })
    expect(encoded.m0).toBeDefined()
    expect(encoded.m1).toBeDefined()
    expect(query.decodeQS(encoded).props.map((prop) => prop.motion)).toEqual(
      migrated.props.map((prop) => prop.motion),
    )
  })

  it('rejects unavailable versions instead of decoding them with the wrong codec', async () => {
    const query = await useSpiroAnimQS(VDEF, useBaseQS(VDEF), 1)

    await expect(query.decodeVer({ r: 'GE28EPi9g', v: '999' })).rejects.toMatchObject({
      name: 'UnsupportedSpiroAnimQSVersionError',
      version: 999,
    })
  })

  it('groups rapid interaction updates into one undo history entry', async () => {
    const query = await useSpiroAnimQS(VDEF, useBaseQS(VDEF), 1)
    const original = createRoot()
    const firstUpdate = structuredClone(original)
    const finalUpdate = structuredClone(original)
    firstUpdate.props[0]!.anim[0]!.arc = 100
    finalUpdate.props[0]!.anim[0]!.arc = 120

    query.beginHistoryGroup(original)
    query.encodeQS(firstUpdate)
    query.encodeQS(finalUpdate)
    query.endHistoryGroup()

    expect(query.qsHistory.value).toEqual([
      new URLSearchParams(query.encodeQS(original, false)).toString(),
      new URLSearchParams(query.encodeQS(finalUpdate, false)).toString(),
    ])

    const separateUpdate = structuredClone(finalUpdate)
    separateUpdate.props[0]!.anim[0]!.arc = 130
    query.encodeQS(separateUpdate)
    expect(query.qsHistory.value).toHaveLength(3)
  })

  it('undoes, redoes, and clears redo history after a new edit', async () => {
    const query = await useSpiroAnimQS(VDEF, useBaseQS(VDEF), 1)
    const original = createRoot()
    const changed = structuredClone(original)
    changed.bpm = 90

    query.encodeQS(original)
    query.encodeQS(changed)

    expect(query.undoQS()?.bpm).toBe(60)
    expect(query.qsFuture.value).toHaveLength(1)
    expect(query.redoQS()?.bpm).toBe(90)
    expect(query.qsFuture.value).toHaveLength(0)

    const undone = query.undoQS()
    expect(undone?.bpm).toBe(60)
    query.encodeQS(undone!)

    const replacement = structuredClone(original)
    replacement.bpm = 120
    query.encodeQS(replacement)

    expect(query.qsFuture.value).toHaveLength(0)
    expect(query.redoQS()).toBeUndefined()
  })
})
