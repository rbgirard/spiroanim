import {
  clampVtgBpm,
  getVtgDistanceForScale,
  vtgThickControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import {
  applyPatternPropColors,
  type PatternPropColor,
} from '@/features/concepts/patternPropColors'
import { getPatternPropMoves } from '@/features/concepts/patternPropSpacing'
import { createDefaultCameraFrame } from '@/math/animation/MotionFunc'
import { toDisplayScale } from '@/domain/animation/scale'
import { INITIAL_ANIMATION_FRAME, resolveAnimationFrames } from '@/math/animation/frameSemantics'
import type { MotionData, PropInd, RootDataFinal } from '@/types/AnimTypes'

export interface VtgBuilderDisplaySettings {
  bpm: number
  thick: number
  spacing: number
  paths: boolean
  hands: boolean
  arms: boolean
  leftPropVisible: boolean
  rightPropVisible: boolean
  propColors: readonly [PatternPropColor, PatternPropColor]
  prop: PropInd
}

interface VtgBuilderDisplayOptions {
  thumbnail?: boolean
  maximumScale?: number
}

const createSpacingMotion = (move: number): MotionData[] =>
  move === 0
    ? []
    : [{ precision: true, arc: 90, plane: move < 0 ? 180 : 0, distance: Math.abs(move) }]

/** Returns the highest effective internal Scale used anywhere in a Builder pattern. */
export const getVtgBuilderMaximumScale = (animation: RootDataFinal): number => {
  let maximumScale: number | undefined

  for (const prop of animation.props) {
    for (const frame of resolveAnimationFrames(prop.anim)) {
      maximumScale = Math.max(maximumScale ?? frame.scale, frame.scale)
    }
  }

  return maximumScale ?? INITIAL_ANIMATION_FRAME.scale
}

/** Applies Builder display controls without changing authored Scale or the source animation. */
export const toVtgBuilderDisplayAnimation = (
  animation: RootDataFinal,
  settings?: VtgBuilderDisplaySettings,
  options: VtgBuilderDisplayOptions = {},
): RootDataFinal => {
  const maximumScale = options.maximumScale ?? getVtgBuilderMaximumScale(animation)
  const framed = {
    ...animation,
    camera: [createDefaultCameraFrame(getVtgDistanceForScale(toDisplayScale(maximumScale)))],
  }

  if (settings === undefined) return framed

  const thumbnail = options.thumbnail === true
  const moves = getPatternPropMoves(settings.spacing)
  const thick = thumbnail ? vtgThickControl.max : settings.thick
  const props = framed.props.map((original, index) => {
    const { visible: _visible, ...prop } = original
    const visible = index === 0 ? settings.leftPropVisible : settings.rightPropVisible
    const displayed = {
      ...prop,
      paths: settings.paths,
      hands: settings.hands,
      arms: settings.arms,
      thick,
      motion: createSpacingMotion(moves[index] ?? 0),
    }

    return !thumbnail && !visible
      ? { ...displayed, paths: false, hands: false, arms: false, visible: false }
      : displayed
  })

  return applyPatternPropColors(
    {
      ...framed,
      bpm: clampVtgBpm(settings.bpm) * 2,
      prop: settings.prop,
      paths: settings.paths,
      hands: settings.hands,
      arms: settings.arms,
      thick,
      props,
    },
    { propColors: settings.propColors },
  )
}
