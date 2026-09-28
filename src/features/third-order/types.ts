import type {
  ThirdOrderCell,
  ThirdOrderDirection,
} from '@/features/third-order/data/thirdOrderMatrix'
import type { VtgPatternSelection } from '@/features/vtg/types'

export type ThirdOrderVersion = 1 | 2

/** Catalog identity only; detecting a match must never regenerate the player's animation. */
export interface ThirdOrderPatternMatch extends ThirdOrderCell {
  handDirection: ThirdOrderDirection
  propDirection: ThirdOrderDirection
  version: ThirdOrderVersion
  duplicate: number
}

export type ThirdOrderDisplaySettings = Pick<
  VtgPatternSelection,
  | 'bpm'
  | 'thick'
  | 'spacing'
  | 'paths'
  | 'hands'
  | 'arms'
  | 'left'
  | 'right'
  | 'propColors'
  | 'prop'
>

export interface ThirdOrderPatternSelection extends ThirdOrderCell, ThirdOrderDisplaySettings {
  concept: 'to'
  handDirection: ThirdOrderDirection
  propDirection: ThirdOrderDirection
  version: ThirdOrderVersion
  duplicate?: number
}
