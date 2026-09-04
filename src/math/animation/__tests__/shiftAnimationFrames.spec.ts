import { describe, expect, it } from 'vitest'
import { MathUtils, Quaternion, Vector3 } from 'three'

import { toScaleMultiplier } from '@/domain/animation/scale'
import { toStrengthRatio } from '@/domain/animation/strength'
import { TTYPE } from '@/domain/animation/AnimStruct'
import {
  animationEndpointsAlign,
  animationRangeEndpointsAlign,
  shiftAnimationFrameRange,
  shiftAnimationFrames,
} from '@/math/animation/shiftAnimationFrames'
import { rootCompile } from '@/math/animation/AnimFunc'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { applyWarpPath } from '@/math/animation/warpPathInterpolation'
import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CHARSET, VDEF } from '@/services/query/versions/SpiroAnimQSv11'
import type { AnimData, RootData } from '@/types/AnimTypes'

const compileFrames = (frames: AnimData[]) =>
  rootCompile(
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
      props: [{ anim: frames }],
      aspectx: 1,
      aspecty: 1,
      distance: 22,
      thick: 4,
    } satisfies RootData),
  ).props[0]!.anim

const expectVectorClose = (actual: readonly number[], expected: readonly number[]) => {
  actual.forEach((coordinate, axis) => expect(coordinate).toBeCloseTo(expected[axis]!, 9))
}

const expectQuaternionClose = (actual: readonly number[], expected: readonly number[]) => {
  const dot = actual.reduce((sum, value, index) => sum + value * expected[index]!, 0)
  expect(Math.abs(dot)).toBeCloseTo(1, 9)
}

const renderedHandPosition = (frame: ReturnType<typeof compileFrames>[number]) =>
  applyWarpPath(
    new Vector3().fromArray(frame.pos),
    new Vector3().fromArray(frame.warpPos),
    toScaleMultiplier(frame.scale),
    toStrengthRatio(frame.strength),
    new Vector3(),
  ).toArray()

const sampleOrientation = (
  frames: ReturnType<typeof compileFrames>,
  targetIndex: number,
  progress: number,
) => {
  const start = frames[targetIndex - 1]!
  const target = frames[targetIndex]!
  const primaryStart = new Quaternion().fromArray(
    target.rebasePrimaryOrientation ? start.orient : start.primaryOrient,
  )
  const secondaryStart = target.rebasePrimaryOrientation
    ? new Quaternion()
    : new Quaternion().fromArray(start.secondaryOrient)
  const primary = new Quaternion()
    .setFromAxisAngle(
      new Vector3().fromArray(target.rotx),
      MathUtils.degToRad(target.turns + (target.type === TTYPE.LINE ? 0 : target.arc)) * progress,
    )
    .multiply(primaryStart)
  const secondary = new Quaternion()
    .setFromAxisAngle(
      new Vector3().fromArray(target.yawx),
      MathUtils.degToRad(target.rotate) * progress,
    )
    .multiply(secondaryStart)
  return secondary.multiply(primary).toArray()
}

const closedFrames: AnimData[] = [
  { arc: 0, twist: 0, beats: 2, scale: 80, warp: 0, depth: 1, move: [1, 0, 0] },
  { arc: 90, twist: 90, beats: 3, scale: 90, warp: -45, depth: 2, move: [2, 0, 0] },
  {
    arc: 90,
    twist: -90,
    plane: 180,
    beats: 4,
    scale: 100,
    warp: 315,
    depth: 3,
    move: [3, 0, 0],
  },
]

describe('shared shiftAnimationFrames', () => {
  it('requires the rendered position, orientation, and twist to close', () => {
    const compiled = compileFrames(closedFrames)
    expect(animationEndpointsAlign(compiled)).toBe(true)

    const mismatchedRotation = structuredClone(compiled)
    mismatchedRotation.at(-1)!.rot = [1, 0, 0]

    expect(animationEndpointsAlign(mismatchedRotation)).toBe(true)

    const mismatchedTwist = structuredClone(compiled)
    mismatchedTwist.at(-1)!.twistRoll += 90

    expect(animationEndpointsAlign(mismatchedTwist)).toBe(false)
    expect(shiftAnimationFrames(closedFrames, mismatchedTwist)).toBeUndefined()
  })

  it('rotates every visible segment and moves the first duration to the end', () => {
    const compiled = compileFrames(closedFrames)
    const shifted = shiftAnimationFrames(closedFrames, compiled)
    expect(shifted).toBeDefined()

    const result = compileFrames(shifted!)
    const stateIndices = [1, 2, 1]
    for (const [index, frame] of result.entries()) {
      const expected = compiled[stateIndices[index]!]!
      expectVectorClose(frame.pos, expected.pos)
      expectVectorClose(frame.rot, expected.rot)
      expect(frame.scale).toBe(expected.scale)
      expect(frame.warp).toBe(expected.warp)
      expect(frame.depth).toBe(expected.depth)
      expect(frame.twistRoll).toBe(expected.twistRoll)
    }

    const incomingSegmentIndices = [2, 1]
    for (const [index, frame] of result.slice(1).entries()) {
      const expected = compiled[incomingSegmentIndices[index]!]!
      expectVectorClose(frame.posx, expected.posx)
      expectVectorClose(frame.rotx, expected.rotx)
      expect(frame).toMatchObject({
        arc: expected.arc,
        turns: expected.turns,
        adjust: expected.adjust,
        type: expected.type,
      })
    }

    expect(result.map(({ beats }) => beats)).toEqual([3, 2, 2])
    expect(closedFrames[0]).toEqual({
      arc: 0,
      twist: 0,
      beats: 2,
      scale: 80,
      warp: 0,
      depth: 1,
      move: [1, 0, 0],
    })
  })

  it('keeps the reconstructed Warp on the final shifted seam', () => {
    const frames: AnimData[] = [
      { arc: 0, warp: 0, scale: 80, strength: 800 },
      { arc: 45, warp: 180 },
      {},
      {},
      {},
      {},
      {},
      { warp: 0 },
      {},
    ]
    const compiled = compileFrames(frames)
    expect(animationEndpointsAlign(compiled)).toBe(true)

    const shifted = shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, {
      allowEndpointMismatch: true,
      preserveFinalOutgoing: true,
    })

    expect(shifted).toBeDefined()
    expect(shifted?.at(-1)?.warp).toBe(180)
    const result = compileFrames(shifted!)
    expect(animationEndpointsAlign(result)).toBe(true)
    expectVectorClose(renderedHandPosition(result.at(-1)!), renderedHandPosition(result[0]!))
  })

  it('reconstructs accumulated Twist as a carried roll gauge', () => {
    const frames: AnimData[] = [
      { arc: 0, twist: 30 },
      { arc: 90 },
      { arc: 90 },
      { arc: 90 },
      { arc: 90 },
    ]
    const compiled = compileFrames(frames)
    const shifted = shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, {
      allowEndpointMismatch: true,
      shiftCount: 2,
    })

    expect(shifted).toBeDefined()
    expect(shifted?.[0]?.twist).toBe(compiled[2]!.twistRoll)
    const result = compileFrames(shifted!)
    const rollGauge = compiled.at(-1)!.twistRoll - compiled[0]!.twistRoll
    const targetIndices = [2, 3, 4, 1, 2]
    expect(result.map(({ twistRoll }) => twistRoll)).toEqual(
      targetIndices.map((sourceIndex, resultIndex) =>
        resultIndex > 2
          ? compiled[sourceIndex]!.twistRoll + rollGauge
          : compiled[sourceIndex]!.twistRoll,
      ),
    )
  })

  it('produces the same compiled result for a direct offset as repeated single shifts', () => {
    const frames: AnimData[] = [
      { arc: 0, beats: 1, scale: 80, depth: 1 },
      { arc: 90, beats: 2, scale: 90, depth: 2 },
      { arc: 90, beats: 3, scale: 100, depth: 3 },
      { arc: 90, beats: 4, scale: 110, depth: 4 },
      { arc: 90, beats: 5, scale: 120, depth: 5 },
    ]

    for (let shiftCount = 1; shiftCount <= 7; shiftCount += 1) {
      let repeated = frames
      for (let repetition = 0; repetition < shiftCount; repetition += 1) {
        repeated = shiftAnimationFrames(repeated, compileFrames(repeated))!
      }

      const direct = shiftAnimationFrames(frames, compileFrames(frames), shiftCount)
      expect(direct).toBeDefined()
      expect(compileFrames(direct!)).toEqual(compileFrames(repeated))
    }
  })

  it('preserves secondary rotation state while shifting a closed range', () => {
    const frames: AnimData[] = [{ arc: 0, turns: 0, rotate: 0 }, { rotate: 180 }, { rotate: 180 }]
    const compiled = compileFrames(frames)
    expect(animationEndpointsAlign(compiled)).toBe(true)

    const shifted = shiftAnimationFrames(frames, compiled)
    expect(shifted).toBeDefined()
    const result = compileFrames(shifted!)

    expectVectorClose(result[0]!.rot, compiled[1]!.rot)
    expectVectorClose(result[1]!.rot, compiled[2]!.rot)
    expectVectorClose(result[2]!.rot, compiled[1]!.rot)
  })

  it('preserves a Rotate path and spin direction across repeated shifts', async () => {
    const query = await useSpiroAnimQS(VDEF, useBaseQS(VDEF, { charset: CHARSET }), 11)
    const animation = query.decodeQS({
      r: 'Ew68kk11Y',
      p0: 'N__.xT_Rhw.bn_Qpg.___RJE..',
      r0: '._-7f_',
      c: '_j_bhq',
      v: '11',
    })
    const frames = animation.props[0]!.anim
    const compiled = compileFrames(frames)
    const shifted = shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, {
      allowEndpointMismatch: true,
      preserveFinalOutgoing: true,
    })

    expect(shifted).toBeDefined()
    const result = compileFrames(shifted!)
    expectVectorClose(result[0]!.pos, compiled[1]!.pos)
    expectVectorClose(result[0]!.rot, compiled[1]!.rot)
    expectVectorClose(result[0]!.adju, compiled[1]!.adju)
    expectQuaternionClose(result[0]!.orient, compiled[1]!.orient)

    const shiftedAgain = shiftAnimationFrameRange(shifted!, result, 0, shifted!.length - 1, {
      allowEndpointMismatch: true,
      preserveFinalOutgoing: true,
    })
    expect(shiftedAgain).toBeDefined()
    const secondResult = compileFrames(shiftedAgain!)
    const firstRotateIndex = result.findIndex((frame, index) => index > 0 && frame.rotate !== 0)
    const secondRotateIndex = secondResult.findIndex(
      (frame, index) => index > 0 && frame.rotate !== 0,
    )
    expect(firstRotateIndex).toBeGreaterThan(0)
    expect(secondRotateIndex).toBeGreaterThan(0)
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      expectQuaternionClose(
        sampleOrientation(secondResult, secondRotateIndex, progress),
        sampleOrientation(result, firstRotateIndex, progress),
      )
    }

    const shiftedDirectly = shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, {
      allowEndpointMismatch: true,
      preserveFinalOutgoing: true,
      shiftCount: 2,
    })
    expect(shiftedDirectly).toBeDefined()
    const directResult = compileFrames(shiftedDirectly!)
    const directRotateIndex = directResult.findIndex(
      (frame, index) => index > 0 && frame.rotate !== 0,
    )
    expect(directRotateIndex).toBeGreaterThan(0)
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      expectQuaternionClose(
        sampleOrientation(directResult, directRotateIndex, progress),
        sampleOrientation(secondResult, secondRotateIndex, progress),
      )
    }

    const shiftedAnimation = structuredClone(animation)
    shiftedAnimation.props[0]!.anim = shiftedAgain!
    const roundTrip = query.decodeQS(query.encodeQS(shiftedAnimation, false))
    const roundTripResult = compileFrames(roundTrip.props[0]!.anim)
    const roundTripRotateIndex = roundTripResult.findIndex(
      (frame, index) => index > 0 && frame.rotate !== 0,
    )
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      expectQuaternionClose(
        sampleOrientation(roundTripResult, roundTripRotateIndex, progress),
        sampleOrientation(result, firstRotateIndex, progress),
      )
    }
  })

  it('continues shifting after a reconstructed Rotate boundary reaches frame zero', async () => {
    const query = await useSpiroAnimQS(VDEF, useBaseQS(VDEF, { charset: CHARSET }), 11)
    const animation = query.decodeQS({
      r: 'Ew68kk11Y',
      p0: 'N__.mD_.bn_RJE.___Qpg.___RJE.',
      r0: 'BG7f_.._-7f_',
      c: '_j_bhq',
      v: '11',
    })
    const frames = animation.props[0]!.anim
    const compiled = compileFrames(frames)
    const shifted = shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, {
      allowEndpointMismatch: true,
      preserveFinalOutgoing: true,
    })

    expect(shifted).toBeDefined()
    const result = compileFrames(shifted!)
    expectQuaternionClose(result[0]!.orient, compiled[1]!.orient)
    for (const [resultIndex, sourceIndex] of [2, 3, 4].entries()) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        expectQuaternionClose(
          sampleOrientation(result, resultIndex + 1, progress),
          sampleOrientation(compiled, sourceIndex, progress),
        )
      }
    }

    let repeatedFrames = shifted!
    let repeatedCompiled = result
    for (let repetition = 0; repetition < 8; repetition += 1) {
      const nextFrames = shiftAnimationFrameRange(
        repeatedFrames,
        repeatedCompiled,
        0,
        repeatedFrames.length - 1,
        {
          allowEndpointMismatch: true,
          preserveFinalOutgoing: true,
        },
      )
      expect(nextFrames).toBeDefined()
      repeatedFrames = nextFrames!
      repeatedCompiled = compileFrames(repeatedFrames)
    }

    const shiftedAnimation = structuredClone(animation)
    shiftedAnimation.props[0]!.anim = shifted!
    const roundTripResult = compileFrames(
      query.decodeQS(query.encodeQS(shiftedAnimation, false)).props[0]!.anim,
    )
    for (const interval of [1, 2, 3]) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        expectQuaternionClose(
          sampleOrientation(roundTripResult, interval, progress),
          sampleOrientation(result, interval, progress),
        )
      }
    }
  })

  it('preserves a wrapped Rotate curve and spin direction across a local-roll seam', async () => {
    const query = await useSpiroAnimQS(VDEF, useBaseQS(VDEF, { charset: CHARSET }), 11)
    const animation = query.decodeQS({
      r: 'Ew68kk11Y',
      p0: 'N__.bg0____WQ._U0Qpg.___RJE_U0..',
      r0: '_-7f_._-7f_',
      c: '_j_bhq',
      v: '11',
    })
    const frames = animation.props[0]!.anim
    const compiled = compileFrames(frames)
    const shifted = shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, {
      allowEndpointMismatch: true,
      preserveFinalOutgoing: true,
    })

    expect(shifted).toBeDefined()
    const result = compileFrames(shifted!)
    expectVectorClose(result.at(-1)!.pos, compiled[1]!.pos)
    expect(Math.abs(result.at(-1)!.rotate)).toBeGreaterThan(0)
    const localRollGauge = new Quaternion()
      .fromArray(compiled[0]!.orient)
      .invert()
      .multiply(new Quaternion().fromArray(result.at(-2)!.orient))
    for (const progress of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
      const expected = new Quaternion()
        .fromArray(sampleOrientation(compiled, 1, progress))
        .multiply(localRollGauge)
      expectQuaternionClose(
        sampleOrientation(result, result.length - 1, progress),
        expected.toArray(),
      )
    }

    const fanHead = new Vector3(Math.sin(-Math.PI / 3), Math.cos(-Math.PI / 3), 0)
    const sampleHead = (
      animationFrames: ReturnType<typeof compileFrames>,
      targetIndex: number,
      progress: number,
    ) => {
      const start = animationFrames[targetIndex - 1]!
      const target = animationFrames[targetIndex]!
      const center = new Vector3()
        .fromArray(start.pos)
        .applyAxisAngle(
          new Vector3().fromArray(target.posx),
          MathUtils.degToRad(target.arc) * progress,
        )
      return fanHead
        .clone()
        .applyQuaternion(
          new Quaternion().fromArray(sampleOrientation(animationFrames, targetIndex, progress)),
        )
        .add(center)
    }
    const headPathVolume = (animationFrames: ReturnType<typeof compileFrames>) => {
      const points = [0, 1 / 3, 2 / 3, 1].map((progress) =>
        sampleHead(animationFrames, animationFrames.length - 1, progress),
      )
      return points[1]!
        .clone()
        .sub(points[0]!)
        .dot(points[2]!.clone().sub(points[0]!).cross(points[3]!.clone().sub(points[0]!)))
    }
    expect(Math.abs(headPathVolume(result))).toBeGreaterThan(1e-4)

    const shiftedAnimation = structuredClone(animation)
    shiftedAnimation.props[0]!.anim = shifted!
    const roundTrip = query.decodeQS(query.encodeQS(shiftedAnimation, false))
    const roundTripResult = compileFrames(roundTrip.props[0]!.anim)
    for (const progress of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
      expectQuaternionClose(
        sampleOrientation(roundTripResult, roundTripResult.length - 1, progress),
        sampleOrientation(result, result.length - 1, progress),
      )
    }
    expect(Math.abs(headPathVolume(roundTripResult))).toBeGreaterThan(1e-4)
  })

  it('reconstructs a zero-Rotate interval after a local-roll seam', () => {
    const frames: AnimData[] = [
      { plane: 180, arc: 90, scale: 7 },
      { plane: 180, arc: 45, turns: -180 },
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      { plane: 0, arc: 45, turns: -180 },
      {},
      {},
      { rotate: 90 },
      {},
      {},
      {},
      {},
    ]
    const compiled = compileFrames(frames)
    for (let shiftCount = 1; shiftCount < frames.length; shiftCount += 1) {
      expect(
        shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, {
          allowEndpointMismatch: true,
          shiftCount,
        }),
      ).toBeDefined()
    }
    const shifted = shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, {
      allowEndpointMismatch: true,
      shiftCount: 8,
    })

    expect(shifted).toBeDefined()
    const result = compileFrames(shifted!)
    const targetIndices = [8, 9, 10, 11, 12, 13, 14, 15, 16, 1, 2, 3, 4, 5, 6, 7, 8]
    const localRollGauge = new Quaternion()
      .fromArray(compiled[0]!.orient)
      .invert()
      .multiply(new Quaternion().fromArray(compiled.at(-1)!.orient))

    for (const [resultIndex, sourceIndex] of targetIndices.entries()) {
      expectVectorClose(result[resultIndex]!.pos, compiled[sourceIndex]!.pos)
      expectVectorClose(result[resultIndex]!.rot, compiled[sourceIndex]!.rot)
      const expectedOrientation = new Quaternion().fromArray(compiled[sourceIndex]!.orient)
      if (resultIndex > 8) expectedOrientation.multiply(localRollGauge)
      expectQuaternionClose(result[resultIndex]!.orient, expectedOrientation.toArray())
    }
    expect(result[9]!.rotate).toBe(0)
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const expected = new Quaternion()
        .fromArray(sampleOrientation(compiled, 1, progress))
        .multiply(localRollGauge)
      expectQuaternionClose(sampleOrientation(result, 9, progress), expected.toArray())
    }
  })

  it('omits values that can use defaults or inherit from the preceding frame', () => {
    const frames: AnimData[] = [
      { arc: 0, beats: 2, scale: 8 },
      { arc: 90, beats: 2, scale: 8 },
      { arc: 90, plane: 180, beats: 2, scale: 8 },
    ]

    const shifted = shiftAnimationFrames(frames, compileFrames(frames))

    expect(shifted).toBeDefined()
    expect(shifted).toEqual([{ arc: 90, beats: 2, scale: 8 }, { plane: -180 }, { plane: -180 }])
  })

  it('rejects animations without a complete loop interval', () => {
    const frames: AnimData[] = [{ arc: 0 }, { arc: 0 }]

    expect(shiftAnimationFrames(frames, compileFrames(frames))).toBeUndefined()
  })

  it('rejects animations whose final position does not match the first', () => {
    const frames: AnimData[] = [{ arc: 0 }, { arc: 45 }, { arc: 45 }]
    const compiled = compileFrames(frames)

    expect(animationEndpointsAlign(compiled)).toBe(false)
    expect(shiftAnimationFrames(frames, compiled)).toBeUndefined()
  })

  it('can shift unmatched endpoints when explicitly allowed', () => {
    const frames: AnimData[] = [
      { arc: 0, beats: 2, scale: 80 },
      { arc: 45, beats: 3, scale: 90 },
      { arc: 45, beats: 4, scale: 100 },
    ]
    const compiled = compileFrames(frames)

    const shifted = shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, {
      allowEndpointMismatch: true,
      preserveFinalOutgoing: true,
    })

    expect(shifted).toBeDefined()
    expect(compileFrames(shifted!).at(-1)).toMatchObject({
      beats: compiled.at(-1)!.beats,
      scale: compiled.at(-1)!.scale,
    })
  })

  it('shifts a closed range and preserves its outgoing boundary values', () => {
    const frames: AnimData[] = [
      { arc: 0, beats: 5, scale: 15, depth: -2, adjust: 5, move: [1, 0, 0] },
      { arc: 0, beats: 2, scale: 8, depth: 1, adjust: 10, move: [1, 0, 0] },
      { arc: 90, beats: 3, scale: 9, depth: 2, adjust: 20, move: [2, 0, 0] },
      {
        arc: 90,
        plane: 180,
        beats: 7,
        scale: 12,
        depth: 4,
        adjust: 30,
        move: [3, 0, 0],
      },
      { arc: 45, beats: 11, scale: 14, depth: 6, adjust: 40, move: [4, 0, 0] },
    ]
    const original = compileFrames(frames)
    expect(animationRangeEndpointsAlign(original, 1, 3)).toBe(true)

    const shiftedRange = shiftAnimationFrameRange(frames, original, 1, 3, {
      preserveFinalOutgoing: true,
    })
    expect(shiftedRange).toBeDefined()

    const resultFrames = structuredClone(frames)
    resultFrames.splice(1, 3, ...shiftedRange!)
    const result = compileFrames(resultFrames)

    expectVectorClose(result[1]!.pos, original[2]!.pos)
    expectVectorClose(result[1]!.rot, original[2]!.rot)
    expectVectorClose(result[2]!.pos, original[3]!.pos)
    expectVectorClose(result[2]!.rot, original[3]!.rot)
    expectVectorClose(result[3]!.pos, original[2]!.pos)
    expectVectorClose(result[3]!.rot, original[2]!.rot)
    expect(result[3]).toMatchObject({
      beats: original[3]!.beats,
      scale: original[3]!.scale,
      depth: original[3]!.depth,
      adjust: original[3]!.adjust,
    })

    expect(resultFrames[0]).toEqual(frames[0])
    expect(resultFrames[4]).toEqual(frames[4])
  })
})
