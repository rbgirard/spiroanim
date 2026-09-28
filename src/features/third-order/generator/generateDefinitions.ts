import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { applyVtgThirdOrderSettings, type VtgThirdOrderTiming } from '@/features/vtg/thirdOrder'
import { getCompiledVtgBuilderMotion } from '@/features/builder/describeVtgBuilderMotion'
import {
  formatVtgSpeedRatio,
  parseVtgIndividualSpeedRatio,
  vtgMoreRatioPickerRatios,
  vtgRatioPickerRatios,
} from '@/features/vtg/types'
import type {
  VtgCellReference,
  VtgIndividualSpeedRatio,
  VtgPatternSelection,
} from '@/features/vtg/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CURRENT_SPIRO_ANIM_QS_VERSION, loadSpiroAnimQSVersion } from '@/services/query/versions'
import {
  alignmentTolerance,
  canonicalizePlanarPattern,
  combineSignals,
  extractPlanarPattern,
  rotatePlanarTerm,
  scaleSignal,
  signalErrorBound,
} from './planarPattern'
import type { CanonicalPattern, PlanarPattern } from './planarPattern'
import type { RootDataFinal } from '@/types/AnimTypes'
import { getThirdOrderHeaderAlignment } from './alignToHeader'

export const thirdOrderAdjustAngles = [0, 45, 90, 135, 180, 225, 270, 315] as const
// Restrict generation to the nine odd-row/odd-column VTG cells.
export const thirdOrderGeneratorReferences = [
  '5-5',
  '3-5',
  '1-5',
  '5-3',
  '3-3',
  '3-1',
  '5-1',
  '1-3',
  '1-1',
] as const satisfies readonly VtgCellReference[]
type Direction = 'anti' | 'spin'
export interface GeneratorRecipe {
  selection: VtgPatternSelection
  /** Physical output indices AFTER VTG Swap; the small prop drives the warped prop's hand. */
  driverIndex: 0 | 1
  followerIndex: 0 | 1
  timingOrder: 'direct' | 'reversed'
  thirdOrder: { timing: VtgThirdOrderTiming; initial: number }
}
interface AcceptedCandidate {
  recipe: GeneratorRecipe
  canonical: CanonicalPattern
  alignmentErrorBound: number
}
export interface GeneratedVersion {
  version: number
  representative: AcceptedCandidate
  equivalentCandidates: AcceptedCandidate[]
  query: string
}
export interface GeneratedCell {
  handRatio: VtgIndividualSpeedRatio
  propRatio: VtgIndividualSpeedRatio
  hand: Direction
  prop: Direction
  versions: GeneratedVersion[]
}
export interface GeneratorOptions {
  references?: readonly VtgCellReference[]
  handRatios?: readonly VtgIndividualSpeedRatio[]
  propRatios?: readonly VtgIndividualSpeedRatio[]
  onProgress?: (message: string) => void
}

/** Rebuild exactly as authored, including role-dependent scale, swap, and Third Order controls. */
export const createGeneratedThirdOrderAnimation = (recipe: GeneratorRecipe): RootDataFinal => {
  const base = createDefaultVtgAnimation(recipe.selection)
  if (!base) throw new Error('Invalid generated VTG reference')
  return applyVtgThirdOrderSettings(
    base,
    recipe.followerIndex === 1 ? [{}, recipe.thirdOrder] : [recipe.thirdOrder, {}],
  )
}

const directions = ['anti', 'spin'] as const
const variants = new Set<VtgCellReference>(['5-5', '5-6', '6-5', '6-6'])
const roleOrder = (pattern: PlanarPattern, driver: 0 | 1): PlanarPattern =>
  driver === 0 ? pattern : [pattern[2], pattern[3], pattern[0], pattern[1]]

export const generateThirdOrderDefinitions = async (options: GeneratorOptions = {}) => {
  const handRatios = options.handRatios ?? vtgRatioPickerRatios
  const propRatios = options.propRatios ?? vtgMoreRatioPickerRatios
  const references = [...new Set(options.references ?? thirdOrderGeneratorReferences)]
  const versionModule = await loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)
  const codec = await useSpiroAnimQS(
    versionModule.VDEF,
    useBaseQS(versionModule.VDEF, { charset: versionModule.CHARSET }),
    CURRENT_SPIRO_ANIM_QS_VERSION,
  )
  const cells: GeneratedCell[] = []
  const stats = {
    baseCandidates: 0,
    adjustCandidates: 0,
    alignedCandidates: 0,
    uniquePatterns: 0,
    swappedOnly: 0,
    reversedOnly: 0,
  }
  for (const handRatio of handRatios)
    for (const propRatio of propRatios) {
      const buckets = new Map<string, Map<string, AcceptedCandidate[]>>()
      for (const hand of directions)
        for (const prop of directions) buckets.set(`${hand}/${prop}`, new Map())
      for (const timingOrder of ['direct', 'reversed'] as const) {
        const inputDriver = timingOrder === 'direct' ? 0 : 1
        const speedRatio =
          timingOrder === 'direct'
            ? formatVtgSpeedRatio(handRatio, propRatio)
            : formatVtgSpeedRatio(propRatio, handRatio)
        for (const reference of references) {
          for (const isAnti of variants.has(reference) ? [false, true] : [false])
            for (const reversePlane of [false, true]) {
              const selection: VtgPatternSelection = {
                reference,
                speedRatio,
                isAnti,
                reversePlane,
                orientation: 0,
                spacing: 0,
                prop: 2,
                scaleSettings: {
                  auto: false,
                  base: 1,
                  mode: 'simple',
                  values:
                    inputDriver === 0 ? [{ '0': 0.5 }, { '0': 1 }] : [{ '0': 1 }, { '0': 0.5 }],
                },
              }
              const base = createDefaultVtgAnimation(selection)
              if (!base) throw new Error(`Missing VTG candidate ${reference}`)
              const compiled = rootCompile(base)
              const rolePattern = roleOrder(extractPlanarPattern(base), inputDriver)
              const canonicalHand = rolePattern[2][0]!
              const target = combineSignals(rolePattern[0], scaleSignal(rolePattern[1], 0.5))
              const initialAxis = compiled.props[inputDriver === 0 ? 1 : 0]!.anim[0]!.warpx[2]
              const ratio = parseVtgIndividualSpeedRatio(handRatio)!
              for (const swapped of [false, true]) {
                stats.baseCandidates++
                const motion = getCompiledVtgBuilderMotion(
                  {
                    ...compiled,
                    props: swapped ? [...compiled.props].reverse() : compiled.props,
                  },
                  1,
                )
                const hand = motion.spins[0] === 'A' ? 'anti' : 'spin'
                const prop = motion.spins[1] === 'A' ? 'anti' : 'spin'
                const driverIndex = swapped ? (inputDriver === 0 ? 1 : 0) : inputDriver
                const followerIndex = driverIndex === 0 ? 1 : 0
                // The final Hand category owns the warp direction, even after Swap.
                const warpDirection = hand === 'anti' ? 'anti' : 'pro'
                for (const initial of thirdOrderAdjustAngles) {
                  stats.adjustCandidates++
                  const auxiliary = {
                    ...rotatePlanarTerm(canonicalHand, (initialAxis * initial * Math.PI) / 180),
                    frequency:
                      (canonicalHand.frequency *
                        (warpDirection === 'anti' ? -1 : 1) *
                        ratio.denominator) /
                      ratio.numerator,
                  }
                  const warpedHand = combineSignals(
                    scaleSignal([canonicalHand], 0.5),
                    scaleSignal([auxiliary], 0.5),
                  )
                  const error = signalErrorBound(target, warpedHand)
                  if (error > alignmentTolerance) continue
                  const timing: VtgThirdOrderTiming = `${handRatio}-${warpDirection}`
                  const recipe: GeneratorRecipe = {
                    selection: { ...selection, swapProps: swapped },
                    driverIndex,
                    followerIndex,
                    timingOrder,
                    thirdOrder: { timing, initial },
                  }
                  // Verify every accepted analytic candidate against the production generator, not
                  // just the shortcut used to reject impossible adjustments cheaply.
                  const actual = roleOrder(
                    extractPlanarPattern(createGeneratedThirdOrderAnimation(recipe)),
                    driverIndex,
                  )
                  if (signalErrorBound(actual[2], warpedHand) > alignmentTolerance)
                    throw new Error('Analytic warp and production animation disagree')
                  const canonical = canonicalizePlanarPattern(actual)
                  const bucket = buckets.get(`${hand}/${prop}`)!
                  const group = bucket.get(canonical.key) ?? []
                  group.push({ recipe, canonical, alignmentErrorBound: error })
                  bucket.set(canonical.key, group)
                  stats.alignedCandidates++
                }
              }
            }
        }
      }
      for (const hand of directions)
        for (const prop of directions) {
          const groups = [...buckets.get(`${hand}/${prop}`)!.values()]
          const versions: GeneratedVersion[] = []
          // Enumeration order is deterministic. Prefer non-swapped, then direct-timing recipes;
          // preserve every alternative, including any reversed-only discoveries.
          for (const group of groups)
            group.sort(
              (a, b) =>
                Number(a.recipe.selection.swapProps) - Number(b.recipe.selection.swapProps) ||
                Number(a.recipe.timingOrder === 'reversed') -
                  Number(b.recipe.timingOrder === 'reversed'),
            )
          groups.sort((a, b) => a[0]!.canonical.key.localeCompare(b[0]!.canonical.key, 'en'))
          for (const group of groups) {
            const aligned = group.map((original): AcceptedCandidate => {
              const alignment = getThirdOrderHeaderAlignment(
                createGeneratedThirdOrderAnimation(original.recipe),
                original.recipe.driverIndex,
                handRatio,
                hand,
              )
              const recipe: GeneratorRecipe = {
                ...original.recipe,
                // VTG applies orientation before turning the plane over, which reverses its sign.
                selection: {
                  ...original.recipe.selection,
                  orientation:
                    alignment.rotation * (original.recipe.selection.reversePlane ? -1 : 1),
                },
              }
              const representative: AcceptedCandidate = {
                ...original,
                recipe,
                canonical: canonicalizePlanarPattern(
                  roleOrder(
                    extractPlanarPattern(createGeneratedThirdOrderAnimation(recipe)),
                    recipe.driverIndex,
                  ),
                ),
              }
              if (representative.canonical.key !== original.canonical.key)
                throw new Error('Header rotation changed the Third Order pattern')
              if (
                Math.abs(
                  getThirdOrderHeaderAlignment(
                    createGeneratedThirdOrderAnimation(recipe),
                    recipe.driverIndex,
                    handRatio,
                    hand,
                  ).rotation,
                ) > alignmentTolerance
              )
                throw new Error('Rotated Third Order pattern does not match its header')
              return representative
            })
            const representative = aligned[0]!
            const query = codec.encodeQS(
              createGeneratedThirdOrderAnimation(representative.recipe),
              false,
            )
            versions.push({
              version: versions.length + 1,
              representative,
              equivalentCandidates: aligned.slice(1),
              query: new URLSearchParams(
                Object.entries(query).map(([key, value]) => [key, String(value)]),
              ).toString(),
            })
            if (group.every((c) => c.recipe.selection.swapProps)) stats.swappedOnly++
            if (group.every((c) => c.recipe.timingOrder === 'reversed')) stats.reversedOnly++
          }
          stats.uniquePatterns += versions.length
          cells.push({ handRatio, propRatio, hand, prop, versions })
        }
      options.onProgress?.(
        `${handRatio} / ${propRatio}: ${[...buckets].map(([label, groups]) => `${label}=${groups.size}`).join(', ')}`,
      )
    }
  return {
    schemaVersion: 1,
    scope: {
      references,
      handRatios,
      propRatios,
      adjustAngles: thirdOrderAdjustAngles,
      orientation: 0,
      representativeOrientation:
        'Every representative and duplicate aligns its small top-timing prop to the header outline after deduplication',
      scales: [0.5, 1],
      strength: 1,
      alignmentTolerance,
      idealHeadRadius: 0.5,
      equivalences: [
        'prop exchange',
        'global planar rotation',
        'turn plane over',
        'continuous cycle phase',
      ],
      exclusions: [
        'transitions',
        'independent prop rotation',
        'time reversal',
        'moving translation',
        'UI rotation exceptions',
      ],
      classification:
        'Final ordered VTG tooltip spin directions AFTER Swap, independent of driver/follower role indices',
      warpDirection: 'Hand Anti requires Anti; Hand Spin requires Pro',
      versionPolicy:
        'Deterministic per-cell ordering; version numbers may change when generator rules change',
    },
    stats,
    cells,
  }
}
