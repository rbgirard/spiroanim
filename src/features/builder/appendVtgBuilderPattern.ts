import { createVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { createVtgTransitionPreviewAnimations } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { getVtgTimingCycleCount } from '@/features/vtg/types'
import { getVtgBuilderMotion } from '@/features/builder/describeVtgBuilderMotion'
import { rejoinVtgBuilderJunction } from '@/features/builder/rejoinVtgBuilderJunction'
import { selectVtgBuilderJunctionMotion } from '@/features/builder/selectVtgBuilderJunctionPlane'
import { rootCompile } from '@/math/animation/AnimFunc'
import { findExplicitPlaneOrTurnsFrameIndices } from '@/math/animation/findExplicitPlaneOrTurnsFrameIndices'
import { orthoAngle } from '@/math/animation/OrthogonalFunc'
import type { AnimData, AnimDataCompiled, RootDataFinal } from '@/types/AnimTypes'
import { MathUtils, Vector3 } from 'three'
import type { VtgBuilderPatternSelection } from '@/features/builder/types'
import { applyVtgThirdOrderSettings, type VtgThirdOrderSettings } from '@/features/vtg/thirdOrder'

const doubledFourBeatIntervalCount = 8
export interface VtgBuilderPatternOptions {
  minimumCycleCount?: 1 | 2
  thirdOrder?: {
    settings: VtgThirdOrderSettings
    mirror: boolean
    opposed: boolean
  }
}
const getBuilderPieceIntervalCount = (
  selection: VtgBuilderPatternSelection,
  options: VtgBuilderPatternOptions = {},
): number =>
  Math.max(getVtgTimingCycleCount(selection.speedRatio), options.minimumCycleCount ?? 1) *
  doubledFourBeatIntervalCount
const createBuilderPatternAnimation = (
  current: RootDataFinal,
  selection: VtgBuilderPatternSelection,
  options: VtgBuilderPatternOptions = {},
): RootDataFinal | undefined => {
  const animation =
    'quarters' in selection
      ? createQtrAnimation(current, selection)
      : createVtgAnimation(current, selection, options)
  return animation && options.thirdOrder
    ? applyVtgThirdOrderSettings(animation, options.thirdOrder.settings, {
        mirror: options.thirdOrder.mirror,
        opposed: options.thirdOrder.opposed,
      })
    : animation
}
const normalizeSignedAngle = (angle: number): number => {
  const normalized = ((angle % 360) + 360) % 360
  return normalized > 180 ? normalized - 360 : normalized
}
const normalizeTravelPlane = (plane: number): 0 | 180 =>
  Math.abs(((plane % 360) + 360) % 360) === 180 ? 180 : 0

const rebaseSourceTravelPlane = (
  sourceStart: AnimDataCompiled,
  sourceTarget: AnimDataCompiled,
): number => {
  const sourcePosition = new Vector3().fromArray(sourceStart.pos)
  const sourcePositionAxis = new Vector3().fromArray(sourceStart.posx)
  const sourcePositionReference = sourcePosition
    .clone()
    .applyAxisAngle(sourcePositionAxis, Math.PI / 2)
  const sourceOutgoingOrthogonal = new Vector3()
    .crossVectors(new Vector3().fromArray(sourceTarget.posx), sourcePosition)
    .normalize()
  return normalizeSignedAngle(
    sourceStart.plane +
      MathUtils.radToDeg(
        orthoAngle(sourcePosition, sourceOutgoingOrthogonal, sourcePositionReference),
      ),
  )
}

const createAppendedFrames = (
  frames: readonly AnimData[],
  compiledFrames: ReturnType<typeof rootCompile>['props'][number]['anim'],
  targetIntervalCount = doubledFourBeatIntervalCount,
): AnimData[] | undefined => {
  // The extracted block drops the source endpoint at index 0. Transport the compiled outgoing
  // POSX axis to the junction, then re-solve Plane so signed source travel stays intact.
  const sourceStart = compiledFrames[0]
  const sourceTarget = compiledFrames[1]
  if (frames.length < 2 || !sourceStart || !sourceTarget) return undefined

  const appended = frames.slice(1, targetIntervalCount + 1).map((frame) => ({ ...frame }))
  const firstFrame = appended[0]
  if (!firstFrame) return undefined
  firstFrame.plane = rebaseSourceTravelPlane(sourceStart, sourceTarget)
  firstFrame.arc = sourceTarget.arc
  firstFrame.turns = sourceTarget.turns

  // Starting-beat shifts can carry the source cycle's closing relationship into the middle of the
  // extracted block. In Builder this drop represents one relationship piece, so only its new first
  // frame may define Plane or Turns.
  for (const frame of appended.slice(1)) {
    delete frame.plane
    delete frame.turns
  }

  while (appended.length < targetIntervalCount) appended.push({})
  return appended
}

const createTransportedBuilderPieceFrames = (
  source: RootDataFinal,
  targetIntervalCount = doubledFourBeatIntervalCount,
): AnimData[][] | undefined => {
  const compiledSource = rootCompile(source)
  const framesByProp = source.props.map((prop, index) => {
    const compiledProp = compiledSource.props[index]
    return compiledProp
      ? createAppendedFrames(prop.anim, compiledProp.anim, targetIntervalCount)
      : undefined
  })
  return framesByProp.some((frames) => frames === undefined)
    ? undefined
    : framesByProp.map((frames) => frames!)
}

const createBuilderPieceFrames = (
  current: RootDataFinal,
  selection: VtgBuilderPatternSelection,
  options: VtgBuilderPatternOptions = {},
): AnimData[][] | undefined => {
  const source = createBuilderPatternAnimation(current, selection, options)
  if (!source || source.props.length !== current.props.length) return undefined
  return createTransportedBuilderPieceFrames(
    source,
    getBuilderPieceIntervalCount(selection, options),
  )
}

const swapAnimationTracks = (animation: RootDataFinal): RootDataFinal | undefined => {
  const [first, second] = animation.props
  if (!first || !second || animation.props.length !== 2) return undefined

  return {
    ...animation,
    props: [
      { ...first, anim: second.anim.map((frame) => ({ ...frame })) },
      { ...second, anim: first.anim.map((frame) => ({ ...frame })) },
    ],
  }
}

const createStartingVtgBuilderPattern = (
  current: RootDataFinal,
  selection: VtgBuilderPatternSelection,
  options: VtgBuilderPatternOptions = {},
): RootDataFinal | undefined => {
  const source = createBuilderPatternAnimation(current, selection, options)
  if (!source || source.props.length !== current.props.length) return undefined
  const targetIntervalCount = getBuilderPieceIntervalCount(selection, options)
  const compiledSource = rootCompile(source)
  const candidate = {
    ...current,
    props: current.props.map((prop, index) => {
      const sourceProp = source.props[index]
      const compiledSourceProp = compiledSource.props[index]
      if (!sourceProp || !compiledSourceProp) return prop

      const inserted = sourceProp.anim.slice(0, targetIntervalCount + 1).map((frame) => ({
        ...frame,
      }))
      while (inserted.length < targetIntervalCount + 1) inserted.push({})
      const insertedRelationship = inserted[1]
      if (insertedRelationship) {
        insertedRelationship.plane = normalizeTravelPlane(compiledSourceProp.anim[1]?.plane ?? 0)
        insertedRelationship.turns = compiledSourceProp.anim[1]?.turns ?? 0
      }
      for (const frame of inserted.slice(2)) {
        delete frame.plane
        delete frame.turns
      }

      return { ...prop, anim: inserted }
    }),
  }
  return selectVtgBuilderJunctionMotion(candidate, 1, getVtgBuilderMotion(source))
}

const prependVtgBuilderPattern = (
  current: RootDataFinal,
  selection: VtgBuilderPatternSelection,
  options: VtgBuilderPatternOptions = {},
): RootDataFinal | undefined => {
  const candidate = createStartingVtgBuilderPattern(current, selection, options)
  const targetIntervalCount = getBuilderPieceIntervalCount(selection, options)
  return candidate
    ? rejoinVtgBuilderJunction(
        candidate,
        targetIntervalCount,
        current,
        0,
        getVtgBuilderMotion(current),
      )
    : undefined
}

/** Appends a dragged VTG cell as one complete doubled timing cycle. */
export const appendVtgBuilderPattern = (
  current: RootDataFinal,
  selection: VtgBuilderPatternSelection,
  options: VtgBuilderPatternOptions = {},
): RootDataFinal | undefined => {
  if (current.props.length === 0) return createBuilderPatternAnimation(current, selection, options)

  const appendedByProp = createBuilderPieceFrames(current, selection, options)
  if (!appendedByProp) return undefined

  const appended = {
    ...current,
    props: current.props.map((prop, index) => ({
      ...prop,
      // Keep the existing endpoint. The appended relationship frame follows it, which lets the
      // preview extractor use that endpoint as the shared start of the new four-beat piece.
      anim: [...prop.anim.map((frame) => ({ ...frame })), ...appendedByProp[index]!],
    })),
  }
  const source = createBuilderPatternAnimation(current, selection, options)
  if (!source || source.props.length < 2 || appended.props.length < 2) return appended
  const appendTarget = current.props[0]?.anim.length
  if (appendTarget === undefined) return appended
  return selectVtgBuilderJunctionMotion(appended, appendTarget, getVtgBuilderMotion(source))
}

/** Swaps one Builder portion's prop tracks and rejoins its untouched successor. */
export const swapVtgBuilderPatternProps = (
  current: RootDataFinal,
  previewIndex: number,
): RootDataFinal | undefined => {
  const previews = createVtgTransitionPreviewAnimations(current)
  const selected = previews?.[previewIndex]
  const firstSelectedProp = selected?.props[0]
  if (!selected || !firstSelectedProp) return undefined

  const relationshipFrames = findExplicitPlaneOrTurnsFrameIndices(current, 2)
  const sliceStarts = [0, ...relationshipFrames.map((frameIndex) => frameIndex - 1)]
  const selectedStart = sliceStarts[previewIndex]
  if (selectedStart === undefined) return undefined

  const swapped = swapAnimationTracks(selected)
  if (!swapped) return undefined
  const selectedIntervalCount = firstSelectedProp.anim.length - 1
  const selectedMotion = getVtgBuilderMotion(swapped)

  const candidate =
    previewIndex === 0
      ? {
          ...current,
          props: current.props.map((prop, propIndex) => {
            const swappedProp = swapped.props[propIndex]
            return swappedProp
              ? { ...prop, anim: swappedProp.anim.map((frame) => ({ ...frame })) }
              : prop
          }),
        }
      : (() => {
          const transported = createTransportedBuilderPieceFrames(swapped, selectedIntervalCount)
          if (!transported) return undefined
          return {
            ...current,
            props: current.props.map((prop, propIndex) => ({
              ...prop,
              anim: [
                ...prop.anim.slice(0, selectedStart + 1).map((frame) => ({ ...frame })),
                ...transported[propIndex]!,
              ],
            })),
          }
        })()
  if (!candidate) return undefined

  const selectedTarget = previewIndex === 0 ? 1 : selectedStart + 1
  const aligned = selectVtgBuilderJunctionMotion(candidate, selectedTarget, selectedMotion)
  if (!aligned) return undefined

  const nextStart = sliceStarts[previewIndex + 1]
  const followingPreview = previews[previewIndex + 1]
  if (nextStart === undefined || !followingPreview) return aligned

  const rejoined = rejoinVtgBuilderJunction(
    aligned,
    selectedStart + selectedIntervalCount,
    current,
    nextStart,
    getVtgBuilderMotion(followingPreview),
  )
  return rejoined
    ? selectVtgBuilderJunctionMotion(
        rejoined,
        selectedStart + selectedIntervalCount + 1,
        getVtgBuilderMotion(followingPreview),
      )
    : undefined
}

/** Inserts a dragged VTG cell before an existing Builder preview. */
export const insertVtgBuilderPattern = (
  current: RootDataFinal,
  selection: VtgBuilderPatternSelection,
  previewIndex: number,
  options: VtgBuilderPatternOptions = {},
): RootDataFinal | undefined => {
  if (!current.props[0]) return undefined
  if (previewIndex === 0) return prependVtgBuilderPattern(current, selection, options)

  const relationshipFrames = findExplicitPlaneOrTurnsFrameIndices(current, 2)
  const sliceStarts = [0, ...relationshipFrames.map((frameIndex) => frameIndex - 1)]
  const targetStart = sliceStarts[previewIndex]
  if (targetStart === undefined) return undefined

  const insertedByProp = createBuilderPieceFrames(current, selection, options)
  if (!insertedByProp) return undefined
  const source = createBuilderPatternAnimation(current, selection, options)
  if (!source) return undefined
  const insertionIndex = targetStart + 1
  const insertedIntervalCount = getBuilderPieceIntervalCount(selection, options)
  const inserted = {
    ...current,
    props: current.props.map((prop, index) => {
      return {
        ...prop,
        // Keep the target's shared starting position. Its relationship frame and every following
        // authored frame shift forward after the inserted piece.
        anim: [
          ...prop.anim.slice(0, insertionIndex).map((frame) => ({ ...frame })),
          ...insertedByProp[index]!,
        ],
      }
    }),
  }
  const alignedInserted = selectVtgBuilderJunctionMotion(
    inserted,
    insertionIndex,
    getVtgBuilderMotion(source),
  )
  const followingPreview = createVtgTransitionPreviewAnimations(current)?.[previewIndex]
  return alignedInserted && followingPreview
    ? rejoinVtgBuilderJunction(
        alignedInserted,
        insertionIndex + insertedIntervalCount - 1,
        current,
        targetStart,
        getVtgBuilderMotion(followingPreview),
      )
    : undefined
}
