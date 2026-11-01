export const STRENGTH_FACTOR = 10
export const STRENGTH_MIN = 0
export const STRENGTH_MAX = 100 * STRENGTH_FACTOR
export const STRENGTH_DEFAULT = STRENGTH_MAX

/** Converts the stored tenths-of-a-percent value to a normalized 0..1 amount. */
export const toStrengthRatio = (strength: number): number => strength / STRENGTH_MAX

export const formatStrength = (strength: number): string => {
  const display = strength / STRENGTH_FACTOR
  return `${Number.isInteger(display) ? display.toFixed(0) : display.toFixed(1)}%`
}
