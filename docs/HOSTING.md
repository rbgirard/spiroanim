# Production Hosting

This document defines the production routing and cache behavior required by SpiroAnim's
prerendered pages, client-only application shells, and Progressive Web App.

## Hosting requirements

Production hosting must:

- serve the site over HTTPS and redirect HTTP to HTTPS;
- serve the generated directory index files so `/`, `/index`, `/about`, and `/tips` return their
  prerendered HTML;
- serve `/vtg3/` and `/vtg4/` as their rendered, indexable standalone documents;
- serve the generated client-only directory index files for `/app`, `/player`, `/editor`,
  `/timeline`, `/concepts`, `/vulcan-tech-gospel`, `/quarterspacing`, `/eight-step`,
  `/quarter-space-tech`, `/the-kinetic-alphabet`, and the pane-layout aliases. A
  blanket rewrite to `/index.html` would
  replace this separation and should not be used;
- serve both web manifests as `application/manifest+json`;
- revalidate HTML files, `/manifest.webmanifest`, `/manifest-dev.webmanifest`, and `/sw.js` rather
  than caching them as immutable;
- do not apply an immutable browser-cache rule to the blanket `/assets/*` URL pattern unless the
  host guarantees missing assets cannot fall back to HTML with the same cache policy.

The application-shell and prerender boundary is described in [`SEO.md`](./SEO.md). PWA runtime and
update behavior is described in [`PWA.md`](./PWA.md).

## Cloudflare Pages cache configuration

The production site is hosted by Cloudflare Pages. Cloudflare reads `public/_headers` during
deployment and applies those response-header rules to the generated files. Keep that file in the
repository even though it is not used by Vite's local development or preview servers.

The current rules require:

- `/sw.js` to use `no-cache, no-store, must-revalidate` so browsers can discover a new service
  worker immediately;
- `/manifest.webmanifest` and `/manifest-dev.webmanifest` to use `no-cache, must-revalidate` so
  installation metadata stays current;
- missing assets to return a real not-found response instead of successful HTML. The build emits a
  standard `404.html` alongside explicit HTML shells for every supported application route.

Cloudflare Pages' default immediate-revalidation behavior is retained for HTML and assets. Do not
apply a long immutable cache to HTML, the manifest, the service worker, or a wildcard that can also
match an HTML fallback. A stale document or cached fallback can reference or replace fingerprinted
assets and leave the application unable to start.

If hosting moves away from Cloudflare Pages, `public/_headers` may not be recognized. Configure the
new platform to provide the same effective cache behavior using its headers, redirects, or server
configuration. The deployment must also publish each build consistently so its HTML, service
worker, and fingerprinted assets come from the same build.

## Deployment validation

After changing hosts or cache rules, inspect the deployed response headers for:

- `/`
- `/sw.js`
- `/manifest.webmanifest`
- `/manifest-dev.webmanifest`
- one `/assets/*` file

Also verify that a missing fingerprinted asset returns a real not-found response rather than an
HTML fallback. Local preview confirms application behavior but cannot validate CDN response
headers.

Vite emits production files to `build/`. The directory is ignored because deployment should build
from source. If a hosting workflow intentionally commits generated output, document that exception
and ensure every deployment regenerates the service worker and precache manifest.
