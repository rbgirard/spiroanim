import { thirdOrderDefinitions } from '@/features/third-order/data/generatedDefinitions'
import {
  createAnimationFromThirdOrderDefinition,
  getThirdOrderDefinitionDuplicateCount,
} from '@/features/third-order/definitionCatalog'
import { createThirdOrderMatchSignatures } from '@/features/third-order/math/createThirdOrderMatchSignature'
import type { ThirdOrderMatchSignature } from '@/features/third-order/math/createThirdOrderMatchSignature'
import type { ThirdOrderPatternMatch } from '@/features/third-order/types'
import type { RootDataFinal } from '@/types/AnimTypes'

/** Lazy, bounded cache: only the requested timing pair is built, not the complete catalog. */
const indexes = new Map<string, ReadonlyMap<string, readonly ThirdOrderPatternMatch[]>>()

const getIndex = ([requestedHand, requestedProp]: ThirdOrderMatchSignature['ratios']) => {
  const key = `${requestedHand}/${requestedProp}`
  const cached = indexes.get(key)
  if (cached) return cached
  const index = new Map<string, ThirdOrderPatternMatch[]>()
  // Do not cache arbitrary unsupported user timings.
  const handRatio = thirdOrderDefinitions.handRatios.find((ratio) => ratio === requestedHand)
  const propRatio = thirdOrderDefinitions.propRatios.find((ratio) => ratio === requestedProp)
  if (!handRatio || !propRatio) return index
  for (const handDirection of ['anti', 'spin'] as const)
    for (const propDirection of ['anti', 'spin'] as const)
      for (const version of [1, 2] as const) {
        const identity = { handRatio, propRatio, handDirection, propDirection, version }
        const count = getThirdOrderDefinitionDuplicateCount(thirdOrderDefinitions, identity)
        for (let duplicate = 1; duplicate <= count; duplicate++) {
          const match = { ...identity, duplicate }
          const animation = createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, match)!
          const signature = createThirdOrderMatchSignatures(animation)[0]
          if (!signature) throw new Error('Unsupported Third Order catalog motion')
          const bucket = index.get(signature.key) ?? []
          bucket.push(match)
          index.set(signature.key, bucket)
        }
      }
  indexes.set(key, index)
  return index
}

const sameMatch = (first: ThirdOrderPatternMatch, second: ThirdOrderPatternMatch) =>
  first.handRatio === second.handRatio &&
  first.propRatio === second.propRatio &&
  first.handDirection === second.handDirection &&
  first.propDirection === second.propDirection &&
  first.version === second.version &&
  first.duplicate === second.duplicate

export const findThirdOrderPatternMatch = (
  animation: RootDataFinal,
  preferred?: ThirdOrderPatternMatch,
): ThirdOrderPatternMatch | undefined => {
  const signatures = createThirdOrderMatchSignatures(animation)
  let first: ThirdOrderPatternMatch | undefined
  for (const signature of signatures) {
    const matches = getIndex(signature.ratios).get(signature.key) ?? []
    if (!preferred && matches[0]) return matches[0]
    first ??= matches[0]
    if (preferred) {
      const current = matches.find((match) => sameMatch(match, preferred))
      if (current) return current
    }
  }
  return first
}
