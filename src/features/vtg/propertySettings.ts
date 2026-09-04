import type {
  VtgFoldMode,
  VtgFoldSideSettings,
  VtgFoldSpan,
  VtgFoldValues,
  VtgTwistMode,
  VtgTwistValues,
} from '@/features/vtg/propertyTypes'
import {
  applyVtgFoldSettings,
  deriveVtgFoldSimpleSources,
} from '@/features/vtg/applyVtgFoldSettings'
import { applyVtgTwistSettings } from '@/features/vtg/applyVtgTwistSettings'
import {
  applyVtgThirdOrderSettings,
  getVtgThirdOrderCycleCount,
  type VtgThirdOrderSettings,
} from '@/features/vtg/thirdOrder'
import type { RootDataFinal } from '@/types/AnimTypes'

export interface VtgPropertySettings {
  twist: {
    mode: VtgTwistMode
    values: VtgTwistValues
  }
  thirdOrder: {
    settings: VtgThirdOrderSettings
    mirror: boolean
    opposed: boolean
  }
  fold: {
    values: VtgFoldValues
    valuesMaterialized: boolean
    mode: VtgFoldMode
    beat: VtgFoldSideSettings<number>
    repeat: VtgFoldSideSettings<boolean>
    every: VtgFoldSideSettings<number>
    alternate: VtgFoldSideSettings<boolean>
    span: VtgFoldSpan
    mirror: boolean
  }
}

export const createDefaultVtgPropertySettings = (): VtgPropertySettings => ({
  twist: { mode: 'simple', values: [{}, {}] },
  thirdOrder: { settings: [{}, {}], mirror: true, opposed: false },
  fold: {
    values: [{}, {}],
    valuesMaterialized: false,
    mode: 'simple',
    beat: [2, 2],
    repeat: [true, true],
    every: [2, 2],
    alternate: [false, false],
    span: 'eighth',
    mirror: true,
  },
})

/** Creates a stable plain-data snapshot suitable for worker messages and deferred operations. */
export const cloneVtgPropertySettings = (settings: VtgPropertySettings): VtgPropertySettings => ({
  twist: {
    mode: settings.twist.mode,
    values: settings.twist.values.map((side) => ({ ...side })) as VtgTwistValues,
  },
  thirdOrder: {
    settings: settings.thirdOrder.settings.map((side) => ({ ...side })) as VtgThirdOrderSettings,
    mirror: settings.thirdOrder.mirror,
    opposed: settings.thirdOrder.opposed,
  },
  fold: {
    values: settings.fold.values.map((side) =>
      Object.fromEntries(Object.entries(side).map(([beat, value]) => [beat, { ...value }])),
    ) as VtgFoldValues,
    valuesMaterialized: settings.fold.valuesMaterialized,
    mode: settings.fold.mode,
    beat: [...settings.fold.beat],
    repeat: [...settings.fold.repeat],
    every: [...settings.fold.every],
    alternate: [...settings.fold.alternate],
    span: settings.fold.span,
    mirror: settings.fold.mirror,
  },
})

export const getVtgPropertyCycleCount = (settings: VtgPropertySettings): 1 | 2 =>
  getVtgThirdOrderCycleCount(settings.thirdOrder.settings, settings.thirdOrder.mirror)

export const hasVtgPropertySettings = (settings: VtgPropertySettings): boolean =>
  settings.twist.values.some((side) => Object.keys(side).length > 0) ||
  settings.thirdOrder.settings.some(
    (side) =>
      side.initial !== undefined || side.strength !== undefined || side.timing !== undefined,
  ) ||
  settings.fold.values.some((side) => Object.keys(side).length > 0)

export const updateVtgMirroredSideSetting = <T>(
  settings: VtgFoldSideSettings<T>,
  propIndex: 0 | 1,
  value: T,
  mirror: boolean,
): VtgFoldSideSettings<T> => {
  const next: VtgFoldSideSettings<T> = [...settings]
  next[propIndex] = value
  if (mirror && propIndex === 0) next[1] = value
  return next
}

/** Applies every VTG property control in its canonical order. */
export const applyVtgPropertySettings = (
  animation: RootDataFinal,
  settings: VtgPropertySettings,
  options: { firstEditableFrameIndex?: number } = {},
): RootDataFinal => {
  const foldValues =
    settings.fold.mode === 'simple'
      ? deriveVtgFoldSimpleSources(
          settings.fold.values,
          settings.fold.beat,
          settings.fold.span,
          settings.fold.valuesMaterialized,
        )
      : settings.fold.values
  return applyVtgThirdOrderSettings(
    applyVtgFoldSettings(
      applyVtgTwistSettings(animation, settings.twist.mode, settings.twist.values, options),
      foldValues,
      { ...settings.fold, firstEditableFrameIndex: options.firstEditableFrameIndex },
    ),
    settings.thirdOrder.settings,
    { ...settings.thirdOrder, firstEditableFrameIndex: options.firstEditableFrameIndex },
  )
}
