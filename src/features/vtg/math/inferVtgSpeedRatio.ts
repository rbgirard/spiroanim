import { rootCompile } from '@/math/animation/AnimFunc'
import type { CompiledVtgAnimation } from '@/features/vtg/math/createVtgAnimationSignature'
import type { AnimDataCompiled, RootDataFinal } from '@/types/AnimTypes'
import type { VtgIndividualSpeedRatio, VtgSpeedRatio } from '@/features/vtg/types'
import { formatVtgIndividualSpeedRatio, formatVtgSpeedRatio } from '@/features/vtg/types'

const firstContinuationFrameIndex = 1
const directionTolerance = 0.000_001
const floatingPointTolerance = 0.000_001
const legacySerializedTurnsResolution = 1
const maximumTimingNumerator = 3600

export type VtgSpinDirection = 'anti' | 'in'

export interface VtgPropTiming {
  ratio: VtgIndividualSpeedRatio
  spin: VtgSpinDirection
}

export interface VtgTiming {
  speedRatio: VtgSpeedRatio
  props: readonly [VtgPropTiming, VtgPropTiming]
}

type DirectionVector = readonly [number, number, number]

const vectorsAlign = (first: readonly number[], second: readonly number[]) =>
  first.length === second.length &&
  first.every((value, index) => Math.abs(value - second[index]!) <= floatingPointTolerance)

const quaternionsAlign = (first: readonly number[], second: readonly number[]) => {
  if (first.length !== second.length) return false
  const dotProduct = first.reduce((sum, value, index) => sum + value * second[index]!, 0)
  return Math.abs(1 - Math.abs(dotProduct)) <= floatingPointTolerance
}

const rollsAlign = (first: number, second: number) => {
  const difference = (((second - first) % 360) + 360) % 360
  return difference <= floatingPointTolerance || 360 - difference <= floatingPointTolerance
}

const dot = (first: DirectionVector, second: DirectionVector): number =>
  first[0] * second[0] + first[1] * second[1] + first[2] * second[2]

const signedDirection = (
  firstAxis: DirectionVector,
  firstAmount: number,
  secondAxis: DirectionVector,
  secondAmount: number,
): number => dot(firstAxis, secondAxis) * Math.sign(firstAmount) * Math.sign(secondAmount)

const inferReducedRatio = (
  rate: number,
  tolerance: number,
): VtgIndividualSpeedRatio | undefined => {
  if (!Number.isFinite(rate) || rate <= 0) return undefined

  for (let numerator = 1; numerator <= maximumTimingNumerator; numerator += 1) {
    const denominator = Math.round(rate * numerator)
    if (denominator < 1) continue
    if (Math.abs(denominator / numerator - rate) <= tolerance) {
      return formatVtgIndividualSpeedRatio({ numerator, denominator })
    }
  }

  return undefined
}

const inferContinuation = (frame: AnimDataCompiled): VtgPropTiming | undefined => {
  const absoluteRotation = frame.arc + frame.turns
  if (
    Math.abs(frame.arc) <= directionTolerance ||
    Math.abs(absoluteRotation) <= directionTolerance
  ) {
    return undefined
  }

  const direction = signedDirection(frame.posx, frame.arc, frame.rotx, absoluteRotation)
  if (Math.abs(direction) <= directionTolerance) return undefined

  // Current query strings serialize Turns to half-degrees, while legacy versions may have rounded
  // to whole degrees. Use the widest supported half-step so old compound ratios still reduce to
  // their intended timing after decoding.
  const ratioTolerance = Math.max(
    floatingPointTolerance,
    legacySerializedTurnsResolution / 2 / Math.abs(frame.arc) + Number.EPSILON,
  )
  const ratio = inferReducedRatio(Math.abs(absoluteRotation / frame.arc), ratioTolerance)
  if (!ratio) return undefined
  return { ratio, spin: direction < 0 ? 'anti' : 'in' }
}

const combinePropTimings = (
  left: VtgPropTiming | undefined,
  right: VtgPropTiming | undefined,
): VtgTiming | undefined =>
  left && right
    ? { speedRatio: formatVtgSpeedRatio(left.ratio, right.ratio), props: [left, right] }
    : undefined

/** Infers VTG timing from one compiled movement interval. */
const inferVtgTimingAtFrame = (
  animation: RootDataFinal,
  frameIndex: number,
): VtgTiming | undefined => {
  if (animation.props.length !== 2 || !Number.isInteger(frameIndex) || frameIndex < 1) {
    return undefined
  }

  const compiled = rootCompile(animation)
  const left = compiled.props[0]?.anim[frameIndex]
  const right = compiled.props[1]?.anim[frameIndex]
  return left && right
    ? combinePropTimings(inferContinuation(left), inferContinuation(right))
    : undefined
}

/** Infers the ratio carried by a 45-degree Pattern Builder portion. */
export const inferVtgDoubledPortionSpeedRatio = (
  animation: RootDataFinal,
): VtgSpeedRatio | undefined =>
  inferVtgTimingAtFrame(animation, firstContinuationFrameIndex)?.speedRatio

/** Infers each prop's ordered reduced timing ratio and spin from its continuation beats. */
export const inferVtgTiming = (animation: RootDataFinal): VtgTiming | undefined =>
  inferVtgTimingFromCompiled(animation, rootCompile(animation))

export const inferVtgTimingFromCompiled = (
  animation: RootDataFinal,
  compiled: CompiledVtgAnimation,
): VtgTiming | undefined => {
  const frameCount = animation.props[0]?.anim.length
  if (
    frameCount === undefined ||
    frameCount <= firstContinuationFrameIndex ||
    animation.props.length !== 2 ||
    animation.props.some((prop) => prop.anim.length !== frameCount)
  ) {
    return undefined
  }

  const hasShiftedSeamGauge = compiled.props.every((prop) => {
    const start = prop.anim[0]
    const end = prop.anim.at(-1)
    return (
      start !== undefined &&
      end !== undefined &&
      vectorsAlign(start.pos, end.pos) &&
      !vectorsAlign(start.rot, end.rot) &&
      quaternionsAlign(start.orient, end.orient) &&
      rollsAlign(start.twistRoll, end.twistRoll)
    )
  })
  const timings = compiled.props.map((prop) => {
    const inferred = prop.anim.slice(1).map(inferContinuation)
    const first = inferred[0]
    if (
      first &&
      inferred.every((timing) => timing?.ratio === first.ratio && timing.spin === first.spin)
    ) {
      return first
    }

    // Shift rebuilds the interval crossing the cycle seam. An equivalent compiled orientation can
    // use the opposite internal rotation-axis gauge on that first interval while every remaining
    // continuation still carries the same observable VTG timing.
    const continuation = inferred[1]
    return hasShiftedSeamGauge &&
      first &&
      continuation &&
      first.ratio === continuation.ratio &&
      inferred
        .slice(1)
        .every(
          (timing) => timing?.ratio === continuation.ratio && timing.spin === continuation.spin,
        )
      ? continuation
      : undefined
  })

  return combinePropTimings(timings[0], timings[1])
}

export const inferVtgSpeedRatio = (animation: RootDataFinal): VtgSpeedRatio | undefined =>
  inferVtgTiming(animation)?.speedRatio
