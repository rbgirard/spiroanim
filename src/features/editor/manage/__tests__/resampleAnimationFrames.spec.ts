import { describe, expect, it } from 'vitest'

import {
  doubleAnimationFrames,
  halveAnimationFrames,
} from '@/features/editor/manage/resampleAnimationFrames'
import { compressAnimationFrames } from '@/features/editor/manage/compressAnimation'
import { rootCompile } from '@/math/animation/AnimFunc'
import { createDefaultCameraFrame } from '@/math/animation/MotionFunc'
import { rootFinal } from '@/math/animation/PlayerFunc'
import type { RootDataFinal } from '@/types/AnimTypes'

const createAnimation = (): RootDataFinal =>
  rootFinal({
    bpm: 120,
    prop: 0,
    color: 0,
    smooth: true,
    guides: false,
    paths: true,
    hands: true,
    arms: false,
    visible: true,
    nodes: false,
    anchors: false,
    props: [
      {
        anim: [
          {
            beats: 1,
            turns: 0,
            scale: 100,
            warp: 0,
            strength: 200,
            depth: 0,
            adjust: 0,
            arc: 0,
          },
          {
            turns: 90,
            twist: 90,
            scale: 200,
            warp: 0,
            strength: 600,
            depth: 10,
            adjust: 20,
            arc: 90,
            plane: 45,
            axis: -45,
          },
          {
            turns: -180,
            twist: -180,
            scale: 100,
            warp: 0,
            strength: 200,
            depth: 0,
            adjust: 0,
            arc: 180,
            plane: -90,
          },
        ],
      },
    ],
    aspectx: 1,
    aspecty: 1,
    distance: 22,
    thick: 4,
  })

const compiledFrameValues = (animation: RootDataFinal) =>
  rootCompile(animation).props.map((prop) =>
    prop.anim.map(
      ({
        turns,
        twist,
        twistRoll,
        beats,
        scale,
        warp,
        strength,
        depth,
        type,
        adjust,
        arc,
        plane,
        axis,
      }) => ({
        turns,
        twist,
        twistRoll,
        beats,
        scale,
        warp,
        strength,
        depth,
        type,
        adjust,
        arc,
        plane,
        axis,
      }),
    ),
  )

describe('resampleAnimationFrames', () => {
  it('inserts exact intermediate values, doubles BPM, and reverses the result', () => {
    const original = createAnimation()
    const originalSnapshot = structuredClone(original)
    const doubled = doubleAnimationFrames(original)

    expect(original).toEqual(originalSnapshot)
    expect(doubled?.bpm).toBe(240)
    expect(doubled?.props[0]?.anim).toHaveLength(5)
    expect(compressAnimationFrames(doubled!.props[0]!.anim)).toBe(0)
    expect(rootCompile(doubled!).props[0]?.anim[1]).toMatchObject({
      turns: 45,
      twist: 45,
      beats: 1,
      scale: 212,
      warp: 0,
      strength: 400,
      depth: 5,
      adjust: 10,
      arc: 45,
      plane: 45,
      axis: -45,
    })
    expect(doubled?.props[0]?.anim[1]?.twist).toBe(45)
    expect(doubled?.props[0]?.anim[2]).not.toHaveProperty('twist')

    const halved = halveAnimationFrames(doubled!)
    expect(halved?.bpm).toBe(120)
    expect(halved?.props[0]?.anim).toHaveLength(3)
    expect(compressAnimationFrames(halved!.props[0]!.anim)).toBe(0)
    expect(halved?.props[0]?.anim[1]?.twist).toBe(90)
    expect(halved?.props[0]?.anim[2]?.twist).toBe(-180)
    expect(compiledFrameValues(halved!)).toEqual(compiledFrameValues(original))
  })

  it('rejects doubled values outside property precision or BPM limits', () => {
    const warped = createAnimation()
    warped.props[0]!.anim[1]!.warp = 5
    expect(doubleAnimationFrames(warped)).toBeDefined()

    const tenthsTurns = createAnimation()
    tenthsTurns.props[0]!.anim[1]!.turns = 0.2
    expect(rootCompile(doubleAnimationFrames(tenthsTurns)!).props[0]?.anim[1]?.turns).toBe(0.1)

    const fractionalTurns = createAnimation()
    fractionalTurns.props[0]!.anim[1]!.turns = 0.1
    expect(doubleAnimationFrames(fractionalTurns)).toBeUndefined()

    const fractionalScale = createAnimation()
    fractionalScale.props[0]!.anim[1]!.scale = 111
    expect(doubleAnimationFrames(fractionalScale)).toBeUndefined()

    const fractionalArc = createAnimation()
    fractionalArc.props[0]!.anim[1]!.arc = 1
    expect(doubleAnimationFrames(fractionalArc)).toBeUndefined()

    const fractionalTwist = createAnimation()
    fractionalTwist.props[0]!.anim[1]!.twist = 45
    expect(doubleAnimationFrames(fractionalTwist)).toBeUndefined()

    const excessiveBpm = createAnimation()
    excessiveBpm.bpm = 300
    expect(doubleAnimationFrames(excessiveBpm)).toBeUndefined()

    const excessiveMotionBeats = createAnimation()
    excessiveMotionBeats.props[0]!.motion = [{ beats: 40 }, {}]
    expect(doubleAnimationFrames(excessiveMotionBeats)).toBeUndefined()
  })

  it('preserves Prop Motion and Camera timing while BPM changes', () => {
    const original = createAnimation()
    original.props[0]!.motion = [
      { beats: 1, distance: 2 },
      { beats: 3, distance: 4 },
    ]
    original.camera = [
      {
        ...createDefaultCameraFrame(),
        orbit: { ...createDefaultCameraFrame().orbit, beats: 1 },
      },
      { orbit: { beats: 3, distance: 20 }, center: {} },
    ]
    const before = rootCompile(original)

    const doubled = doubleAnimationFrames(original)!
    const doubledCompiled = rootCompile(doubled)
    expect(doubledCompiled.props[0]!.motion.map(({ beats }) => beats)).toEqual([2, 6])
    expect(doubledCompiled.camera.map(({ orbit }) => orbit.beats)).toEqual([2, 6])

    const halved = halveAnimationFrames(doubled)!
    const restored = rootCompile(halved)
    expect(restored.props[0]!.motion).toEqual(before.props[0]!.motion)
    expect(restored.camera).toEqual(before.camera)
  })

  it('subdivides inherited Yaw and frame-local Rotate instructions', () => {
    const original = createAnimation()
    for (const frame of original.props[0]!.anim) {
      frame.turns = 0
      frame.arc = 0
      frame.adjust = 0
    }
    original.props[0]!.anim[1]!.yaw = 90
    original.props[0]!.anim[1]!.rotate = 180
    original.props[0]!.anim[2]!.yaw = -90
    original.props[0]!.anim[2]!.rotate = -180

    const originalCompiled = rootCompile(original).props[0]!.anim
    const doubled = doubleAnimationFrames(original)!
    const doubledCompiled = rootCompile(doubled).props[0]!.anim

    expect(doubled.props[0]!.anim[1]).toMatchObject({ rotate: 90 })
    expect(doubled.props[0]!.anim[2]).toMatchObject({ rotate: 90 })
    expect(doubled.props[0]!.anim[3]).toMatchObject({ yaw: -90, rotate: -90 })
    expect(doubled.props[0]!.anim[4]).toMatchObject({ rotate: -90 })
    expect(doubled.props[0]!.anim[4]!.yaw).toBeUndefined()
    for (const [sourceIndex, doubledIndex] of [
      [0, 0],
      [1, 2],
      [2, 4],
    ] as const) {
      doubledCompiled[doubledIndex]!.rot.forEach((value, coordinate) =>
        expect(value).toBeCloseTo(originalCompiled[sourceIndex]!.rot[coordinate]!),
      )
    }

    const halved = halveAnimationFrames(doubled)
    expect(halved?.props[0]?.anim[1]).toMatchObject({ rotate: 180 })
    expect(halved?.props[0]?.anim[2]).toMatchObject({ yaw: -90, rotate: -180 })
  })

  it('preserves simultaneous primary and secondary rotations through independent channels', () => {
    const animation = createAnimation()
    animation.props[0]!.anim[1]!.rotate = 180

    const doubled = doubleAnimationFrames(animation)
    expect(doubled).toBeDefined()
    expect(halveAnimationFrames(doubled!)).toBeDefined()
  })

  it('leaves Beats unchanged on single-frame Prop Motion and Camera tracks', () => {
    const original = createAnimation()
    original.props[0]!.motion = [{ beats: 1, distance: 2 }]
    original.camera = [
      {
        ...createDefaultCameraFrame(),
        orbit: { ...createDefaultCameraFrame().orbit, beats: 1 },
      },
    ]

    const doubled = doubleAnimationFrames(original)!
    const doubledCompiled = rootCompile(doubled)
    expect(doubledCompiled.props[0]!.motion[0]?.beats).toBe(1)
    expect(doubledCompiled.camera[0]?.orbit.beats).toBe(1)

    const halved = halveAnimationFrames(doubled)!
    const halvedCompiled = rootCompile(halved)
    expect(halvedCompiled.props[0]!.motion[0]?.beats).toBe(1)
    expect(halvedCompiled.camera[0]?.orbit.beats).toBe(1)
  })

  it('rejects halving when alternating frames are not exact generated intermediates', () => {
    const doubled = doubleAnimationFrames(createAnimation())!
    doubled.props[0]!.anim[1]!.turns = 45.1
    doubled.props[0]!.anim[2]!.turns = 45
    expect(halveAnimationFrames(doubled)).toBeUndefined()

    const changedScale = doubleAnimationFrames(createAnimation())!
    changedScale.props[0]!.anim[1]!.scale = 160
    expect(halveAnimationFrames(changedScale)).toBeUndefined()

    const changedContinuation = doubleAnimationFrames(createAnimation())!
    changedContinuation.props[0]!.anim[2]!.plane = 45
    expect(halveAnimationFrames(changedContinuation)).toBeUndefined()
  })

  it('rejects halving incompatible frame counts and unrepresentable halved BPM', () => {
    const evenFrameCount = doubleAnimationFrames(createAnimation())!
    evenFrameCount.props[0]!.anim.pop()
    expect(halveAnimationFrames(evenFrameCount)).toBeUndefined()

    const fractionalBpm = doubleAnimationFrames(createAnimation())!
    fractionalBpm.bpm = 81
    expect(halveAnimationFrames(fractionalBpm)).toBeUndefined()

    const lowBpm = doubleAnimationFrames(createAnimation())!
    lowBpm.bpm = 30
    expect(halveAnimationFrames(lowBpm)).toBeUndefined()

    const fractionalMotionBeats = doubleAnimationFrames(createAnimation())!
    fractionalMotionBeats.props[0]!.motion = [{ beats: 3 }, {}]
    expect(halveAnimationFrames(fractionalMotionBeats)).toBeUndefined()

    const fractionalCameraBeats = doubleAnimationFrames(createAnimation())!
    const cameraFrame = fractionalCameraBeats.camera[0]!
    fractionalCameraBeats.camera = [
      { ...cameraFrame, orbit: { ...cameraFrame.orbit, beats: 3 } },
      { orbit: {}, center: {} },
    ]
    expect(halveAnimationFrames(fractionalCameraBeats)).toBeUndefined()
  })

  it('requires at least one interval in the requested direction', () => {
    const singleFrame = createAnimation()
    singleFrame.props[0]!.anim.splice(1)

    expect(doubleAnimationFrames(singleFrame)).toBeUndefined()
    expect(halveAnimationFrames(singleFrame)).toBeUndefined()
  })
})
