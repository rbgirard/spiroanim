<template>
  <section class="third-order-pane" aria-label="Third Order" data-role="to-pane">
    <div class="third-order-directions">
      <label>
        Hand:
        <select v-model="handDirection" aria-label="Hand" data-role="to-hand">
          <option value="anti">Anti</option>
          <option value="spin">Spin</option>
        </select>
      </label>
      <label>
        Prop:
        <select v-model="propDirection" aria-label="Prop" data-role="to-prop">
          <option value="anti">Anti</option>
          <option value="spin">Spin</option>
        </select>
      </label>
      <label>
        Version:
        <select v-model="version" aria-label="Version" data-role="to-version">
          <option :value="1">1</option>
          <option :value="2">2</option>
        </select>
      </label>
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
            <button
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
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(propRatio, rowIndex) in thirdOrderPropRatios" :key="propRatio">
          <th scope="row">
            <button
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
          </th>
          <td v-for="(handRatio, columnIndex) in thirdOrderHandRatios" :key="handRatio">
            <button
              type="button"
              class="third-order-tile third-order-cell"
              :class="{
                'third-order-tile--accent':
                  selectedCell?.handRatio === handRatio || selectedCell?.propRatio === propRatio,
                'third-order-cell--selected':
                  selectedCell?.handRatio === handRatio && selectedCell?.propRatio === propRatio,
              }"
              :aria-label="`Hand ${handRatio}, Prop ${propRatio}`"
              :aria-pressed="
                selectedCell?.handRatio === handRatio && selectedCell?.propRatio === propRatio
              "
              :data-hand-ratio="handRatio"
              :data-prop-ratio="propRatio"
              data-role="to-cell"
              @click="selectCell({ handRatio, propRatio })"
            >
              <img
                v-if="
                  supported && cellPreviewUrls[rowIndex * thirdOrderHandRatios.length + columnIndex]
                "
                :src="cellPreviewUrls[rowIndex * thirdOrderHandRatios.length + columnIndex]"
                class="third-order-cell__preview"
                data-role="to-cell-preview"
                alt=""
              />
              <span v-else class="third-order-cell__preview" aria-hidden="true" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ConceptAnimationControls role-prefix="to" :animation="animation" :show-scale="false" />
  </section>
</template>

<script setup lang="ts">
import { mdiShuffleVariant } from '@mdi/js'
import BaseIcon from '@/components/icons/BaseIcon.vue'
import ConceptAnimationControls from '@/features/concepts/components/ConceptAnimationControls.vue'
import { useThirdOrderHeaderPreviews } from '@/features/third-order/composables/useThirdOrderHeaderPreviews'
import { useThirdOrderCellPreviews } from '@/features/third-order/composables/useThirdOrderCellPreviews'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import type { ThirdOrderPatternSelection, ThirdOrderVersion } from '@/features/third-order/types'
import type { RootDataFinal } from '@/types/AnimTypes'
import {
  thirdOrderCells,
  thirdOrderHandRatios,
  thirdOrderPropRatios,
  type ThirdOrderCell,
  type ThirdOrderDirection,
} from '@/features/third-order/data/thirdOrderMatrix'

const props = withDefaults(defineProps<{ animation?: RootDataFinal; animationReady?: boolean }>(), {
  animationReady: true,
})
const emit = defineEmits<{
  patternSelect: [selection: ThirdOrderPatternSelection]
  customize: [selection: ThirdOrderPatternSelection]
}>()
const handDirection = ref<ThirdOrderDirection>('anti')
const propDirection = ref<ThirdOrderDirection>('anti')
const version = ref<ThirdOrderVersion>(1)
const selectedCell = ref<ThirdOrderCell>()
const board = ref<HTMLTableElement>()
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
)

const currentSelection = (): ThirdOrderPatternSelection | undefined =>
  supported.value && selectedCell.value && props.animationReady !== false
    ? { ...patternSettings.value, ...displaySettings.value, ...selectedCell.value }
    : undefined

const selectCell = (cell: ThirdOrderCell) => {
  selectedCell.value = cell
  const selection = currentSelection()
  if (selection) emit('patternSelect', selection)
}

watch(patternSettings, () => {
  const selection = currentSelection()
  if (selection) emit('patternSelect', selection)
})
watch(displaySettings, () => {
  const selection = currentSelection()
  if (selection) emit('customize', selection)
})

const randomCell = (): ThirdOrderCell =>
  thirdOrderCells[Math.floor(Math.random() * thirdOrderCells.length)]!

const selectRandomCell = () => {
  selectCell(randomCell())
}

const selectColumn = (handRatio: ThirdOrderCell['handRatio']) => {
  selectCell({ handRatio, propRatio: (selectedCell.value ?? randomCell()).propRatio })
}

const selectRow = (propRatio: ThirdOrderCell['propRatio']) => {
  selectCell({ handRatio: (selectedCell.value ?? randomCell()).handRatio, propRatio })
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
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: var(--space-2);
  font-size: 0.875rem;
  font-weight: 700;
}

.third-order-directions label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
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

.third-order-cell--selected {
  outline: 2px solid var(--color-action-primary);
  outline-offset: -3px;
}

.third-order-tile:hover {
  border-color: var(--color-action-primary);
}

.third-order-tile:focus-visible,
.third-order-directions select:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
