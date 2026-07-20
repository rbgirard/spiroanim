<template>
  <AppTooltip v-if="showControl" class="fullscreen-control" :text="label" placement="bottom">
    <template #activator="{ props: tooltipProps }">
      <button
        v-bind="tooltipProps"
        :aria-label="label"
        class="fullscreen"
        type="button"
        @click="toggle"
      >
        <BaseIcon :path="icon" />
      </button>
    </template>
  </AppTooltip>
</template>

<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { mdiFullscreen, mdiFullscreenExit } from '@mdi/js'

import AppTooltip from '@/components/AppTooltip.vue'
import BaseIcon from '@/components/icons/BaseIcon.vue'
import { useAppDisplayMode } from '@/composables/useAppDisplayMode'

const { isFullscreen, isSupported, toggle } = useFullscreen()
const { isInstalledDisplay, isIos } = useAppDisplayMode()
const showControl = computed(() => isSupported.value && !isIos.value && !isInstalledDisplay.value)
const icon = computed(() => (isFullscreen.value ? mdiFullscreenExit : mdiFullscreen))
const label = computed(() => (isFullscreen.value ? 'Exit full screen' : 'Enter full screen'))
</script>

<style scoped>
.fullscreen-control {
  position: absolute;
  top: calc(var(--space-1) + var(--safe-area-inset-top));
  left: calc(var(--space-1) + var(--safe-area-inset-left));
  z-index: 1000;
}

.fullscreen {
  display: grid;
  width: 2rem;
  height: 2rem;
  padding: 0;
  place-items: center;
  color: var(--color-text-muted);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
}

.fullscreen:hover {
  color: var(--color-action-primary);
}

.fullscreen:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
