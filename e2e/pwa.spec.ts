import { expect, test, type Response } from '@playwright/test'
import { readdir } from 'node:fs/promises'

import { stagePwaBuildTransition } from './support/pwaBuildTransition.js'

function requireResponse(response: Response | null): Response {
  if (!response) throw new Error('The browser did not return a navigation response.')
  return response
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

interface ManifestIcon {
  sizes: string
  src: string
}

function readManifestIcons(manifest: unknown): ManifestIcon[] {
  if (!isRecord(manifest) || !Array.isArray(manifest.icons)) {
    throw new Error('The generated web manifest does not contain an icons array.')
  }

  return manifest.icons.map((icon) => {
    if (!isRecord(icon) || typeof icon.src !== 'string' || typeof icon.sizes !== 'string') {
      throw new Error('The generated web manifest contains an invalid icon entry.')
    }

    return { sizes: icon.sizes, src: icon.src }
  })
}

test('ships an installable manifest and every declared icon', async ({ request }) => {
  for (const iconPath of [
    '/images/app-icons/favicon.ico',
    '/images/app-icons/pwa-source.svg',
    '/images/app-icons/apple-touch-icon-180x180.png',
  ]) {
    expect((await request.get(iconPath)).ok()).toBe(true)
  }

  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('application/manifest+json')

  const manifest: unknown = await response.json()
  expect(manifest).toMatchObject({
    id: '/',
    scope: '/',
    start_url: '/',
    name: 'SpiroAnim',
    short_name: 'SpiroAnim',
    display: 'standalone',
  })

  const declaredSizes = new Set<string>()
  for (const icon of readManifestIcons(manifest)) {
    declaredSizes.add(icon.sizes)
    expect((await request.get(icon.src)).ok()).toBe(true)
  }

  expect(declaredSizes).toContain('192x192')
  expect(declaredSizes).toContain('512x512')
  expect(manifest).toMatchObject({
    shortcuts: [
      { name: 'SpiroAnim', short_name: 'SpiroAnim', url: '/app' },
      { name: 'About', short_name: 'About', url: '/about' },
    ],
  })

  const devManifestResponse = await request.get('/manifest-dev.webmanifest')
  expect(devManifestResponse.ok()).toBe(true)
  expect(await devManifestResponse.json()).toMatchObject({
    name: 'SpiroAnim Dev',
    short_name: 'SpiroAnim Dev',
  })
})

test('precaches every elemental image before its first offline use', async ({ context, page }) => {
  const assets = await readdir(new URL('../build/assets/', import.meta.url))
  const elementalImages = assets.filter((name) =>
    /^(air|earth|fire|moon|sun|water)-.*\.webp$/.test(name),
  )
  expect(elementalImages).toHaveLength(6)

  // Install from the landing page without first displaying the elemental artwork.
  await page.goto('/')
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  await context.setOffline(true)
  try {
    for (const name of elementalImages) {
      const dimensions = await page.evaluate(async (source) => {
        const image = new Image()
        image.src = source
        await image.decode()
        return { width: image.naturalWidth, height: image.naturalHeight }
      }, `/assets/${name}`)
      expect(dimensions.width).toBeGreaterThan(0)
      expect(dimensions.height).toBeGreaterThan(0)
    }
  } finally {
    await context.setOffline(false)
  }
})

test('serves rendered HTML only for public pages', async ({ request }) => {
  const landing = await (await request.get('/')).text()
  const about = await (await request.get('/about')).text()
  const app = await (await request.get('/app')).text()
  const notFound = await (await request.get('/404.html')).text()

  expect(landing).toContain('data-prerendered="true"')
  expect(landing).toContain('id="landing-title"')
  expect(landing).toContain('<html lang="en" data-theme="dark">')
  expect(landing).toContain('<meta name="theme-color" content="#090b0f" />')
  expect(landing).not.toContain('dev.spiroanim.com')
  expect(about).toContain('data-prerendered="true"')
  expect(about).toContain('id="about-title"')
  expect(app).toContain('<div id="app"></div>')
  expect(app).not.toContain('data-prerendered="true"')
  expect(notFound).toContain('<meta name="robots" content="noindex, nofollow">')
  expect(notFound).toContain('<div id="app"></div>')
})

test('serves the PWA reset page outside the application shell', async ({ request }) => {
  const response = await request.get('/reset/')
  const html = await response.text()

  expect(response.ok()).toBe(true)
  expect(html).toContain('<h1 id="reset-title">Resetting SpiroAnim</h1>')
  expect(html).toContain('navigator.serviceWorker.getRegistrations()')
  expect(html).not.toContain('<div id="app"></div>')
})

test('serves VTG3 as an indexable standalone document without precaching it', async ({
  request,
}) => {
  const extensionlessResponse = await request.get('/vtg3')
  const response = await request.get('/vtg3/')
  const html = await response.text()
  const serviceWorker = await (await request.get('/sw.js')).text()

  expect(extensionlessResponse.ok()).toBe(true)
  expect(await extensionlessResponse.text()).toContain('<h1>Vulcan Tech Gospel 3</h1>')
  expect(response.ok()).toBe(true)
  expect(html).toContain('<h1>Vulcan Tech Gospel 3</h1>')
  expect(html).toContain('<meta name="robots" content="index, follow" />')
  expect(html).toContain('<link rel="canonical" href="https://spiroanim.com/vtg3/" />')
  expect(html).toContain('name="description"')
  expect(html).toContain('VTG3 and the VTG3 grid were created by Noel Yee.')
  expect(html).toContain('id="return-to-app"')
  expect(html).toContain('>Return to App</a')
  expect(html).not.toContain('>VTG4 Expansion</a')
  expect(html).toContain('/docs-return-to-app.js')
  expect(html).toContain('The VTG 3 was born out of the VTG 1 and the VTG 2.')
  expect(html).toContain('Timing and direction refer to the relative timing')
  for (const abbreviation of ['Tog/Same', 'Tog/Opp', 'Split/Same', 'Split/Opp']) {
    expect(html).toContain(abbreviation)
  }
  expect(html).toContain('A snapshot is the image of a given pattern across the x or y axis.')
  expect(html).toContain('Pattern refers to the image that the props of a given pattern create')
  expect(html).toContain('/vtg3/assets/patterns/1-1/1-1.png')
  expect(html).toContain('/vtg3/assets/patterns/1-3/5-5-spin.png')
  expect(html).toContain('/vtg3/assets/patterns/1-5/5-5-anti.png')
  const patternSection = html.slice(
    html.indexOf('id="patterns"'),
    html.indexOf('</section>', html.indexOf('id="patterns"')),
  )
  const patternSources = [
    ...patternSection.matchAll(/src="(\/vtg3\/assets\/patterns\/[^"]+\.png)"/g),
  ]
    .map((match) => match[1])
    .filter((source) => source !== undefined)
  expect(patternSources).toHaveLength(30)
  expect(new Set(patternSources).size).toBe(30)
  expect(patternSection.match(/loading="eager"/g)).toHaveLength(30)
  expect(patternSection.match(/width="512"/g)).toHaveLength(30)
  expect(patternSection.match(/height="512"/g)).toHaveLength(30)
  expect(patternSection).not.toContain('loading="lazy"')
  for (const source of patternSources) {
    expect((await request.get(source)).ok()).toBe(true)
  }
  expect(html).not.toContain('pattern-pure.webp')
  expect(html).not.toContain('pattern-hybrid-spin-antispin.webp')
  expect(html).not.toContain('pattern-hybrid-spin-spin.webp')
  expect(html).toContain('class="vtg-grid-board"')
  expect(html).toContain('/vtg3/assets/art/vtg3-credit.png')
  expect(html).toContain('id="study-grid"')
  expect(html).toContain('const studyPatternOrder = [')
  expect(html).toContain("['5-1', '5-3', '5-5-spin', '5-1', '5-3', '5-5-anti', '5-1', '5-3']")
  expect(html).toContain("['5-1', '5-3', '5-5-anti', '5-1', '5-3', '5-5-spin', '5-1', '5-3']")
  expect(html).not.toContain('pattern-study.webp')
  for (const ratio of ['1-1', '1-3', '1-5']) {
    expect(html).not.toContain(`/vtg3/assets/art/grid-${ratio}.webp`)
  }
  expect((await request.get('/vtg3/assets/art/vtg3-credit.png')).ok()).toBe(true)
  expect(html).not.toContain('<div id="app"></div>')
  expect(serviceWorker).not.toContain('vtg3/')
})

test('caches VTG4 and returns to the app offline', async ({ context, page }) => {
  await page.goto('/app')
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  await page.goto('/vtg4/')
  await expect(page.getByRole('heading', { name: 'Timing & Direction' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://spiroanim.com/vtg4/',
  )
  await expect(
    page.getByRole('complementary', { name: 'VTG4 and VTG3 relationship' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Return to App' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Home' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'About' })).toHaveCount(0)

  await context.setOffline(true)
  try {
    const offlineResponse = requireResponse(await page.reload())
    expect(offlineResponse.fromServiceWorker()).toBe(true)

    await page.getByRole('link', { name: 'Return to App' }).click()
    await expect(page.locator('[data-role="main-container"]')).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test('removes service workers and all locally stored app data for the current origin', async ({
  page,
}) => {
  await page.goto('/app')
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  await page.evaluate(async () => {
    const cache = await caches.open('spiroanim-reset-test')
    await cache.put('/reset-test-entry', new globalThis.Response('cached'))
    localStorage.setItem('spiroanim-reset-test', 'persisted')
    sessionStorage.setItem('spiroanim-reset-test', 'session')

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('spiroanim-reset-test')
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  })

  const response = requireResponse(await page.goto('/reset/'))
  expect(response.fromServiceWorker()).toBe(false)
  await expect(page.getByRole('heading', { name: 'Reset complete' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open a fresh copy' })).toBeVisible()

  await expect
    .poll(() =>
      page.evaluate(async () => ({
        caches: await caches.keys(),
        databases: (await indexedDB.databases()).map((database) => database.name),
        localStorage: localStorage.length,
        registrations: (await navigator.serviceWorker.getRegistrations()).length,
        sessionStorage: sessionStorage.length,
      })),
    )
    .toEqual({
      caches: [],
      databases: [],
      localStorage: 0,
      registrations: 0,
      sessionStorage: 0,
    })
})

test('relaunches a routed application screen after the network goes offline', async ({
  context,
  page,
}) => {
  await page.goto('/app')
  await expect(page.locator('[data-role="main-container"]')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
    )
    .toBeGreaterThan(0)
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  const landingResponse = requireResponse(await page.goto('/'))

  expect(landingResponse.fromServiceWorker()).toBe(true)
  expect(await landingResponse.text()).toContain('data-prerendered="true"')
  await expect(page.getByRole('heading', { name: 'SpiroAnim.com' })).toBeVisible()

  await page.close()

  await context.setOffline(true)
  try {
    const offlinePage = await context.newPage()
    await offlinePage.goto('/player')
    await expect(offlinePage.locator('[data-role="main-container"]')).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test('updates an open page across changed lazy CSS without stale asset failures', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'SpiroAnim.com' })).toBeVisible()
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  const transition = await stagePwaBuildTransition()
  let replacementCssLoaded = false
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === transition.replacementCssUrl) {
      replacementCssLoaded = response.ok()
    }
  })

  try {
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      await registration.update()
    })

    const updateButton = page.getByRole('button', { name: 'Update Now' })
    await expect(updateButton).toBeVisible()
    await Promise.all([page.waitForEvent('load'), updateButton.click()])

    await expect(page.getByRole('heading', { name: 'SpiroAnim.com' })).toBeVisible()
    await page.goto('/app')
    await expect(page.locator('[data-role="main-container"]')).toBeVisible()

    expect(replacementCssLoaded).toBe(true)
    expect(consoleErrors).toEqual([])
  } finally {
    await transition.restore()
  }
})
