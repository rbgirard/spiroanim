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
import { useViewportStore } from '@/stores/useViewportStore'

withDefaults(
  defineProps<{
    text?: string
    disabled?: boolean
    delay?: number
    placement?: 'top' | 'bottom'
  }>(),
  {
    text: '',
    disabled: false,
    delay: 1000,
    placement: 'top',
  },
)

const { showTooltips } = storeToRefs(useViewportStore())
</script>
