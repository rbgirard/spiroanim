import type { VtgBuilderScaleMode, VtgBuilderScaleValues } from '@/features/builder/types'
import type { RootDataFinal } from '@/types/AnimTypes'
import { applyPatternScaleSettings } from '@/features/concepts/applyPatternScaleSettings'

export interface ApplyVtgBuilderScaleSettingsOptions {
  firstEditableFrameIndex?: number
}

/** Applies Builder Scale settings without mutating the selected portion. */
export const applyVtgBuilderScaleSettings = (
  animation: RootDataFinal,
  mode: VtgBuilderScaleMode,
  values: VtgBuilderScaleValues,
  options: ApplyVtgBuilderScaleSettingsOptions = {},
): RootDataFinal =>
  applyPatternScaleSettings(animation, mode, values, options.firstEditableFrameIndex)
