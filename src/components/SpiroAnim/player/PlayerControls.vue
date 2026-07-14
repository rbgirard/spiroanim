<template>
  <Progress :store="props.store">
    <template #play>
      <AppTooltip text="Play / Pause">
        <template #activator="{ props: tooltipProps }">
          <button
            v-bind="tooltipProps"
            class="icon-button icon-button--primary"
            type="button"
            :aria-label="PLAYING ? 'Pause' : 'Play'"
            @click="clickPlay"
          >
            <BaseIcon :path="playIcon" size="30" />
          </button>
        </template>
      </AppTooltip>
    </template>
    <template #mode>
      <AppTooltip text="Select Mode">
        <template #activator="{ props: tooltipProps }">
          <button
            v-bind="tooltipProps"
            class="icon-button icon-button--primary"
            type="button"
            :aria-pressed="SELECTION"
            aria-label="Select mode"
            @click="clickMode"
          >
            <BaseIcon :path="modeIcon" size="30" />
          </button>
        </template>
      </AppTooltip>
    </template>
  </Progress>

  <AppTooltip class="btnCenter" text="Center Camera">
    <template #activator="{ props: tooltipProps }">
      <button
        v-bind="tooltipProps"
        class="icon-button"
        type="button"
        aria-label="Center camera"
        @click="cameraCenter = Symbol()"
      >
        <BaseIcon :path="mdiImageFilterCenterFocusWeak" size="30" />
      </button>
    </template>
  </AppTooltip>
  <AppTooltip class="btnTracer" text="Tracer Mode">
    <template #activator="{ props: tooltipProps }">
      <button
        v-bind="tooltipProps"
        class="icon-button"
        type="button"
        :aria-pressed="TRACER"
        aria-label="Tracer mode"
        @click="clickTracer"
      >
        <BaseIcon :path="tracerIcon" size="30" />
      </button>
    </template>
  </AppTooltip>
  <AppTooltip class="btnPicture" text="Save Image">
    <template #activator="{ props: tooltipProps }">
      <button
        v-bind="tooltipProps"
        class="icon-button"
        type="button"
        aria-label="Save image"
        @click="clickPicture"
      >
        <BaseIcon :path="pictureIcon" size="30" />
      </button>
    </template>
  </AppTooltip>

  <label class="speed">
    <span>Speed</span>
    <select v-model.number="speed" aria-label="Playback speed">
      <option v-for="option in speedOptions" :key="option" :value="option">{{ option }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
import BaseIcon from '@/components/icons/BaseIcon.vue'
import AppTooltip from '@/components/AppTooltip.vue'
import {
  mdiImageFilterCenterFocusWeak,
  mdiFirework,
  mdiFireworkOff,
  mdiPanoramaVariant,
  mdiPauseCircleOutline,
  mdiPlayCircleOutline,
  mdiVectorSelection,
  mdiSelectionMultiple,
} from '@mdi/js'

import Progress from './PlayerProgress.vue'

import { usePlayerStore } from '@/stores/usePlayerStore'

const props = defineProps<{
  store: string
}>()

const playerStore = usePlayerStore(props.store)
const { ROOT, CURRENT } = playerStore.raw()
const { cameraCenter, saveImage, TRACER, PLAYING, SELECTION, INDEX, UTIMES, UPDATE, SELECTED } =
  storeToRefs(playerStore)

const speedOptions = [4, 3, 2, 1, 0.5, 0.25, 0.1] as const
const speed = ref(ROOT.value.speed)

// Trigger shallow watchers
watch(speed, (val) => {
  ROOT.value.speed = val
  triggerRef(ROOT)
})

const clickTracer = () => (TRACER.value = !TRACER.value)

const clickPicture = () => (saveImage.value = Symbol())

const clickPlay = () => {
  PLAYING.value = !PLAYING.value
}

const clickMode = () => {
  const index = INDEX.value
  const max = UTIMES.value.length - 1
  UPDATE.value = Symbol()

  if ((SELECTION.value = !SELECTION.value)) {
    CURRENT.value = UTIMES.value[index] ?? 0
    SELECTED.value[0] = index
    SELECTED.value[1] = Math.min(index + 1, max) // index + 1 > max ? index : index + 1
  }
}

const pictureIcon = mdiPanoramaVariant
const tracerIcon = computed(() => (TRACER.value ? mdiFirework : mdiFireworkOff))
const playIcon = computed(() => (PLAYING.value ? mdiPauseCircleOutline : mdiPlayCircleOutline))
const modeIcon = computed(() => (SELECTION.value ? mdiVectorSelection : mdiSelectionMultiple))
</script>

<style scoped>
.btnCenter,
.btnTracer,
.btnPicture {
  position: absolute;
  right: 2px;
}

.btnCenter {
  bottom: 115px;
}

.btnTracer {
  bottom: 80px;
}

.btnPicture {
  bottom: 45px;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  color: var(--color-text-muted);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
}

.icon-button--primary,
.icon-button:hover {
  color: var(--color-action-primary);
}

.icon-button:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.speed {
  position: absolute;
  bottom: 44px;
  left: 10px;
  display: grid;
  width: 48px;
  color: var(--color-text);
  font-size: 0.75rem;
  text-align: left;
}

.speed select {
  width: 100%;
  color: var(--color-text);
  text-align: left;
  background: var(--color-surface);
  border: 0;
  border-block-end: 1px solid var(--color-border);
}

.speed select:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
