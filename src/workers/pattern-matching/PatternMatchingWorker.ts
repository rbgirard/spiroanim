import { createMessageChannel } from '@/workers/createMessageChannel'
import {
  compareVtgCandidateLayoutRequest,
  createVtgPreviewCandidatesRequest,
  matchEightStepPatternRequest,
  matchQstPatternRequest,
  matchVtgPatternRequest,
} from '@/workers/pattern-matching/handlePatternMatchingRequest'
import type { PatternMatchingBridgeMap } from '@/workers/pattern-matching/PatternMatchingWorkerTypes'

const { register } = createMessageChannel<PatternMatchingBridgeMap>(
  self as DedicatedWorkerGlobalScope,
)

register('matchVtg', matchVtgPatternRequest)
register('matchEightStep', matchEightStepPatternRequest)
register('matchQst', matchQstPatternRequest)
register('compareVtgCandidateLayout', compareVtgCandidateLayoutRequest)
register('createVtgPreviewCandidates', createVtgPreviewCandidatesRequest)
