/** Authored Scale controls shared by pattern properties and Builder. Values use display units. */
export type PatternScaleMode = 'simple' | 'advanced'
export type PatternScaleValues = [Record<string, number>, Record<string, number>]

/** Live VTG controls; only the resulting frame scales are stored in animations. */
export interface VtgScaleSettings {
  auto: boolean
  base: number
  mode: PatternScaleMode
  values: PatternScaleValues
}
