<template>
  <BasePopupMenu v-model:open="isOpen" class="concept-docs-menu" data-role="concept-docs-menu">
    <template #trigger>
      <span>Docs</span>
      <BaseIcon
        class="concept-docs-menu__chevron"
        :class="{ 'concept-docs-menu__chevron--open': isOpen }"
        :path="mdiChevronDown"
        :size="14"
        aria-hidden="true"
      />
    </template>

    <a
      class="concept-docs-menu__link concept-docs-menu__link--vtg4"
      :href="vtg4Href"
      role="menuitem"
    >
      VTG4 Expansion
    </a>
    <a
      class="concept-docs-menu__link concept-docs-menu__link--vtg3"
      :href="vtg3Href"
      role="menuitem"
    >
      VTG3 Reference
    </a>
    <a
      class="concept-docs-menu__link concept-docs-menu__link--tka"
      href="https://tkaflowarts.com/guide"
      target="_blank"
      rel="noopener"
      role="menuitem"
    >
      The Kinetic Alphabet
    </a>
  </BasePopupMenu>
</template>

<script setup lang="ts">
import { mdiChevronDown } from '@mdi/js'

import BaseIcon from '@/components/icons/BaseIcon.vue'
import BasePopupMenu from '@/components/ui/BasePopupMenu.vue'

const isOpen = ref(false)
const props = withDefaults(defineProps<{ returnPath?: string }>(), { returnPath: '/app' })
const returnQuery = computed(() => new URLSearchParams({ returnTo: props.returnPath }).toString())
const vtg4Href = computed(() => `/vtg4/?${returnQuery.value}`)
const vtg3Href = computed(() => `/vtg3/?${returnQuery.value}`)
</script>

<style scoped>
.concept-docs-menu {
  --popup-menu-trigger-width: var(--size-concepts-docs-trigger);
  --popup-menu-trigger-padding: var(--space-2);
  --popup-menu-panel-min-width: 12rem;

  pointer-events: auto;
}

.concept-docs-menu :deep(.base-popup-menu__trigger) {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-1);
  color: var(--color-text);
  font-weight: 800;
  letter-spacing: 0.04em;
  background:
    linear-gradient(115deg, color-mix(in srgb, var(--color-text) 6%, transparent), transparent 58%),
    color-mix(in srgb, var(--color-surface) 76%, transparent);
  border-color: color-mix(in srgb, var(--color-border) 78%, transparent);
  box-shadow: var(--shadow-sm);
}

.concept-docs-menu :deep(.base-popup-menu__trigger:hover),
.concept-docs-menu :deep(.base-popup-menu__trigger[aria-expanded='true']) {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-text) 8%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-text-muted) 72%, var(--color-border));
}

.concept-docs-menu :deep(.base-popup-menu__trigger:focus-visible) {
  outline-color: var(--color-text);
}

.concept-docs-menu :deep(.base-popup-menu__panel) {
  inset-inline-start: auto;
  inset-inline-end: 0;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--color-status-warning) 9%, transparent),
      transparent 46%
    ),
    linear-gradient(
      325deg,
      color-mix(in srgb, var(--color-element-moon) 10%, transparent),
      transparent 52%
    ),
    var(--color-surface);
  border-color: color-mix(in srgb, var(--color-status-warning) 30%, var(--color-border));
}

.concept-docs-menu__chevron {
  transition: transform var(--transition-fast);
}

.concept-docs-menu__chevron--open {
  transform: rotate(180deg);
}

.concept-docs-menu__link {
  display: flex;
  color: var(--color-text);
  border-inline-start: 0.2rem solid transparent;
}

.concept-docs-menu :deep(.base-popup-menu__panel) .concept-docs-menu__link--vtg4 {
  border-inline-start-color: var(--color-status-warning);
}

.concept-docs-menu :deep(.base-popup-menu__panel) .concept-docs-menu__link--vtg3 {
  border-inline-start-color: var(--color-element-moon);
}

.concept-docs-menu :deep(.base-popup-menu__panel) .concept-docs-menu__link--tka {
  border-inline-start-color: var(--color-element-water);
}

.concept-docs-menu :deep(.base-popup-menu__panel) .concept-docs-menu__link:hover,
.concept-docs-menu :deep(.base-popup-menu__panel) .concept-docs-menu__link:focus-visible {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-status-warning) 11%, transparent);
}

.concept-docs-menu :deep(.base-popup-menu__panel) .concept-docs-menu__link:focus-visible {
  outline-color: var(--color-status-warning);
}

@media (prefers-reduced-motion: reduce) {
  .concept-docs-menu__chevron {
    transition: none;
  }
}
</style>
