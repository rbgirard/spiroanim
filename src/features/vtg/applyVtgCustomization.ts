import {
  applyPatternPropColors,
  defaultPatternPropColors,
} from '@/features/concepts/patternPropColors'
import { getPatternPropMoves } from '@/features/concepts/patternPropSpacing'
import {
  clampVtgBpm,
  getAdjustedVtgScale,
  getVtgDistanceForScale,
  toVtgInternalScale,
  vtgBpmControl,
  vtgDefaultProp,
  vtgPlayerSettings,
  vtgScaleControl,
  vtgThickControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import type { VtgPatternSelection } from '@/features/vtg/types'
import { createDefaultCameraFrame } from '@/math/animation/MotionFunc'
import type { MotionData, PropDataFinal, RootDataFinal } from '@/types/AnimTypes'

const createSpacingMotion = (move: number): MotionData[] =>
  move === 0
    ? []
    : [{ precision: true, arc: 90, plane: move < 0 ? 180 : 0, distance: Math.abs(move) }]

const applyVisibility = (prop: PropDataFinal, visible: boolean): PropDataFinal => {
  if (!visible) return { ...prop, paths: false, hands: false, arms: false, visible: false }
  const { visible: _visible, ...result } = prop
  return result
}

const applyScale = (prop: PropDataFinal, scale: number): PropDataFinal => {
  const firstFrame = prop.anim[0]
  if (firstFrame === undefined) return prop
  return { ...prop, anim: [{ ...firstFrame, scale }, ...prop.anim.slice(1)] }
}

/** Applies only VTG Customize fields, preserving the current pattern frames and transforms. */
export const applyVtgCustomization = (
  animation: RootDataFinal,
  selection: VtgPatternSelection,
): RootDataFinal => {
  const adjustedScale = getAdjustedVtgScale(
    selection.scale ?? vtgScaleControl.default,
    selection.speedRatio,
  )
  const internalScale = toVtgInternalScale(adjustedScale)
  const moves = getPatternPropMoves(selection.spacing)
  const paths = selection.paths ?? vtgPlayerSettings.paths
  const hands = selection.hands ?? vtgPlayerSettings.hands
  const arms = selection.arms ?? vtgPlayerSettings.arms
  const thick = selection.thick ?? vtgThickControl.default

  const props = animation.props.map((original, index) => {
    const visible = (index === 0 ? selection.left : selection.right) !== false
    const prop = applyVisibility(
      applyScale(
        {
          ...original,
          paths,
          hands,
          arms,
          thick,
          motion: createSpacingMotion(moves[index] ?? 0),
        },
        internalScale,
      ),
      visible,
    )
    return prop
  })

  return applyPatternPropColors(
    {
      ...animation,
      prop: selection.prop ?? vtgDefaultProp,
      bpm: clampVtgBpm(selection.bpm ?? vtgBpmControl.default) * 2,
      paths,
      hands,
      arms,
      thick,
      camera: [createDefaultCameraFrame(getVtgDistanceForScale(adjustedScale))],
      props,
    },
    { propColors: selection.propColors ?? defaultPatternPropColors },
  )
}
