<template>
  <section class="third-order-pane" aria-labelledby="third-order-title" data-role="to-pane">
    <div class="third-order-pane__card">
      <div class="third-order-pane__mark" aria-hidden="true">
        <span>III</span>
        <span>O</span>
      </div>

      <div class="third-order-pane__copy">
        <span class="third-order-pane__eyebrow">Concept in development</span>
        <h1 id="third-order-title">Third Order</h1>
        <p class="third-order-pane__lede">Possibly coming soon</p>
        <p class="third-order-pane__note" data-role="to-development-note">
          The Rock is in the kitchen and is COOKING something...
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.third-order-pane {
  container-type: inline-size;
  display: grid;
  min-block-size: 12rem;
  padding: var(--space-4);
  color: var(--color-text);
  place-content: center;
}

.third-order-pane__card {
  box-sizing: border-box;
  display: grid;
  width: min(100%, 34rem);
  padding: clamp(var(--space-4), 5cqi, var(--space-8));
  background:
    radial-gradient(
      circle at 88% 18%,
      color-mix(in srgb, var(--color-status-warning) 18%, transparent),
      transparent 42%
    ),
    color-mix(in srgb, var(--color-status-warning) 7%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-status-warning) 38%, var(--color-border));
  border-radius: var(--radius-md);
  box-shadow: 0 0.75rem 1.75rem color-mix(in srgb, var(--color-status-warning) 14%, transparent);
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-4);
  align-items: center;
}

.third-order-pane__mark {
  display: grid;
  width: clamp(3.75rem, 16cqi, 5rem);
  aspect-ratio: 1;
  color: var(--color-surface);
  font-size: clamp(0.75rem, 3cqi, 1rem);
  font-weight: 800;
  background: var(--color-status-warning);
  border: 1px solid color-mix(in srgb, var(--color-text) 28%, transparent);
  border-radius: var(--radius-md);
  box-shadow:
    0 0 0 0.3rem color-mix(in srgb, var(--color-status-warning) 13%, transparent),
    0 0.65rem 1.25rem color-mix(in srgb, var(--color-status-warning) 24%, transparent);
  grid-template-columns: repeat(2, 1fr);
  place-items: center;
}

.third-order-pane__copy {
  min-width: 0;
}

.third-order-pane h1,
.third-order-pane p {
  margin: 0;
}

.third-order-pane__eyebrow {
  display: block;
  margin-block-end: var(--space-1);
  color: var(--color-status-warning);
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.third-order-pane h1 {
  font-size: clamp(1.25rem, 5cqi, 1.75rem);
  line-height: 1.1;
  text-wrap: balance;
}

.third-order-pane__lede {
  margin-block-start: var(--space-2);
  color: var(--color-text-muted);
}

p.third-order-pane__note {
  margin-block-start: var(--space-3);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-weight: 700;
  background: color-mix(in srgb, var(--color-status-warning) 10%, var(--color-surface));
  border-inline-start: 3px solid var(--color-status-warning);
  border-radius: var(--radius-sm);
}

@container (width < 24rem) {
  .third-order-pane__card {
    grid-template-columns: 1fr;
    text-align: center;
    justify-items: center;
  }

  .third-order-pane__note {
    text-align: start;
  }
}
</style>
