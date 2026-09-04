import {
  clampVtgBpm,
  getVtgDistanceForScale,
  toVtgInternalScale,
  vtgPlayerSettings,
  vtgScaleControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import { qstAdvancedPages } from '@/features/quarter-space-tech/data/patterns/advanced'
import { qstBeyondPages } from '@/features/quarter-space-tech/data/patterns/beyond'
import { qstBreaksPages } from '@/features/quarter-space-tech/data/patterns/breaks'
import type {
  QstCatalogPage,
  QstCollectionDefinition,
  QstPatternDefinition,
  QstPatternReference,
  QstPatternSelection,
  QstPatternSwapPair,
  QstReadableAnimation,
} from '@/features/quarter-space-tech/types'
import { compactReadableAnimationFrames } from '@/math/animation/compressFrames'
import { toInternalScale } from '@/domain/animation/scale'

// The imported catalog is preserved in its historical tenths representation. Normalize it once at
// the catalog boundary so every exported definition follows the current hundredths contract.
const migrateLegacyQstPages = (pages: readonly QstCatalogPage[]): readonly QstCatalogPage[] =>
  pages.map((page) => ({
    ...page,
    patterns: page.patterns.map((pattern) => ({
      ...pattern,
      props: pattern.props.map((prop) => ({
        ...prop,
        anim: prop.anim.map((frame) => ({
          ...frame,
          ...(frame.scale === undefined ? undefined : { scale: toInternalScale(frame.scale / 10) }),
        })),
      })) as [(typeof pattern.props)[0], (typeof pattern.props)[1]],
    })),
  }))

const breaksPages = migrateLegacyQstPages(qstBreaksPages)
const advancedPages = migrateLegacyQstPages(qstAdvancedPages)
const beyondPages = migrateLegacyQstPages(qstBeyondPages)

const combinePagePairs = (pages: readonly QstCatalogPage[]): readonly QstCatalogPage[] =>
  Array.from({ length: Math.ceil(pages.length / 2) }, (_, index) => ({
    patterns: pages.slice(index * 2, index * 2 + 2).flatMap(({ patterns }) => patterns),
  }))

export const qstCollections = [
  {
    key: 'breaks',
    title: 'Quarter "Time" Breaks',
    level: 'Intermediate',
    description: 'Intermediate series where Breaks are introduced, expanding on the Fundamentals.',
    pages: breaksPages,
  },
  {
    key: 'advanced',
    title: 'Quarter "Time" Advanced',
    level: 'Advanced',
    description:
      'Advanced breaking series which continues to focus on quarter hand positions. Each four beat pattern is combined with another four beat pattern, specifically tailored to mess with the brain and muscle memory.',
    pages: combinePagePairs(advancedPages),
  },
  {
    key: 'beyond',
    title: 'Quarter Space Beyond',
    level: 'Master',
    description:
      'Master series which adds together / split hand positions to quarters. Each four beat pattern is combined with another four beat pattern, specifically tailored to mess with the brain and muscle memory.',
    pages: combinePagePairs(beyondPages),
  },
] as const satisfies readonly QstCollectionDefinition[]

const getCollectionPatterns = (
  collection: QstCollectionDefinition,
): readonly QstPatternDefinition[] => collection.pages.flatMap(({ patterns }) => patterns)

export const qstPatternDefinitions: readonly QstPatternDefinition[] =
  qstCollections.flatMap(getCollectionPatterns)

const qstPatternsPerPage = 8
const pageStartPartsByCollection = {
  breaks: [6, 7],
  beyond: [3, 4, 11],
} as const

const patternByProps = new Map(
  qstPatternDefinitions.map((pattern) => [JSON.stringify(pattern.props), pattern] as const),
)

const qstSwapPairs: readonly QstPatternSwapPair[] = qstPatternDefinitions.flatMap(
  (pattern, patternIndex) => {
    const swappedPattern = patternByProps.get(JSON.stringify([pattern.props[1], pattern.props[0]]))
    if (!swappedPattern || swappedPattern === pattern) return []

    const swappedPatternIndex = qstPatternDefinitions.indexOf(swappedPattern)
    return swappedPatternIndex > patternIndex ? [{ first: pattern, second: swappedPattern }] : []
  },
)

const qstSwapPairByReference = new Map<QstPatternReference, QstPatternSwapPair>(
  qstSwapPairs.flatMap((pair) => [
    [pair.first.reference, pair],
    [pair.second.reference, pair],
  ]),
)

export const getQstPatternSwapPair = (
  reference: QstPatternReference,
): QstPatternSwapPair | undefined => qstSwapPairByReference.get(reference)

const paginateQstPatterns = (
  patterns: readonly QstPatternDefinition[],
): readonly QstCatalogPage[] =>
  Array.from({ length: Math.ceil(patterns.length / qstPatternsPerPage) }, (_, index) => ({
    patterns: patterns.slice(index * qstPatternsPerPage, (index + 1) * qstPatternsPerPage),
  }))

export const getQstCatalogPages = (
  collection: QstCollectionDefinition,
  swapProps: boolean,
): readonly QstCatalogPage[] => {
  const visiblePatterns = getCollectionPatterns(collection).filter((pattern) => {
    const pair = getQstPatternSwapPair(pattern.reference)
    if (!pair) return true
    return pattern === (swapProps ? pair.second : pair.first)
  })

  const pageStartParts =
    collection.key === 'breaks' || collection.key === 'beyond'
      ? pageStartPartsByCollection[collection.key]
      : undefined

  if (pageStartParts) {
    const sectionStartIndexes = [0]
    for (const part of pageStartParts) {
      const sectionStartIndex = visiblePatterns.findIndex(({ caption }) =>
        [`Part ${part}:`, `Part ${part} `].some((captionPrefix) =>
          caption.startsWith(captionPrefix),
        ),
      )
      if (sectionStartIndex > (sectionStartIndexes.at(-1) ?? -1)) {
        sectionStartIndexes.push(sectionStartIndex)
      }
    }

    return sectionStartIndexes.flatMap((sectionStartIndex, index) =>
      paginateQstPatterns(visiblePatterns.slice(sectionStartIndex, sectionStartIndexes[index + 1])),
    )
  }

  return paginateQstPatterns(visiblePatterns)
}

export const getQstCanonicalPattern = (pattern: QstPatternDefinition): QstPatternDefinition =>
  getQstPatternSwapPair(pattern.reference)?.first ?? pattern

export const getQstDisplayPattern = (
  pattern: QstPatternDefinition,
  swapProps: boolean,
): QstPatternDefinition => {
  const pair = getQstPatternSwapPair(pattern.reference)
  return pair ? (swapProps ? pair.second : pair.first) : pattern
}

export const normalizeQstPairedSelection = (
  pattern: QstPatternDefinition,
  swapProps: boolean,
): { pattern: QstPatternDefinition; swapProps: boolean } => {
  const pair = getQstPatternSwapPair(pattern.reference)
  if (!pair) return { pattern, swapProps }
  return {
    pattern: pair.first,
    swapProps: swapProps !== (pattern === pair.second),
  }
}

export const getQstPatternDefinition = (
  reference: QstPatternReference,
): QstPatternDefinition | undefined =>
  qstPatternDefinitions.find((definition) => definition.reference === reference)

export const getQstCollectionPatternCount = (collection: QstCollectionDefinition) =>
  collection.pages.reduce((count, page) => count + page.patterns.length, 0)

const normalizeQstArc = (arc: number) => ((arc % 360) + 360) % 360

export const buildQstPattern = (
  selection: QstPatternSelection,
): QstReadableAnimation | undefined => {
  const definition = getQstPatternDefinition(selection.reference)
  if (!definition) return undefined

  const transformedProps = definition.props.map((prop) => {
    const frames = prop.anim.map((frame, frameIndex) => ({
      ...frame,
      ...(frame.arc === undefined ? undefined : { arc: normalizeQstArc(frame.arc) }),
      ...(frameIndex === 0 && selection.scale !== undefined
        ? { scale: toVtgInternalScale(selection.scale) }
        : undefined),
    }))

    return { ...prop, anim: compactReadableAnimationFrames(frames) }
  })

  return {
    ...vtgPlayerSettings,
    ...(selection.bpm === undefined ? undefined : { bpm: clampVtgBpm(selection.bpm) }),
    distance: getVtgDistanceForScale(selection.scale ?? vtgScaleControl.default),
    props: transformedProps,
  }
}
