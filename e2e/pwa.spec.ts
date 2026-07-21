import { expect, test, type Response } from '@playwright/test'

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
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('application/manifest+json')

  const manifest: unknown = await response.json()
  expect(manifest).toMatchObject({
    id: '/',
    scope: '/',
    start_url: '/',
    display: 'standalone',
  })

  const declaredSizes = new Set<string>()
  for (const icon of readManifestIcons(manifest)) {
    declaredSizes.add(icon.sizes)
    expect((await request.get(icon.src)).ok()).toBe(true)
  }

  expect(declaredSizes).toContain('192x192')
  expect(declaredSizes).toContain('512x512')
})

test('serves rendered HTML only for public pages', async ({ request }) => {
  const landing = await (await request.get('/')).text()
  const about = await (await request.get('/about')).text()
  const app = await (await request.get('/app')).text()

  expect(landing).toContain('data-prerendered="true"')
  expect(landing).toContain('id="landing-title"')
  expect(about).toContain('data-prerendered="true"')
  expect(about).toContain('id="about-title"')
  expect(app).toContain('<div id="app"></div>')
  expect(app).not.toContain('data-prerendered="true"')
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
