<template>
  <AppTooltip text="Resize" :style="iconStyle">
    <template #activator="{ props: tooltipProps }">
      <button
        v-bind="{ ...attrs, ...tooltipProps }"
        ref="iconEl"
        aria-label="Resize"
        class="pane-splitter"
        type="button"
        @click.prevent
        @mousedown.prevent="dragStart"
      >
        <BaseIcon :path="icon" />
      </button>
    </template>
  </AppTooltip>
</template>

<script setup lang="ts">
// src\components\SpiroAnim\btn\PaneSplitter.vue

import { mdiArrowSplitVertical, mdiArrowSplitHorizontal, mdiCloseOctagonOutline } from '@mdi/js'

import AppTooltip from '@/components/AppTooltip.vue'
import BaseIcon from '@/components/icons/BaseIcon.vue'
import { useSplitHandle } from '@/composables/useSplitHandle'

const attrs = useAttrs()

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    parent: { width: number; height: number }
    object: { width: number; height: number }
    landscape: boolean
    //str?: string
  }>(),
  {
    //str: 'main',
  },
)

const emit = defineEmits<{
  perc: [num: number]
}>()

const iconEl = ref<HTMLButtonElement>()

const { dragStart, iconStyle, icon } = useSplitHandle({
  parent: toRef(props, 'parent'),
  object: toRef(props, 'object'),
  landscape: toRef(props, 'landscape'),
  emit,
  element: iconEl,
  iconMap: {
    vertical: mdiArrowSplitVertical,
    horizontal: mdiArrowSplitHorizontal,
    close: mdiCloseOctagonOutline,
  },
  //str: props.str,
})
</script>

<style scoped>
.pane-splitter {
  display: grid;
  width: 2rem;
  height: 2rem;
  padding: 0;
  place-items: center;
  color: var(--color-text-muted);
  cursor: grab;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
}

.pane-splitter:hover {
  color: var(--color-action-primary);
}

.pane-splitter:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
