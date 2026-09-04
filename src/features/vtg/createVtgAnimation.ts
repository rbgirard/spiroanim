import { buildVtgPattern } from '@/features/vtg/data/vtgPatternCatalog'
import { toConceptPreviewAnimation } from '@/features/concepts/data/toConceptPreviewAnimation'
import { vtgPlayerSettings, vtgPropSettings } from '@/features/vtg/data/vtgPlayerSettings'
import type { VtgPatternSelection, VtgReadableAnimation } from '@/features/vtg/types'
import {
  getVtgTimingCycleCount,
  vtgDefaultBeat,
  vtgDefaultTransitionBeats,
} from '@/features/vtg/types'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { rootCompile } from '@/math/animation/AnimFunc'
import { decodeReadable, encodeReadable } from '@/services/animation/AnimReadableFunc'
import type { RootDataFinal, RootReadable } from '@/types/AnimTypes'
import { createDefaultCameraFrame } from '@/math/animation/MotionFunc'
import { shiftVtgStartingBeat } from '@/features/vtg/math/shiftVtgStartingBeat'
import {
  applyVtgInitialTurnsPlayback,
  withVtgInitialTurnsOffsetBeat,
} from '@/features/vtg/math/applyVtgInitialTurnsOffset'
import { alternatePatternPlayback } from '@/math/animation/alternatePatternPlayback'
import { applyPatternPropVisibility } from '@/features/concepts/patternPropVisibility'
import { applyPatternPropSpacing } from '@/features/concepts/patternPropSpacing'
import {
  applyPatternFinalTransforms,
  applyPatternInitialArcRotation,
} from '@/features/concepts/applyPatternFinalTransforms'
import { applyPatternPropColors } from '@/features/concepts/patternPropColors'

const axesPointInSameDirection = (first: readonly number[], second: readonly number[]) =>
  (first[0] ?? 0) * (second[0] ?? 0) +
    (first[1] ?? 0) * (second[1] ?? 0) +
    (first[2] ?? 0) * (second[2] ?? 0) >=
  0

const vtgIntervalsPerHandRotation = 8

export interface CreateVtgAnimationOptions {
  minimumCycleCount?: 1 | 2
}

export const applyVtgPropRotationOffsets = (
  animation: RootDataFinal,
  offsets: VtgPatternSelection['propRotationOffsets'],
  reference: RootDataFinal = animation,
): RootDataFinal => {
  if (offsets === undefined || offsets.every((offset) => offset === 0)) return animation

  const compiled = rootCompile(animation)
  const compiledReference = reference === animation ? compiled : rootCompile(reference)
  return {
    ...animation,
    props: animation.props.map((prop, index) => {
      const firstFrame = prop.anim[0]
      const offset = offsets[index]
      if (!firstFrame || offset === undefined || offset === 0) return prop

      const initialAxis = compiled.props[index]?.anim[0]?.rotx
      const referenceAxis = compiledReference.props[index]?.anim[0]?.rotx
      const nextFrame = prop.anim[1]
      const nextTurns = compiled.props[index]?.anim[1]?.turns
      const localOffset =
        initialAxis && referenceAxis && !axesPointInSameDirection(initialAxis, referenceAxis)
          ? -offset
          : offset
      return {
        ...prop,
        anim: [
          { ...firstFrame, turns: (firstFrame.turns ?? 0) + localOffset },
          // Shift compacts repeated channels. Reset Turns on the following frame so changing the
          // initial prop alignment cannot leak through an omitted, inherited value and alter the
          // motion of every later interval.
          ...(nextFrame && nextTurns !== undefined
            ? [{ ...nextFrame, turns: nextTurns }, ...prop.anim.slice(2)]
            : prop.anim.slice(1)),
        ],
      }
    }),
  }
}

const addDefaultFrames = (
  pattern: VtgReadableAnimation,
  speedRatio: VtgPatternSelection['speedRatio'],
  options: CreateVtgAnimationOptions,
): VtgReadableAnimation => ({
  ...pattern,
  props: pattern.props.map((prop, index) => {
    const defaults = vtgPropSettings[index]
    const cycleCount = Math.max(getVtgTimingCycleCount(speedRatio), options.minimumCycleCount ?? 1)
    const frameCount = cycleCount * vtgIntervalsPerHandRotation + 1

    return {
      ...defaults,
      ...prop,
      anim: [
        ...prop.anim,
        ...Array.from({ length: Math.max(0, frameCount - prop.anim.length) }, () => ({})),
      ],
    }
  }),
})

const mergeWithCurrentAnimation = (
  current: RootDataFinal,
  pattern: VtgReadableAnimation,
): RootReadable => ({
  ...encodeReadable(current),
  ...pattern,
  props: pattern.props,
})

const vtgStandaloneBase = rootFinal(
  decodeReadable({
    ...vtgPlayerSettings,
    smooth: true,
    props: [],
  }),
)

export const applyVtgPlaybackControls = (
  animation: RootDataFinal,
  selection: Pick<
    VtgPatternSelection,
    | 'speedRatio'
    | 'beat'
    | 'transition'
    | 'transitionBeats'
    | 'transitionAfterBeat'
    | 'transitionQuad'
    | 'transitionSecond'
    | 'swapProps'
  >,
): RootDataFinal | undefined => {
  const shifted = shiftVtgStartingBeat(animation, selection.beat ?? vtgDefaultBeat)
  const transition = selection.transition === true
  if (!shifted || !transition) return shifted

  const selectedPropIndex = selection.transitionQuad && selection.transitionSecond ? 1 : 0
  const playbackPropIndex = selection.swapProps
    ? selectedPropIndex === 0
      ? 1
      : 0
    : selectedPropIndex
  return alternatePatternPlayback(
    shifted,
    selection.transitionBeats ?? vtgDefaultTransitionBeats,
    playbackPropIndex,
    selection.transitionQuad,
    selection.transitionAfterBeat,
  )
}

/**
 * Builds fresh player data for a VTG selection. Undefined means that the
 * selected cell has no pattern for that speed ratio yet.
 */
export const createVtgAnimation = (
  current: RootDataFinal,
  selection: VtgPatternSelection,
  options: CreateVtgAnimationOptions = {},
): RootDataFinal | undefined => {
  const selectedPattern = buildVtgPattern(selection)
  if (!selectedPattern) return undefined

  const patternWithDefaults = addDefaultFrames(
    {
      ...selectedPattern,
      ...(selection.thick === undefined ? {} : { thick: selection.thick }),
      paths: selection.paths ?? vtgPlayerSettings.paths,
      hands: selection.hands ?? vtgPlayerSettings.hands,
      arms: selection.arms ?? vtgPlayerSettings.arms,
    },
    selection.speedRatio,
    options,
  )
  const pattern = {
    ...patternWithDefaults,
    props: applyPatternPropVisibility(
      applyPatternPropSpacing(patternWithDefaults.props, selection),
      selection,
    ),
  }
  const decoded = decodeReadable(mergeWithCurrentAnimation(current, pattern))

  const animation = {
    ...rootFinal(decoded),
    ...(selection.prop === undefined ? undefined : { prop: selection.prop }),
    camera: [createDefaultCameraFrame(pattern.distance ?? vtgPlayerSettings.distance)],
    speed: current.speed,
    type: pattern.type ?? current.type,
    turns: pattern.turns ?? current.turns,
    depth: pattern.depth ?? current.depth,
  }

  const oriented = applyPatternInitialArcRotation(animation, selection.orientation)
  const completed = applyVtgPlaybackControls(oriented, withVtgInitialTurnsOffsetBeat(selection))
  if (!completed || (selection.transition && selection.initialTurnsOffset !== undefined)) {
    return undefined
  }

  const transformed = applyPatternFinalTransforms(completed, selection)
  const offsetReference = applyPatternFinalTransforms(oriented, selection)
  const aligned = applyVtgPropRotationOffsets(
    transformed,
    selection.propRotationOffsets,
    offsetReference,
  )
  const playback = applyVtgInitialTurnsPlayback(aligned, selection)
  return playback ? applyPatternPropColors(playback, selection) : undefined
}

/**
 * Builds VTG data without inheriting settings from the active player.
 */
export const createDefaultVtgAnimation = (
  selection: VtgPatternSelection,
  options: CreateVtgAnimationOptions = {},
): RootDataFinal | undefined => createVtgAnimation(vtgStandaloneBase, selection, options)

/**
 * Builds VTG data without inheriting settings from the active player.
 */
export const toVtgPreviewAnimation = toConceptPreviewAnimation

export const createVtgPreviewAnimation = (
  selection: VtgPatternSelection,
): RootDataFinal | undefined => {
  const animation = createDefaultVtgAnimation(selection)
  return animation
    ? toVtgPreviewAnimation(animation, {
        hands: selection.hands ?? vtgPlayerSettings.hands,
      })
    : undefined
}
