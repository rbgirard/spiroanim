import {
  createDefaultEightStepAnimation,
  eightStepPlaybackMultiplier,
} from '@/features/eight-step/createEightStepAnimation'
import { eightStepPatternDefinitions } from '@/features/eight-step/data/eightStepPatternDefinitions'
import { eightStepShapes } from '@/features/eight-step/types'
import type { EightStepPatternMatch, EightStepPatternSelection } from '@/features/eight-step/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import { applyVtgPropRotationOffsets } from '@/features/vtg/createVtgAnimation'
import { prepareVtg45TransitionPattern } from '@/features/vtg/math/prepareVtg45TransitionPattern'
import type { AnimDataCompiled, RootDataCompiled, RootDataFinal } from '@/types/AnimTypes'
import { toDisplayScale } from '@/domain/animation/scale'

const booleanOptions = [false, true] as const

type EightStepCandidateMatch = Omit<
  EightStepPatternMatch,
  'bpm' | 'scale' | 'propRotationOffsets'
> & {
  animation: RootDataFinal
}

let candidateCache: ReadonlyMap<string, readonly EightStepCandidateMatch[]> | undefined

const normalizePlane = (angle: number) => {
  const normalized = ((angle % 360) + 360) % 360
  return Object.is(normalized, -0) ? 0 : normalized
}

const frameSignature = (frame: AnimDataCompiled) => [
  frame.turns,
  frame.arc,
  normalizePlane(frame.plane),
]

const structuralFrameSignature = (frame: AnimDataCompiled, frameIndex: number) => [
  // Viewer Offset changes only the initial prop alignment. Keep every subsequent turn so the
  // authored Eight-Step choreography remains exact while the initial alignment stays editable.
  frameIndex === 0 ? 0 : frame.turns,
  frame.arc,
  normalizePlane(frame.plane),
]

const exactRootSignature = (animation: RootDataCompiled) =>
  JSON.stringify(animation.props.map((prop) => prop.anim.map(frameSignature)))

const structuralRootSignature = (animation: RootDataCompiled) =>
  JSON.stringify(animation.props.map((prop) => prop.anim.map(structuralFrameSignature)))

const createExactSignature = (animation: RootDataFinal): string | undefined => {
  try {
    return exactRootSignature(rootCompile(animation))
  } catch {
    return undefined
  }
}

const createSignature = (animation: RootDataFinal): string | undefined => {
  if (animation.props.length !== 2) return undefined

  try {
    return structuralRootSignature(rootCompile(animation))
  } catch {
    return undefined
  }
}

const getScale = (animation: RootDataFinal): number | undefined => {
  const firstScale = animation.props[0]?.anim[0]?.scale
  return firstScale === undefined ? undefined : toDisplayScale(firstScale)
}

interface PreparedEightStepMatchAnimation {
  animation: RootDataFinal
  controlBpm: number
}

const prepareForMatching = (animation: RootDataFinal): PreparedEightStepMatchAnimation => {
  try {
    const continuationArc = rootCompile(animation).props[0]?.anim[1]?.arc
    if (continuationArc === 45) {
      return {
        animation,
        controlBpm: animation.bpm / eightStepPlaybackMultiplier,
      }
    }
  } catch {
    return { animation, controlBpm: animation.bpm }
  }

  // Legacy 90-degree URLs are normalized only at the matching boundary. Their stored BPM is
  // already the performer-facing value and remains unchanged in the controls.
  const prepared = prepareVtg45TransitionPattern(animation)
  return {
    animation: prepared.supported ? prepared.pattern : animation,
    controlBpm: animation.bpm,
  }
}

const getPropRotationOffsets = (
  animation: RootDataFinal,
  candidate: RootDataFinal,
): readonly [number, number] | undefined => {
  const left = (animation.props[0]?.anim[0]?.turns ?? 0) - (candidate.props[0]?.anim[0]?.turns ?? 0)
  const right =
    (animation.props[1]?.anim[0]?.turns ?? 0) - (candidate.props[1]?.anim[0]?.turns ?? 0)
  return animation.props.length === 2 && candidate.props.length === 2 ? [left, right] : undefined
}

const buildCandidateCache = () => {
  const candidates = new Map<string, EightStepCandidateMatch[]>()

  for (const definition of eightStepPatternDefinitions) {
    for (const shape of eightStepShapes) {
      for (const swapProps of booleanOptions) {
        for (const reversePlane of booleanOptions) {
          for (const halve of booleanOptions) {
            const selection: EightStepPatternSelection = {
              concept: '8stp',
              reference: definition.reference,
              swapProps,
              reversePlane,
              shape,
              ...(halve ? { halve: true } : undefined),
            }
            const animation = createDefaultEightStepAnimation(selection)
            if (!animation) continue

            const signature = createSignature(animation)
            if (!signature) continue

            const matches = candidates.get(signature) ?? []
            matches.push({
              reference: definition.reference,
              swapProps,
              reversePlane,
              shape,
              ...(halve ? { halve: true } : undefined),
              animation,
            })
            candidates.set(signature, matches)
          }
        }
      }
    }
  }

  candidateCache = candidates
  return candidates
}

export const findEightStepPatternMatches = (
  animation: RootDataFinal,
): readonly EightStepPatternMatch[] => {
  const scale = getScale(animation)
  const prepared = prepareForMatching(animation)
  const normalizedAnimation = prepared.animation
  const signature = createSignature(normalizedAnimation)
  if (scale === undefined || !signature) return []

  const candidates = candidateCache ?? buildCandidateCache()
  return (candidates.get(signature) ?? []).flatMap((candidate) => {
    const propRotationOffsets = getPropRotationOffsets(normalizedAnimation, candidate.animation)
    if (!propRotationOffsets) return []
    const alignedCandidate = applyVtgPropRotationOffsets(candidate.animation, propRotationOffsets)
    if (createExactSignature(normalizedAnimation) !== createExactSignature(alignedCandidate))
      return []
    const { animation: _candidateAnimation, ...match } = candidate
    const hasPropRotationOffsets = propRotationOffsets.some((offset) => offset !== 0)
    return [
      {
        ...match,
        bpm: prepared.controlBpm,
        scale,
        ...(hasPropRotationOffsets ? { propRotationOffsets } : undefined),
      },
    ]
  })
}

export const findEightStepPatternMatch = (
  animation: RootDataFinal,
): EightStepPatternMatch | undefined => findEightStepPatternMatches(animation)[0]

export const matchesEightStepSelection = (
  animation: RootDataFinal,
  selection: EightStepPatternSelection,
): boolean => {
  const candidate = createDefaultEightStepAnimation(selection)
  if (!candidate) return false

  const normalizedAnimation = prepareForMatching(animation).animation

  return (
    createSignature(normalizedAnimation) === createSignature(candidate) &&
    createExactSignature(normalizedAnimation) === createExactSignature(candidate)
  )
}
