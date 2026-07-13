<template>
  <div class="slider" :style="sliderStyle">
    <div class="slider-control"><slot name="play" /></div>
    <div class="slider-track">
      <template v-if="SELECTION">
        <input
          class="range range--selection range--start"
          type="range"
          aria-label="Selection start"
          :value="SELECTED[0]"
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
          :value="SELECTED[1]"
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
      <input
        v-else
        class="range"
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

  if (autoPlay) PLAYING.value = true
}

const inputValue = (event: Event) => Number((event.currentTarget as HTMLInputElement).value)

const setCurrent = (event: Event) => {
  CURRENT.value = inputValue(event)
  update()
}

const setSelectionStart = (event: Event) => {
  const start = Math.min(inputValue(event), SELECTED.value[1] ?? 0)
  SELECTED.value = [start, SELECTED.value[1] ?? start]
  update()
}

const setSelectionEnd = (event: Event) => {
  const end = Math.max(inputValue(event), SELECTED.value[0] ?? 0)
  SELECTED.value = [SELECTED.value[0] ?? end, end]
  update()
}

watch(SELECTED, (val, old) => {
  const [start = 0, end = 0] = val
  const [oldStart = 0, oldEnd = 0] = old

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

.range--selection {
  position: absolute;
  inset-inline: 0;
  pointer-events: none;
  background: transparent;
}

.range--selection::-webkit-slider-thumb {
  pointer-events: auto;
}

.range--selection::-moz-range-thumb {
  pointer-events: auto;
}

.range:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 3px;
}
</style>
