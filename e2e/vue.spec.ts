import { test, expect, devices } from '@playwright/test'

const expectedCleanupMessages = new Set(['WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost'])

test('keeps QST Customize in view while changing settings on a touch viewport', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    userAgent: devices['Pixel 7'].userAgent,
  })
  const page = await context.newPage()
  try {
    await page.goto('/play-qst')
    await page.locator('[data-role="qst-collection"]').first().click()
    await page.locator('[data-pattern-reference]').first().click()
    await page.locator('[data-role="qst-customize-toggle"]').click()
    const pane = page.locator('[data-concepts-pane]')
    const settings = [
      'paths',
      'hands',
      'arms',
      'left',
      'right',
      ...['scale', 'thick', 'spacing', 'bpm'].flatMap((setting) => [
        `${setting}-stepper-increase`,
        `${setting}-stepper-decrease`,
      ]),
    ]
    for (const setting of settings) {
      const control = page.locator(`[data-role="qst-${setting}"]`)
      // Keep controls clear of the floating pane controls so click's own scrolling isn't measured.
      await control.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      const scrollTop = await pane.evaluate((element) => element.scrollTop)
      expect(scrollTop).toBeGreaterThan(0)
      const beforeUrl = page.url()
      await control.click()
      await expect(page).not.toHaveURL(beforeUrl)
      // Allow the updated layout to paint before checking the focused control's scroll position.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          }),
      )
      expect(await pane.evaluate((element) => element.scrollTop), setting).toBeCloseTo(scrollTop, 0)
      await expect(control).toBeInViewport()
    }
  } finally {
    await context.close()
  }
})

test('restores both routes with browser back and forward navigation', async ({ page }) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      if (expectedCleanupMessages.has(message.text())) return
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

test('hydrates a VTG selection through the lazy pattern-matching worker', async ({ page }) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      if (expectedCleanupMessages.has(message.text())) return
      consoleErrors.push(message.text())
    }
  })

  await page.goto('/vulcan-tech-gospel')
  const pane = page.locator('[data-role="vtg-pane"]')
  const cell = page.locator('[data-cell-reference="5-6"]')
  await expect(pane).toBeVisible()
  await cell.click()
  await expect(pane).toHaveAttribute('data-selected-cell', '5-6')
  await expect.poll(() => new URL(page.url()).searchParams.has('r')).toBe(true)

  await page.reload()

  await expect(pane).toHaveAttribute('data-selected-cell', '5-6')
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('mounts the full Player in Builder with live override playback and collision-safe controls', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto(
    '/play-vtg?r=Ew08Yk11Y&p0=Q__.mBEQDk.5JE.......&x0=_s_&m0=_1_mxqv__&p1=N__.blERhw.5JEQpg.......&x1=_s_&c=_i_bhq&v=11',
  )
  const builderToggle = page
    .locator('label.vtg-pattern-builder-button')
    .filter({ hasText: 'Pattern Builder' })
  const sharedPlayer = page.locator('[data-role="player-view"]')
  await expect(sharedPlayer).toBeVisible()
  await sharedPlayer.evaluate((element) => {
    element.setAttribute('data-player-persistence-probe', 'mounted-before-builder')
  })
  await builderToggle.click()

  const builder = page.locator('[data-role="builder-pane-view"]')
  const builderPlayer = builder.locator('[data-role="builder-player"]')
  const playerSurface = page.locator('[data-role="stable-player-surface"]')
  const freeCamera = sharedPlayer.getByRole('button', { name: 'Free camera' })
  const swap = builder.getByRole('button', { name: 'Swap Builder Views' })
  const exit = builder.getByRole('button', { name: 'Exit Pattern Builder' })
  await expect(builderPlayer).toBeVisible()
  await expect(sharedPlayer).toBeVisible()
  await expect(sharedPlayer).toHaveAttribute(
    'data-player-persistence-probe',
    'mounted-before-builder',
  )
  await expect(playerSurface).toHaveAttribute('data-player-placement', 'builder')
  const position = sharedPlayer.getByRole('slider', { name: 'Animation position' })
  const initialPosition = Number(await position.inputValue())
  await expect.poll(async () => Number(await position.inputValue())).not.toBe(initialPosition)
  const [playerViewBox, initialProgressBox] = await Promise.all([
    sharedPlayer.boundingBox(),
    sharedPlayer.locator('.slider').boundingBox(),
  ])
  expect(playerViewBox).not.toBeNull()
  expect(initialProgressBox).not.toBeNull()
  expect(initialProgressBox!.x).toBeCloseTo(playerViewBox!.x, 0)
  await page.locator('[data-cell-reference="1-2"]').click()
  await expect(builder.locator('[data-role="builder-preview-countdown"]')).toBeVisible()
  const previewInitialPosition = Number(await position.inputValue())
  await expect
    .poll(async () => Number(await position.inputValue()))
    .not.toBe(previewInitialPosition)
  await expect(sharedPlayer.locator('.slider')).not.toHaveClass(/slider--compact/)
  await expect(page.locator('[data-role="player-view"]')).toHaveCount(1)
  await expect(freeCamera).toHaveAttribute('aria-pressed', 'false')
  await expect(sharedPlayer.locator('canvas')).toHaveCSS('touch-action', 'none')
  await expect(exit).toHaveCSS('background-image', /linear-gradient/)
  await expect(exit).toHaveCSS('border-top-width', '2px')

  const [builderBox, thumbnailsBox, exitBox] = await Promise.all([
    builder.boundingBox(),
    builder.locator('[data-role="builder-thumbnails"]').boundingBox(),
    exit.boundingBox(),
  ])
  expect(builderBox).not.toBeNull()
  expect(thumbnailsBox).not.toBeNull()
  expect(exitBox).not.toBeNull()
  expect(exitBox!.y - thumbnailsBox!.y).toBeCloseTo(1, 0)

  // The Vite devtools iframe overlaps this bottom-right control in the test server.
  await swap.dispatchEvent('click')
  await expect(
    builder.locator('[data-role="bottom-pane"] [data-role="builder-player"]'),
  ).toBeVisible()
  await expect(sharedPlayer).toHaveAttribute(
    'data-player-persistence-probe',
    'mounted-before-builder',
  )
  await expect(sharedPlayer.locator('.slider')).toHaveCSS('right', '40px')
  const swappedInitialPosition = Number(await position.inputValue())
  await expect
    .poll(async () => Number(await position.inputValue()))
    .not.toBe(swappedInitialPosition)
  const [progressBox, swapBox] = await Promise.all([
    sharedPlayer.locator('.slider').boundingBox(),
    swap.boundingBox(),
  ])
  expect(progressBox).not.toBeNull()
  expect(swapBox).not.toBeNull()
  expect(progressBox!.x).toBeCloseTo(playerViewBox!.x, 0)
  expect(progressBox!.x + progressBox!.width).toBeLessThanOrEqual(swapBox!.x)

  await freeCamera.click()
  await expect(freeCamera).toHaveAttribute('aria-pressed', 'true')

  await builderToggle.click()
  await expect(page.locator('[data-role="player-view"]')).toBeVisible()
  await expect(sharedPlayer).toHaveAttribute(
    'data-player-persistence-probe',
    'mounted-before-builder',
  )
  const restoredPosition = page
    .locator('[data-role="player-view"]')
    .getByRole('slider', { name: 'Animation position' })
  const restoredInitialPosition = Number(await restoredPosition.inputValue())
  await expect
    .poll(async () => Number(await restoredPosition.inputValue()))
    .not.toBe(restoredInitialPosition)
  await expect(
    page.locator('[data-role="player-view"]').getByRole('button', { name: 'Free camera' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(pageErrors).toEqual([])
})

test('keeps the Full Grid touch drag preview visible over VTG with its shared thumbnail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto(
    '/play-vtg?r=Ew08Yk11Y&p0=Q__.mBEQDk.5JE.......&x0=_s_&m0=_1_mxqv__&p1=N__.blERhw.5JEQpg.......&x1=_s_&c=_i_bhq&v=11',
  )
  await page
    .locator('label')
    .filter({ has: page.getByRole('checkbox', { name: 'Pattern Builder', exact: true }) })
    .click()
  await page.locator('label.vtg-pattern-builder-button').filter({ hasText: 'Full Grid' }).click()
  await page.locator('[data-role="vtg-elemental"]').setChecked(true)

  await expect(page.locator('[data-role="vtg-transition-previews"]')).toBeVisible()
  const sharedThumbnail = page.locator('[data-preview-reference="1-1"]')
  const tile = page.locator('[data-cell-reference="2-2"]')
  await expect(sharedThumbnail).toBeVisible()
  await expect(tile.locator('.elemental-relationship-icons__icon')).toHaveCount(2)
  const tileBox = await tile.boundingBox()
  expect(tileBox).not.toBeNull()
  const startX = tileBox!.x + tileBox!.width / 2
  const startY = tileBox!.y + tileBox!.height / 2

  await tile.evaluate(
    (element, { x, y }) => {
      element.setPointerCapture = () => undefined
      element.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: y,
        }),
      )
      element.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x + 20,
          clientY: y,
        }),
      )
    },
    { x: startX, y: startY },
  )

  const dragPreview = page.locator('body > [data-role="vtg-pattern-pointer-drag"]')
  await expect(dragPreview).toBeVisible()
  await expect(dragPreview.locator('.vtg-transition-previews__pointer-drag-image')).toHaveAttribute(
    'src',
    (await sharedThumbnail.getAttribute('src')) ?? '',
  )
  await expect(dragPreview.locator('.elemental-relationship-icons__icon')).toHaveCount(2)

  await tile.dispatchEvent('pointercancel', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
  })
  await expect(dragPreview).toHaveCount(0)
})

test('keeps one live Player while its surface moves from the main pane into Timeline', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto(
    '/play-time?r=Ew08Yk11Y&p0=Q__.mBEQDk.5JE.......&x0=_s_&m0=_1_mxqv__&p1=N__.blERhw.5JEQpg.......&x1=_s_&c=_i_bhq&v=11',
  )
  const sharedPlayer = page.locator('[data-role="player-view"]')
  const playerSurface = page.locator('[data-role="stable-player-surface"]')
  const position = sharedPlayer.getByRole('slider', { name: 'Animation position' })
  await expect(sharedPlayer).toBeVisible()
  await expect(playerSurface).toHaveAttribute('data-player-placement', 'main')
  await sharedPlayer.evaluate((element) => {
    element.setAttribute('data-player-persistence-probe', 'mounted-before-timeline')
  })

  await page.locator('[data-role="left-pane"]').getByRole('button', { name: 'Swap Views' }).click()

  const timelinePlayerMarker = page.locator('[data-role="timeline-player-host"]')
  await expect(timelinePlayerMarker).toBeVisible()
  await expect(playerSurface).toHaveAttribute('data-player-placement', 'timeline')
  await expect(sharedPlayer).toHaveAttribute(
    'data-player-persistence-probe',
    'mounted-before-timeline',
  )
  const movedInitialPosition = Number(await position.inputValue())
  await expect.poll(async () => Number(await position.inputValue())).not.toBe(movedInitialPosition)

  const [markerBox, surfaceBox] = await Promise.all([
    timelinePlayerMarker.boundingBox(),
    playerSurface.boundingBox(),
  ])
  expect(markerBox).not.toBeNull()
  expect(surfaceBox).not.toBeNull()
  expect(surfaceBox!.x).toBeCloseTo(markerBox!.x, 0)
  expect(surfaceBox!.y).toBeCloseTo(markerBox!.y, 0)
  expect(surfaceBox!.width).toBeCloseTo(markerBox!.width, 0)
  expect(surfaceBox!.height).toBeCloseTo(markerBox!.height, 0)

  await page.getByRole('button', { name: 'Swap Timeline Views' }).click()
  await expect(
    page.locator('[data-role="timeline-bottom-pane"] [data-role="timeline-player-host"]'),
  ).toBeVisible()
  await expect(sharedPlayer).toHaveAttribute(
    'data-player-persistence-probe',
    'mounted-before-timeline',
  )
  const swappedInitialPosition = Number(await position.inputValue())
  await expect
    .poll(async () => Number(await position.inputValue()))
    .not.toBe(swappedInitialPosition)
  expect(pageErrors).toEqual([])
})

test('keeps the Timeline-embedded Player live while Builder opens and closes', async ({ page }) => {
  const pageErrors: string[] = []
  const timelineWarnings: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (
      message.type() === 'warning' &&
      message.text().includes('Timeline thumbnail request failed')
    )
      timelineWarnings.push(message.text())
  })

  await page.goto(
    '/time-vtg?r=Ew08Yk11Y&p0=Q__.mBEQDk.5JE.......&x0=_s_&m0=_1_mxqv__&p1=N__.blERhw.5JEQpg.......&x1=_s_&c=_i_bhq&v=11',
  )
  const sharedPlayer = page.locator('[data-role="player-view"]')
  const playerSurface = page.locator('[data-role="stable-player-surface"]')
  const timelineSurface = page.locator('[data-role="stable-timeline-surface"]')
  const builderToggle = page
    .locator('label.vtg-pattern-builder-button')
    .filter({ hasText: 'Pattern Builder' })

  await expect(playerSurface).toHaveAttribute('data-player-placement', 'timeline')
  await expect(sharedPlayer).toBeVisible()
  await expect(timelineSurface).toBeVisible()
  await sharedPlayer.evaluate((element) => {
    element.setAttribute('data-player-persistence-probe', 'mounted-in-timeline')
  })

  await builderToggle.click()

  await expect(page.locator('[data-role="builder-pane-view"]')).toBeVisible()
  await expect(playerSurface).toHaveAttribute('data-player-placement', 'builder')
  await expect(sharedPlayer).toHaveAttribute('data-player-persistence-probe', 'mounted-in-timeline')
  await expect(sharedPlayer).toBeVisible()
  await expect(page.locator('[data-role="timeline-view"]')).toHaveCount(0)
  await expect(timelineSurface).toHaveCount(0)
  const position = sharedPlayer.getByRole('slider', { name: 'Animation position' })
  const builderInitialPosition = Number(await position.inputValue())
  await expect
    .poll(async () => Number(await position.inputValue()))
    .not.toBe(builderInitialPosition)

  await builderToggle.click()

  await expect(playerSurface).toHaveAttribute('data-player-placement', 'timeline')
  await expect(sharedPlayer).toHaveAttribute('data-player-persistence-probe', 'mounted-in-timeline')
  await expect(timelineSurface).toBeVisible()
  const restoredInitialPosition = Number(await position.inputValue())
  await expect
    .poll(async () => Number(await position.inputValue()))
    .not.toBe(restoredInitialPosition)
  expect(pageErrors).toEqual([])
  expect(timelineWarnings).toEqual([])
})

test('keeps one Timeline instance while moving between Editor and the main Timeline pane', async ({
  page,
}) => {
  const pageErrors: string[] = []
  const timelineWarnings: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (
      message.type() === 'warning' &&
      message.text().includes('Timeline thumbnail request failed')
    )
      timelineWarnings.push(message.text())
  })

  await page.goto(
    '/play-edit?r=Ew08Yk11Y&p0=Q__.mBEQDk.5JE.......&x0=_s_&m0=_1_mxqv__&p1=N__.blERhw.5JEQpg.......&x1=_s_&c=_i_bhq&v=11',
  )
  const timeline = page.locator('[data-role="timeline-content"]')
  const timelineSurface = page.locator('[data-role="stable-timeline-surface"]')
  const timelineScroll = timeline.locator('.scrollbar')
  const leftPaneCycle = page
    .locator('[data-role="left-pane"]')
    .getByRole('button', { name: 'Swap Views', exact: true })

  await expect(page.locator('[data-role="editor-timeline-host"]')).toBeVisible()
  await expect(timelineSurface).toHaveAttribute('data-timeline-placement', 'editor')
  await expect(timeline).toBeVisible()
  await timeline.evaluate((element) => {
    element.setAttribute('data-timeline-persistence-probe', 'mounted-in-editor')
  })
  const initialScrollTop = await timelineScroll.evaluate((element) => {
    element.scrollTop = Math.min(60, Math.max(0, element.scrollHeight - element.clientHeight))
    return element.scrollTop
  })

  await leftPaneCycle.click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/time-edit')
  await expect(timelineSurface).toHaveAttribute('data-timeline-placement', 'main')
  await expect(timeline).toHaveAttribute('data-timeline-persistence-probe', 'mounted-in-editor')
  await expect(page.locator('[data-role="timeline-content-host"]')).toBeVisible()
  expect(await timelineScroll.evaluate((element) => element.scrollTop)).toBe(initialScrollTop)

  await leftPaneCycle.click()
  await expect(timelineSurface).toHaveAttribute('data-timeline-placement', 'editor')
  await expect(timeline).toHaveAttribute('data-timeline-persistence-probe', 'mounted-in-editor')

  await leftPaneCycle.click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/play-edit')
  await expect(timeline).toHaveAttribute('data-timeline-persistence-probe', 'mounted-in-editor')
  expect(pageErrors).toEqual([])
  expect(timelineWarnings).toEqual([])
})

test('opens VTG documents and returns to the exact app URL', async ({ page }) => {
  await page.goto('/vulcan-tech-gospel?docsReturn=preserved#selected-pattern')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/play-vtg')
  const appUrl = page.url()
  const appLocation = new URL(appUrl)
  const appReturnPath = `${appLocation.pathname}${appLocation.search}${appLocation.hash}`
  const docsButton = page.getByRole('button', { name: 'Docs' })
  const docsMenu = page.locator('[data-role="concept-docs-menu"]')
  const conceptsPane = page.locator('[data-concepts-pane]')

  await page.getByRole('button', { name: 'Create four Quick Slots' }).click()
  const [conceptsBox, conceptsClientWidth, docsBox, quickSlotsBox] = await Promise.all([
    conceptsPane.boundingBox(),
    conceptsPane.evaluate((element) => element.clientWidth),
    docsButton.boundingBox(),
    conceptsPane.locator('[data-role="quick-slots"]').boundingBox(),
  ])
  expect(conceptsBox).not.toBeNull()
  expect(docsBox).not.toBeNull()
  expect(quickSlotsBox).not.toBeNull()
  expect(quickSlotsBox!.x - conceptsBox!.x).toBeCloseTo(docsBox!.width, 0)
  expect(
    conceptsBox!.x + conceptsClientWidth - quickSlotsBox!.x - quickSlotsBox!.width,
  ).toBeCloseTo(docsBox!.width, 0)
  await conceptsPane.evaluate((element) => {
    element.scrollTop = 200
  })
  await expect.poll(async () => (await docsButton.boundingBox())?.y).toBeCloseTo(docsBox!.y, 0)

  await docsButton.click()
  await expect(docsMenu.locator('a', { hasText: 'VTG3 Reference' })).toHaveAttribute(
    'href',
    /\/vtg3\/\?returnTo=/,
  )
  await docsMenu.locator('a', { hasText: 'VTG4 Expansion' }).click()

  await expect(page.getByRole('heading', { name: 'Timing & Direction' })).toBeVisible()
  await expect(
    page.getByRole('complementary', { name: 'VTG4 and VTG3 relationship' }),
  ).toBeVisible()
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(appReturnPath)
  await page.getByRole('link', { name: 'Return to App' }).click()
  await expect(page).toHaveURL(appUrl)
  await expect(docsButton).toBeVisible()

  await docsButton.click()
  await docsMenu.locator('a', { hasText: 'VTG3 Reference' }).click()

  await expect(page.getByRole('heading', { name: 'Vulcan Tech Gospel 3' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'VTG4 Expansion' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Return to App' }).click()
  await expect(page).toHaveURL(appUrl)
})

test('does not rewrite 45 Trans Quick Slots while their controls hydrate', async ({ page }) => {
  const legacyTransitionPath =
    '/play-vtg?r=Ew08Yk11Y&p0=Q__.biQ_____s.5JEs8......._ZEwm........_ZEs8........_ZEwm........_ZEs8&m0=_1_mxqv__&p1=N__.biQ_____s.5L_s8......._ZEwm........_ZEs8........_ZEwm........_ZEs8&c=_i_bhq&v=6'

  await page.goto(legacyTransitionPath)
  await page.locator('label.vtg-pattern-builder-button--advanced').click()
  const transitionQuickSlots = page.locator('[data-role="vtg-transition-qslots"]')
  await expect(transitionQuickSlots).toBeEnabled()
  await transitionQuickSlots.click()
  await expect(page.locator('[data-role^="quick-slot-"] input')).toHaveCount(5)

  const readQuickSlotPaths = () =>
    page.evaluate(() => {
      const stored = localStorage.getItem('sa-concepts')
      if (!stored) return []
      const state: unknown = JSON.parse(stored)
      if (typeof state !== 'object' || state === null) return []
      const paths: unknown = Reflect.get(state, 'quickSlotPaths')
      return Array.isArray(paths) && paths.every((path) => typeof path === 'string') ? paths : []
    })
  await expect.poll(readQuickSlotPaths).toHaveLength(5)
  const generatedQuickSlotPaths = await readQuickSlotPaths()

  for (const slot of [1, 2, 4, 3, 5]) {
    await page.locator(`[data-role="quick-slot-${slot}"]`).click()
    await expect
      .poll(() => {
        const url = new URL(page.url())
        return `${url.pathname}${url.search}`
      })
      .toBe(generatedQuickSlotPaths[slot - 1])
  }
})
