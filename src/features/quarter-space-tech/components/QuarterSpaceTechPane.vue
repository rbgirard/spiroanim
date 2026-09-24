<template>
  <section
    ref="paneElement"
    class="quarter-space-tech-pane"
    aria-labelledby="quarter-space-tech-title"
    data-role="qst-pane"
    :style="propColorStyle"
  >
    <h1 id="quarter-space-tech-title" class="quarter-space-tech-pane__visually-hidden">
      Quarter Space Tech
    </h1>

    <div v-if="!selectedCollection" class="qst-landing" data-role="qst-collection-chooser">
      <header class="qst-landing__intro">
        <span class="qst-landing__eyebrow">Six positions. Infinite connections.</span>
        <p>Choose a library to explore its patterns.</p>
      </header>

      <div class="qst-collection-grid">
        <AppTooltip
          v-for="(collection, index) in qstCollections"
          :key="collection.key"
          class="qst-collection-tooltip"
          :text="`Open ${collection.title}`"
        >
          <template #activator="{ props: activatorProps }">
            <button
              v-bind="activatorProps"
              type="button"
              class="qst-collection-card"
              :class="`qst-collection-card--${collection.key}`"
              :data-collection="collection.key"
              data-role="qst-collection"
              @click="openCollection(collection)"
            >
              <span class="qst-collection-card__index" aria-hidden="true">0{{ index + 1 }}</span>
              <span class="qst-collection-card__level">{{ collection.level }}</span>
              <strong>{{ collection.title }}</strong>
              <span class="qst-collection-card__description">{{ collection.description }}</span>
              <span class="qst-collection-card__footer">
                {{ getQstCollectionPatternCount(collection) }} patterns
                <span aria-hidden="true">-&gt;</span>
              </span>
            </button>
          </template>
        </AppTooltip>
      </div>

      <aside class="qst-label-guide" data-role="qst-label-guide">
        <strong>Reading the pattern labels</strong>
        <p>
          Each two-letter label describes how the relationship between the props changes. The first
          letter is the starting relationship and the second is the ending relationship. For
          example, <b>TS</b> means Together to Split and <b>SQ</b> means Split to Quarter.
        </p>
        <dl>
          <div>
            <dt>T</dt>
            <dd>Together</dd>
          </div>
          <div>
            <dt>S</dt>
            <dd>Split</dd>
          </div>
          <div>
            <dt>Q</dt>
            <dd>Quarter</dd>
          </div>
          <div>
            <dt>F</dt>
            <dd>Follow</dd>
          </div>
          <div>
            <dt>FB</dt>
            <dd>Follow Break</dd>
          </div>
          <div>
            <dt>O</dt>
            <dd>Opposite</dd>
          </div>
          <div>
            <dt>OB</dt>
            <dd>Opposite Break</dd>
          </div>
        </dl>
        <p>
          Follow and Opposite describe special Quarter-to-Quarter transitions. A Break means the
          props travel through different planes.
        </p>
      </aside>

      <aside class="qst-history-note" data-role="qst-history-note">
        <strong>About this library</strong>
        <p>
          Quarter Space Tech predates SpiroAnim. The data contained here resulted from that project,
          an attempt to explore the possibilities of plane breaks while ignoring the back point and
          avoiding stalls that return to the same point. For historical purposes, and because some
          parties have expressed interest, this data has been made available in SpiroAnim.
        </p>
      </aside>

      <details class="qst-more" data-role="qst-more">
        <summary class="qst-more__toggle" data-role="qst-more-toggle">MORE...</summary>
        <div class="qst-more__content">
          <p>
            These are the original Quarter Space Tech documents. They are shared here for legacy
            purposes.
          </p>
          <ul>
            <li>
              <a
                href="/docs/qst/01_Quarter_Time_Breaks.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Quarter "Time" Breaks
              </a>
            </li>
            <li>
              <a
                href="/docs/qst/02_Quarter_Time_Advanced.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Quarter "Time" Advanced
              </a>
            </li>
            <li>
              <a
                href="/docs/qst/03_Quarter_Space_Beyond.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Quarter Space Beyond
              </a>
            </li>
          </ul>
        </div>
      </details>
    </div>

    <div v-else class="qst-library" data-role="qst-library">
      <header class="qst-library__header" data-role="qst-library-header">
        <AppTooltip text="Return to the QST libraries">
          <template #activator="{ props: activatorProps }">
            <button
              v-bind="activatorProps"
              type="button"
              class="qst-library__back"
              data-role="qst-back"
              @click="closeCollection"
            >
              <BaseIcon :path="mdiArrowLeft" :size="18" />
              Libraries
            </button>
          </template>
        </AppTooltip>
        <div>
          <span>{{ selectedCollection.level }}</span>
          <h2>{{ selectedCollection.title }}</h2>
          <p>{{ selectedCollection.description }}</p>
        </div>
      </header>

      <div class="qst-top-options" data-role="qst-transform-controls">
        <PatternTransformControls role-prefix="qst" @reset="resetPatternControls" />
      </div>

      <div class="qst-pagination-top" data-role="qst-pagination-top">
        <QstPagination
          :page-count="catalogPages.length"
          :page-index="pageIndex"
          @change="changePage"
        />
      </div>

      <QstCatalogPage
        :key="catalogPageKey"
        :page="currentPage"
        :selected-reference="selectedDisplayPattern?.reference"
        :selection-for="createSelection"
        @select="selectPattern"
      />

      <QstPagination
        data-role="qst-pagination-bottom"
        :page-count="catalogPages.length"
        :page-index="pageIndex"
        @change="changePage"
      />
    </div>

    <ConceptAnimationControls v-if="selectedCollection" :animation="animation" role-prefix="qst" />
  </section>
</template>

<script setup lang="ts">
import { mdiArrowLeft } from '@mdi/js'

import BaseIcon from '@/components/icons/BaseIcon.vue'
import { COLORS, COLSET } from '@/domain/animation/AnimStruct'
import ConceptAnimationControls from '@/features/concepts/components/ConceptAnimationControls.vue'
import AppTooltip from '@/components/AppTooltip.vue'
import PatternTransformControls from '@/features/concepts/components/PatternTransformControls.vue'
import { isPatternPropVisible } from '@/features/concepts/patternPropVisibility'
import { defaultPatternPropColors } from '@/features/concepts/patternPropColors'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import QstCatalogPage from '@/features/quarter-space-tech/components/QstCatalogPage.vue'
import QstPagination from '@/features/quarter-space-tech/components/QstPagination.vue'
import {
  getQstCanonicalPattern,
  getQstCatalogPages,
  getQstCollectionPatternCount,
  getQstDisplayPattern,
  normalizeQstPairedSelection,
  qstCollections,
} from '@/features/quarter-space-tech/data/qstPatternCatalog'
import type {
  QstCollectionDefinition,
  QstCollectionKey,
  QstPatternDefinition,
  QstPatternSelection,
} from '@/features/quarter-space-tech/types'
import {
  vtgBpmControl,
  vtgPlayerSettings,
  vtgPropSettings,
  vtgScaleControl,
  vtgSpacingControl,
  vtgThickControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import type { RootDataFinal } from '@/types/AnimTypes'
import { toColor } from '@/utils/UtilFunc'
import type { PatternMatchingClient } from '@/workers/pattern-matching/PatternMatchingWorkerTypes'

const props = withDefaults(
  defineProps<{
    animation?: RootDataFinal
    animationReady?: boolean
    patternMatcher?: PatternMatchingClient
  }>(),
  {
    animationReady: true,
  },
)

const emit = defineEmits<{
  patternSelect: [selection: QstPatternSelection]
  customize: [selection: QstPatternSelection]
}>()

const conceptsStore = useConceptsStore()
const {
  swapProps,
  reversePlane,
  bpm,
  scale,
  thick,
  spacing,
  paths,
  hands,
  arms,
  leftPropVisible,
  rightPropVisible,
  leftPropColor,
  rightPropColor,
  prop,
} = storeToRefs(conceptsStore)

const selectedCollection = shallowRef<QstCollectionDefinition>()
const selectedPattern = shallowRef<QstPatternDefinition>()
const pageIndex = ref(0)
const paneElement = ref<HTMLElement>()
const pageIndexByCollection = reactive<Record<QstCollectionKey, number>>({
  breaks: 0,
  advanced: 0,
  beyond: 0,
})

let suppressPatternEmit = false
let hydrationVersion = 0
let lastEmittedSelection: QstPatternSelection | undefined
let componentMounted = false
let initialAnimationHandled = false

const catalogPages = computed(() =>
  selectedCollection.value ? getQstCatalogPages(selectedCollection.value, swapProps.value) : [],
)

const currentPage = computed(() => {
  const page = catalogPages.value[pageIndex.value]
  if (!page) throw new Error('Quarter Space Tech collection page is unavailable')
  return page
})

const selectedDisplayPattern = computed(() => {
  if (!selectedCollection.value || !selectedPattern.value) return undefined
  return getQstDisplayPattern(selectedPattern.value, swapProps.value)
})

const getPropColor = (propIndex: 0 | 1) => {
  const fallback = vtgPropSettings[propIndex]
  if (!fallback) throw new Error(`Missing QST defaults for prop ${propIndex + 1}`)
  const colorIndex = props.animation?.props[propIndex]?.color ?? COLORS.indexOf(fallback.color)
  const colorSet = COLSET[colorIndex]
  if (!colorSet) throw new Error(`Missing QST prop color set for index ${colorIndex}`)
  return toColor(colorSet[0])
}

const propColorStyle = computed(() => ({
  '--qst-prop-first': getPropColor(0),
  '--qst-prop-second': getPropColor(1),
}))

const catalogPageKey = computed(
  () =>
    `${selectedCollection.value?.key}-${pageIndex.value}-${swapProps.value}-${reversePlane.value}-${scale.value}-${spacing.value}-${leftPropVisible.value}-${rightPropVisible.value}-${leftPropColor.value}-${rightPropColor.value}-${prop.value}`,
)

const createSelection = (pattern: QstPatternDefinition): QstPatternSelection => {
  const selectedDefinition = selectedCollection.value ? getQstCanonicalPattern(pattern) : pattern
  const selection: QstPatternSelection = {
    concept: 'qst',
    reference: selectedDefinition.reference,
    prop: prop.value,
  }

  if (swapProps.value) selection.swapProps = true
  if (reversePlane.value) selection.reversePlane = true
  if (bpm.value !== vtgBpmControl.default) selection.bpm = bpm.value
  if (scale.value !== vtgScaleControl.default) selection.scale = scale.value
  if (thick.value !== vtgThickControl.default) selection.thick = thick.value
  if (spacing.value !== vtgSpacingControl.default) selection.spacing = spacing.value
  if (paths.value !== vtgPlayerSettings.paths) selection.paths = paths.value
  if (hands.value !== vtgPlayerSettings.hands) selection.hands = hands.value
  if (arms.value !== vtgPlayerSettings.arms) selection.arms = arms.value
  if (!leftPropVisible.value) selection.left = false
  if (!rightPropVisible.value) selection.right = false
  if (
    leftPropColor.value !== defaultPatternPropColors[0] ||
    rightPropColor.value !== defaultPatternPropColors[1]
  ) {
    selection.propColors = [leftPropColor.value, rightPropColor.value]
  }

  return selection
}

const openCollection = (collection: QstCollectionDefinition) => {
  selectedCollection.value = collection
  const pages = getQstCatalogPages(collection, swapProps.value)
  const displayPattern = selectedPattern.value
    ? getQstDisplayPattern(selectedPattern.value, swapProps.value)
    : undefined
  const selectedPatternPageIndex = displayPattern
    ? pages.findIndex((page) =>
        page.patterns.some((pattern) => pattern.reference === displayPattern.reference),
      )
    : -1
  const nextPageIndex =
    selectedPatternPageIndex >= 0
      ? selectedPatternPageIndex
      : Math.min(pageIndexByCollection[collection.key], pages.length - 1)
  pageIndex.value = nextPageIndex
  pageIndexByCollection[collection.key] = nextPageIndex
  void scrollSelectedPatternIntoView()
}

const closeCollection = () => {
  selectedCollection.value = undefined
}

const changePage = (nextPageIndex: number) => {
  const pageCount = catalogPages.value.length
  if (nextPageIndex < 0 || nextPageIndex >= pageCount) return
  pageIndex.value = nextPageIndex
  if (selectedCollection.value) {
    pageIndexByCollection[selectedCollection.value.key] = nextPageIndex
  }
}

const selectPattern = (pattern: QstPatternDefinition) => {
  const selectedDefinition = selectedCollection.value ? getQstCanonicalPattern(pattern) : pattern
  selectedPattern.value = selectedDefinition
  emitPatternSelection(selectedDefinition)
}

const emitPatternSelection = (pattern: QstPatternDefinition) => {
  if (!suppressPatternEmit) hydrationVersion++

  const selection = createSelection(pattern)
  lastEmittedSelection = selection
  emit('patternSelect', selection)
}

const resetPatternControls = async () => {
  suppressPatternEmit = true
  conceptsStore.resetPatternControls()
  await nextTick()
  suppressPatternEmit = false
  if (selectedPattern.value) emitPatternSelection(selectedPattern.value)
}

watch([swapProps, reversePlane], () => {
  if (!suppressPatternEmit && selectedPattern.value) emitPatternSelection(selectedPattern.value)
})

watch(
  [
    bpm,
    scale,
    thick,
    spacing,
    paths,
    hands,
    arms,
    leftPropVisible,
    rightPropVisible,
    leftPropColor,
    rightPropColor,
    prop,
  ],
  () => {
    if (!suppressPatternEmit && selectedPattern.value) {
      emit('customize', createSelection(selectedPattern.value))
    }
  },
)

const findPatternLocation = (reference: QstPatternSelection['reference']) => {
  for (const collection of qstCollections) {
    for (const page of collection.pages) {
      const pattern = page.patterns.find((candidate) => candidate.reference === reference)
      if (pattern) return { collection, pattern }
    }
  }

  return undefined
}

const scrollSelectedPatternIntoView = async () => {
  const reference = selectedDisplayPattern.value?.reference
  if (!reference) return

  await nextTick()
  if (selectedDisplayPattern.value?.reference !== reference) return

  const card = paneElement.value?.querySelector<HTMLElement>(
    `[data-pattern-reference="${reference}"]`,
  )
  const viewport = paneElement.value?.closest<HTMLElement>('[data-concepts-pane]')
  if (!card || !viewport) return

  const cardRect = card.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  const isFullyVisible =
    cardRect.top >= viewportRect.top &&
    cardRect.bottom <= viewportRect.bottom &&
    cardRect.left >= viewportRect.left &&
    cardRect.right <= viewportRect.right
  if (isFullyVisible) return

  card.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' })
}

const matchPattern = async (request: Parameters<PatternMatchingClient['matchQst']>[0]) => {
  if (props.patternMatcher) return props.patternMatcher.matchQst(request)

  const { matchQstPatternRequest } =
    await import('@/workers/pattern-matching/handlePatternMatchingRequest')
  return matchQstPatternRequest(request)
}

const hydratePatternControls = async (animation: RootDataFinal) => {
  const version = ++hydrationVersion
  const selection = lastEmittedSelection
  lastEmittedSelection = undefined

  let result
  try {
    result = await matchPattern({
      animation,
      preferences: {
        swapProps: swapProps.value,
        reversePlane: reversePlane.value,
      },
      ...(selection ? { lastSelection: selection } : undefined),
    })
  } catch (error) {
    if (version === hydrationVersion && componentMounted) {
      console.warn('Quarter Space Tech pattern matching failed.', error)
    }
    return
  }

  if (version !== hydrationVersion || !componentMounted || props.animation !== animation) return
  if (result.status === 'unchanged') return

  suppressPatternEmit = true

  if (result.status === 'matched') {
    const location = findPatternLocation(result.match.reference)
    if (location) {
      const normalized = normalizeQstPairedSelection(location.pattern, result.match.swapProps)
      const pages = getQstCatalogPages(location.collection, normalized.swapProps)
      const displayPattern = getQstDisplayPattern(normalized.pattern, normalized.swapProps)
      const matchedPageIndex = pages.findIndex((page) =>
        page.patterns.some((pattern) => pattern.reference === displayPattern.reference),
      )
      const nextPageIndex = Math.max(0, matchedPageIndex)
      const selectionChanged =
        selectedCollection.value?.key !== location.collection.key ||
        selectedDisplayPattern.value?.reference !== displayPattern.reference ||
        pageIndex.value !== nextPageIndex
      selectedCollection.value = location.collection
      selectedPattern.value = normalized.pattern
      pageIndex.value = nextPageIndex
      pageIndexByCollection[location.collection.key] = pageIndex.value
      swapProps.value = normalized.swapProps
      // Customize rebuilds and rematches the current animation. Keep the user's scroll position
      // while editing its controls; only reveal a card when the displayed selection changes.
      if (selectionChanged) void scrollSelectedPatternIntoView()
    } else {
      swapProps.value = result.match.swapProps
    }
    reversePlane.value = result.match.reversePlane
    bpm.value = result.match.bpm
    scale.value = result.match.scale
    thick.value = animation.thick
    paths.value = animation.paths
    hands.value = animation.hands ?? vtgPlayerSettings.hands
    arms.value = animation.arms
    leftPropVisible.value = isPatternPropVisible(animation.props[0])
    rightPropVisible.value = isPatternPropVisible(animation.props[1])
    leftPropColor.value =
      animation.props[0]?.color === undefined
        ? defaultPatternPropColors[0]
        : COLORS[animation.props[0].color]
    rightPropColor.value =
      animation.props[1]?.color === undefined
        ? defaultPatternPropColors[1]
        : COLORS[animation.props[1].color]
    prop.value = animation.prop
  } else {
    selectedCollection.value = undefined
    selectedPattern.value = undefined
    pageIndex.value = 0
  }

  void nextTick(() => {
    if (version === hydrationVersion) suppressPatternEmit = false
  })
}

const syncPatternControls = () => {
  if (!componentMounted || !props.animationReady || !props.animation) return

  if (props.animation.props.length === 0) {
    if (initialAnimationHandled) return
    initialAnimationHandled = true
    selectedCollection.value = undefined
    selectedPattern.value = undefined
    pageIndex.value = 0
    return
  }

  initialAnimationHandled = true
  void hydratePatternControls(props.animation)
}

watch([() => props.animationReady, () => props.animation], syncPatternControls)

onMounted(() => {
  componentMounted = true
  syncPatternControls()
})

onBeforeUnmount(() => {
  componentMounted = false
  hydrationVersion++
})

defineExpose({
  selectedCollection,
  selectedPattern,
  pageIndex,
})
</script>

<style scoped>
.quarter-space-tech-pane {
  container-name: concept-pane;
  container-type: inline-size;
  width: 100%;
  min-inline-size: 0;
  min-block-size: 0;
  padding-block-end: var(--size-pane-switch-bottom-clearance);
  color: var(--color-text);
}

.qst-top-options {
  display: flex;
  min-width: var(--size-concept-content-min-width);
  padding: var(--space-2) var(--space-2) 0;
  justify-content: center;
}

.qst-label-guide,
.qst-history-note {
  width: min(100%, 45rem);
  padding: var(--space-3) var(--space-4);
  margin: var(--space-4) auto 0;
  border-radius: var(--radius-md);
}

.qst-label-guide {
  background: color-mix(in srgb, var(--qst-prop-first) 7%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--qst-prop-first) 34%, var(--color-border));
}

.qst-history-note {
  background: color-mix(in srgb, var(--color-action-primary) 8%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-action-primary) 38%, var(--color-border));
}

.qst-label-guide strong,
.qst-history-note strong {
  color: var(--color-text);
  font-size: 0.78rem;
}

.qst-label-guide p,
.qst-history-note p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}

.qst-label-guide dl {
  display: flex;
  margin: var(--space-3) 0;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.qst-label-guide dl > div {
  display: flex;
  min-inline-size: 6.5rem;
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  align-items: center;
  gap: var(--space-2);
}

.qst-label-guide dt {
  min-inline-size: 1.5rem;
  color: var(--qst-prop-first);
  font-size: 0.75rem;
  font-weight: 800;
  text-align: center;
}

.qst-label-guide dd {
  margin: 0;
  color: var(--color-text);
  font-size: 0.72rem;
}

.qst-landing,
.qst-library {
  min-inline-size: var(--size-concept-content-min-width);
}

.qst-landing {
  padding: clamp(var(--space-3), 4cqi, var(--space-8));
}

.qst-landing__intro {
  position: relative;
  padding: clamp(var(--space-4), 5cqi, var(--space-8));
  overflow: hidden;
  text-align: center;
  background:
    radial-gradient(
      circle at 20% 0%,
      color-mix(in srgb, var(--qst-prop-first) 20%, transparent),
      transparent 38%
    ),
    radial-gradient(
      circle at 82% 100%,
      color-mix(in srgb, var(--qst-prop-second) 18%, transparent),
      transparent 40%
    ),
    var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.qst-landing__eyebrow,
.qst-library__header > div > span {
  color: var(--color-action-primary);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.qst-landing__intro p {
  margin: var(--space-2) 0 0;
  color: var(--color-text-muted);
}

.qst-collection-grid {
  display: grid;
  margin-block-start: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: var(--space-3);
}

.qst-collection-card {
  --qst-collection-accent: var(--color-action-primary);

  appearance: none;
  position: relative;
  display: grid;
  min-block-size: 15rem;
  padding: var(--space-4);
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  color: var(--color-text);
  text-align: start;
  cursor: pointer;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--qst-collection-accent) 14%, transparent),
      transparent 56%
    ),
    var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--qst-collection-accent) 38%, var(--color-border));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  gap: var(--space-2);
  overflow: hidden;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.qst-collection-tooltip {
  display: flex;
  min-width: 0;
}

.qst-collection-tooltip > .qst-collection-card {
  width: 100%;
}

.qst-collection-card--advanced {
  --qst-collection-accent: var(--qst-prop-first);
}

.qst-collection-card--beyond {
  --qst-collection-accent: var(--qst-prop-second);
}

.qst-collection-card:hover {
  border-color: var(--qst-collection-accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.qst-collection-card:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.qst-collection-card__index {
  position: absolute;
  inset-block-start: -0.18em;
  inset-inline-end: var(--space-3);
  color: color-mix(in srgb, var(--qst-collection-accent) 13%, transparent);
  font-size: 5.5rem;
  font-weight: 900;
  line-height: 1;
}

.qst-collection-card__level {
  z-index: 1;
  width: max-content;
  padding: 0.2rem 0.55rem;
  color: var(--color-text);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: color-mix(in srgb, var(--qst-collection-accent) 20%, var(--color-surface));
  border-radius: 999px;
}

.qst-collection-card strong {
  z-index: 1;
  max-inline-size: 13rem;
  margin-block-start: var(--space-3);
  font-size: 1.3rem;
  line-height: 1.1;
}

.qst-collection-card__description {
  z-index: 1;
  color: var(--color-text-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.qst-collection-card__footer {
  z-index: 1;
  display: flex;
  margin-block-start: auto;
  color: var(--qst-collection-accent);
  font-size: 0.78rem;
  font-weight: 800;
  justify-content: space-between;
}

.qst-library__header {
  display: grid;
  padding: var(--space-3) var(--space-4);
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-action-primary) 9%, transparent),
    transparent
  );
  border-block: 1px solid var(--color-border);
}

.qst-library__back {
  display: flex;
  padding: var(--space-2);
  color: var(--color-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  align-items: center;
  gap: var(--space-1);
}

.qst-library__back:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.qst-library__header h2 {
  margin: 0.1rem 0 0;
  font-size: clamp(1.2rem, 4cqi, 1.8rem);
}

.qst-library__header p {
  max-inline-size: 55rem;
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  line-height: 1.4;
}

.qst-pagination-top {
  display: block;
}

.qst-more {
  width: min(calc(100% - var(--space-4)), 45rem);
  min-width: calc(var(--size-concept-content-min-width) - var(--space-4));
  margin: var(--space-3) auto 0;
  color: var(--color-text);
  font-size: 0.875rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.qst-more__toggle {
  display: flex;
  padding: var(--space-3) var(--space-4);
  color: var(--color-action-primary);
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  list-style: none;
  background: color-mix(in srgb, var(--color-action-primary) 7%, var(--color-surface));
  align-items: center;
  justify-content: space-between;
  transition: background var(--transition-fast);
}

.qst-more__toggle::-webkit-details-marker {
  display: none;
}

.qst-more__toggle::after {
  content: '+';
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1;
}

.qst-more[open] .qst-more__toggle {
  background: color-mix(in srgb, var(--color-action-primary) 13%, var(--color-surface));
  border-block-end: 1px solid var(--color-border);
}

.qst-more[open] .qst-more__toggle::after {
  content: '-';
}

.qst-more__toggle:hover {
  background: color-mix(in srgb, var(--color-action-primary) 13%, var(--color-surface));
}

.qst-more__toggle:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: -3px;
}

.qst-more__content {
  padding: var(--space-4);
}

.qst-more__content p {
  margin: 0 0 var(--space-3);
  color: var(--color-text-muted);
  line-height: 1.45;
}

.qst-more__content ul {
  display: grid;
  padding-inline-start: var(--space-6);
  margin: 0;
  gap: var(--space-2);
}

.qst-more__content a {
  color: var(--color-action-primary);
}

.quarter-space-tech-pane__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}
</style>
