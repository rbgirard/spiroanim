import type {
  EightStepPatternMatchRequest,
  EightStepPatternMatchResult,
  QstPatternMatchRequest,
  QstPatternMatchResult,
  VtgPatternMatchRequest,
  VtgPatternMatchResult,
  VtgCandidateLayoutRequest,
  VtgPreviewCandidatesRequest,
} from '@/workers/pattern-matching/PatternMatchingWorkerTypes'
import type { RootDataFinal } from '@/types/AnimTypes'

export const createVtgPreviewCandidatesRequest = async ({
  selections,
  options,
}: VtgPreviewCandidatesRequest): Promise<readonly (RootDataFinal | undefined)[]> => {
  const { createVtgPreviewCandidate } =
    await import('@/features/concepts/createVtgPreviewCandidate')
  return selections.map((selection) => createVtgPreviewCandidate(selection, options))
}

export const compareVtgCandidateLayoutRequest = async ({
  selections,
  options,
}: VtgCandidateLayoutRequest): Promise<boolean> => {
  const [{ createVtgPreviewCandidate }, { requiresPairedVtgCandidateLayout }] = await Promise.all([
    import('@/features/concepts/createVtgPreviewCandidate'),
    import('@/features/vtg/math/requiresPairedVtgCandidateLayout'),
  ])
  const selectionByReference = new Map(
    selections.map((selection) => [selection.reference, selection]),
  )
  const createCandidate = (reference: (typeof selections)[number]['reference']) => {
    const selection = selectionByReference.get(reference)
    return selection ? createVtgPreviewCandidate(selection, options) : undefined
  }
  const createBaselineCandidate = (reference: (typeof selections)[number]['reference']) => {
    const selection = selectionByReference.get(reference)
    if (!selection) return undefined
    const { properties: _properties, ...baselineOptions } = options
    return createVtgPreviewCandidate(selection, baselineOptions)
  }

  return requiresPairedVtgCandidateLayout(createCandidate, createBaselineCandidate)
}

const matchedVtg = (
  match: Extract<VtgPatternMatchResult, { source: 'vtg' }>['match'],
  exact: boolean,
): VtgPatternMatchResult => ({ status: 'matched', source: 'vtg', match, exact })

const matchedQtr = (
  match: Extract<VtgPatternMatchResult, { source: 'qtr' }>['match'],
  exact: boolean,
): VtgPatternMatchResult => ({ status: 'matched', source: 'qtr', match, exact })

const matchVtgPatternRequestAtCurrentDuration = async ({
  animation,
  preferences,
  source,
  rotationFilter,
  lastSelection,
}: VtgPatternMatchRequest): Promise<VtgPatternMatchResult> => {
  if (source !== 'vtg' && !rotationFilter && lastSelection && 'quarters' in lastSelection) {
    const { exactlyMatchesQtrSelection } = await import('@/features/vtg/qtr/matchQtrAnimation')
    if (exactlyMatchesQtrSelection(animation, lastSelection)) return { status: 'unchanged' }
  }

  const { exactlyMatchesVtgSelection, findVtgPatternMatchResolution } =
    await import('@/features/vtg/matchVtgAnimation')
  if (source !== 'qtr' && !rotationFilter && lastSelection && !('quarters' in lastSelection)) {
    if (exactlyMatchesVtgSelection(animation, lastSelection)) return { status: 'unchanged' }
  }

  const { findQtrPatternMatchResolution } = await import('@/features/vtg/qtr/matchQtrAnimation')
  const qtrResolution =
    source === 'vtg'
      ? undefined
      : findQtrPatternMatchResolution(animation, preferences, rotationFilter)
  const vtgResolution =
    source === 'qtr'
      ? undefined
      : findVtgPatternMatchResolution(animation, preferences, rotationFilter)
  const qtrMatch = qtrResolution?.match
  const vtgMatch = vtgResolution?.match
  const qtrExactlyRegenerates = qtrResolution?.exact ?? false
  const vtgExactlyRegenerates = vtgResolution?.exact ?? false

  if (qtrMatch && qtrExactlyRegenerates && vtgMatch && vtgExactlyRegenerates) {
    const qtrUsesPropRotation = qtrMatch.propRotationOffsets !== undefined
    const vtgUsesPropRotation = vtgMatch.propRotationOffsets !== undefined
    if (qtrUsesPropRotation !== vtgUsesPropRotation) {
      return qtrUsesPropRotation ? matchedVtg(vtgMatch, true) : matchedQtr(qtrMatch, true)
    }

    const qtrIsRotated = (qtrMatch.orientation ?? 0) !== 0
    const vtgIsRotated = (vtgMatch.orientation ?? 0) !== 0
    if (qtrIsRotated !== vtgIsRotated) {
      return qtrIsRotated ? matchedVtg(vtgMatch, true) : matchedQtr(qtrMatch, true)
    }

    const qtrBeat = qtrMatch.beat ?? 1
    const vtgBeat = vtgMatch.beat ?? 1
    const controlsDifferWithinCell =
      qtrMatch.reference === vtgMatch.reference &&
      (qtrBeat !== vtgBeat || (qtrMatch.orientation ?? 0) !== (vtgMatch.orientation ?? 0))
    if (controlsDifferWithinCell) {
      return matchedQtr(qtrMatch, true)
    }

    if (qtrBeat !== vtgBeat) {
      return qtrBeat < vtgBeat ? matchedQtr(qtrMatch, true) : matchedVtg(vtgMatch, true)
    }

    return qtrMatch.reference !== vtgMatch.reference
      ? matchedQtr(qtrMatch, true)
      : matchedVtg(vtgMatch, true)
  }

  if (qtrMatch && qtrExactlyRegenerates) {
    return matchedQtr(qtrMatch, true)
  }
  if (vtgMatch && vtgExactlyRegenerates) {
    return matchedVtg(vtgMatch, true)
  }

  if (vtgMatch?.orientation !== undefined || qtrMatch?.orientation !== undefined) {
    if (vtgMatch && vtgMatch.initialTurnsOffset === undefined) {
      return matchedVtg(vtgMatch, false)
    }
    if (qtrMatch && qtrMatch.initialTurnsOffset === undefined) {
      return matchedQtr(qtrMatch, false)
    }
    if (vtgMatch) return matchedVtg(vtgMatch, false)
    return qtrMatch ? matchedQtr(qtrMatch, false) : { status: 'unmatched' }
  }

  const {
    describePatternSelectionRelationships,
    inferPatternRelationshipOrientation,
    inferPatternRelationshipPropRotationOffsets,
  } = await import('@/features/concepts/math/describePatternSelectionRelationships')
  const { describePatternRelationships } =
    await import('@/features/concepts/math/describePatternRelationships')
  const actualRelationship = describePatternRelationships(animation).label
  const vtgRelationshipOffsets = vtgMatch
    ? inferPatternRelationshipPropRotationOffsets(animation, vtgMatch)
    : undefined
  const resolvedVtgMatch = vtgMatch
    ? {
        ...vtgMatch,
        ...(vtgRelationshipOffsets ? { propRotationOffsets: vtgRelationshipOffsets } : undefined),
      }
    : undefined
  const vtgPreservesRelationship =
    resolvedVtgMatch !== undefined &&
    describePatternSelectionRelationships(resolvedVtgMatch).label === actualRelationship
  if (vtgPreservesRelationship && resolvedVtgMatch.initialTurnsOffset === undefined) {
    return matchedVtg(resolvedVtgMatch, false)
  }

  const qtrRelationshipOrientation = qtrMatch
    ? inferPatternRelationshipOrientation(animation, qtrMatch)
    : undefined
  const qtrRelationshipSelection = qtrMatch
    ? {
        ...qtrMatch,
        ...(qtrRelationshipOrientation === undefined
          ? undefined
          : { orientation: qtrRelationshipOrientation }),
      }
    : undefined
  const qtrRelationshipOffsets = qtrRelationshipSelection
    ? qtrExactlyRegenerates
      ? undefined
      : inferPatternRelationshipPropRotationOffsets(animation, qtrRelationshipSelection)
    : undefined
  const resolvedQtrMatch = qtrMatch
    ? {
        ...qtrMatch,
        ...(qtrRelationshipOrientation === undefined
          ? undefined
          : { orientation: qtrRelationshipOrientation }),
        ...(qtrRelationshipOffsets ? { propRotationOffsets: qtrRelationshipOffsets } : undefined),
      }
    : undefined
  const qtrPreservesRelationship =
    resolvedQtrMatch !== undefined &&
    describePatternSelectionRelationships(resolvedQtrMatch).label === actualRelationship

  if (qtrPreservesRelationship && !vtgPreservesRelationship) {
    return matchedQtr(resolvedQtrMatch, false)
  }
  if (resolvedVtgMatch && resolvedVtgMatch.initialTurnsOffset === undefined) {
    return matchedVtg(resolvedVtgMatch, false)
  }

  if (resolvedQtrMatch && resolvedQtrMatch.initialTurnsOffset === undefined) {
    return matchedQtr(resolvedQtrMatch, false)
  }
  if (resolvedVtgMatch) return matchedVtg(resolvedVtgMatch, false)
  return resolvedQtrMatch ? matchedQtr(resolvedQtrMatch, false) : { status: 'unmatched' }
}

export const matchVtgPatternRequest = async (
  request: VtgPatternMatchRequest,
): Promise<VtgPatternMatchResult> => {
  const result = await matchVtgPatternRequestAtCurrentDuration(request)
  if (result.status !== 'unmatched') return result

  const { normalizeVtgPatternMatchCycle } =
    await import('@/features/vtg/math/normalizeVtgPatternMatchCycle')
  const normalized = normalizeVtgPatternMatchCycle(request.animation)
  if (!normalized) return result

  const normalizedResult = await matchVtgPatternRequestAtCurrentDuration({
    ...request,
    animation: normalized,
  })
  return normalizedResult.status === 'matched'
    ? { ...normalizedResult, exact: false }
    : normalizedResult
}

export const matchEightStepPatternRequest = async ({
  animation,
  lastSelection,
}: EightStepPatternMatchRequest): Promise<EightStepPatternMatchResult> => {
  const { findEightStepPatternMatch, matchesEightStepSelection } =
    await import('@/features/eight-step/matchEightStepAnimation')

  if (lastSelection && matchesEightStepSelection(animation, lastSelection)) {
    return { status: 'unchanged' }
  }

  const match = findEightStepPatternMatch(animation)
  return match ? { status: 'matched', match } : { status: 'unmatched' }
}

export const matchQstPatternRequest = async ({
  animation,
  preferences,
  lastSelection,
}: QstPatternMatchRequest): Promise<QstPatternMatchResult> => {
  const { findQstPatternMatch, matchesQstSelection } =
    await import('@/features/quarter-space-tech/matchQstAnimation')

  if (lastSelection && matchesQstSelection(animation, lastSelection)) {
    return { status: 'unchanged' }
  }

  const match = findQstPatternMatch(animation, preferences)
  return match ? { status: 'matched', match } : { status: 'unmatched' }
}
