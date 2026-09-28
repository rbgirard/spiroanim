import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`Third Order detects VTG edits without rewriting the player at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000)
    await page.setViewportSize(viewport)
    await page.addInitScript(() =>
      localStorage.setItem('sa-concepts', JSON.stringify({ vtgAdvanced: true })),
    )
    await page.goto('/play-to')
    const concept = page.getByRole('combobox', { name: 'Concept', exact: true })
    const target = '[data-role="to-cell"][data-hand-ratio="1:2"][data-prop-ratio="2:11"]'
    await page.locator(target).click()
    await concept.selectOption('vtg')
    await expect(page.locator('[data-role="vtg-pane"]')).toHaveAttribute(
      'data-selected-cell',
      /^[1-6]-[1-6]$/,
    )
    const rotation = page.locator('[data-role="vtg-orientation"]')
    await expect(rotation).toBeEnabled()
    const beforeRotation = new URL(page.url()).search
    await rotation.selectOption((await rotation.inputValue()) === '45' ? '90' : '45')
    await expect.poll(() => new URL(page.url()).search).not.toBe(beforeRotation)
    await page.locator('[data-role="vtg-property-scale-toggle"]').click()
    const beforeScale = new URL(page.url()).search
    await page.getByRole('slider', { name: 'Left Scale', exact: true }).press('ArrowRight')
    await expect.poll(() => new URL(page.url()).search).not.toBe(beforeScale)
    const edited = new URL(page.url()).search
    await concept.selectOption('to')
    await expect(page.locator(target)).toHaveAttribute('aria-pressed', 'true')
    expect(new URL(page.url()).search).toBe(edited)
    await expect
      .poll(async () => {
        const cell = await page.locator(target).boundingBox()
        const header = await page.locator('[data-role="to-pane"] thead').boundingBox()
        const pane = await page.locator('[data-concepts-pane]').boundingBox()
        return (
          cell!.y >= header!.y + header!.height && cell!.y + cell!.height <= pane!.y + pane!.height
        )
      })
      .toBe(true)
    await concept.selectOption('vtg')
    await expect(page.locator('[data-role="vtg-pane"]')).toHaveAttribute(
      'data-selected-cell',
      /^[1-6]-[1-6]$/,
    )
    const beforeSwap = new URL(page.url()).search
    await page
      .locator('label')
      .filter({ has: page.locator('[data-role="vtg-swap"]') })
      .click()
    await expect.poll(() => new URL(page.url()).search).not.toBe(beforeSwap)
    const swapped = new URL(page.url()).search
    await concept.selectOption('to')
    await expect(page.locator(target)).toHaveAttribute('aria-pressed', 'true')
    expect(new URL(page.url()).search).toBe(swapped)
    await page.reload()
    await expect(page.locator(target)).toHaveAttribute('aria-pressed', 'true')
    expect(new URL(page.url()).search).toBe(swapped)
  })

  test(`Third Order cycles duplicates in the player and selected preview at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/play-to')
    const dropdown = page.getByRole('combobox', { name: 'Duplicate', exact: true })
    await expect(dropdown).toBeDisabled()
    await expect(dropdown.locator('option')).toHaveCount(0)
    const controlColors = (element: Element) => {
      const style = getComputedStyle(element)
      return [style.color, style.backgroundColor, style.borderTopColor]
    }
    const selectedColors = await page
      .locator('.third-order-directions input:checked + span')
      .first()
      .evaluate(controlColors)
    expect(await dropdown.evaluate(controlColors)).not.toEqual(selectedColors)
    const cell = page.locator('[data-role="to-cell"]').first()
    const preview = cell.locator('img')
    await expect(page.locator('[data-role="to-cell-preview"]')).toHaveCount(136, { timeout: 15000 })
    await cell.click()
    await expect(dropdown).toHaveValue('1')
    await expect(dropdown.locator('option')).toHaveCount(4)
    await expect.poll(() => dropdown.evaluate(controlColors)).toEqual(selectedColors)
    await expect.poll(() => new URL(page.url()).searchParams.has('r')).toBe(true)
    const originalUrl = page.url()
    const originalPreview = await preview.getAttribute('src')
    await cell.click()
    await expect(dropdown).toHaveValue('2')
    await expect.poll(() => page.url()).not.toBe(originalUrl)
    await expect(preview).not.toHaveAttribute('src', originalPreview!)
    await cell.focus()
    await expect(page.getByRole('tooltip')).toContainText('Duplicate: 2 / 4')
    await dropdown.selectOption('4')
    const lastUrl = page.url()
    await cell.click()
    await expect(dropdown).toHaveValue('1')
    await expect.poll(() => page.url()).not.toBe(lastUrl)
    await expect.poll(() => page.url()).toBe(originalUrl)
    await dropdown.selectOption('3')
    await page.locator('[data-role="to-cell"]').nth(1).click()
    await expect(dropdown).toHaveValue('1')
    // Leaving an alternate restores the previous cell to its representative preview.
    await expect(preview).not.toHaveAttribute('src', originalPreview!)
  })

  test(`Third Order radio sizing matches Customize at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/play-to')
    await page.locator('[data-role="to-customize-toggle"]').press('Enter')
    const sizes = await page
      .locator(
        '.third-order-directions label > span, .third-order-directions select, [data-role="to-customize"] .concept-render-options label > span',
      )
      .evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element)
          return {
            height: element.getBoundingClientRect().height,
            paddingBlock: style.paddingBlock,
            paddingInline: style.paddingInline,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
          }
        }),
      )
    expect(sizes.length).toBeGreaterThan(6)
    for (const size of sizes) expect(size).toEqual(sizes[0])
  })

  test(`Third Order controls and column headers stay visible while scrolling at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/play-to')
    const scroller = page.locator('[data-concepts-pane]')
    const controls = page.locator('[data-role="to-sticky-controls"]')
    const header = page.locator('[data-role="to-pane"] thead')
    await expect(controls).toBeVisible()
    await scroller.evaluate((element) => {
      element.scrollTop = 350
    })
    await expect
      .poll(async () => {
        const pane = await scroller.boundingBox()
        const box = await controls.boundingBox()
        return Math.abs(box!.y - pane!.y)
      })
      .toBeLessThan(2)
    await expect
      .poll(async () => {
        const box = await controls.boundingBox()
        const top = await header.boundingBox()
        return Math.abs(top!.y - box!.y - box!.height)
      })
      .toBeLessThan(2)
    const selector = await page
      .getByRole('combobox', { name: 'Concept', exact: true })
      .boundingBox()
    const pane = await scroller.boundingBox()
    expect(selector!.y + selector!.height).toBeLessThan(pane!.y)
    await page
      .getByRole('radiogroup', { name: 'Hand', exact: true })
      .getByRole('radio', { name: 'Spin', exact: true })
      .press('Space')
    await page.locator('[data-role="to-column-header"][data-ratio="2:1"]').click()
    await expect(page.locator('[data-role="to-column-header"][data-ratio="2:1"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await scroller.evaluate((element) => {
      element.scrollTop = 0
    })
    await expect
      .poll(async () => (await controls.boundingBox())!.y - (await scroller.boundingBox())!.y)
      .toBeGreaterThan(10)
  })

  test(`Third Order reveals selections but not Customize updates at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/play-to')
    const scroller = page.locator('[data-concepts-pane]')
    const selected = page.locator('[data-role="to-cell"][aria-pressed="true"]')
    const last = page.locator(
      '[data-role="to-cell"][data-hand-ratio="1:1"][data-prop-ratio="2:11"]',
    )
    await last.click()
    await scroller.evaluate((element) => {
      element.scrollTop = 0
    })
    await page.locator('[data-role="to-column-header"][data-ratio="2:1"]').click()
    await expect(selected).toHaveAttribute('data-prop-ratio', '2:11')
    await expect
      .poll(async () => {
        const box = await selected.boundingBox()
        const view = await scroller.boundingBox()
        const header = await page.locator('[data-role="to-pane"] thead').boundingBox()
        return (
          box!.y >= header!.y + header!.height && box!.y + box!.height <= view!.y + view!.height
        )
      })
      .toBe(true)
    const position = await scroller.evaluate((element) => element.scrollTop)
    await selected.click()
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(position)
    await scroller.evaluate((element) => {
      element.scrollTop = 350
    })
    await page.locator('[data-role="to-column-header"][data-ratio="1:1"]').click()
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(350)
    // Keyboard activation avoids the development-only Vue DevTools overlay on narrow screens.
    await page.locator('[data-role="to-customize-toggle"]').press('Enter')
    const color = page.locator('[data-role="to-right-color"]')
    await color.scrollIntoViewIfNeeded()
    const customizePosition = await scroller.evaluate((element) => element.scrollTop)
    await color.selectOption('Red')
    await expect(color).toHaveValue('Red')
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(customizePosition)
  })
}

test('Third Order renders headers and selects matrix cells', async ({ page }, testInfo) => {
  test.setTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/play-to')
  const pane = page.locator('[data-role="to-pane"]')
  await expect(pane.locator('[data-role="to-cell"]')).toHaveCount(136)
  const previews = pane.locator('th img')
  await expect(previews).toHaveCount(25)
  await expect(previews.last()).toHaveAttribute('src', /^blob:/)
  const cells = pane.locator('[data-role="to-cell-preview"]')
  await expect(cells).toHaveCount(136, { timeout: 15000 })
  await pane.screenshot({ path: testInfo.outputPath('third-order-desktop.png') })
  const firstColumn = pane.locator('[data-role="to-column-header"]').first()
  await firstColumn.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Hand: 1:1 Anti')
  await pane.locator('[data-role="to-row-header"]').first().hover()
  await expect(page.getByRole('tooltip')).toHaveText('Prop: 1:1 Anti')
  const firstCell = pane.locator('[data-role="to-cell"]').first()
  await firstCell.focus()
  await expect(page.getByRole('tooltip')).toHaveText(
    'Hand: 1:1 Anti\nProp: 1:1 Anti\nVersion: 1\nDuplicate: 1 / 4',
  )
  await expect(firstCell).toHaveAttribute('aria-pressed', 'false')
  const before = await previews.first().getAttribute('src')
  const firstAntiPreview = await cells.last().getAttribute('src')
  await pane
    .getByRole('radiogroup', { name: 'Hand', exact: true })
    .getByRole('radio', { name: 'Spin', exact: true })
    .press('Space')
  await expect(previews.first()).not.toHaveAttribute('src', before!)
  await expect(cells).toHaveCount(136)
  await expect(cells.last()).not.toHaveAttribute('src', firstAntiPreview!, { timeout: 15000 })
  await pane.locator('[data-role="to-cell"][data-hand-ratio="1:3"][data-prop-ratio="1:7"]').click()
  await pane.locator('[data-role="to-column-header"][data-ratio="2:1"]').click()
  await expect(pane.locator('[data-role="to-cell"][aria-pressed="true"]')).toHaveAttribute(
    'data-prop-ratio',
    '1:7',
  )
  await pane
    .getByRole('radiogroup', { name: 'Hand', exact: true })
    .getByRole('radio', { name: 'Anti', exact: true })
    .press('Space')
  await expect(cells).toHaveCount(136, { timeout: 15000 })
  await expect.poll(() => new URL(page.url()).searchParams.has('r')).toBe(true)
  const firstVersionUrl = page.url()
  const firstVersionPreview = await cells.last().getAttribute('src')
  await pane
    .getByRole('radiogroup', { name: 'Version', exact: true })
    .getByRole('radio', { name: '2', exact: true })
    .press('Space')
  await expect.poll(() => page.url()).not.toBe(firstVersionUrl)
  await expect(cells.last()).not.toHaveAttribute('src', firstVersionPreview!, { timeout: 15000 })
  const antiAntiPreview = await cells.last().getAttribute('src')
  await pane
    .getByRole('radiogroup', { name: 'Prop', exact: true })
    .getByRole('radio', { name: 'Spin', exact: true })
    .press('Space')
  await expect(cells).toHaveCount(136)
  await expect(cells.last()).not.toHaveAttribute('src', antiAntiPreview!, { timeout: 15000 })
  const antiSpinUrl = page.url()
  await pane.locator('[data-role="to-cell"]').first().click()
  await expect.poll(() => page.url()).not.toBe(antiSpinUrl)
  const antiSpinPreview = await cells.last().getAttribute('src')
  await pane
    .getByRole('radiogroup', { name: 'Hand', exact: true })
    .getByRole('radio', { name: 'Spin', exact: true })
    .press('Space')
  await expect(cells).toHaveCount(136)
  await expect(cells.last()).not.toHaveAttribute('src', antiSpinPreview!, { timeout: 15000 })
  await expect(pane.getByRole('radiogroup', { name: 'Version' }).getByRole('radio')).toHaveCount(2)
  const secondSpinVersionUrl = page.url()
  await pane
    .getByRole('radiogroup', { name: 'Version', exact: true })
    .getByRole('radio', { name: '1', exact: true })
    .press('Space')
  await expect.poll(() => page.url()).not.toBe(secondSpinVersionUrl)
  await pane
    .getByRole('radiogroup', { name: 'Prop', exact: true })
    .getByRole('radio', { name: 'Anti', exact: true })
    .press('Space')
  await pane.locator('[data-role="to-customize-toggle"]').click()
  const previousColor = await previews.first().getAttribute('src')
  await pane.locator('[data-role="to-left-color"]').selectOption('Red')
  await expect(previews.first()).not.toHaveAttribute('src', previousColor!)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(pane.locator('[data-role="to-shuffle"]')).toBeVisible()
  expect(errors).toEqual([])
})
