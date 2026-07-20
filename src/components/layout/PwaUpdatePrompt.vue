<template>
  <aside v-if="offlineReady || needRefresh" class="pwa-update" role="status" aria-live="polite">
    <p>{{ message }}</p>
    <div class="pwa-update-actions">
      <button v-if="needRefresh" class="primary-action" type="button" @click="applyUpdate">
        Update Now
      </button>
      <button type="button" @click="dismiss">{{ needRefresh ? 'Later' : 'Dismiss' }}</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisterError(error) {
    console.error('PWA service worker registration failed.', error)
  },
})

const message = computed(() =>
  needRefresh.value ? 'A new version of SpiroAnim is available.' : 'SpiroAnim is ready offline.',
)

function dismiss() {
  offlineReady.value = false
  needRefresh.value = false
}

async function applyUpdate() {
  await updateServiceWorker(true)
}
</script>

<style scoped>
.pwa-update {
  position: fixed;
  right: max(var(--space-4), var(--safe-area-inset-right));
  bottom: max(var(--space-4), var(--safe-area-inset-bottom));
  z-index: var(--z-pwa-prompt);
  width: min(calc(100vw - (2 * var(--space-4))), 24rem);
  padding: var(--space-4);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-workspace-boundary);
  border-radius: var(--radius-md);
  box-shadow: 0 1rem 2.5rem color-mix(in srgb, var(--color-text) 20%, transparent);
}

.pwa-update p {
  margin: 0;
  line-height: 1.5;
}

.pwa-update-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-block-start: var(--space-3);
}

.pwa-update button {
  min-height: 2.5rem;
  padding-inline: var(--space-3);
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.pwa-update .primary-action {
  color: var(--color-on-action-primary);
  background: var(--color-action-primary);
  border-color: var(--color-action-primary);
}

.pwa-update button:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
