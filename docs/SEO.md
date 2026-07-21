# Search Engine Rendering

SpiroAnim selectively prerenders its public information pages during `npm run build`:

- `/` and `/index` contain the rendered landing page.
- `/about` contains the rendered About page.
- `/app` and its player, editor, timeline, and pane-layout aliases use a client-only shell.

This is static-site generation rather than a continuously running server. It gives crawlers useful
HTML for the small set of indexable pages without evaluating Three.js, editor state, PWA behavior,
or browser APIs on a server. Vue hydrates the prerendered public pages after mounting. Responsive
guidance remains in the stable HTML and is controlled by CSS, while PWA controls intentionally
appear only after the client mount.

## Build flow

`npm run build` performs these steps:

1. Builds the browser application and web manifest.
2. Builds a temporary Vue server-rendering entry.
3. Renders the landing and About routes into the browser build.
4. Writes client-only route shells for the application aliases.
5. Generates the final service worker from the complete browser and prerender output.
6. Runs the TypeScript check.

The temporary `build-server/` directory and deployable `build/` directory are generated output and
are ignored by Git. `public/robots.txt` and `public/sitemap.xml` are copied into the final build.

## Adding a public page

To make a future route indexable, add its metadata to `src/domain/seo/pageSeo.ts`, render it from
`scripts/prerender.mjs`, and add its canonical URL to `public/sitemap.xml`. Pages that use
browser-only APIs must defer that behavior until mounting or keep it in the client-only route set.
Follow the complete step-by-step checklist in [PRERENDERING.md](PRERENDERING.md).

Hosting must serve directory index files. Do not rewrite every request to the root `index.html`,
because doing so would discard both the prerendered About document and the explicit client-only app
shells. The build also emits clean-URL files such as `about.html` and `app.html` for static servers
that resolve `/about` or `/app` that way. See `docs/PWA.md` for the complete production hosting
requirements.
