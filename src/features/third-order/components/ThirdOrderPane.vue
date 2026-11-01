<template>
  <section
    class="third-order-pane"
    aria-label="Third Order"
    data-role="to-pane"
    :style="{ '--third-order-controls-height': `${controlsHeight}px` }"
  >
    <div ref="controls" class="third-order-directions" data-role="to-sticky-controls">
      <div class="third-order-radio-group" role="radiogroup" aria-label="Hand">
        <BaseTooltip text="Hand: direction of the top-header pattern">
          <template #activator="{ props: activatorProps }">
            <span v-bind="activatorProps" tabindex="0">H:</span>
          </template>
        </BaseTooltip>
        <BaseTooltip
          v-for="direction in directions"
          :key="direction"
          :text="`Hand: ${direction === 'anti' ? 'Anti' : 'Spin'} (top-header pattern)`"
        >
          <template #activator="{ props: activatorProps }">
            <label
              @mouseenter="activatorProps.onMouseenter"
              @mouseleave="activatorProps.onMouseleave"
            >
              <input
                v-bind="activatorProps"
                v-model="handDirection"
                type="radio"
                :name="`${controlId}-hand`"
                :value="direction"
                data-role="to-hand"
              />
              <span>{{ direction === 'anti' ? 'Anti' : 'Spin' }}</span>
            </label>
          </template>
        </BaseTooltip>
      </div>
      <div class="third-order-radio-group" role="radiogroup" aria-label="Prop">
        <BaseTooltip text="Prop: direction of the left-header pattern">
          <template #activator="{ props: activatorProps }">
            <span v-bind="activatorProps" tabindex="0">P:</span>
          </template>
        </BaseTooltip>
        <BaseTooltip
          v-for="direction in directions"
          :key="direction"
          :text="`Prop: ${direction === 'anti' ? 'Anti' : 'Spin'} (left-header pattern)`"
        >
          <template #activator="{ props: activatorProps }">
            <label
              @mouseenter="activatorProps.onMouseenter"
              @mouseleave="activatorProps.onMouseleave"
            >
              <input
                v-bind="activatorProps"
                v-model="propDirection"
                type="radio"
                :name="`${controlId}-prop`"
                :value="direction"
                data-role="to-prop"
              />
              <span>{{ direction === 'anti' ? 'Anti' : 'Spin' }}</span>
            </label>
          </template>
        </BaseTooltip>
      </div>
      <div class="third-order-radio-group" role="radiogroup" aria-label="Version">
        <BaseTooltip text="Version: choose between the two pattern variations">
          <template #activator="{ props: activatorProps }">
            <span v-bind="activatorProps" tabindex="0">V:</span>
          </template>
        </BaseTooltip>
        <BaseTooltip
          v-for="option in versions"
          :key="option"
          :text="`Version ${option}: pattern variation ${option}`"
        >
          <template #activator="{ props: activatorProps }">
            <label
              @mouseenter="activatorProps.onMouseenter"
              @mouseleave="activatorProps.onMouseleave"
            >
              <input
                v-bind="activatorProps"
                v-model="version"
                type="radio"
                :name="`${controlId}-version`"
                :value="option"
                data-role="to-version"
              />
              <span>{{ option }}</span>
            </label>
          </template>
        </BaseTooltip>
      </div>
      <div class="third-order-radio-group">
        <BaseTooltip text="Duplicate: equivalent forms of the selected pattern">
          <template #activator="{ props: activatorProps }">
            <label v-bind="activatorProps" :for="`${controlId}-duplicate`" tabindex="0">D:</label>
          </template>
        </BaseTooltip>
        <BaseTooltip text="Duplicate: choose an equivalent form of the selected pattern">
          <template #activator="{ props: activatorProps }">
            <select
              v-bind="activatorProps"
              :id="`${controlId}-duplicate`"
              v-model="duplicate"
              aria-label="Duplicate"
              data-role="to-duplicate"
              :disabled="duplicateCount === 0"
              @change="applySelectedPattern"
            >
              <option v-for="option in duplicateCount" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </template>
        </BaseTooltip>
      </div>
    </div>

    <table ref="board" class="third-order-board" aria-label="Third Order patterns">
      <thead>
        <tr>
          <td>
            <button
              type="button"
              class="third-order-tile third-order-shuffle"
              aria-label="Shuffle Third Order patterns"
              data-role="to-shuffle"
              @click="selectRandomCell"
            >
              <BaseIcon :path="mdiShuffleVariant" size="42%" />
            </button>
          </td>
          <th v-for="(ratio, index) in thirdOrderHandRatios" :key="ratio" scope="col">
            <BaseTooltip
              class="third-order-tooltip"
              :text="`Hand: ${ratio} ${handDirection === 'anti' ? 'Anti' : 'Spin'}`"
            >
              <template #activator="{ props: activatorProps }">
                <button
                  v-bind="activatorProps"
                  type="button"
                  class="third-order-tile third-order-header"
                  :class="{ 'third-order-tile--accent': selectedCell?.handRatio === ratio }"
                  :aria-label="`Hand ${ratio} ${handDirection === 'anti' ? 'Anti' : 'Spin'}`"
                  :aria-pressed="selectedCell?.handRatio === ratio"
                  data-role="to-column-header"
                  :data-ratio="ratio"
                  @click="selectColumn(ratio)"
                >
                  <img v-if="previewUrls[index]" :src="previewUrls[index]" alt="" />
                  <span>{{ ratio }}</span>
                </button>
              </template>
            </BaseTooltip>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(propRatio, rowIndex) in thirdOrderPropRatios" :key="propRatio">
          <th scope="row">
            <BaseTooltip
              class="third-order-tooltip"
              :text="`Prop: ${propRatio} ${propDirection === 'anti' ? 'Anti' : 'Spin'}`"
            >
              <template #activator="{ props: activatorProps }">
                <button
                  v-bind="activatorProps"
                  type="button"
                  class="third-order-tile third-order-header"
                  :class="{ 'third-order-tile--accent': selectedCell?.propRatio === propRatio }"
                  :aria-label="`Prop ${propRatio} ${propDirection === 'anti' ? 'Anti' : 'Spin'}`"
                  :aria-pressed="selectedCell?.propRatio === propRatio"
                  data-role="to-row-header"
                  :data-ratio="propRatio"
                  @click="selectRow(propRatio)"
                >
                  <img
                    v-if="previewUrls[thirdOrderHandRatios.length + rowIndex]"
                    :src="previewUrls[thirdOrderHandRatios.length + rowIndex]"
                    alt=""
                  />
                  <span>{{ propRatio }}</span>
                </button>
              </template>
            </BaseTooltip>
          </th>
          <td v-for="(handRatio, columnIndex) in thirdOrderHandRatios" :key="handRatio">
            <BaseTooltip
              class="third-order-tooltip"
              :text="getCellDescription(handRatio, propRatio)"
            >
              <template #activator="{ props: activatorProps }">
                <button
                  v-bind="activatorProps"
                  type="button"
                  class="third-order-tile third-order-cell"
                  :class="{
                    'third-order-tile--accent':
                      selectedCell?.handRatio === handRatio ||
                      selectedCell?.propRatio === propRatio,
                    'third-order-cell--selected':
                      selectedCell?.handRatio === handRatio &&
                      selectedCell?.propRatio === propRatio,
                  }"
                  :aria-label="`Hand ${handRatio}, Prop ${propRatio}`"
                  :aria-pressed="
                    selectedCell?.handRatio === handRatio && selectedCell?.propRatio === propRatio
                  "
                  :data-hand-ratio="handRatio"
                  :data-prop-ratio="propRatio"
                  data-role="to-cell"
                  @click="selectCell({ handRatio, propRatio }, true)"
                >
                  <img
                    v-if="
                      supported[rowIndex * thirdOrderHandRatios.length + columnIndex] &&
                      cellPreviewUrls[rowIndex * thirdOrderHandRatios.length + columnIndex]
                    "
                    :src="cellPreviewUrls[rowIndex * thirdOrderHandRatios.length + columnIndex]"
                    class="third-order-cell__preview"
                    data-role="to-cell-preview"
                    alt=""
                  />
                  <span v-else class="third-order-cell__preview" aria-hidden="true" />
                </button>
              </template>
            </BaseTooltip>
          </td>
        </tr>
      </tbody>
    </table>

    <ConceptAnimationControls role-prefix="to" :animation="animation" :show-scale="false" />
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { mdiShuffleVariant } from '@mdi/js'
import BaseIcon from '@/components/icons/BaseIcon.vue'
import BaseTooltip from '@/components/ui/BaseTooltip.vue'
import ConceptAnimationControls from '@/features/concepts/components/ConceptAnimationControls.vue'
import { useThirdOrderHeaderPreviews } from '@/features/third-order/composables/useThirdOrderHeaderPreviews'
import { useThirdOrderCellPreviews } from '@/features/third-order/composables/useThirdOrderCellPreviews'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import type {
  ThirdOrderPatternMatch,
  ThirdOrderPatternSelection,
  ThirdOrderVersion,
} from '@/features/third-order/types'
import { useThirdOrderPatternMatching } from '@/features/third-order/composables/useThirdOrderPatternMatching'
import type { PatternMatchingClient } from '@/workers/pattern-matching/PatternMatchingWorkerTypes'
import { isThirdOrderSelectionSupported } from '@/features/third-order/createThirdOrderAnimation'
import { getThirdOrderDefinitionDuplicateCount } from '@/features/third-order/definitionCatalog'
import { thirdOrderDefinitions } from '@/features/third-order/data/generatedDefinitions'
import type { RootDataFinal } from '@/types/AnimTypes'
import {
  thirdOrderCells,
  thirdOrderHandRatios,
  thirdOrderPropRatios,
  type ThirdOrderCell,
  type ThirdOrderDirection,
} from '@/features/third-order/data/thirdOrderMatrix'

const props = withDefaults(
  defineProps<{
    animation?: RootDataFinal
    animationReady?: boolean
    animationRevision?: number
    patternMatcher?: Pick<PatternMatchingClient, 'matchThirdOrder'>
  }>(),
  {
    animationReady: true,
  },
)
const emit = defineEmits<{
  patternSelect: [selection: ThirdOrderPatternSelection]
  customize: [selection: ThirdOrderPatternSelection]
}>()
const handDirection = ref<ThirdOrderDirection>('anti')
const controlId = useId()
const directions = ['anti', 'spin'] as const
const versions = [1, 2] as const
const propDirection = ref<ThirdOrderDirection>('anti')
const version = ref<ThirdOrderVersion>(1)
const selectedCell = ref<ThirdOrderCell>()
let hydratingMatch = false
const duplicate = ref(1)
const duplicateCount = computed(() =>
  selectedCell.value ? getDuplicateCount(selectedCell.value) : 0,
)
const board = ref<HTMLTableElement>()
const controls = ref<HTMLDivElement>()
const { height: controlsHeight } = useElementSize(controls, undefined, { box: 'border-box' })
const { width } = useElementSize(board)
const { previewUrls } = useThirdOrderHeaderPreviews(handDirection, propDirection, width)

const {
  bpm,
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
} = storeToRefs(useConceptsStore())
const displaySettings = computed(() => ({
  bpm: bpm.value,
  thick: thick.value,
  spacing: spacing.value,
  paths: paths.value,
  hands: hands.value,
  arms: arms.value,
  left: leftPropVisible.value ? undefined : (false as const),
  right: rightPropVisible.value ? undefined : (false as const),
  propColors: [leftPropColor.value, rightPropColor.value] as const,
  prop: prop.value,
}))
const patternSettings = computed(() => ({
  concept: 'to' as const,
  handDirection: handDirection.value,
  propDirection: propDirection.value,
  version: version.value,
}))
// Match the other concepts' fixed thumbnail rendering; only path/identity changes need redraws.
const previewSettings = computed(() => ({
  ...patternSettings.value,
  spacing: spacing.value,
  propColors: [leftPropColor.value, rightPropColor.value] as const,
  prop: prop.value,
}))
const { supported, previewUrls: cellPreviewUrls } = useThirdOrderCellPreviews(
  previewSettings,
  width,
  computed(() =>
    selectedCell.value ? { ...selectedCell.value, duplicate: duplicate.value } : undefined,
  ),
)

const getDuplicateCount = (cell: ThirdOrderCell): number =>
  getThirdOrderDefinitionDuplicateCount(thirdOrderDefinitions, {
    ...patternSettings.value,
    ...cell,
  })

const isSelectedCell = (cell: ThirdOrderCell): boolean =>
  selectedCell.value?.handRatio === cell.handRatio &&
  selectedCell.value?.propRatio === cell.propRatio

const getCellDescription = (
  handRatio: ThirdOrderCell['handRatio'],
  propRatio: ThirdOrderCell['propRatio'],
): string =>
  `Hand: ${handRatio} ${handDirection.value === 'anti' ? 'Anti' : 'Spin'}\nProp: ${propRatio} ${propDirection.value === 'anti' ? 'Anti' : 'Spin'}\nVersion: ${version.value}\nDuplicate: ${isSelectedCell({ handRatio, propRatio }) ? duplicate.value : 1} / ${getDuplicateCount({ handRatio, propRatio })}`

const currentSelection = (): ThirdOrderPatternSelection | undefined => {
  if (!selectedCell.value || !props.animationReady) return undefined
  const selection = {
    ...patternSettings.value,
    ...displaySettings.value,
    ...selectedCell.value,
    duplicate: duplicate.value,
  }
  return isThirdOrderSelectionSupported(selection) ? selection : undefined
}

const revealSelectedCell = async () => {
  await nextTick()
  const cell = board.value?.querySelector<HTMLElement>('[data-role="to-cell"][aria-pressed="true"]')
  const viewport = board.value?.closest<HTMLElement>('[data-concepts-pane]')
  if (!cell || !viewport) return
  const rect = cell.getBoundingClientRect()
  const view = viewport.getBoundingClientRect()
  if (rect.height <= 0 || view.height <= 0) return
  // Reserve the sticky stack even when currently scrolled beyond the table into Customize.
  const top =
    view.top + controlsHeight.value + (board.value?.tHead?.getBoundingClientRect().height ?? 0) + 4
  const bottom = view.bottom - 4
  const dy = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0
  const dx =
    rect.left < view.left
      ? rect.left - view.left
      : rect.right > view.right
        ? rect.right - view.right
        : 0
  if (dx || dy) viewport.scrollBy({ left: dx, top: dy, behavior: 'instant' })
}

const matchIdentity = computed<ThirdOrderPatternMatch | undefined>(() =>
  selectedCell.value
    ? {
        ...selectedCell.value,
        handDirection: handDirection.value,
        propDirection: propDirection.value,
        version: version.value,
        duplicate: duplicate.value,
      }
    : undefined,
)

const { invalidate: invalidateMatch } = useThirdOrderPatternMatching({
  animation: computed(() => props.animation),
  ready: computed(() => props.animationReady),
  revision: computed(() => props.animationRevision),
  preferred: matchIdentity,
  match: async (request) => {
    if (props.patternMatcher?.matchThirdOrder) return props.patternMatcher.matchThirdOrder(request)
    const { matchThirdOrderPatternRequest } =
      await import('@/workers/pattern-matching/handlePatternMatchingRequest')
    return matchThirdOrderPatternRequest(request)
  },
  hydrate: async (match) => {
    const current = matchIdentity.value
    if (
      current &&
      match &&
      current.handRatio === match.handRatio &&
      current.propRatio === match.propRatio &&
      current.handDirection === match.handDirection &&
      current.propDirection === match.propDirection &&
      current.version === match.version &&
      current.duplicate === match.duplicate
    )
      return
    hydratingMatch = true
    try {
      selectedCell.value = match
        ? { handRatio: match.handRatio, propRatio: match.propRatio }
        : undefined
      duplicate.value = match?.duplicate ?? 1
      if (match) {
        handDirection.value = match.handDirection
        propDirection.value = match.propDirection
        version.value = match.version
      }
      // Let all control watchers flush under the guard. Detection never emits player edits.
      await nextTick()
    } finally {
      hydratingMatch = false
    }
    if (match) void revealSelectedCell()
  },
})

const applySelectedPattern = () => {
  if (hydratingMatch) return
  invalidateMatch()
  const selection = currentSelection()
  if (selection) emit('patternSelect', selection)
  void revealSelectedCell()
}

const selectCell = (cell: ThirdOrderCell, cycle = false) => {
  duplicate.value =
    cycle && isSelectedCell(cell) && duplicateCount.value > 0
      ? (duplicate.value % duplicateCount.value) + 1
      : 1
  selectedCell.value = cell
  applySelectedPattern()
}

watch(patternSettings, () => {
  if (hydratingMatch) return
  duplicate.value = 1
  applySelectedPattern()
})
watch(displaySettings, () => {
  if (hydratingMatch) return
  invalidateMatch()
  const selection = currentSelection()
  if (selection) emit('customize', selection)
})

const randomCell = (): ThirdOrderCell | undefined => {
  const cells = thirdOrderCells.filter((_, index) => supported.value[index])
  return cells[Math.floor(Math.random() * cells.length)]
}

const selectRandomCell = () => {
  const cell = randomCell()
  if (cell) selectCell(cell)
}

const selectColumn = (handRatio: ThirdOrderCell['handRatio']) => {
  const cell = selectedCell.value ?? randomCell()
  if (cell) selectCell({ handRatio, propRatio: cell.propRatio })
}

const selectRow = (propRatio: ThirdOrderCell['propRatio']) => {
  const cell = selectedCell.value ?? randomCell()
  if (cell) selectCell({ handRatio: cell.handRatio, propRatio })
}
</script>

<style scoped>
.third-order-pane {
  container-type: inline-size;
  min-width: var(--size-concept-content-min-width);
  padding-block-end: var(--space-3);
  color: var(--color-text);
}

.third-order-directions {
  --space-concept-control-inline: clamp(var(--space-1), 2.3cqi, var(--space-2));
  --font-size-concept-control: clamp(0.625rem, 4cqi, 0.875rem);

  container-type: inline-size;
  position: sticky;
  inset-block-start: 0;
  z-index: 3;
  background: var(--color-thumbnail-header-background);
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-1);
  padding: var(--space-2);
  font-size: var(--font-size-concept-control);
  font-weight: 700;
}

.third-order-radio-group {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.third-order-directions input[type='radio'] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
}

.third-order-directions label {
  position: relative;
  cursor: pointer;
}

.third-order-directions label > span,
.third-order-directions select {
  display: grid;
  padding-block: var(--space-1);
  padding-inline: var(--space-concept-control-inline);
  color: var(--color-text);
  font-size: var(--font-size-concept-control);
  font-weight: 700;
  white-space: nowrap;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  place-items: center;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.third-order-directions select {
  box-sizing: border-box;
  block-size: calc(1lh + 2 * var(--space-1) + 2px);
  line-height: inherit;
  cursor: pointer;
}

.third-order-directions select:disabled {
  cursor: default;
}

.third-order-directions input:checked + span,
.third-order-directions select:enabled {
  color: var(--color-on-action-primary);
  background: var(--color-action-primary);
  border-color: var(--color-action-primary);
}

.third-order-board {
  width: 100%;
  table-layout: fixed;
  border-spacing: 0.5cqi;
}

.third-order-board th,
.third-order-board td {
  padding: 0;
}

.third-order-board thead {
  position: sticky;
  inset-block-start: var(--third-order-controls-height, 0px);
  z-index: 2;
}

.third-order-tooltip {
  display: flex;
  width: 100%;
  min-width: 0;
}

.third-order-tile {
  position: relative;
  display: grid;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  aspect-ratio: 1;
  padding: 0;
  color: var(--color-text);
  background: var(--color-thumbnail-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  place-items: center;
}

.third-order-header {
  background: var(--color-thumbnail-header-background);
  border-style: dashed;
}

.third-order-header img,
.third-order-cell__preview {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  pointer-events: none;
  border-radius: inherit;
}

.third-order-header span {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  font-size: clamp(0.6rem, 1.8cqi, 0.875rem);
  line-height: 1.2;
  background: transparent;
}

.third-order-board tbody .third-order-header span {
  inset-inline-start: auto;
  inset-inline-end: 2px;
  text-align: end;
}

.third-order-tile--accent {
  border-color: var(--color-action-primary);
  border-style: solid;
}

.third-order-tile:hover {
  border-color: var(--color-action-primary);
}

.third-order-cell--selected,
.third-order-cell--selected:hover {
  border-color: var(--color-selection-border);
  outline: 2px solid var(--color-selection-border);
  outline-offset: -3px;
}

.third-order-tile:focus-visible,
.third-order-directions input:focus-visible + span,
.third-order-directions select:focus-visible,
.third-order-directions label:focus-visible,
.third-order-directions span:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
