/** Authored Scale controls shared by pattern properties and Builder. Values use display units. */
export type PatternScaleMode = 'simple' | 'advanced'
export type PatternScaleValues = [Record<string, number>, Record<string, number>]

/** Optional authoring intent; rendered Scale remains stored in the animation frames. */
export interface VtgScaleIntent {
  auto: boolean
  base: number
  mode: PatternScaleMode
}

export interface VtgScaleSettings extends VtgScaleIntent {
  values: PatternScaleValues
}
