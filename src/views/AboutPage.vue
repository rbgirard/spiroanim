<template>
  <main class="about-page">
    <header class="about-nav">
      <RouterLink class="back-link" to="/">
        <BaseIcon :path="mdiArrowLeft" :size="20" />
        Home
      </RouterLink>
      <span class="wordmark">SpiroAnim / About</span>
    </header>

    <article class="about-layout">
      <section class="about-intro" aria-labelledby="about-title">
        <p class="kicker">An open-source project</p>
        <h1 id="about-title">Years<br />in motion.</h1>
        <p class="intro-copy">
          SpiroAnim has gone through many iterations over several years of development before
          settling into its current form.
        </p>
      </section>

      <section class="about-details" aria-label="About the project">
        <div class="detail-block">
          <span class="detail-marker" aria-hidden="true"></span>
          <div>
            <h2>Built through iteration</h2>
            <p>
              The project has evolved alongside its ideas, gradually finding its focus as a 3D
              rendering and editing tool for flow arts props.
            </p>
          </div>
        </div>

        <div class="detail-block">
          <span class="detail-marker" aria-hidden="true"></span>
          <div>
            <h2>Open source</h2>
            <p>
              You're free to use portions of SpiroAnim or modify it for your own use, as long as
              your project is, and remains, open source.
            </p>
          </div>
        </div>

        <div class="detail-block">
          <span class="detail-marker" aria-hidden="true"></span>
          <div>
            <h2>Offline-capable</h2>
            <p>
              The first successful online visit prepares and saves the application files on that
              device. After that, SpiroAnim can reopen without a network connection and will check
              for newer versions when it returns online.
            </p>
          </div>
        </div>

        <div class="detail-block">
          <span class="detail-marker" aria-hidden="true"></span>
          <div>
            <h2>A progressive web app</h2>
            <p>
              SpiroAnim can be installed from a supported browser and launched from your desktop or
              home screen in its own app window. It keeps the convenience of a website while
              receiving new versions through the normal update prompt.
            </p>
          </div>
        </div>

        <p class="coming-soon">
          <strong>Still moving forward.</strong> Many upgrades are in the works and coming soon.
        </p>

        <a
          class="repository-link"
          href="https://github.com/rbgirard/spiroanim/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <BaseIcon :path="mdiGithub" :size="24" />
          View the repository
        </a>
      </section>
    </article>

    <footer>Render the Flow.</footer>
  </main>
</template>

<script setup lang="ts">
import { mdiArrowLeft, mdiGithub } from '@mdi/js'
import { RouterLink } from 'vue-router'

import BaseIcon from '@/components/icons/BaseIcon.vue'
</script>

<style scoped>
.about-page {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100%;
  padding-block-start: max(var(--space-6), var(--safe-area-inset-top));
  padding-inline-end: max(var(--space-6), var(--safe-area-inset-right));
  padding-block-end: max(var(--space-6), var(--safe-area-inset-bottom));
  padding-inline-start: max(var(--space-6), var(--safe-area-inset-left));
  overflow-y: auto;
  color: var(--color-text);
  background:
    linear-gradient(
      90deg,
      transparent 0 49.8%,
      color-mix(in srgb, var(--color-workspace-boundary) 18%, transparent) 49.8% 50%,
      transparent 50% 100%
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0 4rem,
      color-mix(in srgb, var(--color-border) 12%, transparent) 4rem calc(4rem + 1px)
    ),
    var(--color-canvas);
}

.about-nav,
.about-layout,
footer {
  width: min(100%, 76rem);
  margin-inline: auto;
}

.about-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text);
  font-weight: 700;
  text-decoration: none;
  border: 1px solid var(--color-border);
  border-radius: calc(var(--radius-md) * 4);
}

.back-link:hover,
.back-link:focus-visible {
  color: var(--color-action-primary);
  border-color: var(--color-action-primary);
}

.back-link:focus-visible,
.repository-link:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-action-primary) 45%, var(--color-text));
  outline-offset: 3px;
}

.wordmark {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.about-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(20rem, 1.1fr);
  gap: clamp(var(--space-8), 9vw, 8rem);
  align-items: center;
  padding-block: clamp(4rem, 12vh, 8rem);
}

.kicker {
  margin: 0 0 var(--space-4);
  color: var(--color-action-primary);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(3rem, 5.5vw, 5rem);
  line-height: 0.9;
  letter-spacing: -0.065em;
}

.intro-copy {
  max-width: 34rem;
  margin: var(--space-8) 0 0;
  color: var(--color-text-muted);
  font-size: clamp(1.05rem, 2vw, 1.25rem);
  line-height: 1.7;
}

.about-details {
  display: grid;
  gap: var(--space-8);
  padding: clamp(var(--space-6), 5vw, 3.5rem);
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  border-block: 1px solid var(--color-border);
  box-shadow: 1.25rem 1.25rem 0 color-mix(in srgb, var(--color-workspace-boundary) 22%, transparent);
  backdrop-filter: blur(0.75rem);
}

.detail-block {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-4);
}

.detail-marker {
  width: 0.6rem;
  height: 0.6rem;
  margin-block-start: 0.35rem;
  background: var(--color-action-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--color-action-primary) 14%, transparent);
}

h2 {
  margin: 0 0 var(--space-2);
  font-size: 1.15rem;
}

.detail-block p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.65;
}

.coming-soon {
  padding-block: var(--space-3);
  padding-inline: var(--space-4);
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.55;
  background: color-mix(in srgb, var(--color-action-primary) 8%, transparent);
  border-inline-start: 0.2rem solid var(--color-action-primary);
}

.coming-soon strong {
  color: var(--color-text);
}

.repository-link {
  display: inline-flex;
  width: max-content;
  min-height: 3rem;
  align-items: center;
  gap: var(--space-3);
  padding-inline: var(--space-4);
  color: var(--color-on-action-primary);
  font-weight: 800;
  text-decoration: none;
  background: var(--color-action-primary);
  border: 1px solid var(--color-action-primary);
  border-radius: var(--radius-sm);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.repository-link:hover {
  box-shadow: 0.6rem 0.6rem 0 color-mix(in srgb, var(--color-workspace-separator) 30%, transparent);
  transform: translate(-0.15rem, -0.15rem);
}

footer {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

@media (max-width: 48rem) {
  .about-page {
    padding-inline-end: max(var(--space-4), var(--safe-area-inset-right));
    padding-inline-start: max(var(--space-4), var(--safe-area-inset-left));
  }

  .about-layout {
    grid-template-columns: 1fr;
    gap: var(--space-8);
    padding-block: 4rem;
  }

  h1 {
    font-size: clamp(3rem, 15vw, 4.25rem);
  }

  .intro-copy {
    margin-block-start: var(--space-6);
  }

  .about-details {
    margin-inline-end: var(--space-3);
  }
}

@media (max-width: 28rem) {
  .wordmark {
    display: none;
  }

  .repository-link {
    width: 100%;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .repository-link {
    transition: none;
  }
}
</style>
