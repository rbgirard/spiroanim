import { rootCompile } from '@/math/animation/AnimFunc'
import type { RootDataFinal } from '@/types/AnimTypes'
import { toDisplayScale } from '@/domain/animation/scale'

export type CompiledVtgAnimation = ReturnType<typeof rootCompile>

const precision = 1e9
const normalizeNumber = (value: number) => {
  const rounded = Math.round(value * precision) / precision
  return Object.is(rounded, -0) ? 0 : rounded
}
const normalizeAngle = (value: number) => {
  const normalized = ((((normalizeNumber(value) + 180) % 360) + 360) % 360) - 180
  return normalized === -180 ? 180 : normalized
}

/** Describes the complete compiled frame paths for exact catalog regeneration comparisons. */
export const createCompiledVtgPatternSignatureFromCompiled = (compiled: CompiledVtgAnimation) =>
  JSON.stringify({
    props: compiled.props.map((prop) =>
      prop.anim.map((frame) => [
        normalizeNumber(frame.turns),
        normalizeNumber(frame.beats),
        normalizeNumber(frame.depth),
        normalizeNumber(frame.type),
        normalizeNumber(frame.adjust),
        normalizeAngle(frame.arc),
        normalizeAngle(frame.plane),
        normalizeAngle(frame.axis),
        ...frame.pos.map(normalizeNumber),
        ...frame.rot.map(normalizeNumber),
      ]),
    ),
  })

export const createCompiledVtgPatternSignature = (animation: RootDataFinal) =>
  createCompiledVtgPatternSignatureFromCompiled(rootCompile(animation))
const getPositionOrientation = (position: readonly number[], fallback: number) => {
  const x = position[0] ?? 0
  const y = position[1] ?? 0
  return Math.abs(x) + Math.abs(y) < 1e-9
    ? fallback
    : normalizeAngle((Math.atan2(y, x) * 180) / Math.PI)
}

const normalizePosition = (position: readonly number[], orientation: number) => {
  const radians = (orientation * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const x = position[0] ?? 0
  const y = position[1] ?? 0
  return [
    normalizeNumber(x * cosine + y * sine),
    normalizeNumber(-x * sine + y * cosine),
    normalizeNumber(position[2] ?? 0),
  ]
}

const getCompiledSpinDirection = (
  frame: ReturnType<typeof rootCompile>['props'][number]['anim'][number],
) => {
  const axisAlignment = frame.posx.reduce(
    (sum, value, index) => sum + value * frame.rotx[index]!,
    0,
  )
  return Math.sign(axisAlignment * frame.arc * (frame.arc + frame.turns))
}

const semanticTolerance = 1e-6
const vectorsAlign = (first: readonly number[], second: readonly number[]) =>
  first.length === second.length &&
  first.every((value, index) => Math.abs(value - second[index]!) <= semanticTolerance)
const quaternionsAlign = (first: readonly number[], second: readonly number[]) => {
  if (first.length !== second.length) return false
  const dot = first.reduce((sum, value, index) => sum + value * second[index]!, 0)
  return Math.abs(1 - Math.abs(dot)) <= semanticTolerance
}
const rollsAlign = (first: number, second: number) => {
  const difference = (((second - first) % 360) + 360) % 360
  return difference <= semanticTolerance || 360 - difference <= semanticTolerance
}

const hasUnsupportedPatternFields = (animation: RootDataFinal) =>
  animation.type !== 0 ||
  animation.props.some((prop) =>
    prop.anim.some((frame) => frame.type !== undefined || frame.adjust !== undefined),
  )

export interface VtgDirectionSignature {
  key: string
  orientation: number
}

/**
 * Describes starting placement and the direction of every beat. Absolute prop turns and absolute
 * table rotation are intentionally omitted so authored oddballs can match the same VTG cell.
 */
export const createVtgDirectionSignature = (
  animation: RootDataFinal,
): VtgDirectionSignature | undefined =>
  createVtgDirectionSignatureFromCompiled(animation, rootCompile(animation))

export const createVtgDirectionSignatureFromCompiled = (
  animation: RootDataFinal,
  compiled: CompiledVtgAnimation,
): VtgDirectionSignature | undefined => {
  if (animation.props.length !== 2 || hasUnsupportedPatternFields(animation)) return undefined
  const first = compiled.props[0]?.anim[0]
  if (!first) return undefined
  const orientation = getPositionOrientation(first.pos, normalizeAngle(first.arc))
  const hasShiftedSeamGauge = compiled.props.every((prop) => {
    const start = prop.anim[0]
    const end = prop.anim.at(-1)
    return (
      start &&
      end &&
      vectorsAlign(start.pos, end.pos) &&
      !vectorsAlign(start.rot, end.rot) &&
      quaternionsAlign(start.orient, end.orient) &&
      rollsAlign(start.twistRoll, end.twistRoll)
    )
  })
  const tracks = compiled.props.map((prop) => {
    const directions = prop.anim.slice(1).map(getCompiledSpinDirection)
    const beatScale = prop.anim[1]?.beats ?? 1
    const continuationDirection = directions[1]
    const normalizeShiftedSeam =
      hasShiftedSeamGauge &&
      continuationDirection !== undefined &&
      directions.slice(1).every((direction) => direction === continuationDirection)
    return prop.anim.map((frame, frameIndex) =>
      frameIndex === 0
        ? normalizePosition(frame.pos, orientation)
        : [
            ...normalizePosition(frame.pos, orientation),
            // Equivalent Shift reconstructions can flip both the authored turn sign and its
            // compiled rotation-axis gauge. Key the resulting spatial direction, not one channel.
            normalizeShiftedSeam && frameIndex === 1
              ? continuationDirection
              : getCompiledSpinDirection(frame),
            // Uniform frame-duration scaling changes playback tempo, not the VTG pattern.
            // Retain relative durations so authored nonuniform timing still remains distinct.
            normalizeNumber(beatScale === 0 ? frame.beats : frame.beats / beatScale),
          ],
    )
  })

  return { key: JSON.stringify(tracks), orientation }
}

export const createVtgAnimationSignature = (animation: RootDataFinal): string | undefined =>
  createVtgDirectionSignature(animation)?.key

const getSignedRotationDifference = (
  axis: readonly number[],
  from: readonly number[],
  to: readonly number[],
) => {
  const crossX = (from[1] ?? 0) * (to[2] ?? 0) - (from[2] ?? 0) * (to[1] ?? 0)
  const crossY = (from[2] ?? 0) * (to[0] ?? 0) - (from[0] ?? 0) * (to[2] ?? 0)
  const crossZ = (from[0] ?? 0) * (to[1] ?? 0) - (from[1] ?? 0) * (to[0] ?? 0)
  const sine = (axis[0] ?? 0) * crossX + (axis[1] ?? 0) * crossY + (axis[2] ?? 0) * crossZ
  const cosine =
    (from[0] ?? 0) * (to[0] ?? 0) + (from[1] ?? 0) * (to[1] ?? 0) + (from[2] ?? 0) * (to[2] ?? 0)
  return normalizeAngle((Math.atan2(sine, cosine) * 180) / Math.PI)
}

const axesAreEquivalent = (first: number, second: number) =>
  Math.abs(Math.sin(((first - second) * Math.PI) / 180)) <= semanticTolerance

export const getVtgPropRotationOffsets = (
  animation: RootDataFinal,
  candidate: RootDataFinal,
  candidateOffsetReference: RootDataFinal = candidate,
): readonly [number, number] | undefined =>
  getVtgPropRotationOffsetsFromCompiled(
    animation,
    candidate,
    rootCompile(animation),
    rootCompile(candidate),
    candidateOffsetReference === candidate ? undefined : rootCompile(candidateOffsetReference),
  )

export const getVtgPropRotationOffsetsFromCompiled = (
  animation: RootDataFinal,
  candidate: RootDataFinal,
  compiled: CompiledVtgAnimation,
  compiledCandidate: CompiledVtgAnimation,
  compiledCandidateOffsetReference: CompiledVtgAnimation = compiledCandidate,
): readonly [number, number] | undefined => {
  if (animation.props.length !== 2 || candidate.props.length !== 2) return undefined
  const offsets = compiled.props.map((prop, index) => {
    const frame = prop.anim[0]
    const candidateFrame = compiledCandidate.props[index]?.anim[0]
    const referenceFrame = compiledCandidateOffsetReference.props[index]?.anim[0]
    if (!frame || !candidateFrame || !referenceFrame) return undefined
    const authoredAxis = animation.props[index]?.anim[0]?.axis ?? 0
    const candidateAxis = candidate.props[index]?.anim[0]?.axis ?? 0
    if (!axesAreEquivalent(authoredAxis, candidateAxis)) return undefined
    const difference = getSignedRotationDifference(
      referenceFrame.rotx,
      candidateFrame.rot,
      frame.rot,
    )
    if (Math.abs(difference) !== 180) return difference
    const localDifference = frame.turns - candidateFrame.turns < 0 ? -180 : 180
    const axesAlign =
      candidateFrame.rotx.reduce(
        (dot, component, axisIndex) => dot + component * (referenceFrame.rotx[axisIndex] ?? 0),
        0,
      ) >= 0
    return axesAlign ? localDifference : -localDifference
  })
  const left = offsets[0]
  const right = offsets[1]
  return left === undefined || right === undefined ? undefined : [left, right]
}

export const getVtgAnimationScale = (animation: RootDataFinal): number | undefined => {
  const firstScale =
    animation.props[0]?.anim[0]?.scale ?? rootCompile(animation).props[0]?.anim[0]?.scale
  return firstScale === undefined ? undefined : toDisplayScale(firstScale)
}
