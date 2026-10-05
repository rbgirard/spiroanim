# Progressive Web App

SpiroAnim emits its production and development web manifests from Vite configuration. After
prerendering completes, `workbox-build` generates the single final service worker from the finished
build. The service worker precaches the static application shell, routed Vue chunks, and animation
worker so the editor can reopen without a network connection after its first successful load.
`workbox-window` owns registration and the update prompt in the client.

Application icon generation is documented in [`APP_ICONS.md`](./APP_ICONS.md). Production routing,
cache rules, and Cloudflare Pages configuration are documented in [`HOSTING.md`](./HOSTING.md).

## Product behavior

- Installed launches open the landing page. Manifest shortcuts open the SpiroAnim application or
  the About page.
- Pages loaded from `spiroanim.com` use the production manifest and "SpiroAnim" launcher label.
  Every other hostname selects a second web manifest that labels installed apps as "SpiroAnim Dev".
  Both manifests are emitted by the Vite build, so this behavior does not depend on the hosting
  provider or deployment branch metadata.
- Browser installation is offered on the landing page only when the browser exposes an install
  prompt. Safari on iOS receives numbered Add to Home Screen instructions that identify the Share
  control and account for the More and Open as Web App steps shown by current iPadOS versions.
- Service-worker updates require user confirmation on normal application pages. The not-found view
  is the deliberate exception: it applies a ready update and reloads automatically because there
  is no active editor work to preserve on that page.
- When an update is found, the update prompt shows an indeterminate activity indicator while the
  replacement service worker downloads and installs. The update action appears when it is ready.
- The not-found view replaces all 404 messaging with a waiting state and an indeterminate progress
  bar while an update installs. If installation fails, it stops the activity indicator and offers
  an explicit page reload; if no update is active, the regular 404 recovery page remains visible.
- The application checks for an updated service worker when its update controller starts, hourly
  while it remains open, when the browser comes back online, and when the page becomes visible.
  Checks are throttled and remain opportunistic so an update failure never interrupts editing.
- On startup, an already-waiting worker is not offered until that first update check finishes. This
  lets a device replace an intermediate waiting build with the newest available build instead of
  applying missed deployments one at a time.
- After an update is accepted, every page already controlled by the previous service worker reloads
  when the replacement takes control. This prevents an old page from requesting fingerprinted
  assets after the replacement worker removes the previous precache.
- If a routed chunk still becomes unavailable during a deployment transition, the client handles
  Vite's `vite:preloadError` event and reloads. A session-scoped cooldown prevents a tight reload
  loop while allowing a long-lived Safari tab to recover if the first attempt occurred before the
  deployment finished.
- Offline support is available in production builds served over HTTPS (and in `npm run preview`),
  not from `npm run dev`; the development service worker is intentionally disabled.
- A device must finish one online production launch and register the service worker before it can
  relaunch offline. The "SpiroAnim is ready offline" notice confirms that precaching completed.
- A browser shortcut created from a development or otherwise uncontrolled page is only a shortcut;
  it is not an offline-capable installed app.
- Installed desktop and Android apps retain the fullscreen control. It remains hidden on iOS and
  iPadOS because iPhone element fullscreen is unreliable and iPadOS reserves a downward drag to
  exit fullscreen, which conflicts with SpiroAnim's draggable editor controls.
- The service worker uses the client-only `app-shell.html` as its offline navigation fallback,
  including route aliases and URLs containing animation query data.
- `/reset/` is a standalone, network-only recovery page. It unregisters every service worker and
  clears Cache Storage, web storage, IndexedDB, origin-private files, and accessible cookies for the
  current origin. This includes persisted editor preferences and other Pinia store data. The route
  is excluded from service-worker navigation fallback and precaching so a client that has reached
  this release retains a recovery path during future update failures.
- The final service worker is generated after prerendering, so Workbox revisions the actual emitted
  HTML and cannot reuse documents that reference outdated hashed assets.
- The preload recovery hook cannot run when the initial entry script itself is unavailable because
  application code has not started yet. Correct HTML revalidation, real asset 404 responses, and a
  consistent deployment are therefore required parts of startup reliability.

## Mobile development console

The full Eruda suite is installed from npm at a pinned version and emitted as a separate local
JavaScript asset. It is included in the production-build precache even when not activated, so an
offline reload does not depend on a CDN or on having opened the console previously.
Activation is unchanged: after the app mounts, Eruda starts automatically on touch devices outside
`spiroanim.com`, including iPads using a desktop-class user agent. It remains disabled on the
production hostname and on desktop devices. It does not capture errors from before initialization
or replace browser-level service-worker debugging.

## Validation

The PWA test builds the production application, starts Vite preview, validates the generated
manifest and icons, installs the service worker, performs an offline routed navigation, and stages
a second generated build to verify that an already-open client can accept an update and load the
new fingerprinted assets:

```sh
npm run test:pwa
```

Use Chrome DevTools Application panels to inspect the manifest, service worker, and cache contents
when diagnosing an installed build. Local preview verifies application behavior but does not
validate CDN response headers; use the deployment checks in [`HOSTING.md`](./HOSTING.md) for that.
