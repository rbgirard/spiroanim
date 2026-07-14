<template>
  <PaneSwapButton
    class="pane-rotate-icon"
    label="Swap Views"
    :icon="mdiSwapHorizontalBold"
    @click="onClick"
  />
</template>

<script setup lang="ts">
// src\components\SpiroAnim\btn\PaneRotate.vue

import { mdiSwapHorizontalBold } from '@mdi/js'

import PaneSwapButton from '@/components/layout/PaneSwapButton.vue'
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
}
</style>
