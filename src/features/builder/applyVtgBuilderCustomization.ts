import { defaultPatternPropColors } from '@/features/concepts/patternPropColors'
import { toVtgBuilderDisplayAnimation } from '@/features/builder/toVtgBuilderDisplayAnimation'
import {
  vtgBpmControl,
  vtgDefaultProp,
  vtgPlayerSettings,
  vtgSpacingControl,
  vtgThickControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import type { VtgPatternSelection } from '@/features/vtg/types'
import type { RootDataFinal } from '@/types/AnimTypes'

/** Applies Builder Customize fields without accepting VTG's pattern-level Scale control. */
export const applyVtgBuilderCustomization = (
  animation: RootDataFinal,
  selection: VtgPatternSelection,
): RootDataFinal =>
  toVtgBuilderDisplayAnimation(animation, {
    bpm: selection.bpm ?? vtgBpmControl.default,
    thick: selection.thick ?? vtgThickControl.default,
    spacing: selection.spacing ?? vtgSpacingControl.default,
    paths: selection.paths ?? vtgPlayerSettings.paths,
    hands: selection.hands ?? vtgPlayerSettings.hands,
    arms: selection.arms ?? vtgPlayerSettings.arms,
    leftPropVisible: selection.left !== false,
    rightPropVisible: selection.right !== false,
    propColors: selection.propColors ?? defaultPatternPropColors,
    prop: selection.prop ?? vtgDefaultProp,
  })
