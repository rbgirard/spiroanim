import { test, expect, devices } from '@playwright/test'

test('keeps VTG and QTR manual Scale across ratio changes and reload on mobile', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    userAgent: devices['Pixel 7'].userAgent,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto('/play-vtg')
    await page.locator('[data-cell-reference="1-1"]').click()
    await page
      .locator('label')
      .filter({ has: page.locator('[data-role="vtg-advanced"]') })
      .click()
    await page.locator('[data-role="vtg-property-scale-toggle"]').click()
    const auto = page.locator('[data-role="vtg-scale-auto"]')
    const autoButton = page.locator('label').filter({ has: auto })
    const pane = page.locator('[data-role="vtg-pane"]')
    await expect(auto).toBeChecked()
    await page.locator('[data-role="vtg-customize-toggle"]').click()
    await page.locator('[data-role="vtg-scale-stepper-increase"]').click()
    await expect.poll(() => new URL(page.url()).searchParams.get('vs')).toBe('a:90')
    await autoButton.click()
    await expect(page.locator('[data-role="vtg-scale-stepper"]')).toHaveCount(0)
    await expect(page.locator('[data-role="vtg-scale-0-stepper"]')).toContainText('0.9')
    await page.locator('[data-role="vtg-scale-0-stepper-decrease"]').click()
    await page.locator('[data-role="vtg-scale-1-stepper-increase"]').click()
    await expect(page.locator('[data-role="vtg-scale-0-stepper"]')).toContainText('0.8')
    await expect(page.locator('[data-role="vtg-scale-1-stepper"]')).toContainText('1.0')
    await page.getByRole('radio', { name: 'Use the 1:5 speed ratio', exact: true }).check()
    await expect(pane).toHaveAttribute('data-speed-ratio', '1:5')
    await page.locator('[data-role="vtg-qtr"]').check()
    await page.locator('[data-cell-reference="1-2"]').click()
    await expect(page.locator('[data-role="vtg-scale-0-stepper"]')).toContainText('0.8')
    await expect(page.locator('[data-role="vtg-scale-1-stepper"]')).toContainText('1.0')
    await expect.poll(() => new URL(page.url()).searchParams.get('vs')).toBe('m:90')
    await page.reload()
    await expect(auto).not.toBeChecked()
    await expect(page.locator('[data-role="vtg-qtr"]')).toBeChecked()
    await expect(pane).toHaveAttribute('data-selected-cell', '1-2')
    await expect(page.locator('[data-role="vtg-scale-0-stepper"]')).toContainText('0.8')
    await expect(page.locator('[data-role="vtg-scale-1-stepper"]')).toContainText('1.0')
    await page
      .locator('label')
      .filter({ has: page.locator('input[name$="-scale-mode"][value="advanced"]') })
      .click()
    await page.locator('[data-role="vtg-scale-0-1-stepper-increase"]').click()
    await expect(page.locator('[data-role="vtg-scale-0-1-stepper"]')).toContainText('0.9')
    await expect.poll(() => new URL(page.url()).searchParams.get('vs')).toBe('d:90')
    await page.reload()
    await expect(page.locator('[data-role="vtg-scale-0-1-stepper"]')).toContainText('0.9')
    await expect(page.locator('[data-role="vtg-scale-1-1-stepper"]')).toContainText('1.0')
    await autoButton.click()
    await expect.poll(() => new URL(page.url()).searchParams.get('vs')).toBe('a:90')
    await expect(page.locator('[data-role="vtg-scale-0-stepper"]')).toHaveCount(0)
    await autoButton.click()
    await expect(page.locator('[data-role="vtg-scale-0-stepper"]')).toContainText('1.1')
    await expect(page.locator('[data-role="vtg-scale-1-stepper"]')).toContainText('1.1')
    expect(errors).toEqual([])
  } finally {
    await context.close()
  }
})
