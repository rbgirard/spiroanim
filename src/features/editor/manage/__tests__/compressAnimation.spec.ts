import { describe, expect, it } from 'vitest'

import { MOTION_SHAPE, TTYPE } from '@/domain/animation/AnimStruct'
import { compressAnimation } from '@/features/editor/manage/compressAnimation'
import { rootCompile } from '@/math/animation/AnimFunc'
import { rootFinal } from '@/math/animation/PlayerFunc'
import type { RootData } from '@/types/AnimTypes'

const createRoot = () =>
  rootFinal({
    bpm: 120,
    prop: 0,
    color: 1,
    smooth: true,
    guides: false,
    paths: true,
    travel: false,
    hands: true,
    arms: false,
    visible: true,
    nodes: false,
    anchors: false,
    props: [
      {
        prop: 0,
        color: 1,
        anim: [
          {
            beats: 1,
            turns: 0,
            twist: 0,
            scale: 100,
            depth: 0,
            type: TTYPE.SPHE,
            arc: 0,
            plane: 0,
            axis: 0,
          },
          {
            beats: 1,
            turns: 90,
            twist: 90,
            scale: 100,
            type: TTYPE.SPHE,
            arc: 0,
            plane: 45,
            axis: 45,
          },
        ],
        motion: [
          { beats: 1, shape: MOTION_SHAPE.LINE, axis: 90, amount: 75, distance: 2 },
          { shape: MOTION_SHAPE.ARC, amount: 75, axis: 0, distance: 3 },
          { shape: MOTION_SHAPE.ARC, amount: 75, arc: 0, plane: 0, distance: 0 },
        ],
      },
    ],
    aspectx: 1,
    aspecty: 1,
    distance: 22,
    thick: 4,
  } satisfies RootData)

describe('compressAnimation', () => {
  it('removes redundant, default, and inapplicable values', () => {
    const root = createRoot()
    expect(compressAnimation(root)).toBeGreaterThan(0)

    expect(root.props[0]).toMatchObject({
      anim: [{}, { turns: 90, twist: 90, plane: 45 }],
      motion: [{ distance: 2 }, { shape: MOTION_SHAPE.ARC, amount: 75, distance: 3 }, {}],
    })
    expect(root.props[0]).not.toHaveProperty('prop')
    expect(root.props[0]).not.toHaveProperty('color')
  })

  it('preserves compiled behavior except ignored Linear curve controls', () => {
    const root = createRoot()
    const before = rootCompile(root)
    compressAnimation(root)
    const after = rootCompile(root)

    expect(after.props[0]!.anim).toEqual(before.props[0]!.anim)
    for (const index of [1, 2]) {
      expect(after.props[0]!.motion[index]).toMatchObject({
        beats: before.props[0]!.motion[index]!.beats,
        shape: before.props[0]!.motion[index]!.shape,
        amount: before.props[0]!.motion[index]!.amount,
        move: before.props[0]!.motion[index]!.move,
        direction: before.props[0]!.motion[index]!.direction,
        delta: before.props[0]!.motion[index]!.delta,
        offset: before.props[0]!.motion[index]!.offset,
      })
    }
    expect(after.props[0]!.motion[0]).toMatchObject({ shape: MOTION_SHAPE.LINE, distance: 2 })
  })

  it('compresses Camera Orbit and Center with the shared Motion rules', () => {
    const root = createRoot()
    Object.assign(root.camera[0]!.orbit!, {
      beats: 1,
      shape: MOTION_SHAPE.LINE,
      axis: 90,
      amount: 75,
    })
    Object.assign(root.camera[0]!.center!, {
      plane: 0,
      distance: 0,
      axis: 90,
      amount: 75,
    })
    const before = rootCompile(root).camera

    compressAnimation(root)

    expect(root.camera[0]!.orbit).not.toMatchObject({
      beats: expect.anything(),
      shape: expect.anything(),
      axis: expect.anything(),
      amount: expect.anything(),
    })
    expect(root.camera[0]!.center).toEqual({})
    const after = rootCompile(root).camera
    expect(after[0]!.orbit.offset).toEqual(before[0]!.orbit.offset)
    expect(after[0]!.center.offset).toEqual(before[0]!.center.offset)
  })

  it('compacts inherited Precision without changing rendered offsets', () => {
    const root = createRoot()
    root.props[0]!.motion = [
      { distance: 10, precision: false },
      { distance: 20, precision: true },
      { distance: 30, precision: true },
      { distance: 40, precision: false },
    ]
    const before = rootCompile(root).props[0]!.motion.map(({ offset }) => offset)

    compressAnimation(root)

    expect(root.props[0]!.motion).toEqual([
      { distance: 10 },
      { distance: 20, precision: true },
      { distance: 30 },
      { distance: 40, precision: false },
    ])
    expect(rootCompile(root).props[0]!.motion.map(({ offset }) => offset)).toEqual(before)
  })

  it('preserves a changed Yaw for a later Rotate while removing redundant inherited Yaw', () => {
    const root = createRoot()
    root.props[0]!.anim = [{ yaw: -90 }, { yaw: -90 }, { rotate: 180 }]
    const before = rootCompile(root).props[0]!.anim

    compressAnimation(root)

    expect(root.props[0]!.anim).toEqual([{ yaw: -90 }, {}, { rotate: 180 }])
    expect(rootCompile(root).props[0]!.anim).toEqual(before)
  })

  it('retains an explicit zero-distance direction command when the compiler uses it', () => {
    const root = createRoot()
    root.props[0]!.motion = [{ plane: 90, arc: 90, distance: 0 }, { distance: 5 }]
    const before = rootCompile(root).props[0]!.motion

    compressAnimation(root)

    expect(root.props[0]!.motion[0]).not.toEqual({})
    const after = rootCompile(root).props[0]!.motion
    expect(after.map(({ active, direction, offset }) => ({ active, direction, offset }))).toEqual(
      before.map(({ active, direction, offset }) => ({ active, direction, offset })),
    )
  })

  it('honors track scope options', () => {
    const root = createRoot()
    const camera = structuredClone(root.camera)
    const motion = structuredClone(root.props[0]!.motion)

    compressAnimation(root, {
      propValues: false,
      animation: true,
      motion: false,
      camera: false,
    })

    expect(root.props[0]!.anim[0]).toEqual({})
    expect(root.props[0]!.motion).toEqual(motion)
    expect(root.camera).toEqual(camera)
    expect(root.props[0]).toHaveProperty('prop')
  })

  it('is idempotent', () => {
    const root = createRoot()
    compressAnimation(root)
    expect(compressAnimation(root)).toBe(0)
  })
})
