<template>
  <button
    aria-label="Rotate View"
    class="pane-rotate-icon"
    title="Rotate View"
    type="button"
    @click.prevent="onClick"
  >
    <BaseIcon :path="mdiSwapHorizontalBold" />
  </button>
</template>

<script setup lang="ts">
// src\components\SpiroAnim\btn\PaneRotate.vue

import { mdiSwapHorizontalBold } from '@mdi/js'

import BaseIcon from '@/components/icons/BaseIcon.vue'
import { useMainPaneStore, paneKeysMain } from '@/stores/useMainPaneStore'

const props = defineProps<{
  pane: Exclude<(typeof paneKeysMain)[number], 'hidden'>
}>()

const paneStore = useMainPaneStore()

const onClick = () => {
  paneStore.rotatePane(props.pane)
}
</script>

<style scoped>
.pane-rotate-icon {
  position: absolute;
  bottom: 10px;
  left: 1px;
  z-index: 1010;
  display: grid;
  width: 2rem;
  height: 2rem;
  padding: 0;
  place-items: center;
  color: var(--color-action-primary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
}

.pane-rotate-icon:hover {
  color: var(--color-text);
}

.pane-rotate-icon:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
