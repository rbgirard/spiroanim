<template>
  <section
    ref="paneElement"
    class="eight-step-pane"
    aria-labelledby="eight-step-pane-title"
    data-role="eight-step-pane"
    :data-selected-cell="selectedCell?.reference"
  >
    <h1 id="eight-step-pane-title" class="eight-step-pane__visually-hidden">
      Eight Step generator
    </h1>

    <div class="eight-step-top-options">
      <PatternTransformControls role-prefix="eight-step" @reset="resetPatternControls">
        <template #before-reset>
          <PatternShapeControls v-model:shape="shape" role-prefix="eight-step" />
        </template>
      </PatternTransformControls>
    </div>

    <div class="eight-step-board" :style="headColorStyle" data-role="eight-step-board">
      <AppTooltip class="eight-step-shuffle-tooltip" text="Select a random Eight Step pattern">
        <template #activator="{ props: activatorProps }">
          <button
            v-bind="activatorProps"
            type="button"
            class="eight-step-shuffle"
            aria-label="Shuffle Eight Step patterns"
            data-role="eight-step-shuffle"
            @click="selectRandomCell"
          >
            <BaseIcon :path="mdiShuffleVariant" size="42%" />
          </button>
        </template>
      </AppTooltip>

      <AppTooltip
        v-for="group in columnGroups"
        :key="group.label"
        class="eight-step-column-tooltip"
        :text="`Select the ${group.label} column group`"
        :style="{ gridColumn: `${group.columns[0] + 1} / span 2` }"
      >
        <template #activator="{ props: activatorProps }">
          <button
            v-bind="activatorProps"
            class="eight-step-column-header"
            :class="{
              'eight-step-header--accent': isColumnGroupHighlighted(group),
            }"
            :style="{ gridColumn: `${group.columns[0] + 1} / span 2` }"
            :aria-label="`${group.label}, columns ${group.columns.join(' and ')}`"
            :aria-pressed="isColumnGroupHighlighted(group)"
            data-role="eight-step-column-header"
            @click="selectColumnGroup(group)"
          >
            {{ group.label }}
          </button>
        </template>
      </AppTooltip>

      <BaseTooltip
        v-for="(row, rowIndex) in eightStepRows"
        :key="`row-${row}`"
        class="eight-step-row-tooltip"
        :text="getRowDescription(row)"
        :style="{ gridRow: rowIndex + 2 }"
      >
        <template #activator="{ props: activatorProps }">
          <button
            v-bind="activatorProps"
            type="button"
            class="eight-step-row-header"
            :class="{
              'eight-step-header--accent': row === selectedCell?.row,
            }"
            :aria-label="row"
            :aria-pressed="row === selectedCell?.row"
            data-role="eight-step-row-header"
            @click="selectRow(row)"
          >
            <span class="eight-step-row-header__first">{{ row[0] }}</span>
            <span class="eight-step-row-header__second">{{ row[1] }}</span>
          </button>
        </template>
      </BaseTooltip>

      <BaseTooltip
        v-for="cell in cells"
        :key="cell.reference"
        class="eight-step-cell-tooltip"
        :text="getCellDescription(cell)"
        :style="cell.style"
      >
        <template #activator="{ props: activatorProps }">
          <button
            v-bind="activatorProps"
            type="button"
            class="eight-step-cell"
            :class="{
              'eight-step-cell--highlighted': isCellHighlighted(cell),
              'eight-step-cell--marked': isMarkedCellVisible(cell),
              'eight-step-cell--selected': cell.reference === selectedCell?.reference,
            }"
            :aria-label="`${getCellDescription(cell)}, cell ${cell.reference}`"
            :aria-pressed="cell.reference === selectedCell?.reference"
            :data-board-column="cell.column"
            :data-board-row="cell.row"
            :data-cell-reference="cell.reference"
            :data-preview-row-index="cell.rowIndex"
            data-role="eight-step-cell"
            @click="selectCell(cell)"
          >
            <img
              v-if="previewUrls[cell.rowIndex]"
              :src="previewUrls[cell.rowIndex]"
              alt=""
              class="eight-step-cell__preview"
              data-role="eight-step-preview"
              :data-preview-reference="eightStepPreviewReferences[cell.rowIndex]"
            />
          </button>
        </template>
        <template #html>
          <span class="eight-step-cell-tooltip__text">{{ getCellDescription(cell) }}</span>
        </template>
      </BaseTooltip>
    </div>

    <ConceptAnimationControls :animation="animation" role-prefix="eight-step">
      <template #before-customize>
        <PatternPropertyControls
          v-if="!builderActive && animation && selectedCell"
          context="eight-step"
          :animation="animation"
          :offset-values="propRotationOffsets"
          :twist-mode="vtgTwistMode"
          :twist-values="vtgTwistValues"
          :fold-values="vtgFoldValues"
          :fold-values-materialized="vtgFoldValuesMaterialized"
          :fold-mode="vtgFoldMode"
          :fold-beat="vtgFoldBeat"
          :fold-repeat="vtgFoldRepeat"
          :fold-every="vtgFoldEvery"
          :fold-alternate="vtgFoldAlternate"
          :fold-span="vtgFoldSpan"
          :fold-mirror="vtgFoldMirror"
          :active-property="vtgActiveProperty"
          :sliders="sliders"
          @offset-update="updatePropRotationOffset"
          @twist-update="updateTwistSetting"
          @fold-update="updateFoldSetting"
          @update:twist-mode="updateTwistMode"
          @update:fold-mode="updateFoldMode"
          @update:fold-beat="updateFoldBeat"
          @update:fold-repeat="updateFoldRepeat"
          @update:fold-every="updateFoldEvery"
          @update:fold-alternate="updateFoldAlternate"
          @update:fold-span="updateFoldSpan"
          @update:fold-mirror="updateFoldMirror"
          @update:active-property="vtgActiveProperty = $event === 'scale' ? null : $event"
        />
      </template>
    </ConceptAnimationControls>

    <PatternWorkspaceToggle
      label="Pattern Viewer"
      control-role="eight-step-pattern-builder"
      :checked="builderActive"
      :disabled="selectedCell === undefined"
      @toggle="emit('builderOpen', 'manual')"
    />

    <p v-if="shape === 'box'" class="eight-step-development-note" data-role="eight-step-box-note">
      Tilted / Box mode is experimental, and its patterns have not been validated. Difficult /
      Impossible highlighting for patterns performed in Wall-Plane is disabled.
    </p>
    <p
      v-else
      class="eight-step-development-note eight-step-development-note--diamond"
      data-role="eight-step-diamond-note"
    >
      Patterns highlighted in <strong class="eight-step-legend-color--difficult">yellow</strong>, or
      <strong class="eight-step-legend-color--selected">red when selected</strong>, may be difficult
      or impossible to perform in Wall-Plane without significant modification.
    </p>

    <details class="eight-step-more" data-role="eight-step-more">
      <summary class="eight-step-more__toggle" data-role="eight-step-more-toggle">MORE...</summary>
      <div class="eight-step-more__content" data-role="eight-step-more-content">
        <p>8-Step Concepts by Gage DeMello.</p>
        <ul class="eight-step-more__links">
          <li>
            <a href="/docs/8-step/Handpaths_swapped.pdf" target="_blank" rel="noopener noreferrer">
              Handpaths.pdf
            </a>
          </li>
          <li>
            <a
              href="/docs/8-step/TeachingSheets_swapped.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              TeachingSheets.pdf
            </a>
          </li>
          <li>
            <a href="/docs/8-step/TeachingSheets.pdf" target="_blank" rel="noopener noreferrer">
              HandpathsV2.pdf
            </a>
            <span>
              - Additional highlights / notes that I personally added for myself to reference from
              printed copies.
            </span>
          </li>
        </ul>
        <p class="eight-step-more__print-note">
          Printing from Adobe Acrobat or Adobe Acrobat Reader is recommended. Printing from a web
          browser may distort some elements.
        </p>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { mdiShuffleVariant } from '@mdi/js'

import BaseIcon from '@/components/icons/BaseIcon.vue'
import BaseTooltip from '@/components/ui/BaseTooltip.vue'
import PatternPropertyControls from '@/components/pattern/PatternPropertyControls.vue'
import { COLORS, COLSET } from '@/domain/animation/AnimStruct'
import ConceptAnimationControls from '@/features/concepts/components/ConceptAnimationControls.vue'
import AppTooltip from '@/components/AppTooltip.vue'
import PatternTransformControls from '@/features/concepts/components/PatternTransformControls.vue'
import PatternWorkspaceToggle from '@/features/concepts/components/PatternWorkspaceToggle.vue'
import { usePatternPropertyControls } from '@/features/concepts/composables/usePatternPropertyControls'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { isPatternPropVisible } from '@/features/concepts/patternPropVisibility'
import { defaultPatternPropColors } from '@/features/concepts/patternPropColors'
import {
  eightStepPreviewReferences,
  useEightStepPreviews,
} from '@/features/eight-step/composables/useEightStepPreviews'
import PatternShapeControls from '@/features/concepts/components/PatternShapeControls.vue'
import type { ComposerCell } from '@/features/kinetic-alphabet/composerBridge'
import { eightStepPatternDefinitions } from '@/features/eight-step/data/eightStepPatternDefinitions'
import { eightStepRows } from '@/features/eight-step/types'
import type {
  EightStepColumn,
  EightStepPatternDefinition,
  EightStepPatternSelection,
  EightStepShape,
} from '@/features/eight-step/types'
import {
  vtgBpmControl,
  vtgPlayerSettings,
  vtgPropSettings,
  vtgScaleControl,
  vtgSpacingControl,
  vtgThickControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import type { RootDataFinal } from '@/types/AnimTypes'
import { applyVtgPropRotationOffsets } from '@/features/vtg/createVtgAnimation'
import { toColor } from '@/utils/UtilFunc'
import type { PatternMatchingClient } from '@/workers/pattern-matching/PatternMatchingWorkerTypes'

const props = withDefaults(
  defineProps<{
    animation?: RootDataFinal
    animationReady?: boolean
    builderActive?: boolean
    patternMatcher?: PatternMatchingClient
  }>(),
  {
    animationReady: true,
  },
)

const emit = defineEmits<{
  patternSelect: [selection: EightStepPatternSelection]
  customize: [selection: EightStepPatternSelection]
  animationUpdate: [animation: RootDataFinal]
  builderOpen: [source: 'manual']
  patternMatched: []
  composerCellChange: [cell: ComposerCell | null]
}>()

interface EightStepCell extends EightStepPatternDefinition {
  rowIndex: number
  style: {
    gridColumn: number
    gridRow: number
  }
}

interface EightStepColumnGroup {
  label: string
  columns: readonly [EightStepColumn, EightStepColumn]
}

const columnGroups = [
  { label: 'Opposite', columns: [1, 2] },
  { label: 'Same', columns: [3, 4] },
  { label: 'Quarter Aligned', columns: [5, 6] },
  { label: 'Quarter Opposed', columns: [7, 8] },
] as const satisfies readonly EightStepColumnGroup[]

const rowDescriptions = {
  AA: 'Anti vs Anti',
  AE: 'Anti vs Ext',
  AI: 'Anti vs In',
  EA: 'Ext vs Anti',
  EE: 'Ext vs Ext',
  EI: 'Ext vs In',
  IA: 'In vs Anti',
  IE: 'In vs Ext',
  II: 'In vs In',
} as const satisfies Readonly<Record<(typeof eightStepRows)[number], string>>

const getRowDescription = (row: (typeof eightStepRows)[number]) => rowDescriptions[row]

const getCellDescription = (cell: EightStepPatternDefinition) => {
  const group = columnGroups.find(({ columns }) => columns.some((column) => column === cell.column))
  if (!group) throw new Error(`Missing Eight Step column group for column ${cell.column}`)
  return `${group.label}\n${getRowDescription(cell.row)}`
}

const markedCellReferences: ReadonlySet<string> = new Set([
  '1-AE',
  '1-AI',
  '2-AE',
  '2-AI',
  '3-EE',
  '3-EI',
  '3-IE',
  '3-II',
  '4-EE',
  '4-EI',
  '4-IE',
  '4-II',
  '5-EE',
  '5-EI',
  '5-IE',
  '5-II',
  '6-EE',
  '6-EI',
  '6-IE',
  '6-II',
  '7-AE',
  '7-AI',
  '8-AE',
  '8-AI',
])

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
  sliders,
} = storeToRefs(conceptsStore)
const selectedCell = ref<EightStepPatternDefinition>()
const shape = ref<EightStepShape>('diamond')
const propRotationOffsets = ref<EightStepPatternSelection['propRotationOffsets']>()

/**
 * Cell identity for the Flow Arts Composer bridge. This describes which catalog cell the loaded
 * animation is, so it is reported for hydration-driven matches too and is deliberately outside
 * `suppressPatternEmit`, which exists to stop hydration from re-applying a pattern.
 */
const composerCell = computed<ComposerCell | null>(() => {
  const cell = selectedCell.value
  if (!cell) return null

  return { concept: '8stp', reference: cell.reference, shape: shape.value }
})

watch(
  () => JSON.stringify(composerCell.value),
  () => emit('composerCellChange', composerCell.value),
  { immediate: true },
)

let suppressPatternEmit = false
let hydrationVersion = 0
let lastEmittedSelection: EightStepPatternSelection | undefined
let componentMounted = false
let initialAnimationHandled = false
let pendingPropertyAnimation: RootDataFinal | undefined

const emitPropertyAnimation = (animation: RootDataFinal) => {
  pendingPropertyAnimation = animation
  emit('animationUpdate', animation)
}

const {
  vtgTwistMode,
  vtgTwistValues,
  vtgFoldValues,
  vtgFoldValuesMaterialized,
  vtgFoldMode,
  vtgFoldBeat,
  vtgFoldRepeat,
  vtgFoldEvery,
  vtgFoldAlternate,
  vtgFoldSpan,
  vtgFoldMirror,
  vtgActiveProperty,
  updateTwistSetting,
  updateTwistMode,
  updateFoldSetting,
  updateFoldMode,
  updateFoldBeat,
  updateFoldRepeat,
  updateFoldEvery,
  updateFoldAlternate,
  updateFoldSpan,
  updateFoldMirror,
} = usePatternPropertyControls({
  animation: toRef(props, 'animation'),
  onAnimationUpdate: emitPropertyAnimation,
})

const cells: readonly EightStepCell[] = eightStepPatternDefinitions.map((definition) => ({
  ...definition,
  rowIndex: eightStepRows.indexOf(definition.row),
  style: {
    gridColumn: definition.column + 1,
    gridRow: eightStepRows.indexOf(definition.row) + 2,
  },
}))

const getPropColor = (propIndex: 0 | 1, colorPart: 0 | 1 | 2) => {
  const sourcePropIndex = swapProps.value ? propIndex : propIndex === 0 ? 1 : 0
  const fallbackSettings = vtgPropSettings[sourcePropIndex]
  if (!fallbackSettings)
    throw new Error(`Missing Eight Step defaults for prop ${sourcePropIndex + 1}`)
  const fallbackColor = fallbackSettings.color
  const colorIndex = props.animation?.props[sourcePropIndex]?.color ?? COLORS.indexOf(fallbackColor)
  const colorSet = COLSET[colorIndex]
  if (!colorSet) throw new Error(`Missing Eight Step prop color set for index ${colorIndex}`)
  return toColor(colorSet[colorPart])
}

const headColorStyle = computed(() => ({
  '--eight-step-first-head': getPropColor(0, 0),
  '--eight-step-first-tether': getPropColor(0, 2),
  '--eight-step-second-head': getPropColor(1, 0),
  '--eight-step-second-tether': getPropColor(1, 2),
}))

const paneElement = ref<HTMLElement>()
const previewDimensions = reactive(eightStepPreviewReferences.map(() => ({ width: 0, height: 0 })))
const { previewUrls, requestPreviews } = useEightStepPreviews({
  dimensions: previewDimensions,
  swapProps,
  reversePlane,
  scale,
  spacing,
  shape,
  leftPropColor,
  rightPropColor,
  prop,
})

let previewObserver: ResizeObserver | undefined

const roundDimension = (value: number) => Math.round(value * 100) / 100

const isCellHighlighted = (cell: EightStepPatternDefinition) =>
  selectedCell.value !== undefined &&
  (cell.column === selectedCell.value.column || cell.row === selectedCell.value.row)

const isMarkedCell = (cell: EightStepPatternDefinition) => markedCellReferences.has(cell.reference)

const isMarkedCellVisible = (cell: EightStepPatternDefinition) =>
  shape.value === 'diamond' && isMarkedCell(cell)

const isColumnGroupHighlighted = (group: EightStepColumnGroup) =>
  selectedCell.value !== undefined &&
  group.columns.some((column) => column === selectedCell.value?.column)

const createSelection = (cell: EightStepPatternDefinition): EightStepPatternSelection => {
  const selection: EightStepPatternSelection = {
    concept: '8stp',
    reference: cell.reference,
    prop: prop.value,
  }

  if (swapProps.value) selection.swapProps = true
  if (reversePlane.value) selection.reversePlane = true
  if (shape.value !== 'diamond') selection.shape = shape.value
  if (bpm.value !== vtgBpmControl.default) selection.bpm = bpm.value
  if (scale.value !== vtgScaleControl.default) selection.scale = scale.value
  if (propRotationOffsets.value !== undefined)
    selection.propRotationOffsets = propRotationOffsets.value
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

const emitPatternSelection = (cell: EightStepPatternDefinition) => {
  if (!suppressPatternEmit) hydrationVersion++

  const selection = createSelection(cell)
  lastEmittedSelection = selection
  emit('patternSelect', selection)
}

const selectCell = (cell: EightStepPatternDefinition) => {
  selectedCell.value = cell
  emitPatternSelection(cell)
}

const selectRandomCell = () => {
  const cell = cells[Math.floor(Math.random() * cells.length)]
  if (!cell) throw new Error('Cannot select a random Eight Step cell from an empty matrix')
  selectCell(cell)
}

const selectRandomCellFrom = (matchingCells: readonly EightStepCell[]) => {
  const cell = matchingCells[Math.floor(Math.random() * matchingCells.length)]
  if (!cell) throw new Error('Cannot select a random Eight Step cell from an empty line')
  selectCell(cell)
}

const selectRow = (row: (typeof eightStepRows)[number]) => {
  const column = selectedCell.value?.column
  const cell =
    column === undefined
      ? undefined
      : cells.find((item) => item.column === column && item.row === row)

  if (cell) selectCell(cell)
  else selectRandomCellFrom(cells.filter((item) => item.row === row))
}

const selectColumnGroup = (group: EightStepColumnGroup) => {
  const currentColumn = selectedCell.value?.column
  const currentIndex = currentColumn === undefined ? -1 : group.columns.indexOf(currentColumn)
  const column = currentIndex === 0 ? group.columns[1] : group.columns[0]
  const row = selectedCell.value?.row
  const cell =
    row === undefined ? undefined : cells.find((item) => item.column === column && item.row === row)

  if (cell) selectCell(cell)
  else selectRandomCellFrom(cells.filter((item) => item.column === column))
}

const updatePropRotationOffset = (propIndex: 0 | 1, value?: number) => {
  if (!props.animation) return
  const previous: readonly [number, number] = propRotationOffsets.value ?? [0, 0]
  const next: [number, number] = [...previous]
  next[propIndex] = value ?? 0
  const delta: [number, number] = [next[0] - previous[0], next[1] - previous[1]]
  propRotationOffsets.value = next.every((offset) => offset === 0) ? undefined : next
  emitPropertyAnimation(applyVtgPropRotationOffsets(props.animation, delta))
}

const resetPatternControls = async () => {
  suppressPatternEmit = true
  conceptsStore.resetPatternControls()
  shape.value = 'diamond'
  propRotationOffsets.value = undefined
  await nextTick()
  suppressPatternEmit = false
  if (selectedCell.value) emitPatternSelection(selectedCell.value)
}

watch([swapProps, reversePlane, shape], () => {
  if (!suppressPatternEmit && selectedCell.value) emitPatternSelection(selectedCell.value)
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
    if (!suppressPatternEmit && selectedCell.value)
      emit('customize', createSelection(selectedCell.value))
  },
)

const matchPattern = async (request: Parameters<PatternMatchingClient['matchEightStep']>[0]) => {
  if (props.patternMatcher) return props.patternMatcher.matchEightStep(request)

  const { matchEightStepPatternRequest } =
    await import('@/workers/pattern-matching/handlePatternMatchingRequest')
  return matchEightStepPatternRequest(request)
}

const hydratePatternControls = async (animation: RootDataFinal) => {
  const version = ++hydrationVersion
  const shouldHydratePropertyControls = pendingPropertyAnimation !== toRaw(animation)
  pendingPropertyAnimation = undefined
  if (shouldHydratePropertyControls) conceptsStore.hydrateVtgPropertyControls(animation)
  const selection = lastEmittedSelection
  lastEmittedSelection = undefined

  let result
  try {
    result = await matchPattern({
      animation,
      ...(selection ? { lastSelection: selection } : undefined),
    })
  } catch (error) {
    if (version === hydrationVersion && componentMounted) {
      console.warn('Eight Step pattern matching failed.', error)
    }
    return
  }

  if (version !== hydrationVersion || !componentMounted || props.animation !== animation) return
  if (result.status === 'unchanged') {
    emit('patternMatched')
    return
  }

  const match = result.status === 'matched' ? result.match : undefined
  suppressPatternEmit = true

  if (match) {
    emit('patternMatched')
    selectedCell.value = cells.find(({ reference }) => reference === match.reference)
    swapProps.value = match.swapProps
    reversePlane.value = match.reversePlane
    shape.value = match.shape
    bpm.value = match.bpm
    scale.value = match.scale
    propRotationOffsets.value = match.propRotationOffsets
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
    selectedCell.value = undefined
    propRotationOffsets.value = undefined
  }

  void nextTick(() => {
    if (version === hydrationVersion) suppressPatternEmit = false
  })
}

const selectInitialRandomPattern = () => {
  const version = ++hydrationVersion
  suppressPatternEmit = true
  conceptsStore.resetPatternControls()
  shape.value = 'diamond'
  propRotationOffsets.value = undefined
  selectRandomCell()

  void nextTick(() => {
    if (version === hydrationVersion) suppressPatternEmit = false
  })
}

const syncPatternControls = () => {
  if (!componentMounted || !props.animationReady || !props.animation) return

  if (props.animation.props.length === 0) {
    if (initialAnimationHandled) return
    initialAnimationHandled = true
    selectInitialRandomPattern()
    return
  }

  initialAnimationHandled = true
  void hydratePatternControls(props.animation)
}

watch([() => props.animationReady, () => props.animation], syncPatternControls)

onMounted(() => {
  componentMounted = true
  syncPatternControls()

  if (typeof ResizeObserver === 'undefined') return

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (!(entry.target instanceof HTMLElement)) continue

      const rowIndex = Number(entry.target.dataset.previewRowIndex)
      const dimensions = previewDimensions[rowIndex]
      if (!dimensions) continue

      dimensions.width = roundDimension(entry.contentRect.width * 0.78)
      dimensions.height = roundDimension(entry.contentRect.height * 0.78)
    }
    requestPreviews()
  })
  previewObserver = observer

  paneElement.value
    ?.querySelectorAll<HTMLElement>('[data-board-column="1"]')
    .forEach((element) => observer.observe(element))
})

onBeforeUnmount(() => {
  componentMounted = false
  hydrationVersion++
  previewObserver?.disconnect()
})

defineExpose({
  cells,
  previewDimensions,
  previewUrls,
  selectedCell,
  swapProps,
  reversePlane,
  shape,
  bpm,
  scale,
  thick,
  spacing,
  paths,
  hands,
  arms,
  leftPropVisible,
  rightPropVisible,
})
</script>

<style scoped>
.eight-step-pane {
  --eight-step-color-marked: #8a7600;
  --eight-step-color-marked-selected: #ff0000;

  container-name: concept-pane;
  container-type: inline-size;
  width: 100%;
  min-inline-size: 0;
  min-block-size: 0;
  padding-block-end: var(--size-pane-switch-bottom-clearance);
  color: var(--color-text);
  background: transparent;
}

.eight-step-top-options {
  display: flex;
  min-width: var(--size-concept-content-min-width);
  padding: 0 var(--space-2) var(--space-1);
  justify-content: center;
}

.eight-step-development-note {
  width: min(100%, 45rem);
  padding-inline: var(--space-2);
  margin: var(--space-2) auto 0;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
  text-align: center;
}

.eight-step-development-note--diamond {
  padding-block: var(--space-2);
  color: var(--color-text);
  background: color-mix(in srgb, var(--eight-step-color-marked) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--eight-step-color-marked) 45%, transparent);
  border-radius: var(--radius-sm);
}

.eight-step-legend-color--difficult {
  color: var(--eight-step-color-marked);
}

.eight-step-legend-color--selected {
  color: var(--eight-step-color-marked-selected);
}

.eight-step-more {
  width: min(100%, 45rem);
  margin: var(--space-3) auto 0;
  color: var(--color-text);
  font-size: 0.875rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.eight-step-more__toggle {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  color: var(--color-action-primary);
  font-weight: 700;
  letter-spacing: 0.04em;
  list-style: none;
  background: color-mix(in srgb, var(--color-action-primary) 7%, var(--color-surface));
  transition: background var(--transition-fast);
}

.eight-step-more__toggle::-webkit-details-marker {
  display: none;
}

.eight-step-more__toggle::after {
  content: '+';
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1;
}

.eight-step-more[open] .eight-step-more__toggle {
  background: color-mix(in srgb, var(--color-action-primary) 13%, var(--color-surface));
  border-block-end: 1px solid var(--color-border);
}

.eight-step-more[open] .eight-step-more__toggle::after {
  content: '-';
}

.eight-step-more__toggle:hover {
  background: color-mix(in srgb, var(--color-action-primary) 13%, var(--color-surface));
}

.eight-step-more__toggle:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: -3px;
}

.eight-step-more__content {
  padding: var(--space-4);
}

.eight-step-more__content > p:first-child {
  margin: 0 0 var(--space-2);
}

.eight-step-more__links {
  display: grid;
  gap: var(--space-2);
  padding-inline-start: var(--space-6);
  margin: 0;
}

.eight-step-more__links a {
  color: var(--color-action-primary);
}

.eight-step-more__print-note {
  padding-block-start: var(--space-3);
  margin: var(--space-4) 0 0;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  line-height: 1.45;
  border-block-start: 1px solid var(--color-border);
}

.eight-step-board {
  /* These category colors intentionally match VTG and remain stable across themes. */
  --eight-step-color-primary: #5968df;
  --eight-step-color-secondary: #2dc8a8;
  --eight-step-color-ink: #071d26;
  --eight-step-color-rule: #111820;
  --eight-step-color-rule-text: #f6f8fb;
  --eight-step-color-line: #e9eef2;
  --eight-step-color-preview: #071421;
  --eight-step-board-gap: 0.65cqi;
  --eight-step-top-header-min-height: max(2.5rem, 5.85cqi);

  container-type: inline-size;
  display: grid;
  width: 100%;
  min-width: var(--size-concept-content-min-width);
  aspect-ratio: 8.5 / 9.5;
  grid-template-columns: minmax(0, 0.5fr) repeat(8, minmax(0, 1fr));
  grid-template-rows: auto repeat(9, minmax(0, 1fr));
  gap: 0.65%;
  padding: 0.65%;
}

.eight-step-shuffle,
.eight-step-column-header,
.eight-step-row-header,
.eight-step-cell {
  min-width: 0;
  min-height: 0;
  box-shadow: 0 0.45cqi 1cqi color-mix(in srgb, var(--eight-step-color-preview) 22%, transparent);
}

.eight-step-shuffle {
  appearance: none;
  display: grid;
  grid-row: 1;
  grid-column: 1;
  padding: 0;
  color: var(--eight-step-color-ink);
  cursor: pointer;
  background: var(--eight-step-color-secondary);
  border: 0;
  border-radius: 0.75cqi;
  place-items: center;
}

.eight-step-shuffle-tooltip {
  display: flex;
  min-width: 0;
  min-height: 0;
  grid-row: 1;
  grid-column: 1;
}

.eight-step-shuffle-tooltip > .eight-step-shuffle,
.eight-step-column-tooltip > .eight-step-column-header {
  width: 100%;
  height: 100%;
}

.eight-step-column-tooltip {
  display: flex;
  min-width: 0;
  min-height: 0;
  grid-row: 1;
}

.eight-step-column-header,
.eight-step-row-header {
  display: grid;
  color: var(--eight-step-color-rule-text);
  background: var(--eight-step-color-rule);
  border: max(1px, 0.16cqi) dashed var(--eight-step-color-line);
  border-radius: 0.7cqi;
  font-family: 'Arial Narrow', var(--font-family-sans);
  font-weight: 700;
  place-items: center;
}

.eight-step-column-header {
  grid-row: 1;
  min-height: var(--eight-step-top-header-min-height);
  padding-block: 0.2em;
  padding-inline: 0.25em;
  font-size: max(0.7rem, 2cqi);
  font-weight: 800;
  line-height: 0.95;
  text-align: center;
  text-wrap: balance;
}

.eight-step-row-header {
  display: flex;
  gap: 0.04em;
  align-items: center;
  justify-content: center;
  font-size: max(0.62rem, 1.7cqi);
  letter-spacing: 0.08em;
}

.eight-step-row-tooltip {
  grid-column: 1;
  min-width: 0;
  min-height: 0;
}

.eight-step-row-tooltip > .eight-step-row-header {
  width: 100%;
  height: 100%;
}

.eight-step-header--accent {
  color: var(--eight-step-color-ink);
  background: var(--eight-step-color-secondary);
  border-color: var(--eight-step-color-ink);
}

.eight-step-row-header__first {
  color: var(--eight-step-first-head);
}

.eight-step-row-header__second {
  color: var(--eight-step-second-head);
}

.eight-step-header--accent .eight-step-row-header__first {
  color: var(--eight-step-first-tether);
}

.eight-step-header--accent .eight-step-row-header__second {
  color: var(--eight-step-second-tether);
}

.eight-step-cell {
  appearance: none;
  display: grid;
  padding: 0;
  cursor: pointer;
  background: var(--eight-step-color-primary);
  border: 0;
  border-radius: 1.7cqi;
  box-shadow:
    inset 0 0.15cqi 0.15cqi color-mix(in srgb, var(--eight-step-color-rule-text) 12%, transparent),
    0 0.45cqi 1cqi color-mix(in srgb, var(--eight-step-color-preview) 22%, transparent);
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  place-items: center;
}

.eight-step-cell-tooltip {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.eight-step-cell-tooltip > .eight-step-cell {
  width: 100%;
  height: 100%;
}

.eight-step-cell-tooltip__text {
  white-space: pre-line;
}

.eight-step-cell__preview {
  display: block;
  width: 78%;
  aspect-ratio: 1;
  object-fit: contain;
  pointer-events: none;
  background: color-mix(in srgb, var(--eight-step-color-preview) 94%, transparent);
  border-radius: 0.9cqi;
  box-shadow: 0 0.35cqi 0.85cqi color-mix(in srgb, var(--eight-step-color-preview) 30%, transparent);
}

.eight-step-cell--highlighted {
  background: var(--eight-step-color-secondary);
}

.eight-step-cell--marked {
  box-shadow:
    inset 0 0 0 max(2px, 0.28cqi) var(--eight-step-color-marked),
    inset 0 0 0 max(4px, 0.52cqi) var(--eight-step-color-ink),
    0 0.45cqi 1cqi color-mix(in srgb, var(--eight-step-color-preview) 22%, transparent);
}

.eight-step-cell--selected {
  box-shadow:
    inset 0 0 0 max(2px, 0.28cqi) var(--eight-step-color-rule-text),
    inset 0 0 0 max(4px, 0.52cqi) var(--eight-step-color-ink),
    0 0.45cqi 1cqi color-mix(in srgb, var(--eight-step-color-preview) 22%, transparent);
}

.eight-step-cell--marked.eight-step-cell--selected {
  box-shadow:
    inset 0 0 0 max(2px, 0.28cqi) var(--eight-step-color-marked-selected),
    inset 0 0 0 max(4px, 0.52cqi) var(--eight-step-color-ink),
    0 0.45cqi 1cqi color-mix(in srgb, var(--eight-step-color-preview) 22%, transparent);
}

.eight-step-shuffle:focus-visible,
.eight-step-cell:focus-visible {
  outline: max(2px, 0.2cqi) solid var(--eight-step-color-rule-text);
  outline-offset: max(1px, 0.1cqi);
}

.eight-step-pane__visually-hidden {
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
