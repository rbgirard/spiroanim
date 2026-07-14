<template>
  <AppTooltip :text="label">
    <template #activator="{ props: tooltipProps }">
      <button
        v-bind="tooltipProps"
        class="pane-swap-button"
        type="button"
        :aria-label="label"
        @click.prevent="emit('click')"
      >
        <BaseIcon :path="icon" />
      </button>
    </template>
  </AppTooltip>
</template>

<script setup lang="ts">
import BaseIcon from '@/components/icons/BaseIcon.vue'
import AppTooltip from '@/components/AppTooltip.vue'

defineProps<{
  label: string
  icon: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<style scoped>
.pane-swap-button {
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

.pane-swap-button:hover {
  color: var(--color-text);
}

.pane-swap-button:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
