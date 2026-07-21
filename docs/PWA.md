# Progressive Web App

SpiroAnim uses `vite-plugin-pwa` to generate its web manifest and Workbox service worker. The
service worker precaches the static application shell, routed Vue chunks, and animation worker so
the editor can reopen without a network connection after its first successful load.

## Product behavior

- Installed launches open the landing page. Manifest shortcuts can open the player, editor, or
  timeline directly.
- Browser installation is offered on the landing page only when the browser exposes an install
  prompt. Safari on iOS receives numbered Add to Home Screen instructions that identify the Share
  control and account for the More and Open as Web App steps shown by current iPadOS versions.
- Service-worker updates require user confirmation. Do not switch to automatic reload without
  accounting for active editor work.
- Offline support is available in production builds served over HTTPS (and in `npm run preview`),
  not from `npm run dev`; the development service worker is intentionally disabled.
- A device must finish one online production launch and register the service worker before it can
  relaunch offline. The "SpiroAnim is ready offline" notice confirms that precaching completed.
- A browser shortcut created from a development or otherwise uncontrolled page is only a shortcut;
  it is not an offline-capable installed app.
- Installed desktop and Android apps retain the fullscreen control. It remains hidden on iOS and
  iPadOS until their fullscreen behavior is tested and intentionally supported.
- The service worker uses the client-only `app-shell.html` as its offline navigation fallback,
  including route aliases and URLs containing animation query data.
- The final service worker is generated after prerendering, so Workbox revisions the actual emitted
  HTML and cannot reuse documents that reference outdated hashed assets.

## Icons

`public/pwa-source.svg` is the authoritative, editable icon source. It intentionally has a
transparent background; the generator adds a dark background only to platform-specific icons that
require one. Regenerate the favicon, Apple touch icon,
standard PWA icons, and maskable icon after changing it:

```sh
npm run generate:pwa-assets
```

The generation settings are in `pwa-assets.config.ts`. Keep important maskable artwork inside the
central safe zone.

### Icon design brief

Treat these constraints as part of the icon's design contract when modifying it manually or with an
LLM:

- Edit `public/pwa-source.svg`, not the generated PNG or ICO files. Keep it as an understandable,
  editable vector with named gradients, grouped elements, and no embedded raster image.
- Keep the SVG canvas transparent. Do not add a full-canvas dark rectangle, vignette, or baked-in
  border. `pwa-assets.config.ts` supplies the dark background for maskable and Apple icons.
- Preserve the basic concept: three rounded orbital loops at different apparent 3D orientations.
  The tiny spherical center accent is optional and must remain subordinate to the paths. The mark
  should suggest a spirographic animation path and remain legible at 48-64 pixels.
- Preserve a violet-to-blue-to-cyan/teal palette and luminous technical character. The high-level
  inspiration is Vulkan Tech Gospel's dark, neon, flow-art mood; do not copy its skull, lettering,
  diagram, or any other specific artwork.
- Avoid four-way rotational symmetry, hooked or right-angled arms, bent arrows, pinwheels, crosses,
  and any silhouette that could resemble a swastika or another religious or political symbol.
- Keep the emblem visually large on the transparent standard icon while retaining enough central
  safe-zone clearance for circular and maskable crops.
- After every source change, run `npm run generate:pwa-assets` and inspect at least the 64-pixel,
  512-pixel, maskable, and Apple outputs. Do not hand-edit those generated derivatives.

## Validation

The PWA test builds the production application, starts Vite preview, validates the generated
manifest and icons, installs the service worker, and performs an offline routed navigation:

```sh
npm run test:pwa
```

Use Chrome DevTools Application panels to inspect the manifest, service worker, and cache contents
when diagnosing an installed build.

## Hosting requirements

Production hosting must:

- serve the site over HTTPS and redirect HTTP to HTTPS;
- serve the generated directory index files so `/`, `/index`, and `/about` return their prerendered
  HTML;
- serve the generated client-only directory index files for `/app`, `/player`, `/editor`,
  `/timeline`, and the pane-layout aliases. A blanket rewrite to `/index.html` would replace this
  separation and should not be used;
- serve `manifest.webmanifest` as `application/manifest+json`;
- revalidate HTML files, `/manifest.webmanifest`, and `/sw.js` rather than caching them as immutable;
- cache hashed `/assets/*` files with a long immutable lifetime.

### Cloudflare Pages cache configuration

The production site is hosted by Cloudflare Pages. Cloudflare reads `public/_headers` during
deployment and applies those response-header rules to the generated files. Keep that file in the
repository even though it is not used by Vite's local development or preview servers.

The current rules require:

- `/sw.js` to use `no-cache, no-store, must-revalidate` so browsers can discover a new service
  worker immediately;
- `/manifest.webmanifest` to use `no-cache, must-revalidate` so installation metadata stays
  current;
- fingerprinted `/assets/*` files to use a one-year immutable cache because a content change
  produces a new filename.

Cloudflare Pages' default immediate-revalidation behavior is retained for HTML. Do not apply a long
immutable cache to HTML, the manifest, or the service worker. A stale HTML document can reference
fingerprinted assets from an older deployment and leave the application unable to start.

If hosting moves away from Cloudflare Pages, `public/_headers` may not be recognized. Configure the
new platform to provide the same effective cache behavior using its headers, redirects, or server
configuration. The deployment must also publish each build consistently so its HTML, service
worker, and fingerprinted assets come from the same build.

After changing hosts or cache rules, inspect the deployed response headers for `/`, `/sw.js`,
`/manifest.webmanifest`, and one `/assets/*` file. Local preview confirms application behavior but
cannot validate CDN response headers.

Vite emits production files to `build/`. The directory is ignored because deployment should build
from source. If a hosting workflow intentionally commits generated output, document that exception
and ensure every deployment regenerates the service worker and precache manifest.
