import type {
  ThirdOrderCell,
  ThirdOrderDirection,
} from '@/features/third-order/data/thirdOrderMatrix'
import type { VtgPatternSelection } from '@/features/vtg/types'

export type ThirdOrderVersion = 1 | 2

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
}
