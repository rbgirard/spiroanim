<template>
  <div class="resample-animation-frames">
    <AppTooltip>
      <template #activator="{ props: tooltipProps }">
        <a
          v-bind="tooltipProps"
          href="#"
          data-role="double-animation-frames"
          :aria-disabled="!canDouble"
          @click.prevent="applyDouble"
        >
          Double Frames
        </a>
      </template>
      <template #html>
        <strong>Double Frames</strong><br />
        Inserts the exact intermediate frame between every pair of Animation frames and doubles BPM,
        preserving playback timing.<br />
        Disabled when any generated value exceeds its property range or precision, or when the
        generated endpoint would bend a Linear hand path.
      </template>
    </AppTooltip>

    <AppTooltip>
      <template #activator="{ props: tooltipProps }">
        <a
          v-bind="tooltipProps"
          href="#"
          data-role="halve-animation-frames"
          :aria-disabled="!canHalve"
          @click.prevent="applyHalve"
        >
          Halve Frames
        </a>
      </template>
      <template #html>
        <strong>Halve Frames</strong><br />
        Removes every intermediate Animation frame and halves BPM, preserving playback timing.<br />
        Disabled unless every removed frame has the exact values produced by Double Frames.
      </template>
    </AppTooltip>
  </div>
</template>

<script setup lang="ts">
import AppTooltip from '@/components/AppTooltip.vue'
import {
  doubleAnimationFrames,
  halveAnimationFrames,
} from '@/features/editor/manage/resampleAnimationFrames'
import { usePlayerStore } from '@/stores/usePlayerStore'

const store = inject('store', ref('main'))
const playerStore = usePlayerStore(store.value)
const { ROOT } = playerStore.raw()
const { PLAYING } = storeToRefs(playerStore)

const doubled = computed(() => doubleAnimationFrames(ROOT.value))
const halved = computed(() => halveAnimationFrames(ROOT.value))
const canDouble = computed(() => !PLAYING.value && doubled.value !== undefined)
const canHalve = computed(() => !PLAYING.value && halved.value !== undefined)

const applyDouble = () => {
  if (!canDouble.value || doubled.value === undefined) return
  ROOT.value = doubled.value
}

const applyHalve = () => {
  if (!canHalve.value || halved.value === undefined) return
  ROOT.value = halved.value
}
</script>

<style scoped>
.resample-animation-frames {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 5px;
}

[aria-disabled='true'] {
  color: var(--color-text-muted);
  cursor: default;
  opacity: 0.65;
}
</style>
