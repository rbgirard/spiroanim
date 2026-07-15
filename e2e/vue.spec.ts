import { test, expect } from '@playwright/test'

test('restores both routes with browser back and forward navigation', async ({ page }) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'SpiroAnim.com' })).toBeVisible()

  await page.getByRole('link', { name: 'Enter' }).click()
  await expect(page.locator('[data-role="main-container"]')).toBeVisible()

  await page.goBack()
  expect(new URL(page.url()).pathname).toBe('/')
  await expect(page.getByRole('heading', { name: 'SpiroAnim.com' })).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])

  await page.goForward()
  await expect(page.locator('[data-role="main-container"]')).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})
