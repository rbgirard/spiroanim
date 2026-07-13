<template>
  <button
    v-if="display()"
    aria-label="Full Screen Toggle"
    class="fullscreen"
    title="Full Screen Toggle"
    type="button"
    @click="toggle"
  >
    <BaseIcon :path="icon" />
  </button>
</template>

<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { mdiFullscreen, mdiFullscreenExit } from '@mdi/js'

import BaseIcon from '@/components/icons/BaseIcon.vue'

const { isFullscreen, toggle } = useFullscreen(),
  icon = computed(() => {
    return isFullscreen.value ? mdiFullscreen : mdiFullscreenExit
  }),
  // 1.) iPhones don't support full screen
  // 2.) Added standalone app support for Apple devices (TODO: needs more work)
  // 3.) Fullscreen mode on ipad is still funky, removed
  display = () => {
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/.test(ua)

    // platform is deprecated but still used for iPad detection
    const platform = (navigator as Navigator & { platform?: string }).platform
    const isTouchMac = platform === 'MacIntel' && navigator.maxTouchPoints > 1

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches

    return !(isIOS || isTouchMac || isStandalone)
  }
</script>

<style scoped>
.fullscreen {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 1000;
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
