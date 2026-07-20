<template>
  <div v-if="canPromptInstall || canShowIosInstructions" class="pwa-install">
    <button class="install-button" type="button" @click="install">
      {{ canPromptInstall ? 'Install App' : 'How to Install' }}
    </button>
    <p v-if="showIosInstructions" class="install-instructions" role="status">
      In Safari, open Share and choose Add to Home Screen.
    </p>
  </div>
</template>

<script setup lang="ts">
import { usePwaInstall } from '@/composables/usePwaInstall'

const { canPromptInstall, canShowIosInstructions, promptInstall } = usePwaInstall()
const showIosInstructions = ref(false)

async function install() {
  if (canPromptInstall.value) {
    await promptInstall()
    return
  }

  showIosInstructions.value = !showIosInstructions.value
}
</script>

<style scoped>
.pwa-install {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  margin-block-start: var(--space-4);
}

.install-button {
  min-height: 2.75rem;
  padding-inline: var(--space-4);
  color: var(--color-action-primary);
  font-weight: 700;
  background: transparent;
  border: 1px solid var(--color-action-primary);
  border-radius: var(--radius-md);
}

.install-button:hover {
  color: var(--color-on-action-primary);
  background: var(--color-action-primary);
}

.install-button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-action-primary) 45%, var(--color-text));
  outline-offset: 3px;
}

.install-instructions {
  max-width: 24rem;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
