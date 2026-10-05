import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto(
    '/play-vtg?r=Ew496k11Y&p0=Q__.blE.5JE-ZU..._ZE_6k........_ZE-ZU....&x0=Qo&m0=_1_mxqv__&p1=N__.bn_.5JE-ZU......._ZE_6k........_ZE-ZU&x1=Qo&c=_i_bhq&v=12&vs=a:80',
  )
  await page
    .locator('label')
    .filter({ has: page.locator('[data-role="vtg-advanced"]') })
    .click()
  const beat = page.locator('[data-role="vtg-beat"]')
  const fortyFive = page.locator('[data-role="vtg-transition-45"]')
  const trans = page.locator('[data-role="vtg-transition"]')
  await expect(fortyFive).toBeChecked()
  await expect(beat).toHaveValue('1')
  const originalUrl = page.url()
  await beat.press('ArrowRight')
  await expect(beat).toHaveValue('1.5')
  await expect.poll(() => page.url()).not.toBe(originalUrl)
  await expect(trans).not.toBeChecked()
})

test('retains 45 at beat 1.5 after refresh', async ({ page }) => {
  await page.reload()
  await expect(page.locator('[data-role="vtg-transition-45"]')).toBeChecked()
  await expect(page.locator('[data-role="vtg-transition"]')).not.toBeChecked()
  await expect(page.locator('[data-role="vtg-beat"]')).toHaveValue('1.5')
  await expect(page.locator('[data-role="vtg-transition-beats"]')).toHaveValue('2')
  await expect(page.locator('[data-role="vtg-transition-quad"]')).toBeChecked()
})

test('retains 45 after moving from beat 1 to 1.5 and back before refresh', async ({ page }) => {
  const beat = page.locator('[data-role="vtg-beat"]')
  const halfBeatUrl = page.url()
  await beat.press('ArrowLeft')
  await expect(beat).toHaveValue('1')
  await expect.poll(() => page.url()).not.toBe(halfBeatUrl)
  await page.reload()
  await expect(page.locator('[data-role="vtg-transition-45"]')).toBeChecked()
  await expect(page.locator('[data-role="vtg-transition"]')).not.toBeChecked()
  await expect(beat).toHaveValue('1')
  await expect(page.locator('[data-role="vtg-transition-beats"]')).toHaveValue('2')
  await expect(page.locator('[data-role="vtg-transition-quad"]')).toBeChecked()
})
