<template>
  <main class="message-page">
    <h1>Browser not supported</h1>
    <p>An up-to-date Chromium-based browser is recommended.</p>
    <p>This application requires ES2022, WebGL 2, and OffscreenCanvas support.</p>
    <p>
      Although the application is designed for mobile devices, older devices may not provide the
      required browser features.
    </p>
  </main>
</template>

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
  margin-block: var(--space-3);
  color: var(--color-text-muted);
}
</style>
