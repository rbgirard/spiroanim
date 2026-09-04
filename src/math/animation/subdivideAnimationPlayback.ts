import { rootCompile } from '@/math/animation/AnimFunc'
import { compactAnimationFrames } from '@/math/animation/compressFrames'
import { resolveMotionFrames } from '@/math/animation/frameSemantics'
import { MathUtils, Quaternion, Vector3 } from 'three'
import type {
  AnimData,
  AnimDataCompiled,
  CameraData,
  MotionData,
  RootDataFinal,
} from '@/types/AnimTypes'

export const doublePlaybackMultiplier = 2
const transportedContinuationAngle = 0

const interpolate = (start: number, end: number, progress: number) =>
  start + (end - start) * progress

const playbackTolerance = 0.000_000_001
const nearlyEqual = (first: number, second: number): boolean =>
  Math.abs(first - second) <= playbackTolerance
const vectorsNearlyEqual = (first: readonly number[], second: readonly number[]): boolean =>
  first.length === second.length &&
  first.every((value, index) => nearlyEqual(value, second[index]!))
const quaternionsNearlyEqual = (first: readonly number[], second: readonly number[]): boolean =>
  first.length === second.length &&
  nearlyEqual(Math.abs(first.reduce((sum, value, index) => sum + value * second[index]!, 0)), 1)

const adjustedOrientation = (frame: AnimDataCompiled): Quaternion =>
  new Quaternion()
    .fromArray(frame.orient)
    .premultiply(
      new Quaternion().setFromAxisAngle(
        new Vector3().fromArray(frame.adjustx),
        MathUtils.degToRad(frame.adjust),
      ),
    )

const compiledBoundaryStateMatches = (
  expected: AnimDataCompiled,
  actual: AnimDataCompiled,
): boolean =>
  expected.beats === actual.beats &&
  expected.scale === actual.scale &&
  expected.strength === actual.strength &&
  expected.depth === actual.depth &&
  expected.type === actual.type &&
  expected.adjust === actual.adjust &&
  nearlyEqual(expected.twistRoll, actual.twistRoll) &&
  vectorsNearlyEqual(expected.pos, actual.pos) &&
  vectorsNearlyEqual(expected.warpPos, actual.warpPos) &&
  vectorsNearlyEqual(expected.rot, actual.rot) &&
  vectorsNearlyEqual(expected.posx, actual.posx) &&
  vectorsNearlyEqual(expected.warpx, actual.warpx) &&
  vectorsNearlyEqual(expected.rotx, actual.rotx) &&
  vectorsNearlyEqual(expected.yawx, actual.yawx) &&
  quaternionsNearlyEqual(expected.primaryOrient, actual.primaryOrient) &&
  quaternionsNearlyEqual(expected.secondaryOrient, actual.secondaryOrient) &&
  quaternionsNearlyEqual(expected.orient, actual.orient) &&
  quaternionsNearlyEqual(
    adjustedOrientation(expected).toArray(),
    adjustedOrientation(actual).toArray(),
  )

const subdivisionPreservesCompiledBoundaries = (
  expected: ReturnType<typeof rootCompile>,
  actual: ReturnType<typeof rootCompile>,
  subdivisionCount: number,
): boolean =>
  expected.props.length === actual.props.length &&
  expected.props.every((prop, propIndex) => {
    const actualProp = actual.props[propIndex]
    return (
      actualProp !== undefined &&
      actualProp.anim.length === (prop.anim.length - 1) * subdivisionCount + 1 &&
      prop.anim.every((frame, frameIndex) => {
        const actualFrame = actualProp.anim[frameIndex * subdivisionCount]
        return actualFrame !== undefined && compiledBoundaryStateMatches(frame, actualFrame)
      })
    )
  })

const scaleMotionTrackBeats = (frames: readonly MotionData[], multiplier: number): MotionData[] => {
  if (frames.length <= 1) return frames.map((frame) => ({ ...frame }))

  const resolved = resolveMotionFrames(frames)
  return frames.map((frame, index) => ({
    ...frame,
    beats: resolved[index]!.beats * multiplier,
  }))
}

const scaleCameraTrackBeats = (frames: readonly CameraData[], multiplier: number): CameraData[] => {
  if (frames.length <= 1) {
    return frames.map((frame) => ({
      ...frame,
      ...(frame.orbit === undefined ? {} : { orbit: { ...frame.orbit } }),
      ...(frame.center === undefined ? {} : { center: { ...frame.center } }),
    }))
  }

  const resolvedOrbit = resolveMotionFrames(frames.map((frame) => frame.orbit ?? {}))
  return frames.map((frame, index) => ({
    ...frame,
    orbit: {
      ...frame.orbit,
      beats: resolvedOrbit[index]!.beats * multiplier,
    },
  }))
}

const subdivideFrame = (
  start: AnimDataCompiled,
  target: AnimDataCompiled,
  step: number,
  subdivisionCount: number,
): AnimData => {
  const progress = step / subdivisionCount
  const scale = interpolate(start.scale, target.scale, progress)
  const strength = interpolate(start.strength, target.strength, progress)
  return {
    turns: target.turns / subdivisionCount,
    twist: target.twist / subdivisionCount,
    yaw: target.yaw,
    rotate: target.rotate / subdivisionCount,
    beats: step === subdivisionCount ? target.beats : start.beats,
    scale,
    warp: target.warp / subdivisionCount,
    strength,
    depth: interpolate(start.depth, target.depth, progress),
    type: target.type,
    adjust: interpolate(start.adjust, target.adjust, progress),
    arc: target.arc / subdivisionCount,
    plane: step === 1 ? target.plane : transportedContinuationAngle,
    axis: step === 1 ? target.axis : transportedContinuationAngle,
  }
}

const subdivideFrames = (
  frames: readonly AnimData[],
  compiled: readonly AnimDataCompiled[],
  subdivisionCount: number,
): AnimData[] | undefined => {
  const firstFrame = frames[0]
  const firstCompiledFrame = compiled[0]
  if (
    firstFrame === undefined ||
    firstCompiledFrame === undefined ||
    frames.length !== compiled.length
  ) {
    return undefined
  }

  const subdivided: AnimData[] = [{ ...firstFrame }]

  for (let frameIndex = 1; frameIndex < compiled.length; frameIndex += 1) {
    const start = compiled[frameIndex - 1]
    const target = compiled[frameIndex]
    if (!start || !target) return undefined

    for (let step = 1; step <= subdivisionCount; step += 1) {
      subdivided.push(subdivideFrame(start, target, step, subdivisionCount))
    }
  }

  return compactAnimationFrames(subdivided, {
    // The starting frame is an authored pattern boundary inspected by VTG matching callers.
    preserve: (frameIndex) => frameIndex === 0,
  })
}

/**
 * Raises playback rate while subdividing every authored interval so duration,
 * endpoints, and the visible path remain unchanged.
 */
export const subdivideAnimationPlayback = (
  animation: RootDataFinal,
  subdivisionCount: number,
): RootDataFinal | undefined => {
  if (!Number.isInteger(subdivisionCount) || subdivisionCount < doublePlaybackMultiplier) {
    return undefined
  }

  const compiled = rootCompile(animation)
  const props = []

  for (const [propIndex, prop] of animation.props.entries()) {
    const compiledProp = compiled.props[propIndex]
    if (!compiledProp) return undefined

    const anim = subdivideFrames(prop.anim, compiledProp.anim, subdivisionCount)
    if (!anim) return undefined
    props.push({
      ...prop,
      anim,
      motion: scaleMotionTrackBeats(prop.motion, subdivisionCount),
    })
  }

  const subdivided: RootDataFinal = {
    ...animation,
    bpm: animation.bpm * subdivisionCount,
    camera: scaleCameraTrackBeats(animation.camera, subdivisionCount),
    props,
  }
  return subdivisionPreservesCompiledBoundaries(compiled, rootCompile(subdivided), subdivisionCount)
    ? subdivided
    : undefined
}

export const doubleAnimationPlayback = (animation: RootDataFinal): RootDataFinal | undefined =>
  subdivideAnimationPlayback(animation, doublePlaybackMultiplier)

/**
 * Lowers playback rate while combining equal groups of authored intervals. This is the inverse of
 * subdivision for uniformly authored motion and retains each group's final visual state.
 */
export const consolidateAnimationPlayback = (
  animation: RootDataFinal,
  consolidationCount: number,
): RootDataFinal | undefined => {
  if (!Number.isInteger(consolidationCount) || consolidationCount < doublePlaybackMultiplier) {
    return undefined
  }

  const compiled = rootCompile(animation)
  const props = animation.props.map((prop, propIndex) => {
    const compiledProp = compiled.props[propIndex]
    const firstFrame = prop.anim[0]
    if (
      !compiledProp ||
      !firstFrame ||
      prop.anim.length !== compiledProp.anim.length ||
      (prop.anim.length - 1) % consolidationCount !== 0
    ) {
      return undefined
    }

    const anim: AnimData[] = [{ ...firstFrame }]
    for (
      let startIndex = 1;
      startIndex < compiledProp.anim.length;
      startIndex += consolidationCount
    ) {
      const first = compiledProp.anim[startIndex]
      const last = compiledProp.anim[startIndex + consolidationCount - 1]
      if (!first || !last) return undefined

      anim.push({
        turns: Array.from(
          { length: consolidationCount },
          (_, offset) => compiledProp.anim[startIndex + offset]?.turns,
        ).reduce<number>((sum, turns) => sum + (turns ?? 0), 0),
        twist: Array.from(
          { length: consolidationCount },
          (_, offset) => compiledProp.anim[startIndex + offset]?.twist,
        ).reduce<number>((sum, twist) => sum + (twist ?? 0), 0),
        yaw: first.yaw,
        rotate: Array.from(
          { length: consolidationCount },
          (_, offset) => compiledProp.anim[startIndex + offset]?.rotate,
        ).reduce<number>((sum, rotate) => sum + (rotate ?? 0), 0),
        beats: last.beats,
        scale: last.scale,
        warp: Array.from(
          { length: consolidationCount },
          (_, offset) => compiledProp.anim[startIndex + offset]?.warp,
        ).reduce<number>((sum, warp) => sum + (warp ?? 0), 0),
        strength: last.strength,
        depth: last.depth,
        type: last.type,
        adjust: last.adjust,
        arc: Array.from(
          { length: consolidationCount },
          (_, offset) => compiledProp.anim[startIndex + offset]?.arc,
        ).reduce<number>((sum, arc) => sum + (arc ?? 0), 0),
        plane: first.plane,
        axis: first.axis,
      })
    }
    return {
      ...prop,
      anim: compactAnimationFrames(anim, {
        // Consolidation retains the source's authored starting boundary.
        preserve: (frameIndex) => frameIndex === 0,
      }),
      motion: scaleMotionTrackBeats(prop.motion, 1 / consolidationCount),
    }
  })
  if (props.some((prop) => prop === undefined)) return undefined

  return {
    ...animation,
    bpm: animation.bpm / consolidationCount,
    camera: scaleCameraTrackBeats(animation.camera, 1 / consolidationCount),
    props: props.map((prop) => prop!),
  }
}
