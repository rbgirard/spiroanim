import { vtgBaseFrameSettings, vtgPlayerSettings } from '@/features/vtg/data/vtgPlayerSettings'
import { getVtgPropSpeedRatios, parseVtgIndividualSpeedRatio } from '@/features/vtg/types'
import { compactReadableAnimationFrames } from '@/math/animation/compressFrames'
import {
  resolveReadableAnimationFrames,
  type ResolvedAnimationFrame,
} from '@/math/animation/frameSemantics'
import type {
  VtgCellReference,
  VtgPatternDefinition,
  VtgIndividualSpeedRatio,
  VtgReadableAnimation,
  VtgRuleNumber,
  VtgSpeedRatio,
} from '@/features/vtg/types'
import type { AnimReadable, TypeStr } from '@/types/AnimTypes'

type VtgSpinDirection = 'anti' | 'in'
type VtgContinuation = Omit<AnimReadable, 'turns'> & { spin: VtgSpinDirection }
type VtgPropPair = readonly [VtgContinuation, VtgContinuation]
type VtgStartPair = readonly [AnimReadable, AnimReadable]

interface VtgSpinAntiPair {
  spin: VtgPropPair
  anti: VtgPropPair
}

type VtgCellPattern = VtgPropPair | VtgSpinAntiPair
type VtgColumnPatterns = Readonly<Record<VtgRuleNumber, VtgCellPattern>>

interface VtgRowPattern {
  starts: VtgStartPair
  columns: VtgColumnPatterns
  columnsBySpeedRatio?: Readonly<Partial<Record<VtgIndividualSpeedRatio, VtgColumnPatterns>>>
  swapProps?: boolean
}

const compactVtgDefinitionFrame = (
  frame: AnimReadable,
  preceding?: ResolvedAnimationFrame<TypeStr>,
): AnimReadable =>
  compactReadableAnimationFrames([frame], {
    preceding,
    // Later VTG transformations inspect authored values; only the two historically compacted
    // fields may be removed while this is still a pattern definition.
    preserve: (_frameIndex, key) => key !== 'plane' && key !== 'turns',
  })[0]!

const createFirstFrame = (start: AnimReadable): AnimReadable =>
  compactVtgDefinitionFrame({ ...vtgBaseFrameSettings, ...start })

const createTurns = (
  arc: number,
  spin: VtgSpinDirection,
  speedRatio: VtgIndividualSpeedRatio,
): number => {
  const ratio = parseVtgIndividualSpeedRatio(speedRatio)
  if (!ratio) throw new RangeError(`Invalid individual VTG speed ratio: ${speedRatio}`)
  const relativeRate =
    spin === 'anti'
      ? -(ratio.denominator + ratio.numerator) / ratio.numerator
      : (ratio.denominator - ratio.numerator) / ratio.numerator
  return arc * relativeRate
}

const createContinuationFrame = (
  start: AnimReadable,
  continuation: VtgContinuation,
  speedRatio: VtgIndividualSpeedRatio,
): AnimReadable => {
  const { spin, ...frameValues } = continuation
  const frame: AnimReadable = {
    ...frameValues,
    turns: createTurns(continuation.arc ?? 0, spin, speedRatio),
  }
  return compactVtgDefinitionFrame(frame, resolveReadableAnimationFrames([start])[0])
}

const getDefinitionSpeedRatio = (speedRatio: VtgIndividualSpeedRatio): VtgIndividualSpeedRatio => {
  const ratio = parseVtgIndividualSpeedRatio(speedRatio)
  if (!ratio) return '1:3'

  switch (ratio.denominator) {
    case 1:
    case 2:
      return '1:1'
    case 5:
    case 6:
      return '1:5'
    default:
      return '1:3'
  }
}

const createPattern = (
  row: VtgRowPattern,
  column: VtgRuleNumber,
  isAnti: boolean,
  speedRatio: VtgSpeedRatio,
): VtgReadableAnimation => {
  const speedRatios = getVtgPropSpeedRatios(speedRatio)
  const definitionSpeedRatio = getDefinitionSpeedRatio(speedRatios[0])
  const sourceIndexes = row.swapProps ? ([1, 0] as const) : ([0, 1] as const)
  const createProp = (outputIndex: 0 | 1) => {
    const sourceIndex = sourceIndexes[outputIndex]
    const cellPattern =
      row.columnsBySpeedRatio?.[definitionSpeedRatio]?.[column] ?? row.columns[column]
    const continuations =
      'spin' in cellPattern ? (isAnti ? cellPattern.anti : cellPattern.spin) : cellPattern
    return {
      anim: [
        createFirstFrame(row.starts[sourceIndex]),
        createContinuationFrame(
          row.starts[sourceIndex],
          continuations[sourceIndex],
          speedRatios[outputIndex],
        ),
        {},
        {},
        {},
        {},
        {},
        {},
        {},
      ],
    }
  }

  return {
    ...vtgPlayerSettings,
    bpm: vtgPlayerSettings.bpm * 2,
    props: [createProp(0), createProp(1)],
  }
}

const createPatternDefinition = (
  row: VtgRowPattern,
  column: VtgRuleNumber,
): VtgPatternDefinition => ({
  build: (isAnti, speedRatio) => createPattern(row, column, isAnti, speedRatio),
})

/**
 * VTG cells are numbered row first in the interface. Every cell in a row shares
 * the same first animation frame for each prop. Continuations are the
 * semantic Anti/In directions; the builder derives Turns from the target ratio. The historical
 * 1:1 and 1:5 definitions intentionally reverse several directions from the canonical 1:3 data.
 * Compound timings use the first prop's definition family for both props. Definition
 * families are selected from the first timing denominator: 1-2 use 1:1, 3-4 use 1:3, and 5-6 use
 * 1:5. Unrecognized denominators use the canonical 1:3 definitions. Actual timing math still uses
 * each prop's complete ratio.
 * Only the four special cells define explicit Spin/Anti variants.
 */
// prettier-ignore
const rowPatterns: Readonly<Record<VtgRuleNumber, VtgRowPattern>> = {
  // Row 1 starts both props on the 180-degree plane and owns every continuation.
  1: {
    starts: [{ plane: 180, arc: 90, turns: 0 }, { plane: 180, arc: 90, turns: 0 }],
    columnsBySpeedRatio: {
      '1:1': {
        1: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }],
        2: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }],
        3: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }],
        4: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }],
        5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }],
        6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      },
      '1:5': {
        1: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }],
        2: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }],
        3: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }],
        4: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }],
        5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }],
        6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      },
    },
    columns: {
      1: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }],
      2: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }],
      3: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }],
      4: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }],
      5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }],
      6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
    },
  },
  // Row 2 starts the second prop on plane 0 and owns a separate copy of every continuation.
  2: {
    starts: [{ plane: 180, arc: 90, turns: 0 }, { plane: 0, arc: 90, turns: 0 }],
    columnsBySpeedRatio: {
      '1:1': {
        1: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }], 2: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], 3: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }], 4: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }], 5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }], 6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      },
      '1:5': {
        1: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }], 2: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], 3: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }], 4: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }], 5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }], 6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      },
    },
    columns: {
      1: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }],
      2: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }],
      3: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }],
      4: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }],
      5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }],
      6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
    },
  },
  // Row 3 starts the props in opposite directions and keeps row 4's second prop on plane 0.
  3: {
    starts: [{ plane: 180, arc: 90, turns: -180 }, { plane: 180, arc: 90, turns: 180 }],
    columnsBySpeedRatio: {
      '1:1': {
        1: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }], 2: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }], 3: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }], 4: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], 5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }], 6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      },
      '1:5': {
        1: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }], 2: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }], 3: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }], 4: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], 5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }], 6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      },
    },
    columns: {
      1: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }],
      2: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }],
      3: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }],
      4: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }],
      5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }],
      6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
    },
  },
  // Row 4 pairs a backward plane path with a forward arc path and owns every continuation.
  4: {
    starts: [{ plane: 180, arc: 90, turns: -180 }, { plane: 0, arc: 90, turns: 180 }],
    columnsBySpeedRatio: {
      '1:1': {
        1: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }], 2: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }], 3: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }], 4: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], 5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }], 6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      },
      '1:5': {
        1: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }], 2: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }], 3: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }], 4: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], 5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }], 6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      },
    },
    columns: {
      1: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }],
      2: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }],
      3: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }],
      4: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }],
      5: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }],
      6: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
    },
  },
  // Row 5 starts with two arc paths and defines Spin/Anti alternatives for rows 5 and 6.
  5: {
    starts: [{ plane: 0, arc: 90, turns: 0 }, { plane: 0, arc: 90, turns: 180 }],
    columnsBySpeedRatio: {
      '1:1': {
        1: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }], 2: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }], 3: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'in' }], 4: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'in' }], 5: { spin: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], anti: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }] }, 6: { spin: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }], anti: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }] },
      },
      '1:5': {
        1: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }], 2: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }], 3: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'in' }], 4: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'in' }], 5: { spin: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], anti: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }] }, 6: { spin: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }], anti: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }] },
      },
    },
    columns: {
      1: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'in' }],
      2: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'in' }],
      3: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      4: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'anti' }],
      5: { spin: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], anti: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }] },
      6: { spin: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 180, arc: 45, spin: 'in' }], anti: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 180, arc: 45, spin: 'anti' }] },
    },
  },
  // Row 6 mirrors column 5's roles.
  6: {
    starts: [{ plane: 180, arc: 90, turns: 180 }, { plane: 0, arc: 90, turns: 0 }],
    swapProps: true,
    columnsBySpeedRatio: {
      '1:1': {
        1: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'in' }], 2: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'in' }], 3: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }], 4: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }], 5: { spin: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], anti: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }] }, 6: { spin: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], anti: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }] },
      },
      '1:5': {
        1: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'in' }], 2: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'in' }], 3: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }], 4: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }], 5: { spin: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], anti: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }] }, 6: { spin: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], anti: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }] },
      },
    },
    columns: {
      1: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      2: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'anti' }],
      3: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'in' }],
      4: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'in' }],
      5: { spin: [{ plane: 0, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], anti: [{ plane: 0, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }] },
      6: { spin: [{ plane: 180, arc: 45, spin: 'in' }, { plane: 0, arc: 45, spin: 'in' }], anti: [{ plane: 180, arc: 45, spin: 'anti' }, { plane: 0, arc: 45, spin: 'anti' }] },
    },
  },
}

const ruleNumbers = [1, 2, 3, 4, 5, 6] as const
const catalog: Partial<Record<VtgCellReference, Readonly<VtgPatternDefinition>>> = {}

for (const row of ruleNumbers) {
  for (const column of ruleNumbers) {
    const reference: VtgCellReference = `${row}-${column}`
    catalog[reference] = createPatternDefinition(rowPatterns[row], column)
  }
}

export const vtgRowPatterns: Readonly<
  Partial<Record<VtgCellReference, Readonly<VtgPatternDefinition>>>
> = catalog
