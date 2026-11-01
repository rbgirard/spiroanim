export const SCALE_FACTOR = 100
export const SCALE_MIN = -200
export const SCALE_MAX = 400
export const SCALE_DEFAULT = 100

export const toScaleMultiplier = (scale: number): number => scale / SCALE_FACTOR

export const toInternalScale = (scale: number): number => Math.round(scale * SCALE_FACTOR)

export const toDisplayScale = (scale: number): number => scale / SCALE_FACTOR

export const formatScale = (scale: number): string => {
  const display = toDisplayScale(scale)
  return display.toFixed(Number.isInteger(display * 10) ? 1 : 2)
}
