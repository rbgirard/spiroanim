import { rootCompile } from '@/math/animation/AnimFunc'
import { getVtgBuilderMotion } from '@/features/builder/describeVtgBuilderMotion'
import { rejoinVtgBuilderJunction } from '@/features/builder/rejoinVtgBuilderJunction'
import { selectVtgBuilderJunctionPlane } from '@/features/builder/selectVtgBuilderJunctionPlane'
import { findExplicitPlaneOrTurnsFrameIndices } from '@/math/animation/findExplicitPlaneOrTurnsFrameIndices'
import {
  shiftAnimationFrameRange,
  shiftAnimationFrames,
} from '@/math/animation/shiftAnimationFrames'
import { doublePlaybackMultiplier } from '@/math/animation/subdivideAnimationPlayback'
import type { VtgPatternRotationFilter } from '@/features/vtg/types'
import type { RootDataFinal } from '@/types/AnimTypes'

const extractedPatternSourceFrameCount = 2
const defaultQuickSlotBeatCount = 4
const transitionSegmentCount = 4
export type VtgTransitionQuickSlotCandidates = readonly RootDataFinal[]
export type VtgTransitionPreviewAnimations = readonly RootDataFinal[]

const getVtgTransitionPreviewSliceStarts = (animation: RootDataFinal): number[] | undefined => {
  const firstProp = animation.props[0]
  if (
    !firstProp ||
    animation.props.length !== 2 ||
    animation.props.some((prop) => prop.anim.length !== firstProp.anim.length)
  ) {
    return undefined
  }

  const relationshipChangeFrames = findExplicitPlaneOrTurnsFrameIndices(
    animation,
    extractedPatternSourceFrameCount,
  )
  return [0, ...relationshipChangeFrames.map((frameIndex) => frameIndex - 1)]
}

export const getVtgTransitionPreviewCount = (animation: RootDataFinal): number | undefined =>
  getVtgTransitionPreviewSliceStarts(animation)?.length

export const getVtgTransitionPreviewBeatCount = (animation: RootDataFinal): number => {
  const frames = rootCompile(animation).props[0]?.anim
  if (!frames || frames.length < 2) return 0

  const doubledBeatCount = frames.slice(0, -1).reduce((total, frame) => total + frame.beats, 0)
  return doubledBeatCount / doublePlaybackMultiplier
}

export const resizeVtgTransitionPatternPreview = (
  animation: RootDataFinal,
  previewIndex: number,
  beatCount: number,
): RootDataFinal | undefined => {
  const firstProp = animation.props[0]
  if (!firstProp) return undefined

  const relationshipChangeFrames = findExplicitPlaneOrTurnsFrameIndices(
    animation,
    extractedPatternSourceFrameCount,
  )
  const sliceStarts = [0, ...relationshipChangeFrames.map((frameIndex) => frameIndex - 1)]
  const startFrameIndex = sliceStarts[previewIndex]
  if (startFrameIndex === undefined) return undefined

  const nextStartFrameIndex = sliceStarts[previewIndex + 1]
  const currentIntervalCount =
    nextStartFrameIndex === undefined
      ? firstProp.anim.length - startFrameIndex - 1
      : nextStartFrameIndex - startFrameIndex
  const targetIntervalCount = Math.round(beatCount * doublePlaybackMultiplier)
  const intervalDelta = targetIntervalCount - currentIntervalCount
  if (intervalDelta === 0) return animation

  return {
    ...animation,
    props: animation.props.map((prop) => ({
      ...prop,
      anim: (() => {
        const frames = prop.anim.map((frame) => ({ ...frame }))
        if (nextStartFrameIndex === undefined) {
          if (intervalDelta > 0) frames.push(...Array.from({ length: intervalDelta }, () => ({})))
          else frames.splice(frames.length + intervalDelta, -intervalDelta)
        } else if (intervalDelta > 0) {
          frames.splice(
            nextStartFrameIndex + 1,
            0,
            ...Array.from({ length: intervalDelta }, () => ({})),
          )
        } else {
          frames.splice(nextStartFrameIndex + intervalDelta + 1, -intervalDelta)
        }
        return frames
      })(),
    })),
  }
}

const reversedTravelPlane = (plane: number): number => (((plane + 180) % 360) + 360) % 360

/** Reverses one Builder segment and carries the plane correction into its successor. */
export const reverseVtgTransitionPatternPreview = (
  animation: RootDataFinal,
  previewIndex: number,
): RootDataFinal | undefined => {
  const firstProp = animation.props[0]
  if (!firstProp || animation.props.some((prop) => prop.anim.length !== firstProp.anim.length)) {
    return undefined
  }

  const relationshipChangeFrames = findExplicitPlaneOrTurnsFrameIndices(
    animation,
    extractedPatternSourceFrameCount,
  )
  const sliceStarts = [0, ...relationshipChangeFrames.map((frameIndex) => frameIndex - 1)]
  const selectedStart = sliceStarts[previewIndex]
  if (selectedStart === undefined) return undefined

  const movementFrameIndices = [previewIndex === 0 ? 0 : selectedStart + 1]
  const nextStart = sliceStarts[previewIndex + 1]
  if (nextStart !== undefined) movementFrameIndices.push(nextStart + 1)

  const compiled = rootCompile(animation)
  const reversed = {
    ...animation,
    props: animation.props.map((prop, propIndex) => ({
      ...prop,
      anim: prop.anim.map((frame, frameIndex) => {
        if (!movementFrameIndices.includes(frameIndex)) return { ...frame }
        const compiledFrame = compiled.props[propIndex]?.anim[frameIndex]
        if (!compiledFrame) return { ...frame }
        return {
          ...frame,
          plane: reversedTravelPlane(compiledFrame.plane),
          axis: reversedTravelPlane(compiledFrame.axis),
        }
      }),
    })),
  }
  return reversed
}

/** Removes one Builder preview while preserving the authored relationship that follows it. */
export const removeVtgTransitionPatternPreview = (
  animation: RootDataFinal,
  previewIndex: number,
): RootDataFinal | undefined => {
  const firstProp = animation.props[0]
  if (!firstProp || animation.props.some((prop) => prop.anim.length !== firstProp.anim.length)) {
    return undefined
  }

  const relationshipChangeFrames = findExplicitPlaneOrTurnsFrameIndices(
    animation,
    extractedPatternSourceFrameCount,
  )
  const sliceStarts = [0, ...relationshipChangeFrames.map((frameIndex) => frameIndex - 1)]
  const startFrameIndex = sliceStarts[previewIndex]
  if (startFrameIndex === undefined) return undefined

  const nextStartFrameIndex = sliceStarts[previewIndex + 1]
  if (previewIndex === 0) {
    if (nextStartFrameIndex === undefined) {
      return { ...animation, props: [] }
    }

    // Rebase the next closed slice exactly as preview extraction does so all inherited position
    // and rotation state becomes its valid standalone starting state.
    const shifted = shiftClosedAnimation(animation, nextStartFrameIndex, true)
    if (!shifted) return undefined
    const remainingFrameCount = firstProp.anim.length - nextStartFrameIndex
    const rebased: RootDataFinal = {
      ...shifted,
      props: shifted.props.map((prop) => ({
        ...prop,
        anim: prop.anim.slice(0, remainingFrameCount).map((frame) => ({ ...frame })),
      })),
    }
    const compiledRebased = rootCompile(rebased)
    const survivingRelationshipFrameIndices = sliceStarts
      .slice(1)
      .map((sliceStart) => sliceStart - nextStartFrameIndex + 1)
    const withBoundaries: RootDataFinal = {
      ...rebased,
      props: rebased.props.map((prop, propIndex) => ({
        ...prop,
        anim: prop.anim.map((frame, frameIndex) => {
          if (!survivingRelationshipFrameIndices.includes(frameIndex)) {
            if (frameIndex < extractedPatternSourceFrameCount) return frame
            const withoutRebaseBoundary = { ...frame }
            delete withoutRebaseBoundary.plane
            delete withoutRebaseBoundary.turns
            return withoutRebaseBoundary
          }
          const compiledFrame = compiledRebased.props[propIndex]?.anim[frameIndex]
          return compiledFrame
            ? { ...frame, plane: compiledFrame.plane, turns: compiledFrame.turns }
            : frame
        }),
      })),
    }
    const followingPreview = createVtgTransitionPreviewAnimation(animation, 1)
    return followingPreview
      ? selectVtgBuilderJunctionPlane(withBoundaries, 1, getVtgBuilderMotion(followingPreview))
      : undefined
  }

  const deleteEndFrameIndex = nextStartFrameIndex ?? firstProp.anim.length - 1
  const deleteCount = deleteEndFrameIndex - startFrameIndex
  if (nextStartFrameIndex === undefined) {
    return {
      ...animation,
      props: animation.props.map((prop) => ({
        ...prop,
        anim: [
          ...prop.anim.slice(0, startFrameIndex + 1).map((frame) => ({ ...frame })),
          ...prop.anim.slice(startFrameIndex + 1 + deleteCount).map((frame) => ({ ...frame })),
        ],
      })),
    }
  }
  const followingPreview = createVtgTransitionPreviewAnimation(animation, previewIndex + 1)
  if (!followingPreview) return undefined

  return rejoinVtgBuilderJunction(
    animation,
    startFrameIndex,
    animation,
    nextStartFrameIndex,
    getVtgBuilderMotion(followingPreview),
  )
}

export type VtgTransitionQuickSlotResolution =
  | { status: 'matched'; animations: readonly RootDataFinal[] }
  | {
      status: 'partial'
      animations: readonly RootDataFinal[]
      unmatchedSlots: readonly number[]
    }

type VtgTransitionQuickSlotMatcher = (
  animation: RootDataFinal,
  rotationFilter: VtgPatternRotationFilter,
) => VtgTransitionQuickSlotMatchKind | false | Promise<VtgTransitionQuickSlotMatchKind | false>

export type VtgTransitionQuickSlotMatchKind = 'exact' | 'transitionTurns'

const cloneAnimation = (animation: RootDataFinal): RootDataFinal => ({
  ...animation,
  props: animation.props.map((prop) => ({
    ...prop,
    anim: prop.anim.map((frame) => ({ ...frame })),
  })),
})

const shiftClosedAnimation = (
  animation: RootDataFinal,
  shiftCount: number,
  allowEndpointMismatch = false,
): RootDataFinal | undefined => {
  if (shiftCount === 0) return cloneAnimation(animation)

  const compiled = rootCompile(animation)
  const shiftedFrames = animation.props.map((prop, propIndex) => {
    const compiledProp = compiled.props[propIndex]
    if (!compiledProp) return undefined
    return allowEndpointMismatch
      ? shiftAnimationFrameRange(prop.anim, compiledProp.anim, 0, prop.anim.length - 1, {
          allowEndpointMismatch: true,
          shiftCount,
        })
      : shiftAnimationFrames(prop.anim, compiledProp.anim, shiftCount)
  })
  if (shiftedFrames.some((frames) => frames === undefined)) return undefined

  return {
    ...animation,
    props: animation.props.map((prop, propIndex) => ({
      ...prop,
      anim: shiftedFrames[propIndex]!,
    })),
  }
}

const extractDoubledCycle = (
  animation: RootDataFinal,
  targetFrameCount: number,
): RootDataFinal | undefined => {
  if (
    targetFrameCount < extractedPatternSourceFrameCount ||
    animation.props.some((prop) => prop.anim.length < extractedPatternSourceFrameCount)
  ) {
    return undefined
  }

  return {
    ...animation,
    props: animation.props.map((prop) => ({
      ...prop,
      anim: [
        ...prop.anim.slice(0, extractedPatternSourceFrameCount).map((frame) => ({ ...frame })),
        ...Array.from({ length: targetFrameCount - extractedPatternSourceFrameCount }, () => ({})),
      ],
    })),
  }
}

/**
 * Extracts pattern regions using the same relationship boundaries as Q2-Q5 while retaining each
 * duration. A relationship authored on frame N describes the path from N-1 into N, so adjacent
 * slices share frame N-1 and the following slice owns that complete visual segment.
 */
const createVtgTransitionPreviewAnimationAt = (
  animation: RootDataFinal,
  sliceStarts: readonly number[],
  previewIndex: number,
): RootDataFinal | undefined => {
  const firstProp = animation.props[0]
  const startFrameIndex = sliceStarts[previewIndex]
  if (!firstProp || startFrameIndex === undefined) return undefined

  const shifted = shiftClosedAnimation(animation, startFrameIndex, true)
  if (!shifted) return undefined

  const nextStartFrameIndex = sliceStarts[previewIndex + 1]
  const sliceFrameCount =
    nextStartFrameIndex === undefined
      ? firstProp.anim.length - startFrameIndex
      : nextStartFrameIndex - startFrameIndex + 1

  return {
    ...shifted,
    props: shifted.props.map((prop) => ({
      ...prop,
      anim: prop.anim.slice(0, sliceFrameCount).map((frame) => ({ ...frame })),
    })),
  }
}

/** Extracts only one Builder preview without compiling every other portion. */
export const createVtgTransitionPreviewAnimation = (
  animation: RootDataFinal,
  previewIndex: number,
): RootDataFinal | undefined => {
  const sliceStarts = getVtgTransitionPreviewSliceStarts(animation)
  return sliceStarts
    ? createVtgTransitionPreviewAnimationAt(animation, sliceStarts, previewIndex)
    : undefined
}

export const createVtgTransitionPreviewAnimations = (
  animation: RootDataFinal,
): VtgTransitionPreviewAnimations | undefined => {
  const sliceStarts = getVtgTransitionPreviewSliceStarts(animation)
  if (!sliceStarts) return undefined

  const previews = sliceStarts.map((_, previewIndex) =>
    createVtgTransitionPreviewAnimationAt(animation, sliceStarts, previewIndex),
  )
  if (previews.some((preview) => preview === undefined)) return undefined

  return previews.map((preview) => preview!)
}

/**
 * Creates candidates for the current reciprocal transition and the four closed doubled-cycle
 * patterns surrounding its detected relationship changes. The matcher recognizes every half-beat
 * starting position directly, so each segment needs only its raw extracted cycle.
 */
export const createVtgTransitionQuickSlotAnimationCandidates = (
  animation: RootDataFinal,
  beatCount = defaultQuickSlotBeatCount,
): VtgTransitionQuickSlotCandidates | undefined => {
  const firstProp = animation.props[0]
  if (
    !firstProp ||
    animation.props.length !== 2 ||
    animation.props.some((prop) => prop.anim.length !== firstProp.anim.length)
  ) {
    return undefined
  }

  const relationshipChangeFrames = findExplicitPlaneOrTurnsFrameIndices(
    animation,
    extractedPatternSourceFrameCount,
  )
  const firstRelationshipChangeFrame = relationshipChangeFrames[0]
  if (firstRelationshipChangeFrame === undefined) return undefined
  // Legacy transitions place the relationship on an even interval boundary and extraction begins
  // on the following frame. Current transitions place it on the odd frame immediately after that
  // boundary, so that frame is already the equivalent extraction origin.
  const legacyBoundaryOffset = firstRelationshipChangeFrame % doublePlaybackMultiplier === 0 ? 1 : 0
  const segmentShiftCounts = [
    0,
    ...relationshipChangeFrames
      .slice(0, transitionSegmentCount - 1)
      .map((frameIndex) => frameIndex + legacyBoundaryOffset),
  ]
  if (segmentShiftCounts.length !== transitionSegmentCount) return undefined

  const segments = segmentShiftCounts.map((shiftCount) => {
    const shifted = shiftClosedAnimation(animation, shiftCount)
    const frameCount = beatCount * doublePlaybackMultiplier + 1
    return shifted ? extractDoubledCycle(shifted, frameCount) : undefined
  })
  if (segments.some((segment) => segment === undefined)) return undefined

  return [cloneAnimation(animation), ...segments.map((segment) => segment!)]
}

/**
 * Resolves every generated slot through the same pattern matcher used by Concepts. Rotation is
 * deliberately the final comparison tier. When an extraction is not recognized, it is retained so
 * one unknown pattern cannot prevent the complete transition set from being created; the partial
 * result identifies every such slot to the UI.
 */
export const resolveVtgTransitionQuickSlotAnimations = async (
  candidates: VtgTransitionQuickSlotCandidates,
  matches: VtgTransitionQuickSlotMatcher,
): Promise<VtgTransitionQuickSlotResolution> => {
  const animations: RootDataFinal[] = []
  const unmatchedSlots: number[] = []

  for (const [slotIndex, candidate] of candidates.entries()) {
    if (slotIndex === 0) {
      animations.push(candidate)
      continue
    }

    let matched = false
    for (const matchKind of ['exact', 'transitionTurns'] as const) {
      for (const rotationFilter of ['unrotated', 'rotated'] as const) {
        matched = (await matches(candidate, rotationFilter)) === matchKind
        if (matched) break
      }
      if (matched) break
    }

    if (matched) {
      animations.push(candidate)
    } else {
      animations.push(candidate)
      unmatchedSlots.push(slotIndex + 1)
    }
  }

  return unmatchedSlots.length > 0
    ? { status: 'partial', animations, unmatchedSlots }
    : { status: 'matched', animations }
}
