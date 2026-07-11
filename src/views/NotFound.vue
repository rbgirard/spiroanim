<template>
  <main class="message-page">
    <h1>Page not found</h1>
    <p>The requested page does not exist.</p>
    <RouterLink to="/">Return to SpiroAnim</RouterLink>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.message-page {
  max-width: 42rem;
  margin-inline: auto;
  padding: var(--space-8);
  color: var(--color-text);
  background: var(--color-surface);
}

h1 {
  margin-block: 0 var(--space-4);
}

p {
  color: var(--color-text-muted);
}

a {
  color: var(--color-action-primary);
}
</style>
