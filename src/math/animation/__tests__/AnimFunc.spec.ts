import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { angularDistance, closestPoint, rootCompile } from '@/math/animation/AnimFunc'
import { PNTIND, PPOS } from '@/domain/animation/AnimStruct'
import { rootFinal } from '@/math/animation/PlayerFunc'
import type { RootData } from '@/types/AnimTypes'

describe('AnimFunc', () => {
  it('measures the shortest wrapped angular distance', () => {
    expect(angularDistance((10 * Math.PI) / 180, (350 * Math.PI) / 180)).toBeCloseTo(
      (20 * Math.PI) / 180,
    )
    expect(angularDistance((350 * Math.PI) / 180, (10 * Math.PI) / 180)).toBeCloseTo(
      (20 * Math.PI) / 180,
    )
  })

  it('finds the closest point from all points or a restricted guide', () => {
    const position = PPOS[PNTIND.MBC]!.clone()

    expect(closestPoint(position)).toBe(PNTIND.MBC)
    expect(closestPoint(position, [PNTIND.FTC, PNTIND.BTC])).toBe(PNTIND.FTC)
    expect(closestPoint(new Vector3(100, 100, 100), [])).toBe(0)
  })

  it('compiles inherited values without modifying the editable source', () => {
    const root: RootData = {
      bpm: 60,
      prop: 1,
      color: 2,
      smooth: true,
      guides: true,
      paths: false,
      arms: false,
      nodes: true,
      anchors: false,
      props: [{ anim: [{ beats: 2, turns: 90 }, {}] }],
      aspectx: 16,
      aspecty: 9,
      distance: 22,
      thick: 4,
    }
    const final = rootFinal(root)

    const compiled = rootCompile(final)

    expect(compiled.props[0]).toMatchObject({
      prop: 1,
      color: 2,
      guides: true,
      travel: false,
      arms: false,
      thick: 4,
    })
    expect(compiled.props[0]!.anim[0]).toMatchObject({ beats: 2, turns: 90, scale: 100 })
    expect(compiled.props[0]!.anim[1]).toMatchObject({ beats: 2, turns: 90 })
    expect(final.props[0]!.anim[1]).toEqual({})
    expect(final.travel).toBe(false)
  })

  it('compiles inherited Twist into an absolute roll for every frame', () => {
    const root: RootData = {
      bpm: 60,
      prop: 3,
      color: 2,
      smooth: true,
      guides: false,
      paths: false,
      arms: false,
      nodes: false,
      anchors: false,
      props: [{ anim: [{}, { twist: 90 }, {}, { twist: 0 }, {}] }],
      aspectx: 16,
      aspecty: 9,
      distance: 22,
      thick: 4,
    }

    const frames = rootCompile(rootFinal(root)).props[0]!.anim

    expect(frames.map(({ twist }) => twist)).toEqual([0, 90, 90, 0, 0])
    expect(frames.map(({ twistRoll }) => twistRoll)).toEqual([0, 90, 180, 180, 180])
  })

  it('compiles Warp independently from canonical and prop rotation state', () => {
    const createRoot = (warp?: number): RootData => ({
      bpm: 60,
      prop: 0,
      color: 2,
      smooth: true,
      guides: false,
      paths: true,
      arms: true,
      nodes: true,
      anchors: false,
      props: [{ anim: [{ arc: 45, plane: 30, ...(warp === undefined ? {} : { warp }) }, {}] }],
      aspectx: 16,
      aspecty: 9,
      distance: 22,
      thick: 4,
    })
    const baseline = rootCompile(rootFinal(createRoot())).props[0]!.anim
    const warped = rootCompile(rootFinal(createRoot(90))).props[0]!.anim

    for (const [index, frame] of warped.entries()) {
      expect(frame.pos).toEqual(baseline[index]!.pos)
      expect(frame.posx).toEqual(baseline[index]!.posx)
      expect(frame.rot).toEqual(baseline[index]!.rot)
      expect(frame.orient).toEqual(baseline[index]!.orient)
    }
    expect(warped[0]!.warp).toBe(90)
    expect(warped[1]!.warp).toBe(90)
  })

  it('compiles frame-local Yaw/Rotate into persistent orientation state', () => {
    const root: RootData = {
      bpm: 60,
      prop: 3,
      color: 2,
      smooth: true,
      guides: false,
      paths: false,
      arms: false,
      nodes: false,
      anchors: false,
      props: [{ anim: [{}, { rotate: 180 }, {}, { yaw: -90, rotate: 90 }, {}] }],
      aspectx: 16,
      aspecty: 9,
      distance: 22,
      thick: 4,
    }

    const frames = rootCompile(rootFinal(root)).props[0]!.anim

    expect(frames.map(({ yaw, rotate }) => ({ yaw, rotate }))).toEqual([
      { yaw: 90, rotate: 0 },
      { yaw: 90, rotate: 180 },
      { yaw: 90, rotate: 0 },
      { yaw: -90, rotate: 90 },
      { yaw: -90, rotate: 0 },
    ])
    expect(
      frames.every(({ rot }) => rot.every((value, index) => value === frames[0]!.rot[index])),
    ).toBe(true)
    expect(frames[1]!.orient).not.toEqual(frames[0]!.orient)
    expect(frames[2]!.orient).toEqual(frames[1]!.orient)
    expect(frames[3]!.orient).not.toEqual(frames[2]!.orient)
    expect(frames[4]!.orient).toEqual(frames[3]!.orient)
    expect(frames[1]!.primaryOrient).toEqual(frames[0]!.primaryOrient)
    expect(frames[1]!.secondaryOrient).not.toEqual(frames[0]!.secondaryOrient)
    expect(frames[2]!.secondaryOrient).toEqual([0, 0, 0, 1])
    expect(frames[2]!.primaryOrient).toEqual(frames[1]!.orient)
  })

  it('does not let Yaw/Rotate alter later primary Axis/Turns state', () => {
    const createRoot = (withSecondary: boolean): RootData => ({
      bpm: 60,
      prop: 3,
      color: 2,
      smooth: true,
      guides: false,
      paths: false,
      arms: false,
      nodes: false,
      anchors: false,
      props: [
        {
          anim: [
            {},
            ...(withSecondary ? [{ yaw: 90, rotate: 180 }] : [{}]),
            { turns: 90 },
            { axis: -90, turns: 90 },
          ],
        },
      ],
      aspectx: 16,
      aspecty: 9,
      distance: 22,
      thick: 4,
    })

    const compiled = rootCompile(rootFinal(createRoot(true))).props[0]!.anim
    const primaryOnly = rootCompile(rootFinal(createRoot(false))).props[0]!.anim

    for (const [index, frame] of compiled.entries()) {
      expect(frame.rot).toEqual(primaryOnly[index]!.rot)
      expect(frame.rotx).toEqual(primaryOnly[index]!.rotx)
    }
    expect(compiled[1]!.orient).not.toEqual(primaryOnly[1]!.orient)
    expect(compiled.at(-1)!.orient).not.toEqual(primaryOnly.at(-1)!.orient)
  })

  it('rebases the completed Rotate orientation before subsequent primary rotation', () => {
    const createRoot = (rotate: number): RootData => ({
      bpm: 60,
      prop: 0,
      color: 2,
      smooth: true,
      guides: false,
      paths: false,
      arms: false,
      nodes: false,
      anchors: false,
      props: [{ anim: [{ arc: 270 }, { arc: 90, turns: 180, rotate }, {}, {}] }],
      aspectx: 16,
      aspecty: 9,
      distance: 22,
      thick: 4,
    })
    const rotated = rootCompile(rootFinal(createRoot(180))).props[0]!.anim
    const baseline = rootCompile(rootFinal(createRoot(0))).props[0]!.anim

    expect(rotated.map(({ rebasePrimaryOrientation }) => rebasePrimaryOrientation)).toEqual([
      false,
      false,
      true,
      false,
    ])
    expect(rotated[1]!.primaryOrient).toEqual(baseline[1]!.primaryOrient)
    expect(rotated[2]!.primaryOrient).not.toEqual(baseline[2]!.primaryOrient)
    expect(rotated[2]!.secondaryOrient).toEqual([0, 0, 0, 1])
    expect(rotated.map(({ rot }) => rot)).toEqual(baseline.map(({ rot }) => rot))
  })
})
