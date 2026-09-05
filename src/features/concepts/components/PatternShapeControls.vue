<template>
  <section class="pattern-shape-controls" :data-role="`${rolePrefix}-shape-controls`">
    <AppTooltip text="Use the tilted pattern orientation">
      <template #activator="{ props: activatorProps }">
        <label v-bind="activatorProps">
          <input
            v-model="tilted"
            type="checkbox"
            aria-label="Use the tilted pattern orientation"
            :data-role="`${rolePrefix}-tilted`"
          />
          <span>Tilted</span>
        </label>
      </template>
    </AppTooltip>
    <AppTooltip v-if="showHalve" text="Intended for double-ended props like Staff and Triads.">
      <template #activator="{ props: activatorProps }">
        <label v-bind="activatorProps">
          <input
            v-model="halve"
            type="checkbox"
            aria-label="Halve Turns for double-ended props like Staff and Triads"
            :data-role="`${rolePrefix}-halve`"
          />
          <span>Halve</span>
        </label>
      </template>
    </AppTooltip>
  </section>
</template>

<script setup lang="ts">
import AppTooltip from '@/components/AppTooltip.vue'
import type { PatternShape } from '@/types/PatternTypes'

withDefaults(defineProps<{ rolePrefix?: string; showHalve?: boolean }>(), {
  rolePrefix: 'vtg',
  showHalve: false,
})

const shape = defineModel<PatternShape>('shape', { required: true })
const halve = defineModel<boolean>('halve', { default: false })
const tilted = computed({
  get: () => shape.value === 'box',
  set: (value: boolean) => {
    shape.value = value ? 'box' : 'diamond'
  },
})
</script>

<style scoped>
.pattern-shape-controls {
  display: contents;
}

.pattern-shape-controls label {
  position: relative;
  min-width: 0;
  cursor: pointer;
}

.pattern-shape-controls input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.pattern-shape-controls label > span {
  box-sizing: border-box;
  display: grid;
  block-size: var(--size-concept-control-block);
  padding-block: var(--space-1);
  padding-inline: var(--space-concept-control-inline);
  color: var(--color-text);
  font-size: var(--font-size-concept-control);
  font-weight: 700;
  white-space: nowrap;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  place-items: center;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.pattern-shape-controls input:checked + span {
  color: var(--color-on-action-primary);
  background: var(--color-pattern-mode-active);
  border-color: var(--color-pattern-mode-active-border);
}

.pattern-shape-controls input:focus-visible + span {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
