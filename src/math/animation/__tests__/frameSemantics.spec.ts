import { describe, expect, it } from 'vitest'

import { TTYPE } from '@/domain/animation/AnimStruct'
import { resolveAnimationFrames, resolveMotionFrames } from '@/math/animation/frameSemantics'
import { compileMotionTrack, createDefaultCameraFrame } from '@/math/animation/MotionFunc'
import type { AnimData } from '@/types/AnimTypes'

describe('compiler frame semantics', () => {
  it('resolves inherited Animation values and per-frame Plane/Axis defaults', () => {
    const frames: AnimData[] = [
      { turns: 90, twist: 45, beats: 2, arc: 90, plane: 30 },
      {},
      { plane: -45, axis: 60 },
    ]

    expect(resolveAnimationFrames(frames)).toEqual([
      {
        turns: 90,
        twist: 45,
        yaw: 90,
        rotate: 0,
        beats: 2,
        scale: 100,
        warp: 0,
        strength: 1000,
        depth: 0,
        type: TTYPE.SPHE,
        adjust: 0,
        arc: 90,
        plane: 30,
        axis: 30,
      },
      {
        turns: 90,
        twist: 45,
        yaw: 90,
        rotate: 0,
        beats: 2,
        scale: 100,
        warp: 0,
        strength: 1000,
        depth: 0,
        type: TTYPE.SPHE,
        adjust: 0,
        arc: 90,
        plane: 0,
        axis: 0,
      },
      {
        turns: 90,
        twist: 45,
        yaw: 90,
        rotate: 0,
        beats: 2,
        scale: 100,
        warp: 0,
        strength: 1000,
        depth: 0,
        type: TTYPE.SPHE,
        adjust: 0,
        arc: 90,
        plane: -45,
        axis: 60,
      },
    ])
  })

  it('inherits Yaw while continuing to default Rotate per frame', () => {
    expect(resolveAnimationFrames([{ yaw: -90, rotate: 180 }, {}, { rotate: -90 }])).toMatchObject([
      { yaw: -90, rotate: 180 },
      { yaw: -90, rotate: 0 },
      { yaw: -90, rotate: -90 },
    ])
  })

  it('inherits Warp timing until an explicit zero stops additional relative rotation', () => {
    expect(resolveAnimationFrames([{ warp: 90 }, {}, { warp: 0 }, {}])).toMatchObject([
      { warp: 90 },
      { warp: 90 },
      { warp: 0 },
      { warp: 0 },
    ])
  })

  it('inherits Strength until an explicit zero restores the ordinary hand path', () => {
    expect(resolveAnimationFrames([{ strength: 500 }, {}, { strength: 0 }, {}])).toMatchObject([
      { strength: 500 },
      { strength: 500 },
      { strength: 0 },
      { strength: 0 },
    ])
  })

  it('uses authored Motion direction presence as compiler state', () => {
    const frames = [{ plane: 90, arc: 0, distance: 0 }, {}]
    const resolved = resolveMotionFrames(frames)
    const compiled = compileMotionTrack(frames)

    expect(resolved.map(({ active }) => active)).toEqual([true, false])
    expect(compiled.map(({ active }) => active)).toEqual([true, false])
    expect(compiled[1]!.direction).toEqual(compiled[0]!.direction)
  })

  it('applies the compiler Camera Orbit default only when first-frame Distance is absent', () => {
    const defaultOrbit = createDefaultCameraFrame().orbit!

    expect(compileMotionTrack([{}], { firstFrameDefaults: defaultOrbit })[0]).toMatchObject({
      ...defaultOrbit,
      active: true,
    })
    expect(
      compileMotionTrack([{ distance: 0 }], { firstFrameDefaults: defaultOrbit })[0],
    ).toMatchObject({
      plane: 0,
      arc: 0,
      distance: 0,
      active: true,
    })
  })
})
