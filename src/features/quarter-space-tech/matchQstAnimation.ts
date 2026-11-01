import { createDefaultQstAnimation } from '@/features/quarter-space-tech/createQstAnimation'
import { qstPatternDefinitions } from '@/features/quarter-space-tech/data/qstPatternCatalog'
import type {
  QstPatternMatch,
  QstPatternMatchPreferences,
  QstPatternSelection,
} from '@/features/quarter-space-tech/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import type { AnimDataCompiled, RootDataCompiled, RootDataFinal } from '@/types/AnimTypes'
import { toDisplayScale } from '@/domain/animation/scale'

const booleanOptions = [false, true] as const

type QstCandidateMatch = Omit<QstPatternMatch, 'bpm' | 'scale'>

let candidateCache: ReadonlyMap<string, readonly QstCandidateMatch[]> | undefined

const normalizeAngle = (angle: number) => {
  const normalized = ((angle % 360) + 360) % 360
  return Object.is(normalized, -0) ? 0 : normalized
}

const frameSignature = (frame: AnimDataCompiled) => [
  frame.turns,
  frame.arc,
  normalizeAngle(frame.plane),
  normalizeAngle(frame.axis),
]

const rootSignature = (animation: RootDataCompiled) =>
  JSON.stringify(animation.props.map((prop) => prop.anim.map(frameSignature)))

const compileMatchData = (
  animation: RootDataFinal,
): { signature: string; scale: number } | undefined => {
  if (animation.props.length !== 2) return undefined

  try {
    const compiled = rootCompile(animation)
    const scale = compiled.props[0]?.anim[0]?.scale
    if (scale === undefined) return undefined
    return { signature: rootSignature(compiled), scale: toDisplayScale(scale) }
  } catch {
    return undefined
  }
}

const buildCandidateCache = () => {
  const candidates = new Map<string, QstCandidateMatch[]>()

  for (const definition of qstPatternDefinitions) {
    for (const swapProps of booleanOptions) {
      for (const reversePlane of booleanOptions) {
        const animation = createDefaultQstAnimation({
          concept: 'qst',
          reference: definition.reference,
          swapProps,
          reversePlane,
        })
        if (!animation) continue

        const data = compileMatchData(animation)
        if (!data) continue
        const matches = candidates.get(data.signature) ?? []
        matches.push({ reference: definition.reference, swapProps, reversePlane })
        candidates.set(data.signature, matches)
      }
    }
  }

  candidateCache = candidates
  return candidates
}

export const findQstPatternMatches = (animation: RootDataFinal): readonly QstPatternMatch[] => {
  const data = compileMatchData(animation)
  if (!data) return []

  const candidates = candidateCache ?? buildCandidateCache()
  return (candidates.get(data.signature) ?? []).map((candidate) => ({
    ...candidate,
    bpm: animation.bpm,
    scale: data.scale,
  }))
}

const preferenceDifferenceCount = (
  match: QstPatternMatch,
  preferences: QstPatternMatchPreferences,
) =>
  Number(match.swapProps !== preferences.swapProps) +
  Number(match.reversePlane !== preferences.reversePlane)

export const findQstPatternMatch = (
  animation: RootDataFinal,
  preferences?: QstPatternMatchPreferences,
): QstPatternMatch | undefined => {
  const matches = findQstPatternMatches(animation)
  return preferences
    ? [...matches].sort(
        (first, second) =>
          preferenceDifferenceCount(first, preferences) -
          preferenceDifferenceCount(second, preferences),
      )[0]
    : matches[0]
}

export const matchesQstSelection = (
  animation: RootDataFinal,
  selection: QstPatternSelection,
): boolean => {
  const candidate = createDefaultQstAnimation(selection)
  if (!candidate) return false

  return compileMatchData(animation)?.signature === compileMatchData(candidate)?.signature
}
