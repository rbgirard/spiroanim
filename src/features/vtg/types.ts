import type { PropInd, PropReadable, RootDataFinal, RootReadable } from '@/types/AnimTypes'
import type { PatternPropVisibilitySelection } from '@/features/concepts/patternPropVisibility'
import type { PatternPropSpacingSelection } from '@/features/concepts/patternPropSpacing'
import type { PatternPropColorSelection } from '@/features/concepts/patternPropColors'
export type VtgRuleNumber = 1 | 2 | 3 | 4 | 5 | 6

/** VTG matrix references are presented as row first, then column. */
export type VtgCellReference = `${VtgRuleNumber}-${VtgRuleNumber}`
export type VtgTimingCode = 'S' | 'T' | 'Q'
export type VtgDirectionCode = 'S' | 'O'
export type VtgRelationshipCode = `${VtgTimingCode}${VtgDirectionCode}`
export type VtgPatternLabel = `${VtgRelationshipCode} / ${VtgRelationshipCode}`

export interface VtgCellAddress {
  column: VtgRuleNumber
  row: VtgRuleNumber
}

export type VtgIndividualSpeedRatio = `${number}:${number}`
export type VtgCompoundSpeedRatio =
  | `${VtgIndividualSpeedRatio}v${number}`
  | `${VtgIndividualSpeedRatio}v${VtgIndividualSpeedRatio}`
export type VtgSpeedRatio = VtgIndividualSpeedRatio | VtgCompoundSpeedRatio
export const vtgPrimarySpeedRatios = [
  '1:1',
  '1:2',
  '1:3',
  '1:4',
  '1:5',
] as const satisfies readonly VtgIndividualSpeedRatio[]
export type VtgEstablishedIndividualSpeedRatio = (typeof vtgPrimarySpeedRatios)[number]
export const vtgTwoCycleSpeedRatios = [
  '2:1',
  '2:3',
  '2:5',
] as const satisfies readonly VtgIndividualSpeedRatio[]
export const vtgIndividualSpeedRatios = [
  ...vtgPrimarySpeedRatios,
  ...vtgTwoCycleSpeedRatios,
] as const satisfies readonly VtgIndividualSpeedRatio[]
export const vtgRatioPickerRatios = [
  '1:1',
  '2:1',
  '1:2',
  '1:3',
  '2:3',
  '1:4',
  '1:5',
  '2:5',
] as const satisfies readonly VtgIndividualSpeedRatio[]
export const vtgSpeedRatioRows = [
  vtgRatioPickerRatios,
] as const satisfies readonly (readonly VtgSpeedRatio[])[]
export const vtgSpeedRatios = vtgSpeedRatioRows.flat()
export const vtgCanonicalSpeedRatio = '1:3' satisfies VtgSpeedRatio
export const vtgDefaultSpeedRatio = vtgCanonicalSpeedRatio

export interface VtgRatioParts {
  numerator: number
  denominator: number
}

const greatestCommonDivisor = (left: number, right: number): number => {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

export const formatVtgIndividualSpeedRatio = ({
  numerator,
  denominator,
}: VtgRatioParts): VtgIndividualSpeedRatio => `${numerator}:${denominator}`

export const parseVtgIndividualSpeedRatio = (value: string): VtgRatioParts | undefined => {
  const match = /^(\d+):(\d+)$/.exec(value)
  if (!match) return undefined
  const numerator = Number(match[1])
  const denominator = Number(match[2])
  if (numerator < 1 || denominator < 1 || greatestCommonDivisor(numerator, denominator) !== 1) {
    return undefined
  }
  return { numerator, denominator }
}

export const getVtgPropSpeedRatios = (
  speedRatio: VtgSpeedRatio,
): readonly [VtgIndividualSpeedRatio, VtgIndividualSpeedRatio] => {
  const match = /^(\d+):(\d+)(?:v(?:(\d+):)?(\d+))?$/.exec(speedRatio)
  if (!match) throw new RangeError(`Invalid VTG speed ratio: ${speedRatio}`)

  const left = `${match[1]}:${match[2]}` as VtgIndividualSpeedRatio
  if (match[4] === undefined) return [left, left]
  const right = `${match[3] ?? match[1]}:${match[4]}` as VtgIndividualSpeedRatio
  return [left, right]
}

const leastCommonMultiple = (left: number, right: number): number =>
  Math.abs(left * right) / greatestCommonDivisor(left, right)

/** Number of complete hand rotations needed for both prop timings to close. */
export const getVtgTimingCycleCount = (speedRatio: VtgSpeedRatio): number => {
  const [left, right] = getVtgPropSpeedRatios(speedRatio)
  const leftParts = parseVtgIndividualSpeedRatio(left)
  const rightParts = parseVtgIndividualSpeedRatio(right)
  if (!leftParts || !rightParts) throw new RangeError(`Invalid VTG speed ratio: ${speedRatio}`)
  return leastCommonMultiple(leftParts.numerator, rightParts.numerator)
}

/** Whether an even denominator intrinsically needs independently rendered path previews. */
export const requiresPairedVtgPreviewLayout = (speedRatio: VtgSpeedRatio): boolean =>
  getVtgPropSpeedRatios(speedRatio).some((ratio) => {
    const parts = parseVtgIndividualSpeedRatio(ratio)
    return parts !== undefined && parts.denominator % 2 === 0
  })

export const formatVtgSpeedRatio = (
  left: VtgIndividualSpeedRatio,
  right: VtgIndividualSpeedRatio,
): VtgSpeedRatio => {
  if (left === right) return left
  const leftParts = parseVtgIndividualSpeedRatio(left)
  const rightParts = parseVtgIndividualSpeedRatio(right)
  if (!leftParts || !rightParts) throw new RangeError(`Invalid VTG ratio pair: ${left}, ${right}`)
  return leftParts.numerator === rightParts.numerator
    ? `${left}v${rightParts.denominator}`
    : `${left}v${right}`
}

export const isVtgSpeedRatio = (value: string): value is VtgSpeedRatio => {
  try {
    const [left, right] = getVtgPropSpeedRatios(value as VtgSpeedRatio)
    if (!parseVtgIndividualSpeedRatio(left) || !parseVtgIndividualSpeedRatio(right)) return false
    return formatVtgSpeedRatio(left, right) === value
  } catch {
    return false
  }
}

export const vtgBeats = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5] as const
const vtgTwoCycleBeats = [...vtgBeats, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5] as const
export type VtgBeat = (typeof vtgTwoCycleBeats)[number]
export const getVtgBeats = (speedRatio: VtgSpeedRatio): readonly VtgBeat[] =>
  getVtgTimingCycleCount(speedRatio) === 1 ? vtgBeats : vtgTwoCycleBeats
export const vtgDefaultBeat = 1 satisfies VtgBeat
export const vtgTransitionBeats = [6, 5, 4, 3, 2] as const
export type VtgTransitionBeats = (typeof vtgTransitionBeats)[number]
export const vtgTransitionInitialTurnsOffsets = [-45, 45] as const
export type VtgTransitionInitialTurnsOffset = (typeof vtgTransitionInitialTurnsOffsets)[number]
export const vtgPatternOrientations = [-90, -45, 0, 45, 90, 180] as const
export type VtgPatternOrientation = number
export const getVtgPatternOrientations = (
  _speedRatio: VtgSpeedRatio,
): readonly VtgPatternOrientation[] => vtgPatternOrientations
export const vtgDefaultPatternOrientation = -90 satisfies VtgPatternOrientation
export const getDefaultVtgPatternOrientation = (
  speedRatio: VtgSpeedRatio,
): VtgPatternOrientation =>
  getVtgTimingCycleCount(speedRatio) === 2 ||
  getVtgPropSpeedRatios(speedRatio).some((ratio) => Number(ratio.slice(2)) % 2 === 0)
    ? vtgDefaultPatternOrientation
    : 0
export const vtgDefaultTransitionBeats = 4 satisfies VtgTransitionBeats

export interface VtgPatternSelection
  extends PatternPropVisibilitySelection, PatternPropSpacingSelection, PatternPropColorSelection {
  reference: VtgCellReference
  speedRatio: VtgSpeedRatio
  isAnti?: boolean
  swapProps?: boolean
  reversePlane?: boolean
  beat?: VtgBeat
  transition?: boolean
  transitionAfterBeat?: boolean
  transitionBeats?: VtgTransitionBeats
  transitionQuad?: boolean
  transitionSecond?: boolean
  initialTurnsOffset?: VtgTransitionInitialTurnsOffset
  initialTurnsOffsetBeat?: VtgBeat
  orientation?: VtgPatternOrientation
  /** Hidden per-prop phase alignment inferred while matching an existing pattern. */
  propRotationOffsets?: readonly [number, number]
  bpm?: number
  scale?: number
  thick?: number
  paths?: boolean
  hands?: boolean
  arms?: boolean
  prop?: PropInd
}

export interface VtgPatternMatch {
  reference: VtgCellReference
  speedRatio: VtgSpeedRatio
  isAnti: boolean
  swapProps: boolean
  reversePlane: boolean
  beat?: VtgBeat
  transition?: boolean
  transitionAfterBeat?: boolean
  transitionBeats?: VtgTransitionBeats
  transitionQuad?: boolean
  transitionSecond?: boolean
  initialTurnsOffset?: VtgTransitionInitialTurnsOffset
  orientation?: VtgPatternOrientation
  /** Hidden per-prop phase alignment relative to the matched catalog cell. */
  propRotationOffsets?: readonly [number, number]
  bpm: number
  scale: number
}

export type VtgPatternMatchPreferences = Pick<VtgPatternMatch, 'swapProps' | 'reversePlane'>
export type VtgPatternRotationFilter = 'unrotated' | 'rotated'

export const qtrModes = [1, 2] as const
export type QtrMode = (typeof qtrModes)[number]

export interface QtrPatternSelection extends VtgPatternSelection {
  quarters: QtrMode
}

export interface QtrPatternMatch extends VtgPatternMatch {
  quarters: QtrMode
}

export type QtrPatternMatchPreferences = VtgPatternMatchPreferences &
  Pick<QtrPatternMatch, 'quarters' | 'orientation'>

export type VtgReadableAnimation = Partial<
  Omit<RootReadable, 'props'> & Pick<RootDataFinal, 'speed' | 'type' | 'turns' | 'depth'>
> & {
  props: PropReadable[]
}

export type VtgPatternBuilder = (isAnti: boolean, speedRatio: VtgSpeedRatio) => VtgReadableAnimation

export interface VtgPatternDefinition {
  build: VtgPatternBuilder
}

export interface VtgPropPlacement {
  orientation?: 'vertical' | 'horizontal'
  lane: number
  start: number
  end: number
  largeEnd: 'start' | 'end'
}

export interface VtgRuleDiagram {
  props: readonly [VtgPropPlacement, VtgPropPlacement]
  divider?: number
}

export interface VtgRuleSpec {
  labels: readonly [string, string]
  number: VtgRuleNumber
  diagram: VtgRuleDiagram
  description: string
}
