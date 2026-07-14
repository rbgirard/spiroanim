<template>
  <div class="slider" :style="sliderStyle">
    <div class="slider-control"><slot name="play" /></div>
    <div class="slider-track">
      <template v-if="SELECTION">
        <div class="selection-track" aria-hidden="true">
          <div class="selection-fill" :style="selectionFillStyle" />
        </div>
        <input
          class="range range--selection range--start"
          type="range"
          aria-label="Selection start"
          :value="selectionHandles[0]"
          :max="max"
          step="1"
          min="0"
          @input="setSelectionStart"
          @pointerdown="start"
          @pointerup="end"
          @pointercancel="end"
          @keydown="start"
          @keyup="end"
          @blur="end"
        />
        <input
          class="range range--selection range--end"
          type="range"
          aria-label="Selection end"
          :value="selectionHandles[1]"
          :max="max"
          step="1"
          min="0"
          @input="setSelectionEnd"
          @pointerdown="start"
          @pointerup="end"
          @pointercancel="end"
          @keydown="start"
          @keyup="end"
          @blur="end"
        />
      </template>
      <template v-else>
        <div class="selection-track" aria-hidden="true">
          <div class="selection-fill" :style="positionFillStyle" />
        </div>
        <input
          class="range range--custom range--position"
          type="range"
          aria-label="Animation position"
          :value="CURRENT"
          :max="max"
          step="1"
          min="0"
          @input="setCurrent"
          @pointerdown="start"
          @pointerup="end"
          @pointercancel="end"
          @keydown="start"
          @keyup="end"
          @blur="end"
        />
      </template>
    </div>
    <div class="slider-control"><slot name="mode" /></div>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '@/stores/usePlayerStore'

const props = defineProps<{
  store: string
}>()

const playerStore = usePlayerStore(props.store)
const { CURRENT } = playerStore.raw()
const { PLAYING, UPDATE, SELECTION, SELECTED, COUNT, MAX, UTIMES } = storeToRefs(playerStore)

const dim = inject<Readonly<{ width: number; height: number }>>('dim')

let autoPlay = false
let interacting = false
const selectionHandles = ref<[number, number]>([SELECTED.value[0] ?? 0, SELECTED.value[1] ?? 0])
let previousSelection: [number, number] = [...selectionHandles.value]

// Switches MAX between COUNT and MAX
const max = computed(() => (SELECTION.value ? COUNT.value : MAX.value))

// Informs the PLAYER we've made modifications
const update = (/*val: number | [number, number]*/) => {
  UPDATE.value = Symbol()
}

const start = (/*original: number*/) => {
  if (interacting) return
  interacting = true

  if (PLAYING.value) {
    PLAYING.value = false
    autoPlay = true
  } else autoPlay = false
}

const end = (/*final: number*/) => {
  if (!interacting) return
  interacting = false
  selectionHandles.value = [SELECTED.value[0] ?? 0, SELECTED.value[1] ?? 0]

  if (autoPlay) PLAYING.value = true
}

const inputValue = (event: Event) => Number((event.currentTarget as HTMLInputElement).value)

const setCurrent = (event: Event) => {
  CURRENT.value = inputValue(event)
  update()
}

const setSelectionStart = (event: Event) => {
  selectionHandles.value[0] = inputValue(event)
  SELECTED.value = [...selectionHandles.value].sort((a, b) => a - b) as [number, number]
  update()
}

const setSelectionEnd = (event: Event) => {
  selectionHandles.value[1] = inputValue(event)
  SELECTED.value = [...selectionHandles.value].sort((a, b) => a - b) as [number, number]
  update()
}

watch(
  SELECTED,
  (val) => {
    const [start = 0, end = 0] = val
    const [oldStart, oldEnd] = previousSelection

    if (!interacting) selectionHandles.value = [start, end]

    if (end !== oldEnd) {
      // If end index changed:
      // - Normally set CURRENT to UTIMES[end]
      // - But if moving forward (end > start), we adjust CURRENT to just before end
      //   so playback logic doesn't overshoot or duplicate the final frame
      CURRENT.value = (UTIMES.value[end] ?? 0) + (end > start ? -1 : 0)
    } else if (start !== oldStart) {
      // If only the start changed, set CURRENT to that new start frame
      CURRENT.value = UTIMES.value[start] ?? 0
    }

    previousSelection = [start, end]
  },
  { deep: true },
)

watch(
  SELECTION,
  (selection) => {
    if (selection && !interacting)
      selectionHandles.value = [SELECTED.value[0] ?? 0, SELECTED.value[1] ?? 0]
  },
  { flush: 'post' },
)

const selectionFillStyle = computed<CSSProperties>(() => {
  const count = Math.max(COUNT.value, 0)
  const start = Math.min(Math.max(SELECTED.value[0] ?? 0, 0), count)
  const end = Math.min(Math.max(SELECTED.value[1] ?? 0, start), count)
  const startPercent = count === 0 ? 0 : (start / count) * 100
  const endPercent = count === 0 ? 0 : (end / count) * 100

  return {
    'inset-inline-start': `${startPercent}%`,
    'inset-inline-end': `${100 - endPercent}%`,
  }
})

const positionFillStyle = computed<CSSProperties>(() => {
  const maximum = Math.max(MAX.value, 0)
  const current = Math.min(Math.max(CURRENT.value, 0), maximum)
  const currentPercent = maximum === 0 ? 0 : (current / maximum) * 100

  return {
    'inset-inline-start': '0%',
    'inset-inline-end': `${100 - currentPercent}%`,
  }
})

const sliderStyle = computed<CSSProperties>(() => ({
  width: `${Math.max((dim?.width ?? 0) - 45, 0)}px`,
  position: 'absolute',
  bottom: '10px',
  right: '0px',
}))
</script>

<style scoped>
.slider {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr) 2.25rem;
  gap: var(--space-2);
  align-items: center;
  color: var(--color-action-primary);
}

.slider-control {
  display: flex;
  align-items: center;
  justify-content: center;
}

.slider-track {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 2rem;
}

.range {
  width: 100%;
  margin: 0;
  accent-color: var(--color-action-primary);
  cursor: pointer;
}

.range--custom,
.range--selection {
  position: absolute;
  inset-inline: 0;
  z-index: 1;
  appearance: none;
  background: transparent;
}

.range--selection {
  pointer-events: none;
}

.selection-track {
  position: absolute;
  inset-inline: 0;
  height: 0.375rem;
  overflow: hidden;
  background: var(--color-border);
  border-radius: var(--radius-md);
}

.selection-fill {
  position: absolute;
  inset-block: 0;
  background: var(--color-action-primary);
  border-radius: inherit;
}

.range--custom::-webkit-slider-runnable-track,
.range--selection::-webkit-slider-runnable-track {
  height: 0.375rem;
  background: transparent;
  border: 0;
}

.range--custom::-webkit-slider-thumb,
.range--selection::-webkit-slider-thumb {
  position: relative;
  z-index: 2;
  width: 1rem;
  height: 1rem;
  margin-block-start: -0.3125rem;
  appearance: none;
  pointer-events: auto;
  background: var(--color-action-primary);
  border: 2px solid var(--color-surface);
  border-radius: 50%;
}

.range--custom::-moz-range-track,
.range--selection::-moz-range-track {
  height: 0.375rem;
  background: transparent;
  border: 0;
}

.range--custom::-moz-range-progress,
.range--selection::-moz-range-progress {
  height: 0.375rem;
  background: transparent;
}

.range--custom::-moz-range-thumb,
.range--selection::-moz-range-thumb {
  width: 1rem;
  height: 1rem;
  pointer-events: auto;
  background: var(--color-action-primary);
  border: 2px solid var(--color-surface);
  border-radius: 50%;
}

.range--custom:focus,
.range--custom:active,
.range--selection:focus,
.range--selection:active {
  z-index: 2;
}

.range.range--custom:focus-visible,
.range.range--selection:focus-visible {
  outline: none;
}

.range--custom:focus-visible::-webkit-slider-thumb,
.range--selection:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-action-primary) 35%, transparent);
}

.range--custom:focus-visible::-moz-range-thumb,
.range--selection:focus-visible::-moz-range-thumb {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-action-primary) 35%, transparent);
}

.range:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 3px;
}
</style>
