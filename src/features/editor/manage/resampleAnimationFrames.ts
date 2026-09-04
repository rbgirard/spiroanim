import { rootCompile } from '@/math/animation/AnimFunc'
import { compiledMotionFramesHaveEqualPlayback } from '@/math/animation/compressFrames'
import { compressAnimation } from '@/features/editor/manage/compressAnimation'
import {
  consolidateAnimationPlayback,
  doubleAnimationPlayback,
  doublePlaybackMultiplier,
} from '@/math/animation/subdivideAnimationPlayback'
import { VDEF } from '@/stores/useQSMainStore'
import type { AllVars, AnimData, AnimDataCompiled, RootDataFinal } from '@/types/AnimTypes'

const numericTolerance = 0.000_000_001
const animationValueKeys = [
  'turns',
  'twist',
  'yaw',
  'rotate',
  'beats',
  'scale',
  'warp',
  'strength',
  'depth',
  'type',
  'adjust',
  'arc',
  'plane',
  'axis',
] as const satisfies readonly (keyof AnimDataCompiled)[]

const nearlyEqual = (first: number, second: number): boolean =>
  Math.abs(first - second) <= numericTolerance

const vectorsNearlyEqual = (first: readonly number[], second: readonly number[]): boolean =>
  first.length === second.length &&
  first.every((value, index) => nearlyEqual(value, second[index]!))

const quaternionsNearlyEqual = (first: readonly number[], second: readonly number[]): boolean =>
  first.length === second.length &&
  nearlyEqual(Math.abs(first.reduce((sum, value, index) => sum + value * second[index]!, 0)), 1)

const isRepresentableValue = (key: AllVars, value: number): boolean => {
  const [minimum, maximum, _bits, transform] = VDEF[key]
  if (!Number.isFinite(value) || value < minimum || value > maximum) return false

  if (typeof transform === 'object') {
    const decoded = transform.decode(transform.encode(value))
    return typeof decoded === 'number' && nearlyEqual(decoded, value)
  }

  return Number.isInteger(value)
}

const isRepresentableFrame = (frame: AnimData): boolean => {
  for (const key of animationValueKeys) {
    const value = frame[key]
    if (value !== undefined && !isRepresentableValue(key, value)) return false
  }

  return (
    frame.move === undefined ||
    frame.move.every((coordinate) => isRepresentableValue('move', coordinate))
  )
}

const isRepresentableAnimation = (animation: RootDataFinal): boolean =>
  isRepresentableValue('bpm', animation.bpm) &&
  animation.props.every(
    (prop) =>
      prop.anim.every(isRepresentableFrame) &&
      prop.motion.every(
        (frame) => frame.beats === undefined || isRepresentableValue('beats', frame.beats),
      ),
  ) &&
  animation.camera.every(
    (frame) => frame.orbit?.beats === undefined || isRepresentableValue('beats', frame.orbit.beats),
  )

const compiledFramesEqual = (
  first: readonly AnimDataCompiled[],
  second: readonly AnimDataCompiled[],
): boolean =>
  first.length === second.length &&
  first.every((frame, index) => {
    const comparison = second[index]
    return (
      comparison !== undefined &&
      animationValueKeys.every((key) => nearlyEqual(frame[key], comparison[key])) &&
      frame.rebasePrimaryOrientation === comparison.rebasePrimaryOrientation &&
      nearlyEqual(frame.twistRoll, comparison.twistRoll) &&
      vectorsNearlyEqual(frame.pos, comparison.pos) &&
      vectorsNearlyEqual(frame.warpPos, comparison.warpPos) &&
      vectorsNearlyEqual(frame.rot, comparison.rot) &&
      vectorsNearlyEqual(frame.posx, comparison.posx) &&
      vectorsNearlyEqual(frame.warpx, comparison.warpx) &&
      vectorsNearlyEqual(frame.rotx, comparison.rotx) &&
      vectorsNearlyEqual(frame.yawx, comparison.yawx) &&
      vectorsNearlyEqual(frame.adjustx, comparison.adjustx) &&
      quaternionsNearlyEqual(frame.primaryOrient, comparison.primaryOrient) &&
      quaternionsNearlyEqual(frame.secondaryOrient, comparison.secondaryOrient) &&
      quaternionsNearlyEqual(frame.orient, comparison.orient)
    )
  })

const animationsHaveEqualFrameValues = (first: RootDataFinal, second: RootDataFinal): boolean => {
  if (first.bpm !== second.bpm || first.props.length !== second.props.length) return false

  const firstCompiled = rootCompile(first)
  const secondCompiled = rootCompile(second)
  return (
    firstCompiled.camera.length === secondCompiled.camera.length &&
    firstCompiled.camera.every((frame, index) => {
      const comparison = secondCompiled.camera[index]
      return (
        comparison !== undefined &&
        compiledMotionFramesHaveEqualPlayback([frame.orbit], [comparison.orbit]) &&
        compiledMotionFramesHaveEqualPlayback([frame.center], [comparison.center])
      )
    }) &&
    firstCompiled.props.every((prop, index) => {
      const comparison = secondCompiled.props[index]
      return (
        comparison !== undefined &&
        compiledFramesEqual(prop.anim, comparison.anim) &&
        compiledMotionFramesHaveEqualPlayback(prop.motion, comparison.motion)
      )
    })
  )
}

const hasIntervals = (animation: RootDataFinal, minimumFrameCount: number): boolean =>
  animation.props.some((prop) => prop.anim.length >= minimumFrameCount)

const compressRepresentableResult = (
  animation: RootDataFinal | undefined,
): RootDataFinal | undefined => {
  if (!animation) return undefined
  compressAnimation(animation, { propValues: false })
  return isRepresentableAnimation(animation) ? animation : undefined
}

/** Doubles authored Animation intervals and preserves Motion/Camera timing when all values fit. */
export const doubleAnimationFrames = (animation: RootDataFinal): RootDataFinal | undefined => {
  if (!hasIntervals(animation, doublePlaybackMultiplier)) return undefined

  return compressRepresentableResult(doubleAnimationPlayback(animation))
}

/**
 * Halves authored animation intervals only when doubling the result recreates every effective
 * source-frame value.
 */
export const halveAnimationFrames = (animation: RootDataFinal): RootDataFinal | undefined => {
  if (!hasIntervals(animation, doublePlaybackMultiplier + 1)) return undefined

  const halved = compressRepresentableResult(
    consolidateAnimationPlayback(animation, doublePlaybackMultiplier),
  )
  if (!halved) return undefined

  const restored = doubleAnimationPlayback(halved)
  return restored && animationsHaveEqualFrameValues(animation, restored) ? halved : undefined
}
