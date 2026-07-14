<template>
  <BaseTooltip
    :text="text"
    :disabled="disabled || !showTooltips"
    :delay="delay"
    :placement="placement"
  >
    <template #activator="{ props: activatorProps }">
      <slot name="activator" :props="activatorProps" />
    </template>
    <template #html>
      <slot name="html">
        <span>{{ text }}</span>
      </slot>
    </template>
  </BaseTooltip>
</template>

<script setup lang="ts">
import BaseTooltip from '@/components/ui/BaseTooltip.vue'
import { DEFAULT_TOOLTIP_DELAY, type TooltipPlacement } from '@/components/ui/tooltip'
import { useViewportStore } from '@/stores/useViewportStore'

withDefaults(
  defineProps<{
    text?: string
    disabled?: boolean
    delay?: number
    placement?: TooltipPlacement
  }>(),
  {
    text: '',
    disabled: false,
    delay: DEFAULT_TOOLTIP_DELAY,
    placement: 'top',
  },
)

const { showTooltips } = storeToRefs(useViewportStore())
</script>
