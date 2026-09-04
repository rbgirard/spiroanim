import {
  applyVtgPlaybackControls,
  applyVtgPropRotationOffsets,
  createDefaultVtgAnimation,
  createVtgAnimation,
  toVtgPreviewAnimation,
} from '@/features/vtg/createVtgAnimation'
import type { QtrMode, QtrPatternSelection } from '@/features/vtg/types'
import type { RootDataFinal } from '@/types/AnimTypes'
import { applyPatternFinalTransforms } from '@/features/concepts/applyPatternFinalTransforms'
import { vtgPlayerSettings } from '@/features/vtg/data/vtgPlayerSettings'
import {
  applyVtgInitialTurnsPlayback,
  withVtgInitialTurnsOffsetBeat,
} from '@/features/vtg/math/applyVtgInitialTurnsOffset'

const normalizeArc = (arc: number): number => ((arc % 360) + 360) % 360
const propIndices = [0, 1] as const
const firstQuarterArcAmounts = [90, 0] as const

const shiftPropArc = (
  animation: RootDataFinal,
  propIndex: 0 | 1,
  amount: number,
): RootDataFinal => {
  const prop = animation.props[propIndex]
  const firstFrame = prop?.anim[0]
  if (!prop || !firstFrame) return animation

  return {
    ...animation,
    props: animation.props.map((candidate, index) =>
      index === propIndex
        ? {
            ...prop,
            anim: [
              { ...firstFrame, arc: normalizeArc((firstFrame.arc ?? 0) + amount) },
              ...prop.anim.slice(1),
            ],
          }
        : candidate,
    ),
  }
}

const getQtrArcAmounts = (
  animation: RootDataFinal,
  quarterMode: QtrMode,
): readonly [number, number] => {
  const amounts = propIndices.map((outputIndex) => {
    const firstQuarterAmount = firstQuarterArcAmounts[outputIndex]
    if (quarterMode === 1) return firstQuarterAmount

    const plane = normalizeArc(animation.props[outputIndex]?.anim[0]?.plane ?? 0)
    return firstQuarterAmount + (plane === 180 ? -90 : 90)
  })

  return [amounts[0]!, amounts[1]!]
}

const transformQtrAnimation = (
  animation: RootDataFinal,
  quarterMode: QtrMode,
  direction: 1 | -1,
): RootDataFinal => {
  const amounts = getQtrArcAmounts(animation, quarterMode)
  return shiftPropArc(shiftPropArc(animation, 0, direction * amounts[0]), 1, direction * amounts[1])
}

const withoutFinalTransforms = ({
  swapProps: _swapProps,
  reversePlane: _reversePlane,
  initialTurnsOffset: _initialTurnsOffset,
  initialTurnsOffsetBeat: _initialTurnsOffsetBeat,
  propRotationOffsets: _propRotationOffsets,
  ...selection
}: QtrPatternSelection): QtrPatternSelection => selection

// Qtr #2 remains accepted for legacy callers. Swap and 180 are shared final transforms and must
// not select a different QTR base geometry.
const getSelectedQtrMode = (selection: QtrPatternSelection): QtrMode => selection.quarters

const applyQtrFinalTransforms = (
  animation: RootDataFinal,
  selection: QtrPatternSelection,
): RootDataFinal => applyPatternFinalTransforms(animation, selection)

/** Builds the concept-specific QTR state before playback and shared final transforms. */
export const createDefaultQtrBaseAnimation = (
  selection: QtrPatternSelection,
): RootDataFinal | undefined => {
  const animation = createDefaultVtgAnimation({
    ...withoutFinalTransforms(selection),
    beat: 1,
    transition: false,
  })

  return animation ? transformQtrAnimation(animation, getSelectedQtrMode(selection), 1) : undefined
}

export const createQtrAnimation = (
  current: RootDataFinal,
  selection: QtrPatternSelection,
): RootDataFinal | undefined => {
  const animation = createVtgAnimation(current, {
    ...withoutFinalTransforms(selection),
    beat: 1,
    transition: false,
  })
  if (!animation) return undefined

  const qtrAnimation = transformQtrAnimation(animation, getSelectedQtrMode(selection), 1)
  const completed = applyVtgPlaybackControls(qtrAnimation, withVtgInitialTurnsOffsetBeat(selection))
  if (!completed || (selection.transition && selection.initialTurnsOffset !== undefined)) {
    return undefined
  }

  const transformed = applyQtrFinalTransforms(completed, selection)
  const aligned = applyVtgPropRotationOffsets(
    transformed,
    selection.propRotationOffsets,
    applyQtrFinalTransforms(qtrAnimation, selection),
  )
  return applyVtgInitialTurnsPlayback(aligned, selection)
}

export const createDefaultQtrAnimation = (
  selection: QtrPatternSelection,
): RootDataFinal | undefined => {
  const base = createDefaultQtrBaseAnimation(selection)
  if (!base) return undefined

  const completed = applyVtgPlaybackControls(base, withVtgInitialTurnsOffsetBeat(selection))
  if (!completed || (selection.transition && selection.initialTurnsOffset !== undefined)) {
    return undefined
  }

  const transformed = applyQtrFinalTransforms(completed, selection)
  const aligned = applyVtgPropRotationOffsets(
    transformed,
    selection.propRotationOffsets,
    applyQtrFinalTransforms(base, selection),
  )
  return applyVtgInitialTurnsPlayback(aligned, selection)
}

export const createQtrPreviewAnimation = (
  selection: QtrPatternSelection,
): RootDataFinal | undefined => {
  const animation = createDefaultQtrAnimation(selection)
  return animation
    ? toVtgPreviewAnimation(animation, {
        hands: selection.hands ?? vtgPlayerSettings.hands,
      })
    : undefined
}
