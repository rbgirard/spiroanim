import { applyPatternPropSpacing } from '@/features/concepts/patternPropSpacing'
import { applyPatternPropVisibility } from '@/features/concepts/patternPropVisibility'
import { applyPatternFinalTransforms } from '@/features/concepts/applyPatternFinalTransforms'
import { applyPatternPropColors } from '@/features/concepts/patternPropColors'
import { toConceptPreviewAnimation } from '@/features/concepts/data/toConceptPreviewAnimation'
import { buildQstPattern } from '@/features/quarter-space-tech/data/qstPatternCatalog'
import { analyzeQstPositionPairs } from '@/features/quarter-space-tech/math/analyzeQstAnimation'
import { createQstFrames } from '@/features/quarter-space-tech/math/createQstFrames'
import type { QstPatternSelection, QstReadableAnimation } from '@/features/quarter-space-tech/types'
import {
  vtgDefaultProp,
  vtgPlayerSettings,
  vtgPropSettings,
} from '@/features/vtg/data/vtgPlayerSettings'
import { createDefaultCameraFrame } from '@/math/animation/MotionFunc'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { decodeReadable, encodeReadable } from '@/services/animation/AnimReadableFunc'
import type { CameraData, RootDataFinal, RootReadable } from '@/types/AnimTypes'

const createQstCameraFrame = (distance: number): CameraData => ({
  orbit: { distance, arc: 110, plane: -115 },
  center: { distance: 1, arc: 135, plane: 180 },
})

const toQstPreviewAnimation = (animation: RootDataFinal): RootDataFinal =>
  toConceptPreviewAnimation({
    ...animation,
    camera: [
      createDefaultCameraFrame(animation.camera[0]?.orbit?.distance ?? vtgPlayerSettings.distance),
    ],
  })

const addPropDefaults = (pattern: QstReadableAnimation): QstReadableAnimation => ({
  ...pattern,
  props: pattern.props.map((prop, index) => ({
    ...vtgPropSettings[index],
    ...prop,
  })),
})

const mergeWithCurrentAnimation = (
  current: RootDataFinal,
  pattern: QstReadableAnimation,
): RootReadable => ({
  ...encodeReadable(current),
  ...pattern,
  props: pattern.props,
})

const qstStandaloneBase = rootFinal(
  decodeReadable({
    ...vtgPlayerSettings,
    smooth: true,
    props: [],
  }),
)

export const createQstAnimation = (
  current: RootDataFinal,
  selection: QstPatternSelection,
): RootDataFinal | undefined => {
  const selectedPattern = buildQstPattern(selection)
  if (!selectedPattern) return undefined

  const patternWithDefaults = addPropDefaults({
    ...selectedPattern,
    ...(selection.thick === undefined ? undefined : { thick: selection.thick }),
    paths: selection.paths ?? vtgPlayerSettings.paths,
    hands: selection.hands ?? vtgPlayerSettings.hands,
    arms: selection.arms ?? vtgPlayerSettings.arms,
  })
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
    prop: selection.prop ?? vtgDefaultProp,
    camera: [createQstCameraFrame(pattern.distance ?? vtgPlayerSettings.distance)],
    speed: current.speed,
    type: pattern.type ?? current.type,
    turns: pattern.turns ?? current.turns,
    depth: pattern.depth ?? current.depth,
  }

  return applyPatternPropColors(applyPatternFinalTransforms(animation, selection), selection)
}

export const createDefaultQstAnimation = (
  selection: QstPatternSelection,
): RootDataFinal | undefined => createQstAnimation(qstStandaloneBase, selection)

export const createQstPreviewAnimation = (
  selection: QstPatternSelection,
): RootDataFinal | undefined => {
  const animation = createDefaultQstAnimation(selection)
  return animation ? toQstPreviewAnimation(animation) : undefined
}

export const createQstLinePreviewAnimation = (
  selection: QstPatternSelection,
  lineIndex: number,
  lineBeats: number,
): RootDataFinal | undefined => {
  const animation = createDefaultQstAnimation(selection)
  if (!animation) return undefined

  const pairs = analyzeQstPositionPairs(animation)
  const start = lineIndex * lineBeats
  const linePairs = pairs.slice(start, Math.min(start + lineBeats + 1, pairs.length))
  if (linePairs.length < 2) return undefined

  const readable = encodeReadable(animation)
  readable.props = readable.props.map((prop, propIndex) => ({
    ...prop,
    anim: createQstFrames(linePairs.map((pair) => pair[propIndex === 0 ? 0 : 1])).map(
      (frame, frameIndex) =>
        frameIndex === 0 && prop.anim[0]?.scale !== undefined
          ? { ...frame, scale: prop.anim[0].scale }
          : frame,
    ),
  }))

  return toQstPreviewAnimation(rootFinal(decodeReadable(readable)))
}
