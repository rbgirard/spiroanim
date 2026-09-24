import { test, expect, type Page } from '@playwright/test'

const expectLayouts = async (page: Page) => {
  for (const [ratio, count] of [
    ['1:2', 18],
    ['2:1', 18],
    ['1:4', 18],
    ['2:3', 18],
    ['2:5', 18],
    ['1:3', 9],
  ] as const) {
    await page.getByRole('radio', { name: `Use the ${ratio} speed ratio`, exact: true }).check()
    const previews = page.locator('[data-role="vtg-preview"]')
    await expect(previews).toHaveCount(count)
    await expect(previews.last()).toHaveAttribute('src', /^blob:/)
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/play-vtg')
  await page
    .locator('label')
    .filter({ has: page.locator('[data-role="vtg-advanced"]') })
    .click()
})

test('compares VTG thumbnail paths in standalone VTG', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await expectLayouts(page)
  expect(errors).toEqual([])
})

test('compares VTG thumbnail paths in Builder Full Grid', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.locator('[data-cell-reference="1-1"]').click()
  await page
    .locator('label')
    .filter({ has: page.getByRole('checkbox', { name: 'Pattern Builder', exact: true }) })
    .click()
  await page
    .locator('label')
    .filter({ has: page.locator('[data-role="vtg-builder-full-grid"]') })
    .click()
  await expectLayouts(page)
  expect(errors).toEqual([])
})
