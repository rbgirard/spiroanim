import type { ConceptPatternSelection } from '@/features/concepts/types'
import type { QtrPatternSelection, VtgPatternSelection } from '@/features/vtg/types'

export type VtgBuilderPatternSelection = VtgPatternSelection | QtrPatternSelection
export type VtgBuilderScaleMode = import('@/types/AnimationScale').PatternScaleMode
export type VtgBuilderScaleValues = import('@/types/AnimationScale').PatternScaleValues

export const builderPatternDragType = 'application/x-spiroanim-pattern'

export interface BuilderPatternDrop {
  previewIndex: number
  selection: ConceptPatternSelection
}
