import { rootCompile } from '@/math/animation/AnimFunc'
import {
  consolidateAnimationPlayback,
  subdivideAnimationPlayback,
} from '@/math/animation/subdivideAnimationPlayback'
import { TIMING_ANGLE_FACTOR } from '@/domain/animation/timingAngle'
import type { AnimDataCompiled, RootDataFinal } from '@/types/AnimTypes'

const continuationFrameIndex = 1
const supportedArc = 45
const supportedPropCount = 2
const turnsPrecisionTolerance = 0.000_001

export interface PreparedVtg45TransitionPattern {
  pattern: RootDataFinal
  supported: boolean
}

const clonePattern = (pattern: RootDataFinal): RootDataFinal => ({
  ...pattern,
  props: pattern.props.map((prop) => ({
    ...prop,
    anim: prop.anim.map((frame) => ({ ...frame })),
    motion: prop.motion.map((frame) => ({ ...frame })),
  })),
  camera: pattern.camera.map((frame) => ({
    ...frame,
    orbit: frame.orbit === undefined ? undefined : { ...frame.orbit },
    center: frame.center === undefined ? undefined : { ...frame.center },
  })),
})

const hasContinuationArc = (frames: readonly AnimDataCompiled[], arc: number): boolean =>
  frames.length > continuationFrameIndex &&
  frames.slice(continuationFrameIndex).every((frame) => frame.arc === arc)

const hasRepresentableDividedTurns = (
  frames: readonly AnimDataCompiled[],
  divisor: number,
): boolean =>
  frames.slice(continuationFrameIndex).every((frame) => {
    const scaledTurns = (frame.turns / divisor) * TIMING_ANGLE_FACTOR
    return Math.abs(scaledTurns - Math.round(scaledTurns)) <= turnsPrecisionTolerance
  })

const getWholeFactor = (value: number): number | undefined => {
  const rounded = Math.round(value)
  return rounded >= 1 && Math.abs(value - rounded) <= turnsPrecisionTolerance ? rounded : undefined
}

const hasAlignedFrames = (pattern: RootDataFinal): boolean => {
  const [firstProp, secondProp] = pattern.props
  if (!firstProp || !secondProp || firstProp.anim.length !== secondProp.anim.length) return false

  const compiled = rootCompile(pattern)
  const [firstCompiledProp, secondCompiledProp] = compiled.props
  if (!firstCompiledProp || !secondCompiledProp) return false

  return firstCompiledProp.anim.every(
    (frame, frameIndex) => frame.beats === secondCompiledProp.anim[frameIndex]?.beats,
  )
}

/** Creates the private working pattern used to determine 45 Trans support. */
export const prepareVtg45TransitionPattern = (
  source: RootDataFinal,
): PreparedVtg45TransitionPattern => {
  const copy = clonePattern(source)
  const compiledCopy = rootCompile(copy)
  const continuationArc = compiledCopy.props[0]?.anim[continuationFrameIndex]?.arc
  const hasUniformArc =
    continuationArc !== undefined &&
    compiledCopy.props.every((prop) => hasContinuationArc(prop.anim, continuationArc))
  const subdivisionFactor =
    hasUniformArc && continuationArc > supportedArc
      ? getWholeFactor(continuationArc / supportedArc)
      : undefined
  const consolidationFactor =
    hasUniformArc && continuationArc < supportedArc
      ? getWholeFactor(supportedArc / continuationArc)
      : undefined
  const converted =
    copy.props.length !== supportedPropCount
      ? undefined
      : subdivisionFactor !== undefined &&
          compiledCopy.props.every((prop) =>
            hasRepresentableDividedTurns(prop.anim, subdivisionFactor),
          )
        ? subdivideAnimationPlayback(copy, subdivisionFactor)
        : consolidationFactor !== undefined
          ? consolidateAnimationPlayback(copy, consolidationFactor)
          : continuationArc === supportedArc
            ? copy
            : undefined
  const pattern = converted ?? copy
  const compiledPattern = rootCompile(pattern)
  const supported =
    converted !== undefined &&
    pattern.props.length === supportedPropCount &&
    compiledPattern.props.every((prop) => hasContinuationArc(prop.anim, supportedArc)) &&
    hasAlignedFrames(pattern)

  return { pattern, supported }
}
