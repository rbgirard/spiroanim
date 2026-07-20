<template>
  <main class="landing-page">
    <div class="landing-shell">
      <section class="landing-card" aria-labelledby="landing-title">
        <img class="brand-mark" :src="brandIconUrl" alt="" aria-hidden="true" />

        <h1 id="landing-title">SpiroAnim.com</h1>
        <p class="lead">Render the Flow.</p>

        <div class="experience-note">
          <h2>The complete workspace lives on desktop</h2>
          <p>
            A high-end mobile device can run SpiroAnim, but desktop provides the best experience:
            hover tooltips, more room for the player, editor, and timeline, plus additional features
            that may not be available in the touch layout.
          </p>
        </div>

        <p class="mobile-note">
          Continuing on mobile is fine—just expect a more compact experience designed around the
          available screen and input method.
        </p>

        <RouterLink class="enter-button" to="/app">Enter</RouterLink>
        <PwaInstallControl />
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

import PwaInstallControl from '@/components/layout/PwaInstallControl.vue'

const brandIconUrl = '/pwa-source.svg'
</script>

<style scoped>
.landing-page {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  color: var(--color-text);
  background:
    radial-gradient(
      circle at 15% 15%,
      color-mix(in srgb, var(--color-action-primary) 18%, transparent),
      transparent 34rem
    ),
    radial-gradient(
      circle at 85% 85%,
      color-mix(in srgb, var(--color-workspace-separator) 15%, transparent),
      transparent 30rem
    ),
    var(--color-canvas);
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.landing-shell {
  --landing-safe-padding: clamp(var(--space-4), 6vw, var(--space-8));

  display: grid;
  min-height: 100%;
  padding-block-start: max(var(--landing-safe-padding), var(--safe-area-inset-top));
  padding-inline-end: max(var(--landing-safe-padding), var(--safe-area-inset-right));
  padding-block-end: max(var(--landing-safe-padding), var(--safe-area-inset-bottom));
  padding-inline-start: max(var(--landing-safe-padding), var(--safe-area-inset-left));
  place-items: center;
}

.landing-card {
  width: min(100%, 46rem);
  padding: clamp(var(--space-6), 6vw, 3.5rem);
  text-align: center;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-workspace-boundary) 55%, var(--color-border));
  border-radius: calc(var(--radius-md) * 2);
  box-shadow: 0 1.5rem 4rem color-mix(in srgb, var(--color-text) 14%, transparent);
}

.brand-mark {
  display: block;
  width: clamp(6rem, 18vw, 8.5rem);
  height: auto;
  margin-inline: auto;
  margin-block-end: var(--space-4);
  filter: drop-shadow(0 0 1.25rem color-mix(in srgb, var(--color-action-primary) 24%, transparent));
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--color-action-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(2.75rem, 9vw, 5.25rem);
  line-height: 0.95;
  letter-spacing: -0.055em;
}

.lead {
  max-width: 34rem;
  margin: var(--space-4) auto var(--space-6);
  color: var(--color-text-muted);
  font-size: clamp(1.05rem, 3vw, 1.3rem);
  line-height: 1.55;
}

.experience-note {
  padding: var(--space-6);
  text-align: start;
  background: color-mix(in srgb, var(--color-action-primary) 8%, var(--color-surface));
  border-inline-start: 0.25rem solid var(--color-action-primary);
  border-radius: var(--radius-md);
}

.experience-note h2 {
  margin: 0 0 var(--space-2);
  font-size: 1.1rem;
}

.experience-note p,
.mobile-note {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.mobile-note {
  max-width: 38rem;
  margin: var(--space-4) auto var(--space-6);
  font-size: 0.9rem;
}

.enter-button {
  display: inline-flex;
  min-width: 10rem;
  min-height: 3rem;
  align-items: center;
  justify-content: center;
  padding-inline: var(--space-6);
  color: var(--color-on-action-primary);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-decoration: none;
  text-transform: uppercase;
  background: var(--color-action-primary);
  border: 1px solid var(--color-action-primary);
  border-radius: var(--radius-md);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.enter-button:hover {
  box-shadow: 0 0.75rem 1.75rem color-mix(in srgb, var(--color-action-primary) 28%, transparent);
  transform: translateY(-2px);
}

.enter-button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-action-primary) 45%, var(--color-text));
  outline-offset: 4px;
}

@media (max-width: 32rem) {
  .landing-card {
    padding-inline: var(--space-4);
  }

  .experience-note {
    padding: var(--space-4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .enter-button {
    transition: none;
  }
}
</style>
