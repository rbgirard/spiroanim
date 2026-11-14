<template>
  <section
    class="kinetic-alphabet-pane"
    aria-labelledby="kinetic-alphabet-title"
    data-role="tka-pane"
  >
    <div class="kinetic-alphabet-pane__card">
      <div class="kinetic-alphabet-pane__mark" aria-hidden="true">
        <span>T</span>
        <span>K</span>
        <span>A</span>
      </div>

      <div class="kinetic-alphabet-pane__copy">
        <span class="kinetic-alphabet-pane__eyebrow">Notation</span>
        <h1 id="kinetic-alphabet-title">The Kinetic Alphabet</h1>
        <p class="kinetic-alphabet-pane__lede">Write and share flow sequences, by Austen Cloud</p>
        <p class="kinetic-alphabet-pane__note" data-role="tka-development-note">
          Try it in
          <a href="https://tkaflowarts.com" target="_blank" rel="noopener">Flow Arts Composer</a>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.kinetic-alphabet-pane {
  container-type: inline-size;
  display: grid;
  min-block-size: 12rem;
  padding: var(--space-4);
  color: var(--color-text);
  place-content: center;
}

.kinetic-alphabet-pane__card {
  box-sizing: border-box;
  display: grid;
  width: min(100%, 34rem);
  padding: clamp(var(--space-4), 5cqi, var(--space-8));
  background:
    radial-gradient(
      circle at 12% 18%,
      color-mix(in srgb, var(--color-action-primary) 16%, transparent),
      transparent 42%
    ),
    color-mix(in srgb, var(--color-action-primary) 6%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-action-primary) 32%, var(--color-border));
  border-radius: var(--radius-md);
  box-shadow: 0 0.75rem 1.75rem color-mix(in srgb, var(--color-action-primary) 12%, transparent);
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-4);
  align-items: center;
}

.kinetic-alphabet-pane__mark {
  display: grid;
  width: clamp(3.75rem, 16cqi, 5rem);
  aspect-ratio: 1;
  color: var(--color-on-action-primary);
  font-size: clamp(0.75rem, 3cqi, 1rem);
  font-weight: 800;
  background: var(--color-action-primary);
  border: 1px solid color-mix(in srgb, var(--color-on-action-primary) 32%, transparent);
  border-radius: 50%;
  box-shadow:
    0 0 0 0.3rem color-mix(in srgb, var(--color-action-primary) 12%, transparent),
    0 0.65rem 1.25rem color-mix(in srgb, var(--color-action-primary) 22%, transparent);
  grid-template-columns: repeat(3, 1fr);
  place-items: center;
}

.kinetic-alphabet-pane__copy {
  min-width: 0;
}

.kinetic-alphabet-pane h1,
.kinetic-alphabet-pane p {
  margin: 0;
}

.kinetic-alphabet-pane__eyebrow {
  display: block;
  margin-block-end: var(--space-1);
  color: var(--color-action-primary);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.kinetic-alphabet-pane h1 {
  font-size: clamp(1.25rem, 5cqi, 1.75rem);
  line-height: 1.1;
  text-wrap: balance;
}

.kinetic-alphabet-pane__lede {
  margin-block-start: var(--space-2);
  color: var(--color-text-muted);
}

p.kinetic-alphabet-pane__note {
  margin-block-start: var(--space-3);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-weight: 700;
  background: color-mix(in srgb, var(--color-action-primary) 9%, var(--color-surface));
  border-inline-start: 3px solid var(--color-action-primary);
  border-radius: var(--radius-sm);
}

@container (width < 24rem) {
  .kinetic-alphabet-pane__card {
    grid-template-columns: 1fr;
    text-align: center;
    justify-items: center;
  }

  .kinetic-alphabet-pane__note {
    text-align: start;
  }
}
</style>
