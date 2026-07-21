# How to Prerender a Public Page

SpiroAnim prerenders selected public pages during `npm run build`. The editor and PWA functionality
remain client-only. Prerendering is an explicit allowlist so a new route cannot accidentally become
search-indexable.

The examples below add a public `/help` page.

## 1. Create the view

Add the route-level component under `src/views`, for example `src/views/HelpPage.vue`. Keep
browser-only behavior behind `onMounted()` so the component can render safely during the build.

```vue
<template>
  <main>
    <h1>Help</h1>
    <p>Help content that search engines can read.</p>
  </main>
</template>
```

Three.js, editor state, DOM access, media queries, PWA controls, and other browser-dependent work
should either remain on client-only routes or wait until mounting.

## 2. Register the route

Add the page to `src/router/index.ts`:

```ts
{
  path: '/help',
  name: 'help',
  component: () => import('@/views/HelpPage.vue'),
},
```

Do not add the route to `clientOnlyPaths`. If an existing route is being converted from client-only
to prerendered, remove it from that list or the prerender script will overwrite it with the app
shell.

## 3. Add search metadata

Add an entry to `src/domain/seo/pageSeo.ts`:

```ts
'/help': {
  canonicalPath: '/help',
  description: 'Learn how to use SpiroAnim.',
  robots: 'index, follow',
  title: 'Help - SpiroAnim',
},
```

Use a unique, descriptive title and description. The canonical path should match the public route.

## 4. Add the page to the prerender build

In `scripts/prerender.mjs`, render the route and write both its directory-index and clean-URL files:

```js
const help = await render('/help')

await writeRoute('/help', pageHtml(help.appHtml, help.seo), true)
```

The final `true` emits both:

- `build/help/index.html`
- `build/help.html`

This supports static hosts that resolve `/help` using either convention.

## 5. Preserve rendered HTML through the service worker

Add both generated files to `additionalManifestEntries` in `vite.config.ts`:

```ts
{ url: 'help.html', revision: publicPageRevision },
{ url: 'help/index.html', revision: publicPageRevision },
```

Then add `help` to `navigateFallbackDenylist`. For example:

```ts
navigateFallbackDenylist: [/^\/(?:index\/?|about\/?|help\/?)?$/],
```

This step is required. Without it, an active service worker can replace the rendered document with
`app-shell.html`, making the page client-rendered again. The revision keeps the cached public HTML
in sync when application source changes.

## 6. Add the page to the sitemap

Add its canonical URL to `public/sitemap.xml`:

```xml
<url>
  <loc>https://spiroanim.com/help</loc>
</url>
```

Only add public, canonical, indexable pages to the sitemap.

## 7. Add or update tests

Add the route to the relevant router and metadata tests. Extend `e2e/pwa.spec.ts` when necessary to
verify that the built response contains the page's rendered heading and `data-prerendered="true"`.

## 8. Build and verify

Run:

```powershell
npm.cmd run build
npm.cmd run preview
```

Open `http://localhost:4173/help`, then use **View Page Source** (`Ctrl+U`). Do not use only the
DevTools Elements panel, because Elements also shows content created later by JavaScript.

Confirm the source contains:

- the page's heading and meaningful body copy;
- `data-prerendered="true"` on the application container;
- the expected `<title>` and description;
- the canonical URL;
- `robots` set to `index, follow`.

Disable JavaScript and reload as an additional check. The primary page content should remain
visible, while controls intentionally deferred until mounting may be absent.

If an old service worker is still active, accept the SpiroAnim update prompt or unregister it under
DevTools > Application > Service Workers before checking again.

## Completion checklist

- [ ] View component created under `src/views`.
- [ ] Route registered and not listed as client-only.
- [ ] SEO metadata added.
- [ ] Route rendered by `scripts/prerender.mjs`.
- [ ] Clean and directory-index HTML added to the service-worker manifest.
- [ ] Route excluded from the client-shell navigation fallback.
- [ ] Canonical URL added to the sitemap.
- [ ] Browser-only behavior deferred until mounting.
- [ ] Tests updated.
- [ ] Production build and View Page Source verified.
