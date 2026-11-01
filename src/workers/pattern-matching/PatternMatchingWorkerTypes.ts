import type { EightStepPatternMatch, EightStepPatternSelection } from '@/features/eight-step/types'
import type { VtgBuilderPatternSelection } from '@/features/builder/types'
import type { VtgPropertySettings } from '@/features/vtg/propertySettings'
import type {
  QstPatternMatch,
  QstPatternMatchPreferences,
  QstPatternSelection,
} from '@/features/quarter-space-tech/types'
import type {
  QtrPatternMatch,
  QtrPatternMatchPreferences,
  QtrPatternSelection,
  VtgPatternMatch,
  VtgPatternMatchPreferences,
  VtgPatternRotationFilter,
  VtgPatternSelection,
} from '@/features/vtg/types'
import type { RootDataFinal } from '@/types/AnimTypes'
import type { ThirdOrderPatternMatch } from '@/features/third-order/types'

export interface ThirdOrderPatternMatchRequest {
  animation: RootDataFinal
  preferred?: ThirdOrderPatternMatch
}

export type ThirdOrderPatternMatchResult =
  | { status: 'unmatched' }
  | { status: 'matched'; match: ThirdOrderPatternMatch }

export interface VtgPatternMatchRequest {
  animation: RootDataFinal
  preferences: VtgPatternMatchPreferences &
    Pick<QtrPatternMatchPreferences, 'quarters' | 'orientation'>
  source?: 'vtg' | 'qtr'
  rotationFilter?: VtgPatternRotationFilter
  lastSelection?: VtgPatternSelection | QtrPatternSelection
}

export type VtgPatternMatchResult =
  | { status: 'unchanged' }
  | { status: 'unmatched' }
  | { status: 'matched'; source: 'vtg'; match: VtgPatternMatch; exact?: boolean }
  | { status: 'matched'; source: 'qtr'; match: QtrPatternMatch; exact?: boolean }

export interface EightStepPatternMatchRequest {
  animation: RootDataFinal
  lastSelection?: EightStepPatternSelection
}

export type EightStepPatternMatchResult =
  | { status: 'unchanged' }
  | { status: 'unmatched' }
  | { status: 'matched'; match: EightStepPatternMatch }

export interface QstPatternMatchRequest {
  animation: RootDataFinal
  preferences: QstPatternMatchPreferences
  lastSelection?: QstPatternSelection
}

export type QstPatternMatchResult =
  | { status: 'unchanged' }
  | { status: 'unmatched' }
  | { status: 'matched'; match: QstPatternMatch }

export interface VtgCandidateLayoutRequest {
  selections: readonly [VtgBuilderPatternSelection, VtgBuilderPatternSelection]
  options: {
    source?: RootDataFinal
    builderInsertionIndex?: number
    properties?: VtgPropertySettings
  }
}

export interface VtgPreviewCandidatesRequest {
  selections: readonly VtgBuilderPatternSelection[]
  options: {
    source?: RootDataFinal
    builderInsertionIndex?: number
    properties?: VtgPropertySettings
  }
}

export interface PatternMatchingBridgeMap {
  matchThirdOrder: {
    arg: ThirdOrderPatternMatchRequest
    ret: ThirdOrderPatternMatchResult
  }
  matchVtg: {
    arg: VtgPatternMatchRequest
    ret: VtgPatternMatchResult
  }
  matchEightStep: {
    arg: EightStepPatternMatchRequest
    ret: EightStepPatternMatchResult
  }
  matchQst: {
    arg: QstPatternMatchRequest
    ret: QstPatternMatchResult
  }
  compareVtgCandidateLayout: {
    arg: VtgCandidateLayoutRequest
    ret: boolean
  }
  createVtgPreviewCandidates: {
    arg: VtgPreviewCandidatesRequest
    ret: readonly (RootDataFinal | undefined)[]
  }
}

export interface PatternMatchingClient {
  matchThirdOrder?: (
    request: ThirdOrderPatternMatchRequest,
  ) => Promise<ThirdOrderPatternMatchResult>
  matchVtg: (request: VtgPatternMatchRequest) => Promise<VtgPatternMatchResult>
  matchEightStep: (request: EightStepPatternMatchRequest) => Promise<EightStepPatternMatchResult>
  matchQst: (request: QstPatternMatchRequest) => Promise<QstPatternMatchResult>
  compareVtgCandidateLayout?: (request: VtgCandidateLayoutRequest) => Promise<boolean>
  createVtgPreviewCandidates?: (
    request: VtgPreviewCandidatesRequest,
  ) => Promise<readonly (RootDataFinal | undefined)[]>
}
