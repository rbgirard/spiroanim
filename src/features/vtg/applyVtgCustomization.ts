import {
  applyPatternPropColors,
  defaultPatternPropColors,
} from '@/features/concepts/patternPropColors'
import { getPatternPropMoves } from '@/features/concepts/patternPropSpacing'
import {
  clampVtgBpm,
  vtgBpmControl,
  vtgDefaultProp,
  vtgPlayerSettings,
  vtgThickControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import type { VtgPatternSelection } from '@/features/vtg/types'
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

/**
 * Applies live VTG Customize fields while preserving the current pattern frames and camera.
 * Scale belongs to VTG pattern generation and is intentionally not applied here.
 */
export const applyVtgCustomization = (
  animation: RootDataFinal,
  selection: VtgPatternSelection,
): RootDataFinal => {
  const moves = getPatternPropMoves(selection.spacing)
  const paths = selection.paths ?? vtgPlayerSettings.paths
  const hands = selection.hands ?? vtgPlayerSettings.hands
  const arms = selection.arms ?? vtgPlayerSettings.arms
  const thick = selection.thick ?? vtgThickControl.default

  const props = animation.props.map((original, index) => {
    const visible = (index === 0 ? selection.left : selection.right) !== false
    const prop = applyVisibility(
      {
        ...original,
        paths,
        hands,
        arms,
        thick,
        motion: createSpacingMotion(moves[index] ?? 0),
      },
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
      props,
    },
    { propColors: selection.propColors ?? defaultPatternPropColors },
  )
}
