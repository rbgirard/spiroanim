<template>
  <div
    ref="previewGrid"
    class="vtg-transition-previews"
    :class="{
      'vtg-transition-previews--drag-active': dragActive,
      'vtg-transition-previews--has-selection': selectedIndex !== undefined,
      'vtg-transition-previews--touch-sliders': protectTouchScrolling,
    }"
    data-role="vtg-transition-previews"
    :style="{ '--vtg-transition-preview-columns': String(columns) }"
  >
    <template v-for="(url, index) in previewUrls" :key="index">
      <div
        class="vtg-transition-previews__item"
        :class="{
          'vtg-transition-previews__item--drag-over': dragOverIndex === index,
          'vtg-transition-previews__item--drop-blocked':
            dragOverIndex === index && !isDropAllowed(index),
          'vtg-transition-previews__item--selected': selectedIndex === index,
        }"
        :data-preview-index="index"
        @dragenter.prevent="dragOverIndex = index"
        @dragover.prevent="allowPatternDrop(index, $event)"
        @dragleave="leavePatternDrop(index, $event)"
        @drop.prevent="dropPattern(index, $event)"
      >
        <AppTooltip
          class="vtg-transition-previews__tooltip"
          :text="previewRelationships[index]?.description"
        >
          <template #activator="{ props: tooltipProps }">
            <button
              v-bind="tooltipProps"
              class="vtg-transition-previews__visual"
              type="button"
              draggable="false"
              :aria-label="`Preview pattern ${index + 1}`"
              :aria-controls="`vtg-transition-preview-actions-${index}`"
              :aria-expanded="selectedIndex === index"
              :aria-pressed="selectedIndex === index"
              @click="previewPattern(index)"
              @dragstart.prevent
            >
              <img
                v-if="url"
                class="vtg-transition-previews__image"
                :src="url"
                :alt="`45 Trans pattern ${index + 1}`"
                draggable="false"
              />
              <span v-if="previewRatios[index]" class="vtg-transition-previews__ratio">
                {{ previewRatios[index] }}
              </span>
              <Transition name="vtg-label-swap">
                <ElementalRelationshipIcons
                  v-if="elementalLayout"
                  key="elemental"
                  class="vtg-transition-previews__label"
                  :hands="previewRelationships[index]?.hands"
                  :props="previewRelationships[index]?.props"
                  :hands-indeterminate="previewRelationships[index]?.handsIndeterminate"
                  :props-indeterminate="previewRelationships[index]?.propsIndeterminate"
                  :size="16"
                />
                <span v-else key="classic" class="vtg-transition-previews__label">
                  {{ previewLabels[index] }}
                </span>
              </Transition>
            </button>
          </template>
        </AppTooltip>
        <div
          :id="`vtg-transition-preview-actions-${index}`"
          class="vtg-transition-previews__actions"
        >
          <div class="vtg-transition-previews__transform-actions">
            <AppTooltip v-if="structureEditingEnabled" text="Reverse">
              <template #activator="{ props: tooltipProps }">
                <button
                  v-bind="tooltipProps"
                  class="vtg-transition-previews__reverse"
                  type="button"
                  :aria-label="`Reverse direction of pattern ${index + 1}`"
                  data-role="vtg-transition-preview-reverse"
                  @click.stop="emit('patternReverse', index)"
                >
                  <BaseIcon :path="mdiRotate3dVariant" :size="18" />
                </button>
              </template>
            </AppTooltip>
            <AppTooltip
              v-if="structureEditingEnabled && swappablePreviews[index]"
              text="Swap Props"
            >
              <template #activator="{ props: tooltipProps }">
                <button
                  v-bind="tooltipProps"
                  class="vtg-transition-previews__swap"
                  type="button"
                  :aria-label="`Swap props in pattern ${index + 1}`"
                  data-role="vtg-transition-preview-swap"
                  @click.stop="emit('patternSwap', index)"
                >
                  <BaseIcon :path="mdiSwapHorizontal" :size="18" />
                </button>
              </template>
            </AppTooltip>
          </div>
          <div v-if="structureEditingEnabled" class="vtg-transition-previews__delete-action">
            <AppTooltip text="Delete">
              <template #activator="{ props: tooltipProps }">
                <button
                  v-bind="tooltipProps"
                  class="vtg-transition-previews__delete"
                  type="button"
                  :aria-label="`Delete pattern ${index + 1}`"
                  @click.stop="emit('patternDelete', index)"
                >
                  <BaseIcon :path="mdiTrashCanOutline" :size="18" />
                </button>
              </template>
            </AppTooltip>
          </div>
        </div>
        <div class="vtg-transition-previews__beats">
          <span class="vtg-transition-previews__visually-hidden">
            Pattern {{ index + 1 }} beats
          </span>
          <input
            v-if="sliders"
            type="range"
            :min="minimumBeatCount(index)"
            :max="maximumBeatCount(index)"
            step="0.5"
            :value="beatCounts[index]"
            :aria-label="`Pattern ${index + 1} beats`"
            :aria-valuetext="`${beatCounts[index]} beats`"
            :disabled="!structureEditingEnabled"
            data-role="vtg-transition-preview-beats"
            @input="updateBeatCount(index, $event)"
            @pointerdown="beginPointerSlider"
            @pointerup="endPointerSlider"
            @pointercancel="cancelPointerSlider"
            @keydown="emit('sliderStart')"
            @keyup="emit('sliderEnd')"
            @blur="emit('sliderEnd')"
          />
          <output v-if="sliders">{{ beatCounts[index] }}</output>
          <ConceptStepper
            v-else
            :model-value="beatCounts[index] ?? minimumBeatCount(index)"
            label="Pattern beats"
            :data-role="`vtg-transition-preview-beats-${index}`"
            :min="minimumBeatCount(index)"
            :max="maximumBeatCount(index)"
            :step="0.5"
            :display-value="String(beatCounts[index])"
            :disabled="!structureEditingEnabled"
            @update:model-value="updateBeatCountValue(index, $event)"
          />
        </div>
      </div>
      <div
        v-if="propertiesAfterPreviewIndex === index"
        class="vtg-transition-previews__properties"
        data-role="vtg-transition-preview-properties"
      >
        <slot name="selected-properties" />
      </div>
    </template>

    <button
      v-if="dropPlaceholderVisible"
      type="button"
      class="vtg-transition-previews__item vtg-transition-previews__placeholder"
      :class="{
        'vtg-transition-previews__item--drag-over': dragOverIndex === previewUrls.length,
        'vtg-transition-previews__item--drop-blocked':
          dragOverIndex === previewUrls.length && !isDropAllowed(previewUrls.length),
        'vtg-transition-previews__item--selected': selectedIndex === previewUrls.length,
      }"
      aria-label="Select empty pattern slot"
      :aria-pressed="selectedIndex === previewUrls.length"
      data-role="vtg-transition-preview-drop-target"
      :data-preview-index="previewUrls.length"
      @click="previewPattern(previewUrls.length)"
      @dragenter.prevent="dragOverIndex = previewUrls.length"
      @dragover.prevent="allowPatternDrop(previewUrls.length, $event)"
      @dragleave="leavePatternDrop(previewUrls.length, $event)"
      @drop.prevent="dropPattern(previewUrls.length, $event)"
    >
      <span>Drag and drop a pattern here</span>
    </button>

    <Teleport to="body">
      <div
        v-if="dragActive && pointerPosition"
        class="vtg-transition-previews__pointer-drag"
        :style="{
          insetInlineStart: `${pointerPosition.x}px`,
          insetBlockStart: `${pointerPosition.y}px`,
          inlineSize: `${pointerPosition.preview.width}px`,
          blockSize: `${pointerPosition.preview.height}px`,
        }"
        data-role="vtg-pattern-pointer-drag"
        aria-hidden="true"
      >
        <img
          v-if="pointerPosition.preview.imageUrl"
          class="vtg-transition-previews__pointer-drag-image"
          :src="pointerPosition.preview.imageUrl"
          alt=""
        />
        <span
          class="vtg-transition-previews__pointer-drag-label"
          :class="{
            'vtg-transition-previews__pointer-drag-label--elemental':
              pointerPosition.preview.elemental,
          }"
        >
          <template v-if="pointerPosition.preview.elemental">
            <span v-if="pointerPosition.preview.elemental.prefix">
              {{ pointerPosition.preview.elemental.prefix }} /
            </span>
            <ElementalRelationshipIcons
              :hands="pointerPosition.preview.elemental.hands"
              :props="pointerPosition.preview.elemental.props"
              :hands-indeterminate="pointerPosition.preview.elemental.handsIndeterminate"
              :props-indeterminate="pointerPosition.preview.elemental.propsIndeterminate"
              :size="16"
            />
          </template>
          <template v-else>{{ pointerPosition.preview.label }}</template>
        </span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useConceptPreviewRenderer } from '@/features/concepts/composables/useConceptPreviewRenderer'
import type { ConceptPreviewDimensions } from '@/features/concepts/composables/useConceptPreviewRenderer'
import type { RootDataFinal } from '@/types/AnimTypes'
import { builderPatternDragType } from '@/features/builder/types'
import { isVtgBuilderDropAllowed } from '@/features/builder/isVtgBuilderDropAllowed'
import type { BuilderPatternDrop } from '@/features/builder/types'
import type { ConceptPatternSelection } from '@/features/concepts/types'
import {
  toVtgBuilderDisplayAnimation,
  type VtgBuilderDisplaySettings,
} from '@/features/builder/toVtgBuilderDisplayAnimation'
import type { PatternRelationships } from '@/features/concepts/math/describePatternRelationships'
import { vtgThickControl } from '@/features/vtg/data/vtgPlayerSettings'
import { inferVtgDoubledPortionSpeedRatio } from '@/features/vtg/math/inferVtgSpeedRatio'
import { getVtgBuilderMotion } from '@/features/builder/describeVtgBuilderMotion'
import AppTooltip from '@/components/AppTooltip.vue'
import BaseIcon from '@/components/icons/BaseIcon.vue'
import { mdiRotate3dVariant, mdiSwapHorizontal, mdiTrashCanOutline } from '@mdi/js'
import { useTouchSafeRangeSlider } from '@/composables/useTouchSafeRangeSlider'
import {
  builderPatternPointerDropEvent,
  builderPatternPointerEndEvent,
  builderPatternPointerMoveEvent,
} from '@/features/builder/patternPointerDrag'
import type { BuilderPatternPointerDetail } from '@/features/builder/patternPointerDrag'
import ConceptStepper from '@/features/concepts/components/ConceptStepper.vue'
import ElementalRelationshipIcons from '@/features/concepts/components/ElementalRelationshipIcons.vue'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'

const props = withDefaults(
  defineProps<{
    animations: readonly RootDataFinal[]
    refreshKey: string
    columns?: number
    initialBeatCounts: readonly number[]
    beatCounts: readonly number[]
    relationships: readonly PatternRelationships[]
    maximumScale?: number
    displaySettings?: VtgBuilderDisplaySettings
    selectedIndex?: number
    allowFirstDrop?: boolean
    structureEditingEnabled?: boolean
  }>(),
  { columns: 4, maximumScale: 10, allowFirstDrop: false, structureEditingEnabled: true },
)
const { elementalLayout, sliders } = storeToRefs(useConceptsStore())
const previewReferences = props.animations.map((_, index) => String(index + 1))
const previewGrid = ref<HTMLElement>()
const emit = defineEmits<{
  beatChange: [index: number, beatCount: number]
  sliderStart: []
  sliderEnd: []
  patternDrop: [drop: BuilderPatternDrop]
  patternDelete: [index: number]
  patternReverse: [index: number]
  patternSwap: [index: number]
  patternPreview: [animation: RootDataFinal, index: number]
  selectionChange: [index: number | undefined]
}>()
const dragActive = ref(false)
const { protectTouchScrolling, beginPointerSlider, endPointerSlider, cancelPointerSlider } =
  useTouchSafeRangeSlider({
    begin: () => emit('sliderStart'),
    end: () => emit('sliderEnd'),
  })
const previewRelationships = computed(() => props.relationships)
const previewLabels = computed(() => previewRelationships.value.map(({ label }) => label))
const previewRatios = computed(() => props.animations.map(inferVtgDoubledPortionSpeedRatio))
const dropPlaceholderVisible = computed(
  () =>
    props.structureEditingEnabled &&
    (props.selectedIndex === undefined || props.selectedIndex >= props.animations.length),
)
const propertiesRowEndPosition = computed(() => {
  if (props.selectedIndex === undefined || props.selectedIndex >= previewUrls.value.length) {
    return undefined
  }
  const rowStart = Math.floor(props.selectedIndex / props.columns) * props.columns
  return Math.min(rowStart + props.columns - 1, previewUrls.value.length - 1)
})
const propertiesAfterPreviewIndex = computed(() => {
  const rowEnd = propertiesRowEndPosition.value
  return rowEnd !== undefined && rowEnd < previewUrls.value.length ? rowEnd : undefined
})
const swappablePreviews = computed(() =>
  props.animations.map((animation) => {
    const { spins } = getVtgBuilderMotion(animation)
    return spins[0] !== spins[1]
  }),
)
const pointerPosition = ref<
  { x: number; y: number; preview: BuilderPatternPointerDetail['preview'] } | undefined
>()
useEventListener(typeof document === 'undefined' ? null : document, 'dragstart', () => {
  dragActive.value = true
})
useEventListener(typeof document === 'undefined' ? null : document, 'dragend', () => {
  dragActive.value = false
})
useEventListener(typeof document === 'undefined' ? null : document, 'drop', () => {
  dragActive.value = false
})
const dragOverIndex = ref<number>()
const isDropAllowed = (index: number) =>
  props.structureEditingEnabled &&
  isVtgBuilderDropAllowed({
    portionCount: props.animations.length,
    selectedIndex: props.selectedIndex,
    targetIndex: index,
    allowFirstDrop: props.allowFirstDrop,
  })
const allowPatternDrop = (index: number, event: DragEvent) => {
  if (event.dataTransfer) event.dataTransfer.dropEffect = isDropAllowed(index) ? 'copy' : 'none'
}
const leavePatternDrop = (index: number, event: DragEvent) => {
  const item = event.currentTarget
  if (item instanceof HTMLElement && item.contains(event.relatedTarget as Node | null)) return
  if (dragOverIndex.value === index) dragOverIndex.value = undefined
}
const dropPattern = (previewIndex: number, event: DragEvent) => {
  dragOverIndex.value = undefined
  if (!isDropAllowed(previewIndex)) return
  const serialized = event.dataTransfer?.getData(builderPatternDragType)
  if (!serialized) return
  try {
    emit('patternDrop', {
      previewIndex,
      selection: JSON.parse(serialized) as ConceptPatternSelection,
    })
  } catch {
    // Ignore drag data from outside the Pattern Builder.
  }
}
const pointerDropIndex = (clientX: number, clientY: number) => {
  const target = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>('[data-preview-index]')
  if (!target || !previewGrid.value?.contains(target)) return undefined
  const index = Number(target.dataset.previewIndex)
  return Number.isInteger(index) ? index : undefined
}
const handlePointerMove = (event: Event) => {
  const detail = (event as CustomEvent<BuilderPatternPointerDetail>).detail
  dragActive.value = true
  pointerPosition.value = {
    x: detail.clientX,
    y: detail.clientY,
    preview: detail.preview,
  }
  dragOverIndex.value = pointerDropIndex(detail.clientX, detail.clientY)
}
const handlePointerDrop = (event: Event) => {
  const detail = (event as CustomEvent<BuilderPatternPointerDetail>).detail
  const previewIndex = pointerDropIndex(detail.clientX, detail.clientY)
  if (previewIndex !== undefined && isDropAllowed(previewIndex)) {
    emit('patternDrop', { previewIndex, selection: detail.selection })
  }
  dragActive.value = false
  dragOverIndex.value = undefined
  pointerPosition.value = undefined
}
const endPointerDrag = () => {
  dragActive.value = false
  dragOverIndex.value = undefined
  pointerPosition.value = undefined
}
useEventListener(
  typeof document !== 'undefined' ? document : null,
  builderPatternPointerMoveEvent,
  handlePointerMove,
)
useEventListener(
  typeof document !== 'undefined' ? document : null,
  builderPatternPointerDropEvent,
  handlePointerDrop,
)
useEventListener(
  typeof document !== 'undefined' ? document : null,
  builderPatternPointerEndEvent,
  endPointerDrag,
)
const minimumBeatCount = (index: number) =>
  Math.max(0.5, (props.initialBeatCounts[index] ?? 0.5) - 2)
const maximumBeatCount = (index: number) => Math.min(8, (props.initialBeatCounts[index] ?? 8) + 2)
const updateBeatCount = (index: number, event: Event) => {
  if (event.target instanceof HTMLInputElement)
    emit('beatChange', index, event.target.valueAsNumber)
}
const updateBeatCountValue = (index: number, value: number) => {
  emit('sliderStart')
  emit('beatChange', index, value)
  emit('sliderEnd')
}
const previewPattern = (index: number) => {
  const nextIndex = props.selectedIndex === index ? undefined : index
  emit('selectionChange', nextIndex)
  if (nextIndex === undefined) return
  const animation = props.animations[index]
  if (animation) emit('patternPreview', animation, index)
}
const { width } = useElementSize(previewGrid)
const dimensions = reactive<ConceptPreviewDimensions[]>(
  previewReferences.map(() => ({ width: 0, height: 0 })),
)

const { previewUrls, requestPreviews } = useConceptPreviewRenderer({
  dimensions,
  references: previewReferences,
  createAnimation: (reference) => {
    const animation = props.animations[Number(reference) - 1]
    if (!animation) return undefined

    if (props.displaySettings)
      return toVtgBuilderDisplayAnimation(animation, props.displaySettings, {
        thumbnail: true,
        maximumScale: props.maximumScale,
      })

    const display = toVtgBuilderDisplayAnimation(animation, undefined, {
      maximumScale: props.maximumScale,
    })
    return {
      ...display,
      thick: vtgThickControl.max,
      props: display.props.map((prop) => ({ ...prop, thick: vtgThickControl.max })),
    }
  },
  label: 'VTG 45 Trans',
  frame: 'final',
})

watch([width, () => props.columns], ([gridWidth]) => {
  const previewSize = gridWidth / props.columns
  dimensions.forEach((item) => {
    item.width = previewSize
    item.height = previewSize
  })
  requestPreviews()
})
watch([() => props.animations, () => props.refreshKey], requestPreviews)
</script>

<style scoped>
.vtg-transition-previews {
  display: grid;
  grid-template-columns: repeat(var(--vtg-transition-preview-columns), minmax(0, 1fr));
  gap: var(--space-1);
  width: min(calc(100% - var(--space-2)), 45rem);
  margin: var(--space-2) auto 0;
}

.vtg-transition-previews__item {
  position: relative;
  min-width: 0;
  border-radius: var(--radius-sm);
}

.vtg-transition-previews__properties {
  min-width: 0;
  grid-column: 1 / -1;
}

.vtg-transition-previews__item--selected {
  box-shadow: 0 0 0 2px var(--color-status-warning);
}

.vtg-transition-previews__item--drag-over {
  box-shadow: 0 0 0 2px var(--color-action-primary);
}

.vtg-transition-previews__item--drop-blocked {
  box-shadow: 0 0 0 2px var(--color-status-error);
}

.vtg-transition-previews__pointer-drag {
  /* VTG category colors are fixed domain colors and must travel with the teleported drag layer. */
  --vtg-pointer-color-primary: #5968df;
  --vtg-pointer-color-rule-text: #f6f8fb;

  position: fixed;
  z-index: calc(var(--z-tooltip) + 1);
  display: grid;
  min-width: 3rem;
  min-height: 3rem;
  overflow: hidden;
  color: var(--vtg-pointer-color-rule-text);
  pointer-events: none;
  background: var(--vtg-pointer-color-primary);
  border: 2px solid var(--vtg-pointer-color-rule-text);
  border-radius: 1.7cqi;
  box-shadow: var(--shadow-sm);
  opacity: 0.92;
  place-items: center;
  transform: translate(-50%, -50%);
}

.vtg-transition-previews__pointer-drag-image {
  width: 78%;
  height: 78%;
  object-fit: contain;
}

.vtg-transition-previews__pointer-drag-label {
  position: absolute;
  inset-block-end: var(--space-1);
  inset-inline: var(--space-1);
  overflow: hidden;
  font-family: 'Arial Narrow', var(--font-family-sans);
  font-size: var(--font-size-concept-control);
  font-weight: 700;
  line-height: 1;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vtg-transition-previews__pointer-drag-label--elemental {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
}

.vtg-transition-previews__placeholder {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  padding: var(--space-3);
  border: 2px dashed var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 32%, transparent);
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: inherit;
  text-align: center;
  font-size: var(--font-size-concept-control);
  font-weight: 700;
}

.vtg-transition-previews__visual {
  position: relative;
  box-sizing: border-box;
  display: block;
  width: 100%;
  padding: 0;
  overflow: hidden;
  aspect-ratio: 1;
  color: inherit;
  cursor: pointer;
  background: color-mix(in srgb, var(--color-surface) 28%, transparent);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
}

.vtg-transition-previews__tooltip {
  display: flex;
  width: 100%;
}

.vtg-transition-previews__visual:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.vtg-transition-previews__actions {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.vtg-transition-previews__delete-action {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  z-index: 1;
}

.vtg-transition-previews__delete {
  display: grid;
  padding: var(--space-1);
  color: var(--color-text-muted);
  cursor: pointer;
  background: color-mix(in srgb, var(--color-surface) 82%, transparent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  opacity: 0;
  pointer-events: none;
  place-items: center;
}

.vtg-transition-previews__item--selected .vtg-transition-previews__delete,
.vtg-transition-previews__delete:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: hover) {
  .vtg-transition-previews:not(.vtg-transition-previews--has-selection)
    .vtg-transition-previews__item:hover
    .vtg-transition-previews__delete {
    opacity: 1;
    pointer-events: auto;
  }
}

.vtg-transition-previews__delete:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.vtg-transition-previews__transform-actions {
  position: absolute;
  inset-block-start: var(--space-1);
  inset-inline-start: var(--space-1);
  z-index: 2;
  display: grid;
  gap: var(--space-1);
}

.vtg-transition-previews__reverse,
.vtg-transition-previews__swap {
  display: grid;
  padding: var(--space-1);
  color: var(--color-text);
  cursor: pointer;
  background: color-mix(in srgb, var(--color-surface) 82%, transparent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  opacity: 0;
  pointer-events: none;
  place-items: center;
}

.vtg-transition-previews__item--selected .vtg-transition-previews__reverse,
.vtg-transition-previews__item--selected .vtg-transition-previews__swap,
.vtg-transition-previews__reverse:focus-visible,
.vtg-transition-previews__swap:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

.vtg-transition-previews__reverse:focus-visible,
.vtg-transition-previews__swap:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

@media (hover: hover) {
  .vtg-transition-previews:not(.vtg-transition-previews--has-selection)
    .vtg-transition-previews__item:hover
    .vtg-transition-previews__reverse,
  .vtg-transition-previews:not(.vtg-transition-previews--has-selection)
    .vtg-transition-previews__item:hover
    .vtg-transition-previews__swap {
    opacity: 1;
    pointer-events: auto;
  }
}

.vtg-transition-previews__label,
.vtg-transition-previews__ratio {
  position: absolute;
  bottom: var(--space-1);
  z-index: 1;
  padding-inline: var(--space-1);
  color: var(--color-text);
  font-size: var(--font-size-concept-control);
  font-weight: 800;
  line-height: 1.4;
  pointer-events: none;
  background: color-mix(in srgb, var(--color-surface) 78%, transparent);
  border-radius: var(--radius-sm);
}

.vtg-transition-previews__label {
  inset-inline-end: var(--space-1);
}

.vtg-transition-previews__ratio {
  inset-inline-start: var(--space-1);
}

.vtg-label-swap-enter-active,
.vtg-label-swap-leave-active {
  transition:
    opacity var(--transition-label-swap),
    scale var(--transition-label-swap),
    filter var(--transition-label-swap);
}

.vtg-label-swap-enter-from,
.vtg-label-swap-leave-to {
  opacity: 0;
  scale: 0.72;
  filter: blur(3px);
}

@media (prefers-reduced-motion: reduce) {
  .vtg-label-swap-enter-active,
  .vtg-label-swap-leave-active {
    transition: none;
  }
}

.vtg-transition-previews--drag-active .vtg-transition-previews__delete {
  display: none;
}

.vtg-transition-previews--drag-active .vtg-transition-previews__transform-actions {
  display: none;
}

.vtg-transition-previews__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vtg-transition-previews__beats {
  display: grid;
  margin-block-start: var(--space-1);
  padding-inline: var(--space-1);
  gap: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-concept-control);
  font-weight: 700;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.vtg-transition-previews__beats input {
  width: 100%;
  min-width: 0;
  accent-color: var(--color-action-primary);
  cursor: pointer;
}

.vtg-transition-previews--touch-sliders .vtg-transition-previews__beats input {
  touch-action: pan-y;
}

.vtg-transition-previews__beats input:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.vtg-transition-previews__beats output {
  min-width: 2em;
  text-align: end;
}

.vtg-transition-previews__beats .concept-stepper {
  grid-column: 1 / -1;
  width: 100%;
}

.vtg-transition-previews__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
</style>
