import { MathUtils, Quaternion, Vector3 } from 'three'

// Shared reconstruction math for rotating closed animation-frame ranges.

import { TTYPE } from '@/domain/animation/AnimStruct'
import { compactAnimationFrames } from '@/math/animation/compressFrames'
import {
  InitialOrtho,
  InitialPoint,
  orthoAngle,
  orthoNext,
  orthoPoint,
} from '@/math/animation/OrthogonalFunc'
import type { AnimData, AnimDataCompiled } from '@/types/AnimTypes'

const endpointTolerance = 1e-6
const integerSnapTolerance = endpointTolerance

export interface ShiftAnimationRangeOptions {
  allowEndpointMismatch?: boolean
  /** Retains final endpoint/outgoing values; Warp still follows the reconstructed incoming seam. */
  preserveFinalOutgoing?: boolean
  shiftCount?: number
}

const vectorsAlign = (first: readonly number[], second: readonly number[]) =>
  first.length === second.length &&
  first.every((value, index) => Math.abs(value - second[index]!) <= endpointTolerance)

const quaternionsAlign = (first: readonly number[], second: readonly number[]) => {
  if (first.length !== second.length) return false
  const dot = first.reduce((sum, value, index) => sum + value * second[index]!, 0)
  return Math.abs(1 - Math.abs(dot)) <= endpointTolerance
}

const rollsAlign = (first: number, second: number) => {
  const difference = MathUtils.euclideanModulo(second - first, 360)
  return difference <= endpointTolerance || 360 - difference <= endpointTolerance
}

const orientationsDifferByLocalRoll = (actual: Quaternion, target: Quaternion) => {
  const difference = target.clone().invert().multiply(actual).normalize()
  const axisLength = Math.hypot(difference.x, difference.y, difference.z)
  return (
    axisLength > endpointTolerance &&
    Math.abs(difference.x / axisLength) <= endpointTolerance &&
    Math.abs(difference.z / axisLength) <= endpointTolerance &&
    Math.abs(1 - Math.abs(difference.y / axisLength)) <= endpointTolerance
  )
}

export const animationRangeEndpointsAlign = (
  frames: readonly AnimDataCompiled[],
  startIndex: number,
  endIndex: number,
) => {
  const first = frames[startIndex]
  const last = frames[endIndex]
  return (
    endIndex - startIndex >= 2 &&
    first !== undefined &&
    last !== undefined &&
    vectorsAlign(first.pos, last.pos) &&
    vectorsAlign(first.warpPos, last.warpPos) &&
    // Rotation direction plus primary/secondary orientation are an internal decomposition and can
    // use a different gauge for the same rendered pose after Shift reconstruction. Closure depends
    // on the composed orientation, position, and visible twist instead.
    quaternionsAlign(first.orient, last.orient) &&
    rollsAlign(first.twistRoll, last.twistRoll)
  )
}

export const animationEndpointsAlign = (frames: readonly AnimDataCompiled[]) =>
  animationRangeEndpointsAlign(frames, 0, frames.length - 1)

const snapNumber = (value: number) => {
  const nearestInteger = Math.round(value)
  const snapped =
    Math.abs(value - nearestInteger) <= integerSnapTolerance
      ? nearestInteger
      : Math.round(value * 1e9) / 1e9
  return Object.is(snapped, -0) ? 0 : snapped
}

const snapSignedAngle = (radians: number) => {
  const degrees = MathUtils.radToDeg(radians)
  const wrapped = MathUtils.euclideanModulo(degrees + 180, 360) - 180
  return snapNumber(wrapped)
}

const planeFromCross = (
  source: Vector3,
  cross: Vector3,
  reference: Vector3,
  orthogonal: Vector3,
) => {
  orthogonal.crossVectors(cross, source).normalize()
  return orthoAngle(source, orthogonal, reference)
}

const signedRotationAround = (source: Vector3, target: Vector3, axis: Vector3, cross: Vector3) => {
  cross.crossVectors(source, target)
  return Math.atan2(axis.dot(cross), source.dot(target))
}

interface InitialOrientationReconstruction {
  axisRadians: number
  rotationRadians: number
  yaw: number
  rotate: number
  primaryGauge?: Quaternion
}

const decomposePrimaryOrientation = (
  orientation: Quaternion,
): Pick<InitialOrientationReconstruction, 'axisRadians' | 'rotationRadians'> | undefined => {
  const initialPrimary = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), InitialPoint)
  const rotation = orientation.clone().multiply(initialPrimary.invert()).normalize()
  if (rotation.w < 0) {
    rotation.x *= -1
    rotation.y *= -1
    rotation.z *= -1
    rotation.w *= -1
  }

  const axisLength = Math.hypot(rotation.x, rotation.y, rotation.z)
  if (axisLength <= endpointTolerance) return { axisRadians: 0, rotationRadians: 0 }
  const axis = new Vector3(
    rotation.x / axisLength,
    rotation.y / axisLength,
    rotation.z / axisLength,
  )
  if (Math.abs(axis.dot(InitialPoint)) > endpointTolerance) return undefined

  const axisPoint = axis.cross(InitialPoint).normalize()
  return {
    axisRadians: orthoAngle(InitialPoint, axisPoint, InitialOrtho),
    rotationRadians: 2 * Math.atan2(axisLength, rotation.w),
  }
}

const decomposeSecondaryOrientation = (
  orientation: Quaternion,
): Pick<InitialOrientationReconstruction, 'yaw' | 'rotate'> | undefined => {
  const secondary = orientation.clone().normalize()
  if (secondary.w < 0) {
    secondary.x *= -1
    secondary.y *= -1
    secondary.z *= -1
    secondary.w *= -1
  }

  const axisLength = Math.hypot(secondary.x, secondary.y, secondary.z)
  if (axisLength <= endpointTolerance) return { yaw: 90, rotate: 0 }
  const axis = new Vector3(
    secondary.x / axisLength,
    secondary.y / axisLength,
    secondary.z / axisLength,
  )
  if (Math.abs(axis.dot(InitialPoint)) > endpointTolerance) return undefined

  const yawPoint = axis.cross(InitialPoint).normalize()
  return {
    yaw: snapSignedAngle(orthoAngle(InitialPoint, yawPoint, InitialOrtho)),
    rotate: snapNumber(MathUtils.radToDeg(2 * Math.atan2(axisLength, secondary.w))),
  }
}

const decomposeInitialOrientationChannels = (
  target: AnimDataCompiled,
): InitialOrientationReconstruction | undefined => {
  const primary = decomposePrimaryOrientation(new Quaternion().fromArray(target.primaryOrient))
  const secondary = decomposeSecondaryOrientation(
    new Quaternion().fromArray(target.secondaryOrient),
  )
  return primary && secondary ? { ...primary, ...secondary } : undefined
}

const reconstructShiftedInitialOrientation = (
  target: AnimDataCompiled,
  nextTarget: AnimDataCompiled | undefined,
): InitialOrientationReconstruction | undefined => {
  if (!nextTarget) return undefined

  const nextAxis = new Vector3().fromArray(nextTarget.rotx).normalize()
  const circleReference = InitialPoint.clone().addScaledVector(
    nextAxis,
    -InitialPoint.dot(nextAxis),
  )
  if (circleReference.lengthSq() <= endpointTolerance) {
    circleReference.copy(InitialOrtho).addScaledVector(nextAxis, -InitialOrtho.dot(nextAxis))
  }
  if (circleReference.lengthSq() <= endpointTolerance) return undefined
  circleReference.normalize()
  const circleCross = new Vector3().crossVectors(nextAxis, circleReference).normalize()
  const targetOrientation = new Quaternion().fromArray(target.orient)
  const targetPrimary = new Quaternion().fromArray(target.primaryOrient)
  const targetRotation = new Vector3().fromArray(target.rot)
  const initialPrimary = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), InitialPoint)
  const rotation = new Vector3()
  const reconstructedRotation = new Vector3()
  const reconstructedReference = new Vector3()
  const rotationAxis = new Vector3()
  const primary = new Quaternion()
  const inversePrimary = new Quaternion()
  const secondary = new Quaternion()
  let axisRadians = 0
  let rotationRadians = 0

  const evaluateConstraint = (angle: number) => {
    rotation
      .copy(circleReference)
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(circleCross, Math.sin(angle))
      .normalize()
    rotationRadians = InitialPoint.angleTo(rotation)
    axisRadians = orthoAngle(InitialPoint, rotation, InitialOrtho)
    reconstructedRotation.copy(InitialPoint)
    reconstructedReference.copy(InitialOrtho)
    orthoNext(
      axisRadians,
      rotationRadians,
      reconstructedRotation,
      reconstructedReference,
      rotationAxis,
    )
    primary.setFromAxisAngle(rotationAxis, rotationRadians).multiply(initialPrimary)
    secondary.copy(targetOrientation).multiply(inversePrimary.copy(primary).invert()).normalize()
    return (
      secondary.x * InitialPoint.x + secondary.y * InitialPoint.y + secondary.z * InitialPoint.z
    )
  }

  const captureCandidate = (angle: number) => {
    const constraint = evaluateConstraint(angle)
    return {
      axisRadians,
      rotationRadians,
      secondary: secondary.clone(),
      // A shifted boundary may need a different primary/secondary split to express the same
      // total orientation with one frame. This quaternion maps the old primary basis to the
      // representable one so following primary axes can be transported through that basis.
      primaryGauge: primary.clone().multiply(targetPrimary.clone().invert()).normalize(),
      constraint,
      score: rotation.distanceTo(targetRotation),
    }
  }

  const candidates: Array<ReturnType<typeof captureCandidate>> = []
  const sampleCount = 720
  let previousAngle = 0
  let previousConstraint = evaluateConstraint(previousAngle)
  if (Math.abs(previousConstraint) <= endpointTolerance) {
    candidates.push(captureCandidate(previousAngle))
  }

  for (let sample = 1; sample <= sampleCount; sample += 1) {
    const angle = (sample / sampleCount) * Math.PI * 2
    const currentConstraint = evaluateConstraint(angle)
    if (Math.abs(currentConstraint) <= endpointTolerance) {
      candidates.push(captureCandidate(angle))
    } else if (previousConstraint * currentConstraint < 0) {
      let low = previousAngle
      let high = angle
      let lowValue = previousConstraint
      for (let iteration = 0; iteration < 50; iteration += 1) {
        const middle = (low + high) / 2
        const middleConstraint = evaluateConstraint(middle)
        if (Math.abs(middleConstraint) <= 1e-12) {
          low = high = middle
          break
        }
        if (lowValue * middleConstraint <= 0) high = middle
        else {
          low = middle
          lowValue = middleConstraint
        }
      }
      candidates.push(captureCandidate((low + high) / 2))
    }
    previousAngle = angle
    previousConstraint = currentConstraint
  }

  let best: InitialOrientationReconstruction | undefined
  let bestScore = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const decomposedSecondary = decomposeSecondaryOrientation(candidate.secondary)
    if (!decomposedSecondary || candidate.score >= bestScore) continue
    best = {
      axisRadians: candidate.axisRadians,
      rotationRadians: candidate.rotationRadians,
      ...decomposedSecondary,
      primaryGauge: candidate.primaryGauge,
    }
    bestScore = candidate.score
  }
  return best
}

const initialOrientationChannelsAlign = (
  target: AnimDataCompiled,
  rotationAxis: Vector3,
  rotationRadians: number,
): boolean => {
  const primary = new Quaternion()
    .setFromAxisAngle(rotationAxis, rotationRadians)
    .multiply(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), InitialPoint))
  const secondary = new Quaternion().setFromAxisAngle(
    new Vector3().fromArray(target.yawx),
    MathUtils.degToRad(target.rotate),
  )
  return (
    quaternionsAlign(primary.toArray(), target.primaryOrient) &&
    quaternionsAlign(secondary.toArray(), target.secondaryOrient)
  )
}

interface ShiftedOrientationState {
  primary: Quaternion
  secondary: Quaternion
  orientation: Quaternion
  hasPendingSecondaryRotation: boolean
}

const applyShiftedOrientationFrame = (
  state: ShiftedOrientationState,
  rotationAxis: Vector3,
  rotationRadians: number,
  yaw: number,
  rotate: number,
): ShiftedOrientationState => {
  const rebase = rotate === 0 && state.hasPendingSecondaryRotation
  const primary = rebase ? state.orientation.clone() : state.primary.clone()
  const secondary = rebase ? new Quaternion() : state.secondary.clone()
  const yawProjected = orthoPoint(
    MathUtils.degToRad(yaw),
    InitialPoint,
    InitialOrtho,
    new Vector3(),
  )
  const yawAxis = new Vector3().crossVectors(InitialPoint, yawProjected).normalize()

  primary.premultiply(new Quaternion().setFromAxisAngle(rotationAxis, rotationRadians)).normalize()
  secondary
    .premultiply(new Quaternion().setFromAxisAngle(yawAxis, MathUtils.degToRad(rotate)))
    .normalize()
  return {
    primary,
    secondary,
    orientation: secondary.clone().multiply(primary).normalize(),
    hasPendingSecondaryRotation: rotate !== 0 || (!rebase && state.hasPendingSecondaryRotation),
  }
}

const solveWrappedSecondaryRotation = (
  state: ShiftedOrientationState,
  rotationAxis: Vector3,
  rotationRadians: number,
  targetOrientation: Quaternion,
): Pick<InitialOrientationReconstruction, 'yaw' | 'rotate'> | undefined => {
  const solveFrom = (primaryStart: Quaternion, secondaryStart: Quaternion) => {
    const primaryEnd = new Quaternion()
      .setFromAxisAngle(rotationAxis, rotationRadians)
      .multiply(primaryStart)
    const requiredSecondaryDelta = targetOrientation
      .clone()
      .multiply(primaryEnd.invert())
      .multiply(secondaryStart.clone().invert())
      .normalize()
    return decomposeSecondaryOrientation(requiredSecondaryDelta)
  }
  const candidates = [solveFrom(state.primary, state.secondary)]
  if (state.hasPendingSecondaryRotation)
    candidates.push(solveFrom(state.orientation, new Quaternion()))

  return candidates.find((candidate) => {
    if (!candidate) return false
    const result = applyShiftedOrientationFrame(
      state,
      rotationAxis,
      rotationRadians,
      candidate.yaw,
      candidate.rotate,
    )
    return quaternionsAlign(result.orientation.toArray(), targetOrientation.toArray())
  })
}

const solveWrappedPrimaryRotation = (
  state: ShiftedOrientationState,
  rawStart: Vector3,
  rawReference: Vector3,
  preferredAxis: Vector3,
  target: AnimDataCompiled,
  yaw: number,
  rotate: number,
): Pick<InitialOrientationReconstruction, 'axisRadians' | 'rotationRadians'> | undefined => {
  const rebase = rotate === 0 && state.hasPendingSecondaryRotation
  const primaryStart = rebase ? state.orientation : state.primary
  const secondaryStart = rebase ? new Quaternion() : state.secondary
  const yawProjected = orthoPoint(
    MathUtils.degToRad(yaw),
    InitialPoint,
    InitialOrtho,
    new Vector3(),
  )
  const yawAxis = new Vector3().crossVectors(InitialPoint, yawProjected).normalize()
  const secondaryEnd = new Quaternion()
    .setFromAxisAngle(yawAxis, MathUtils.degToRad(rotate))
    .multiply(secondaryStart)
  const requiredPrimaryEnd = secondaryEnd
    .clone()
    .invert()
    .multiply(new Quaternion().fromArray(target.orient))
  const primaryDelta = requiredPrimaryEnd.multiply(primaryStart.clone().invert()).normalize()
  if (primaryDelta.w < 0) {
    primaryDelta.x *= -1
    primaryDelta.y *= -1
    primaryDelta.z *= -1
    primaryDelta.w *= -1
  }

  const axisLength = Math.hypot(primaryDelta.x, primaryDelta.y, primaryDelta.z)
  if (axisLength <= endpointTolerance) {
    return vectorsAlign(rawStart.toArray(), target.rot)
      ? { axisRadians: 0, rotationRadians: 0 }
      : undefined
  }
  const rotationAxis = new Vector3(
    primaryDelta.x / axisLength,
    primaryDelta.y / axisLength,
    primaryDelta.z / axisLength,
  )
  let rotationRadians = 2 * Math.atan2(axisLength, primaryDelta.w)
  if (rotationAxis.dot(preferredAxis) < 0) {
    rotationAxis.negate()
    rotationRadians *= -1
  }
  if (Math.abs(rotationAxis.dot(rawStart)) > endpointTolerance) return undefined
  if (
    !vectorsAlign(
      rawStart.clone().applyAxisAngle(rotationAxis, rotationRadians).toArray(),
      target.rot,
    )
  ) {
    return undefined
  }

  return {
    axisRadians: orthoAngle(
      rawStart,
      rotationAxis.clone().cross(rawStart).normalize(),
      rawReference,
    ),
    rotationRadians,
  }
}

// Rebuilds an interval crossing a local-roll seam from its angular velocity. Only the finite
// equivalent representations of the existing Yaw/Rotate channel are considered; each resulting
// primary generator must also reproduce the complete source quaternion curve. A zero-Rotate
// source can still require this reconstruction because the carried local roll changes the basis
// in which its primary rotation must be expressed.
const solveWrappedLocalRollRotation = (
  state: ShiftedOrientationState,
  rawStart: Vector3,
  rawReference: Vector3,
  preferredAxis: Vector3,
  sourceStart: AnimDataCompiled,
  target: AnimDataCompiled,
  yaw: number,
  rotate: number,
): InitialOrientationReconstruction | undefined => {
  const sourcePrimaryStart = new Quaternion().fromArray(sourceStart.primaryOrient)
  const sourceSecondaryStart = new Quaternion().fromArray(sourceStart.secondaryOrient)
  const sourceRotationRadians =
    MathUtils.degToRad(target.turns) +
    (target.type === TTYPE.SPHE ? MathUtils.degToRad(target.arc) : 0)
  const localRollGauge = new Quaternion()
    .fromArray(sourceStart.orient)
    .invert()
    .multiply(state.orientation)
    .normalize()
  const sourcePrimaryAxis = new Vector3().fromArray(target.rotx)
  const sourceYawAxis = new Vector3().fromArray(target.yawx)
  const sourceAngularVelocity = sourcePrimaryAxis
    .clone()
    .multiplyScalar(sourceRotationRadians)
    .applyQuaternion(sourceSecondaryStart)
    .addScaledVector(sourceYawAxis, MathUtils.degToRad(target.rotate))
  const inverseShiftedSecondary = state.secondary.clone().invert()
  const alternateYaw = snapSignedAngle(MathUtils.degToRad(yaw + 180))
  const secondaryCandidates = [
    { yaw, rotate },
    { yaw, rotate: -rotate },
    { yaw: alternateYaw, rotate },
    { yaw: alternateYaw, rotate: -rotate },
  ].filter(
    (candidate, index, candidates) =>
      candidates.findIndex(
        (comparison) => comparison.yaw === candidate.yaw && comparison.rotate === candidate.rotate,
      ) === index,
  )

  return secondaryCandidates
    .map((secondary): (InitialOrientationReconstruction & { score: number }) | undefined => {
      const candidateYawPoint = orthoPoint(
        MathUtils.degToRad(secondary.yaw),
        InitialPoint,
        InitialOrtho,
        new Vector3(),
      )
      const candidateYawAxis = new Vector3()
        .crossVectors(InitialPoint, candidateYawPoint)
        .normalize()
      const primaryGenerator = sourceAngularVelocity
        .clone()
        .addScaledVector(candidateYawAxis, -MathUtils.degToRad(secondary.rotate))
        .applyQuaternion(inverseShiftedSecondary)
      let rotationRadians = primaryGenerator.length()
      if (rotationRadians <= endpointTolerance) return undefined
      const rotationAxis = primaryGenerator.divideScalar(rotationRadians)
      if (rotationAxis.dot(preferredAxis) < 0) {
        rotationAxis.negate()
        rotationRadians *= -1
      }
      if (Math.abs(rotationAxis.dot(rawStart)) > endpointTolerance) return undefined

      const preservesCurve = [0.25, 0.5, 0.75, 1].every((progress) => {
        const candidatePrimary = new Quaternion()
          .setFromAxisAngle(rotationAxis, rotationRadians * progress)
          .multiply(state.primary)
        const candidateSecondary = new Quaternion()
          .setFromAxisAngle(candidateYawAxis, MathUtils.degToRad(secondary.rotate) * progress)
          .multiply(state.secondary)
        const sourcePrimary = new Quaternion()
          .setFromAxisAngle(sourcePrimaryAxis, sourceRotationRadians * progress)
          .multiply(sourcePrimaryStart)
        const sourceSecondary = new Quaternion()
          .setFromAxisAngle(sourceYawAxis, MathUtils.degToRad(target.rotate) * progress)
          .multiply(sourceSecondaryStart)
        return quaternionsAlign(
          candidateSecondary.multiply(candidatePrimary).toArray(),
          sourceSecondary.multiply(sourcePrimary).multiply(localRollGauge).toArray(),
        )
      })
      if (!preservesCurve) return undefined

      return {
        axisRadians: orthoAngle(
          rawStart,
          rotationAxis.clone().cross(rawStart).normalize(),
          rawReference,
        ),
        rotationRadians,
        ...secondary,
        score:
          Math.abs(secondary.rotate - rotate) + Math.abs(rotationRadians - sourceRotationRadians),
      }
    })
    .filter((candidate) => candidate !== undefined)
    .sort((first, second) => first.score - second.score)[0]
}

/**
 * Rotates a closed animation by the requested number of displayed intervals.
 *
 * The first frame in the shifted range is rebuilt from the preceding compiled
 * state, or from the application's fixed basis when the range begins at frame 0.
 * Relative angles are recalculated from compiled axes so every visible spatial
 * path stays intact.
 */
export const shiftAnimationFrameRange = (
  frames: readonly AnimData[],
  compiled: readonly AnimDataCompiled[],
  startIndex: number,
  endIndex: number,
  options: ShiftAnimationRangeOptions = {},
): AnimData[] | undefined => {
  if (
    compiled.length !== frames.length ||
    startIndex < 0 ||
    endIndex >= frames.length ||
    (!options.allowEndpointMismatch &&
      !animationRangeEndpointsAlign(compiled, startIndex, endIndex))
  ) {
    return undefined
  }

  const position = InitialPoint.clone()
  const positionReference = InitialOrtho.clone()
  const warpPosition = InitialPoint.clone()
  const warpReference = InitialOrtho.clone()
  const rotation = InitialPoint.clone()
  const rotationReference = InitialOrtho.clone()

  const rangeLength = endIndex - startIndex + 1
  const lastOutputIndex = rangeLength - 1
  const requestedShiftCount = Math.trunc(options.shiftCount ?? 1)
  if (requestedShiftCount === 0) return frames.slice(startIndex, endIndex + 1)
  const normalizedShiftCount = MathUtils.euclideanModulo(requestedShiftCount, lastOutputIndex)
  const firstCycleOffset = normalizedShiftCount === 0 ? lastOutputIndex : normalizedShiftCount
  const targetIndices = Array.from(
    { length: rangeLength },
    (_, index) => startIndex + ((firstCycleOffset - 1 + index) % lastOutputIndex) + 1,
  )
  const preserveFinalOutgoing = options.preserveFinalOutgoing ?? false
  const originalStart = compiled[startIndex]!
  const originalEnd = compiled[endIndex]!
  const precedingTwistRoll = startIndex > 0 ? compiled[startIndex - 1]!.twistRoll : 0
  const hasLocalRollBoundaryMismatch =
    vectorsAlign(originalStart.pos, originalEnd.pos) &&
    vectorsAlign(originalStart.rot, originalEnd.rot) &&
    orientationsDifferByLocalRoll(
      new Quaternion().fromArray(originalEnd.orient),
      new Quaternion().fromArray(originalStart.orient),
    )

  const targetPosition = new Vector3()
  const targetWarpPosition = new Vector3()
  const targetRotation = new Vector3()
  const targetAdjustment = new Vector3()
  const targetOrientation = new Quaternion()
  const unadjustedOrientation = new Vector3()
  const targetPositionAxis = new Vector3()
  const positionAxis = new Vector3()
  const warpProjected = new Vector3()
  const warpAxis = new Vector3()
  const warpCross = new Vector3()
  const targetRotationAxis = new Vector3()
  const orthogonal = new Vector3()
  const rotationAxis = new Vector3()
  const rotationCross = new Vector3()
  const shiftedFirstPosition = new Vector3()
  const shiftedFirstWarpPosition = new Vector3()
  const shiftedFirstRotation = new Vector3()
  const wrappedRotationStart = new Vector3()
  const wrappedRotationReference = new Vector3()
  let shiftedOrientationState: ShiftedOrientationState = {
    primary: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), InitialPoint),
    secondary: new Quaternion(),
    orientation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), InitialPoint),
    hasPendingSecondaryRotation: false,
  }
  let primaryGauge: Quaternion | undefined
  let reconstructionFailed = false

  if (startIndex > 0) {
    const preceding = compiled[startIndex - 1]!
    position.fromArray(preceding.pos)
    positionReference
      .copy(position)
      .applyAxisAngle(targetPositionAxis.fromArray(preceding.posx), Math.PI / 2)
    warpPosition.fromArray(preceding.warpPos)
    warpReference
      .copy(warpPosition)
      .applyAxisAngle(targetPositionAxis.fromArray(preceding.warpx), Math.PI / 2)
    rotation.fromArray(preceding.rot)
    rotationReference
      .copy(rotation)
      .applyAxisAngle(targetRotationAxis.fromArray(preceding.rotx), Math.PI / 2)
    shiftedOrientationState = {
      primary: new Quaternion().fromArray(preceding.primaryOrient),
      secondary: new Quaternion().fromArray(preceding.secondaryOrient),
      orientation: new Quaternion().fromArray(preceding.orient),
      hasPendingSecondaryRotation: compiled
        .slice(0, startIndex)
        .reduce(
          (pending, frame) => frame.rotate !== 0 || (pending && !frame.rebasePrimaryOrientation),
          false,
        ),
    }
  }

  const shifted = targetIndices.map((targetIndex, outputIndex): AnimData => {
    const target = compiled[targetIndex]!
    const rebuildStart = outputIndex === 0
    const preserveOutgoing = preserveFinalOutgoing && outputIndex === lastOutputIndex
    const rebuildWrappedInterval =
      outputIndex > 0 &&
      targetIndex === startIndex + 1 &&
      targetIndices[outputIndex - 1] === endIndex
    targetPosition.fromArray(target.pos)
    targetWarpPosition.fromArray(target.warpPos)
    targetRotation.fromArray(target.rot)

    const arcRadians = rebuildStart
      ? position.angleTo(targetPosition)
      : MathUtils.degToRad(target.arc)
    const planeRadians = rebuildStart
      ? orthoAngle(position, targetPosition, positionReference)
      : planeFromCross(
          position,
          targetPositionAxis.fromArray(target.posx),
          positionReference,
          orthogonal,
        )
    orthoNext(planeRadians, arcRadians, position, positionReference, positionAxis)

    if (outputIndex === 0) shiftedFirstPosition.copy(position)

    orthoPoint(planeRadians, warpPosition, warpReference, warpProjected)
    warpAxis.crossVectors(warpPosition, warpProjected).normalize()
    const warpRadians = rebuildStart
      ? signedRotationAround(warpPosition, targetWarpPosition, warpAxis, warpCross)
      : MathUtils.degToRad(target.arc + target.warp)
    orthoNext(planeRadians, warpRadians, warpPosition, warpReference, warpAxis)
    if (rebuildStart) {
      shiftedFirstWarpPosition.copy(warpPosition)
      if (!vectorsAlign(warpPosition.toArray(), targetWarpPosition.toArray())) {
        reconstructionFailed = true
      }
    }

    const targetRotationRadians =
      MathUtils.degToRad(target.turns) +
      (target.type === TTYPE.SPHE ? MathUtils.degToRad(target.arc) : 0)
    if (rebuildWrappedInterval) {
      wrappedRotationStart.copy(rotation)
      wrappedRotationReference.copy(rotationReference)
    }
    // Once the compiler consumes pending Rotate into primary orientation, the temporary basis
    // split no longer exists and subsequent axes return to their compiled world directions.
    if (outputIndex > 0 && target.rebasePrimaryOrientation) primaryGauge = undefined
    let rotationRadians = rebuildStart ? rotation.angleTo(targetRotation) : targetRotationRadians
    let axisRadians = rebuildStart
      ? orthoAngle(rotation, targetRotation, rotationReference)
      : planeFromCross(
          rotation,
          primaryGauge
            ? targetRotationAxis.fromArray(target.rotx).applyQuaternion(primaryGauge)
            : targetRotationAxis.fromArray(target.rotx),
          rotationReference,
          orthogonal,
        )
    let reconstructedOrientation: InitialOrientationReconstruction | undefined
    if (rebuildStart) {
      const candidateRotation = rotation.clone()
      const candidateReference = rotationReference.clone()
      const candidateAxis = new Vector3()
      orthoNext(axisRadians, rotationRadians, candidateRotation, candidateReference, candidateAxis)
      if (!initialOrientationChannelsAlign(target, candidateAxis, rotationRadians)) {
        reconstructedOrientation =
          decomposeInitialOrientationChannels(target) ??
          reconstructShiftedInitialOrientation(target, compiled[targetIndices[1]!])
        if (!reconstructedOrientation) reconstructionFailed = true
        else {
          rotationRadians = reconstructedOrientation.rotationRadians
          axisRadians = reconstructedOrientation.axisRadians
          primaryGauge =
            compiled[targetIndices[1]!]?.rotate === 0
              ? undefined
              : reconstructedOrientation.primaryGauge
        }
      }
    }
    orthoNext(axisRadians, rotationRadians, rotation, rotationReference, rotationAxis)
    if (outputIndex === 0) shiftedFirstRotation.copy(rotation)

    const adjust =
      outputIndex === 0
        ? MathUtils.radToDeg(
            signedRotationAround(
              unadjustedOrientation
                .set(0, 1, 0)
                .applyQuaternion(targetOrientation.fromArray(target.orient)),
              targetAdjustment.fromArray(target.adju),
              rotationAxis,
              rotationCross,
            ),
          )
        : target.adjust

    let yaw = reconstructedOrientation?.yaw ?? target.yaw
    let rotate = reconstructedOrientation?.rotate ?? target.rotate
    let nextOrientationState = applyShiftedOrientationFrame(
      shiftedOrientationState,
      rotationAxis,
      rotationRadians,
      yaw,
      rotate,
    )
    if (
      rebuildWrappedInterval &&
      !quaternionsAlign(nextOrientationState.orientation.toArray(), target.orient)
    ) {
      const wrappedLocalRoll = hasLocalRollBoundaryMismatch
        ? solveWrappedLocalRollRotation(
            shiftedOrientationState,
            wrappedRotationStart,
            wrappedRotationReference,
            rotationAxis,
            originalStart,
            target,
            yaw,
            rotate,
          )
        : undefined
      const wrappedPrimary =
        wrappedLocalRoll || hasLocalRollBoundaryMismatch
          ? undefined
          : solveWrappedPrimaryRotation(
              shiftedOrientationState,
              wrappedRotationStart,
              wrappedRotationReference,
              rotationAxis,
              target,
              yaw,
              rotate,
            )
      if (wrappedLocalRoll || wrappedPrimary) {
        const wrapped = wrappedLocalRoll ?? wrappedPrimary!
        rotationRadians = wrapped.rotationRadians
        axisRadians = wrapped.axisRadians
        if (wrappedLocalRoll) {
          yaw = wrappedLocalRoll.yaw
          rotate = wrappedLocalRoll.rotate
        }
        rotation.copy(wrappedRotationStart)
        rotationReference.copy(wrappedRotationReference)
        orthoNext(axisRadians, rotationRadians, rotation, rotationReference, rotationAxis)
        nextOrientationState = applyShiftedOrientationFrame(
          shiftedOrientationState,
          rotationAxis,
          rotationRadians,
          yaw,
          rotate,
        )
      } else if (hasLocalRollBoundaryMismatch) {
        // Returning no Shift is safer than replacing a 3D Rotate curve with an endpoint-only
        // approximation. This branch should be unreachable for representable integer channels.
        reconstructionFailed = true
      } else {
        const wrappedRotation = solveWrappedSecondaryRotation(
          shiftedOrientationState,
          rotationAxis,
          rotationRadians,
          targetOrientation.fromArray(target.orient),
        )
        // A non-zero correction would define a different Rotate curve. Only remove a carried
        // Rotate when the exact endpoint solution proves that no secondary rotation is needed.
        if (wrappedRotation?.rotate === 0 && rotate !== 0) {
          yaw = wrappedRotation.yaw
          rotate = wrappedRotation.rotate
          nextOrientationState = applyShiftedOrientationFrame(
            shiftedOrientationState,
            rotationAxis,
            rotationRadians,
            yaw,
            rotate,
          )
        }
      }
    }
    shiftedOrientationState = nextOrientationState

    return {
      turns: snapNumber(
        MathUtils.radToDeg(rotationRadians) -
          (target.type === TTYPE.SPHE ? MathUtils.radToDeg(arcRadians) : 0),
      ),
      twist: preserveOutgoing
        ? originalEnd.twist
        : rebuildStart
          ? snapNumber(target.twistRoll - precedingTwistRoll)
          : target.twist,
      yaw,
      rotate,
      beats: preserveOutgoing
        ? originalEnd.beats
        : compiled[
            outputIndex === lastOutputIndex
              ? startIndex + MathUtils.euclideanModulo(firstCycleOffset - 1, lastOutputIndex)
              : targetIndex === endIndex
                ? startIndex
                : targetIndex
          ]!.beats,
      scale: preserveOutgoing ? originalEnd.scale : target.scale,
      warp: snapNumber(rebuildStart ? MathUtils.radToDeg(warpRadians - arcRadians) : target.warp),
      strength: preserveOutgoing ? originalEnd.strength : target.strength,
      depth: preserveOutgoing ? originalEnd.depth : target.depth,
      type: target.type,
      adjust: snapNumber(preserveOutgoing ? originalEnd.adjust : adjust),
      arc: snapNumber(MathUtils.radToDeg(arcRadians)),
      plane: snapSignedAngle(planeRadians),
      axis: snapSignedAngle(axisRadians),
    }
  })

  if (
    reconstructionFailed ||
    (!options.allowEndpointMismatch &&
      (!vectorsAlign(position.toArray(), shiftedFirstPosition.toArray()) ||
        !vectorsAlign(warpPosition.toArray(), shiftedFirstWarpPosition.toArray()) ||
        !vectorsAlign(rotation.toArray(), shiftedFirstRotation.toArray())))
  ) {
    return undefined
  }

  return compactAnimationFrames(shifted, {
    preceding: startIndex > 0 ? compiled[startIndex - 1] : undefined,
  })
}

export const shiftAnimationFrames = (
  frames: readonly AnimData[],
  compiled: readonly AnimDataCompiled[],
  shiftCount = 1,
): AnimData[] | undefined =>
  shiftAnimationFrameRange(frames, compiled, 0, frames.length - 1, { shiftCount })
