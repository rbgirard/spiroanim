export type VtgTwistMode = 'simple' | 'advanced'
export type VtgTwistValues = [Record<string, number>, Record<string, number>]

export interface VtgFoldValue {
  yaw?: number
  rotate?: number
}

export type VtgFoldValues = [Record<string, VtgFoldValue>, Record<string, VtgFoldValue>]
export type VtgFoldMode = 'simple' | 'advanced'
export type VtgFoldSpan = 'eighth' | 'quarter'
export type VtgFoldSideSettings<T> = [T, T]
export type VtgPropertyKey = 'offset' | 'axis' | 'twist' | 'turns' | 'third-order'
