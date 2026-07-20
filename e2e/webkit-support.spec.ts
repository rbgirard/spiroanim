import { expect, test } from '@playwright/test'

test('explains the rendering requirements when WebKit is unsupported', async ({ page }) => {
  await page.goto('/app')

  await expect(page.getByRole('heading', { name: 'Browser not supported' })).toBeVisible()
  await expect(
    page.getByText('This application requires ES2022, WebGL 2, and OffscreenCanvas support.'),
  ).toBeVisible()
})
