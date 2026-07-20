<template>
  <div ref="rootElement" class="app-navigation-menu">
    <AppTooltip text="Open SpiroAnim menu" placement="bottom" :disabled="isOpen">
      <template #activator="{ props: tooltipProps }">
        <button
          :id="triggerId"
          ref="triggerElement"
          v-bind="tooltipProps"
          class="menu-trigger"
          type="button"
          aria-label="Open SpiroAnim menu"
          aria-haspopup="menu"
          :aria-controls="menuId"
          :aria-expanded="isOpen"
          @click="toggleMenu"
          @keydown.arrow-down.prevent="openAndFocusFirst"
          @keydown.esc.stop.prevent="closeAndFocusTrigger"
        >
          <span class="site-mark" aria-hidden="true" />
          <span class="menu-chevron" aria-hidden="true">
            <BaseIcon :path="mdiChevronDown" :size="14" />
          </span>
        </button>
      </template>
    </AppTooltip>

    <div
      v-if="isOpen"
      :id="menuId"
      ref="menuElement"
      class="menu-panel"
      role="menu"
      :aria-labelledby="triggerId"
      @keydown="onMenuKeydown"
    >
      <section class="menu-group" role="group" aria-labelledby="navigation-heading">
        <h2 id="navigation-heading">Navigation</h2>
        <RouterLink
          v-for="item in navigationLinks"
          :key="item.path"
          class="menu-link"
          exact-active-class="menu-link--active"
          role="menuitem"
          :to="item.path"
          @click="closeMenu"
        >
          <BaseIcon :path="item.icon" :size="22" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { mdiChevronDown, mdiHomeOutline, mdiInformationOutline } from '@mdi/js'
import { onClickOutside } from '@vueuse/core'
import { useId } from 'vue'
import { RouterLink } from 'vue-router'

import AppTooltip from '@/components/AppTooltip.vue'
import BaseIcon from '@/components/icons/BaseIcon.vue'

interface MenuLink {
  icon: string
  label: string
  path: string
}

const navigationLinks: MenuLink[] = [
  { icon: mdiHomeOutline, label: 'Home', path: '/' },
  { icon: mdiInformationOutline, label: 'About', path: '/about' },
]

const isOpen = ref(false)
const rootElement = ref<HTMLElement>()
const triggerElement = ref<HTMLButtonElement>()
const menuElement = ref<HTMLElement>()
const triggerId = useId()
const menuId = useId()

function closeMenu() {
  isOpen.value = false
}

function toggleMenu() {
  isOpen.value = !isOpen.value
}

async function openAndFocusFirst() {
  isOpen.value = true
  await nextTick()
  menuItems()[0]?.focus()
}

function closeAndFocusTrigger() {
  closeMenu()
  triggerElement.value?.focus()
}

function menuItems(): HTMLElement[] {
  return Array.from(menuElement.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
}

function focusRelativeItem(direction: 1 | -1) {
  const items = menuItems()
  if (items.length === 0) return

  const currentIndex = items.indexOf(document.activeElement as HTMLElement)
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + items.length) % items.length
  items[nextIndex]?.focus()
}

function onMenuKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      closeAndFocusTrigger()
      break
    case 'ArrowDown':
      event.preventDefault()
      focusRelativeItem(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusRelativeItem(-1)
      break
    case 'Home':
      event.preventDefault()
      menuItems()[0]?.focus()
      break
    case 'End':
      event.preventDefault()
      menuItems().at(-1)?.focus()
      break
  }
}

onClickOutside(rootElement, closeMenu)
</script>

<style scoped>
.app-navigation-menu {
  position: absolute;
  inset-block-start: 1px;
  inset-inline-start: 1px;
  z-index: 3000;
}

.menu-trigger {
  position: relative;
  display: grid;
  width: var(--size-editor-toolbar-height);
  height: calc(var(--size-editor-toolbar-height) - 1px);
  padding: var(--space-1);
  place-items: center;
  color: var(--color-action-primary);
  background: color-mix(in srgb, var(--color-surface) 58%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border) 65%, transparent);
  border-radius: var(--radius-sm);
  backdrop-filter: blur(0.45rem);
}

.site-mark {
  display: block;
  width: 100%;
  height: 100%;
  background: url('/pwa-source.svg') center / contain no-repeat;
  filter: drop-shadow(0 0 0.4rem color-mix(in srgb, var(--color-action-primary) 24%, transparent));
}

.menu-chevron {
  position: absolute;
  inset-inline-end: -0.2rem;
  inset-block-end: -0.15rem;
  display: grid;
  width: 1.15rem;
  height: 1.15rem;
  place-items: center;
  color: var(--color-action-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  transition: transform var(--transition-fast);
}

.menu-trigger[aria-expanded='true'] {
  background: color-mix(in srgb, var(--color-action-primary) 14%, var(--color-surface));
  border-color: var(--color-action-primary);
}

.menu-trigger[aria-expanded='true'] .menu-chevron {
  transform: rotate(180deg);
}

.menu-trigger:hover {
  background: color-mix(in srgb, var(--color-action-primary) 10%, var(--color-surface));
  border-color: var(--color-action-primary);
}

.menu-trigger:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: -2px;
}

.menu-panel {
  position: absolute;
  inset-block-start: calc(var(--size-editor-toolbar-height) + var(--space-2));
  inset-inline-start: 0;
  width: min(18rem, calc(100vw - var(--space-8)));
  max-height: calc(
    100dvh - var(--size-editor-toolbar-height) - var(--space-4) - var(--safe-area-inset-bottom)
  );
  padding: var(--space-2);
  overflow-y: auto;
  overscroll-behavior: contain;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 1rem 3rem color-mix(in srgb, var(--color-text) 24%, transparent);
  backdrop-filter: blur(1rem);
}

.menu-group h2 {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.menu-link {
  display: grid;
  grid-template-columns: 1.5rem 1fr;
  gap: var(--space-3);
  min-height: 2.75rem;
  align-items: center;
  padding-inline: var(--space-3);
  color: var(--color-text);
  font-weight: 700;
  text-decoration: none;
  border-radius: var(--radius-sm);
}

.menu-link:hover,
.menu-link:focus-visible,
.menu-link--active {
  color: var(--color-action-primary);
  background: color-mix(in srgb, var(--color-action-primary) 10%, transparent);
}

.menu-link:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: -2px;
}

@media (max-width: 32rem) {
  .menu-panel {
    width: min(18rem, calc(100vw - var(--space-6)));
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-chevron {
    transition: none;
  }
}
</style>
