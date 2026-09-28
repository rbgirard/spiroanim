import { vtgMoreRatioPickerRatios, vtgRatioPickerRatios } from '@/features/vtg/types'

// Keep the header catalog aligned with VTG's timing pickers.
export const thirdOrderHandRatios = vtgRatioPickerRatios
export const thirdOrderPropRatios = vtgMoreRatioPickerRatios

export type ThirdOrderDirection = 'anti' | 'spin'
export interface ThirdOrderCell {
  handRatio: (typeof thirdOrderHandRatios)[number]
  propRatio: (typeof thirdOrderPropRatios)[number]
}

export const thirdOrderCells: readonly ThirdOrderCell[] = thirdOrderPropRatios.flatMap(
  (propRatio) => thirdOrderHandRatios.map((handRatio) => ({ handRatio, propRatio })),
)
