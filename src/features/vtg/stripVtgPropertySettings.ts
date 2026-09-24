import { applyVtgFoldSettings } from '@/features/vtg/applyVtgFoldSettings'
import { applyVtgTwistSettings } from '@/features/vtg/applyVtgTwistSettings'
import type { RootDataFinal } from '@/types/AnimTypes'
import { applyPatternScaleSettings } from '@/features/concepts/applyPatternScaleSettings'

/** Removes generator-owned property tracks before identifying the underlying VTG/QTR pattern. */
export const stripVtgPropertySettings = (animation: RootDataFinal): RootDataFinal => {
  // Independent or zero Scale affects paths, not the underlying VTG/QTR selection. Normalize it
  // only for matching; the caller retains the original authored frames for rendering and editing.
  const matchSource =
    animation.vtgScale?.auto === false
      ? applyPatternScaleSettings(animation, 'simple', [{ '0': 0.8 }, { '0': 0.8 }])
      : animation
  return applyVtgFoldSettings(applyVtgTwistSettings(matchSource, 'advanced', [{}, {}]), [{}, {}])
}
