<template>
  <fieldset
    ref="quickSlotsElement"
    class="quick-slots"
    :class="{ 'quick-slots--split': slotGroups.length > 1 }"
    data-role="quick-slots"
    :data-row-count="slotGroups.length"
  >
    <legend class="quick-slots__visually-hidden">Quick Slots</legend>

    <div
      v-for="(slotGroup, rowIndex) in slotGroups"
      :key="rowIndex"
      class="quick-slots__row"
      data-role="quick-slots-row"
    >
      <AppTooltip v-if="rowIndex === 0" text="Remove a Quick Slot" :disabled="touchDevice">
        <template #activator="{ props: activatorProps }">
          <QuickSlotVisual
            v-bind="activatorProps"
            aria-label="Remove a Quick Slot"
            data-role="quick-slot-remove"
            @click="conceptsStore.removeQuickSlot()"
          >
            <BaseIcon :path="mdiMinus" :size="18" />
          </QuickSlotVisual>
        </template>
      </AppTooltip>

      <AppTooltip
        v-for="slot in slotGroup"
        :key="slot"
        :text="quickSlotTooltip(slot)"
        :disabled="touchDevice"
      >
        <template #activator="{ props: activatorProps }">
          <label
            v-bind="activatorProps"
            :data-role="`quick-slot-${slot}`"
            @click.capture="suppressClickAfterLongPress($event, slot)"
            @pointerdown="startLongPress($event, slot)"
            @pointermove="cancelLongPressAfterMove"
            @pointerup="finishLongPress"
            @pointercancel="cancelLongPress"
            @pointerleave="cancelLongPress"
            @contextmenu.prevent
          >
            <QuickSlotVisual
              v-if="applyOnly"
              :class="{ 'quick-slot-visual--selected': selectedQuickSlot === slot }"
              :aria-pressed="selectedQuickSlot === slot"
              :aria-label="quickSlotLabel(slot)"
              :disabled="!quickSlotHasContent(slot)"
              @click="loadWithoutSelecting(slot)"
              @keydown.delete.prevent="clearStoredQuickSlot(slot)"
              @keydown.backspace.prevent="clearStoredQuickSlot(slot)"
            >
              Q{{ slot }}
              <span
                v-if="quickSlotHasContent(slot)"
                class="quick-slot-saved-indicator"
                data-role="quick-slot-saved-indicator"
                aria-hidden="true"
              />
            </QuickSlotVisual>
            <input
              v-else
              v-model="selectedQuickSlot"
              type="radio"
              name="quick-slot"
              :value="slot"
              :aria-label="quickSlotLabel(slot)"
              @click.capture="handleSelectedQuickSlotClick(slot)"
              @change="applyQuickSlot(slot)"
              @keydown.delete.prevent="clearStoredQuickSlot(slot)"
              @keydown.backspace.prevent="clearStoredQuickSlot(slot)"
            />
            <QuickSlotVisual v-if="!applyOnly" tag="span">
              Q{{ slot }}
              <span
                v-if="quickSlotHasContent(slot)"
                class="quick-slot-saved-indicator"
                data-role="quick-slot-saved-indicator"
                aria-hidden="true"
              />
            </QuickSlotVisual>
          </label>
        </template>
      </AppTooltip>

      <AppTooltip
        v-if="rowIndex === slotGroups.length - 1"
        text="Add a Quick Slot"
        :disabled="touchDevice"
      >
        <template #activator="{ props: activatorProps }">
          <QuickSlotVisual
            v-bind="activatorProps"
            aria-label="Add a Quick Slot"
            data-role="quick-slot-add"
            @click="addAndSelectQuickSlot"
          >
            <BaseIcon :path="mdiPlus" :size="18" />
          </QuickSlotVisual>
        </template>
      </AppTooltip>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { mdiMinus, mdiPlus } from '@mdi/js'

import BaseIcon from '@/components/icons/BaseIcon.vue'
import AppTooltip from '@/components/AppTooltip.vue'
import QuickSlotVisual from '@/features/concepts/components/QuickSlotVisual.vue'
import { useBalancedControlRows } from '@/composables/useBalancedControlRows'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { isTouchDevice } from '@/utils/device'

const props = withDefaults(defineProps<{ applyOnly?: boolean }>(), { applyOnly: false })
const emit = defineEmits<{
  apply: [path: string]
  save: [slot: number]
}>()

const conceptsStore = useConceptsStore()
const { quickSlotCount, quickSlotPaths, selectedQuickSlot } = storeToRefs(conceptsStore)
const quickSlots = computed(() =>
  Array.from({ length: quickSlotCount.value }, (_, index) => index + 1),
)
const { containerElement: quickSlotsElement, itemGroups: slotGroups } = useBalancedControlRows(
  quickSlots,
  {
    controlSelector: '.quick-slot-visual',
    extraControlCount: 2,
  },
)
const touchDevice = typeof navigator !== 'undefined' && isTouchDevice()
const longPressDuration = 500
const longPressMoveTolerance = 10
let longPressTimer: ReturnType<typeof setTimeout> | undefined
let longPressPointerId: number | undefined
let longPressStart = { x: 0, y: 0 }
let suppressClickSlot: number | undefined

const quickSlotHasContent = (slot: number) => typeof quickSlotPaths.value[slot - 1] === 'string'

const quickSlotLabel = (slot: number) =>
  `Quick Slot ${slot}, ${quickSlotHasContent(slot) ? 'saved; press and hold to clear' : 'empty'}`

const quickSlotPathLabel = (slot: number) =>
  quickSlotPaths.value[slot - 1]?.split(/[?#]/, 1)[0]?.replace(/^\/+/, '')

const quickSlotTooltip = (slot: number) => {
  const pathLabel = quickSlotPathLabel(slot)
  const instruction = `${props.applyOnly ? 'Load' : selectedQuickSlot.value === slot ? 'Clear' : 'Select'} Quick Slot ${slot} (${quickSlotHasContent(slot) ? 'Saved - hold to clear' : 'Empty'})`
  return pathLabel ? `${instruction}\nLoads: ${pathLabel}` : instruction
}

const addAndSelectQuickSlot = () => {
  conceptsStore.addQuickSlot()
  if (!props.applyOnly) selectedQuickSlot.value = quickSlotCount.value
}

const loadWithoutSelecting = (slot: number) => {
  if (selectedQuickSlot.value === slot) selectedQuickSlot.value = null
  const path = quickSlotPaths.value[slot - 1]
  if (path) emit('apply', path)
}

const clearStoredQuickSlot = (slot: number) => {
  if (quickSlotHasContent(slot)) conceptsStore.clearQuickSlot(slot)
}

const cancelLongPress = (event?: PointerEvent) => {
  if (event && longPressPointerId !== event.pointerId) return
  if (longPressTimer !== undefined) clearTimeout(longPressTimer)
  longPressTimer = undefined
  longPressPointerId = undefined
}

const startLongPress = (event: PointerEvent, slot: number) => {
  // A completed long press owns its ensuing click until that click is delivered. If the browser
  // never synthesizes one, the next real pointer interaction starts a fresh activation instead.
  suppressClickSlot = undefined
  if (event.button !== 0 || !event.isPrimary || !quickSlotHasContent(slot)) return

  cancelLongPress()
  longPressPointerId = event.pointerId
  longPressStart = { x: event.clientX, y: event.clientY }
  longPressTimer = setTimeout(() => {
    longPressTimer = undefined
    suppressClickSlot = slot
    clearStoredQuickSlot(slot)
  }, longPressDuration)
}

const cancelLongPressAfterMove = (event: PointerEvent) => {
  if (longPressPointerId !== event.pointerId) return
  if (
    Math.hypot(event.clientX - longPressStart.x, event.clientY - longPressStart.y) >
    longPressMoveTolerance
  )
    cancelLongPress(event)
}

const finishLongPress = (event: PointerEvent) => {
  cancelLongPress(event)
  if (suppressClickSlot !== undefined) event.preventDefault()
}

const suppressClickAfterLongPress = (event: MouseEvent, slot: number) => {
  if (suppressClickSlot !== slot) return
  event.preventDefault()
  event.stopPropagation()
  suppressClickSlot = undefined
}

const handleSelectedQuickSlotClick = (slot: number) => {
  if (selectedQuickSlot.value !== slot) return
  if (quickSlotHasContent(slot)) conceptsStore.toggleQuickSlot(slot)
  else emit('save', slot)
}

const applyQuickSlot = (slot: number) => {
  const path = conceptsStore.quickSlotPaths[slot - 1]
  if (path) emit('apply', path)
  else emit('save', slot)
}

onBeforeUnmount(() => {
  cancelLongPress()
})
</script>

<style scoped>
.quick-slots {
  display: flex;
  width: max(
    0px,
    calc(100% - var(--size-concepts-docs-trigger) - var(--size-concepts-docs-trigger))
  );
  min-inline-size: 0;
  max-inline-size: 100%;
  padding: var(--space-1);
  margin: 0 auto;
  border: 0;
  gap: var(--space-1);
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.quick-slots__row {
  display: contents;
}

.quick-slots--split {
  display: grid;
}

.quick-slots--split .quick-slots__row {
  display: flex;
  justify-content: center;
  gap: var(--space-1);
}

.quick-slots label {
  position: relative;
  cursor: pointer;
}

.quick-slots input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.quick-slots input:checked + .quick-slot-visual,
.quick-slots .quick-slot-visual--selected {
  --quick-slot-accent: color-mix(
    in srgb,
    var(--color-action-primary) 68%,
    var(--color-status-success)
  );
  color: var(--color-on-action-primary);
  background: var(--quick-slot-accent);
  border-color: var(--quick-slot-accent);
  box-shadow: var(--shadow-sm);
}

.quick-slots label:hover > input:not(:checked) + .quick-slot-visual {
  --quick-slot-accent: color-mix(
    in srgb,
    var(--color-action-primary) 68%,
    var(--color-status-success)
  );
  background: color-mix(in srgb, var(--quick-slot-accent) 17%, var(--color-surface));
}

.quick-slots input:focus-visible + .quick-slot-visual {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.quick-slot-saved-indicator {
  position: absolute;
  right: var(--space-1);
  bottom: var(--space-1);
  width: 0.3rem;
  height: 0.3rem;
  background: currentColor;
  border-radius: 50%;
}

.quick-slots__visually-hidden {
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
