import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test.use({ viewport: { width: 1024, height: 1366 }, hasTouch: true, deviceScaleFactor: 2 })

test('keeps the thumbnail layout square while changing columns', async ({ page }) => {
  // Exercise the real CSS without WebGL, which the Windows WebKit runner does not support.
  const component = await readFile('src/features/vtg/components/VtgTransitionPreviews.vue', 'utf8')
  const styles = component.split('<style scoped>')[1]?.split('</style>')[0]
  expect(styles).toBeTruthy()
  const base = await readFile('src/assets/styles/base.css', 'utf8')
  const tokens = await readFile('src/assets/styles/tokens.css', 'utf8')
  const themes = await readFile('src/assets/styles/themes.css', 'utf8')
  const image =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><circle cx="256" cy="256" r="200"/></svg>',
    )
  await page.setContent(`<style>${tokens}${themes}${base}${styles}</style>
    <div class="vtg-transition-previews" style="--vtg-transition-preview-columns: 4">
      ${Array.from(
        { length: 4 },
        () => `<div class="vtg-transition-previews__item">
        <span class="vtg-transition-previews__tooltip">
          <button class="vtg-transition-previews__visual"><img class="vtg-transition-previews__image" src="${image}" /></button>
        </span>
        <div class="vtg-transition-previews__beats"><input type="range" /><output>2</output></div>
      </div>`,
      ).join('')}
    </div>`)
  const preview = page.locator('.vtg-transition-previews__visual').first()
  for (const columns of [4, 5, 6, 3, 2, 1, 4]) {
    await page.locator('.vtg-transition-previews').evaluate((element, count) => {
      if (element instanceof HTMLElement)
        element.style.setProperty('--vtg-transition-preview-columns', String(count))
    }, columns)
    await expect
      .poll(
        async () => {
          const bounds = await preview.boundingBox()
          if (!bounds) throw new Error('Missing thumbnail')
          return Math.abs(bounds.width - bounds.height)
        },
        { message: `Square thumbnail layout at ${columns} columns` },
      )
      .toBeLessThan(1)
    await expect
      .poll(
        async () => {
          const bounds = await preview.boundingBox()
          const imageBounds = await preview.locator('img').boundingBox()
          if (!bounds || !imageBounds) throw new Error('Missing thumbnail image')
          return Math.abs(imageBounds.height - (bounds.height - 4))
        },
        { message: `Image fits thumbnail height at ${columns} columns` },
      )
      .toBeLessThan(1)
  }
})
