import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

const readStyles = async (path: string) => {
  const source = await readFile(path, 'utf8')
  const styles = source.split('<style scoped>')[1]?.split('</style>')[0]
  if (!styles) throw new Error(`Missing styles in ${path}`)
  return styles
}

test.use({ viewport: { width: 1024, height: 600 }, hasTouch: true, deviceScaleFactor: 2 })

test('resizes the Builder square and its bitmap from one column without remounting', async ({
  page,
}) => {
  // Isolate actual layout CSS: Windows WebKit cannot initialize the full WebGL application.
  const styles = await Promise.all([
    readFile('src/assets/styles/tokens.css', 'utf8'),
    readFile('src/assets/styles/themes.css', 'utf8'),
    readFile('src/assets/styles/base.css', 'utf8'),
    readStyles('src/components/ui/BaseTooltip.vue'),
    readStyles('src/features/vtg/components/VtgTransitionPreviews.vue'),
  ])
  const imageUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1440
    return canvas.toDataURL()
  })
  await page.setContent(`<style>${styles.join('\n')}</style>
    <div class="vtg-transition-previews" style="--vtg-transition-preview-columns: 1">
      <div class="vtg-transition-previews__item">
        <span class="tooltip-root vtg-transition-previews__tooltip">
          <button class="vtg-transition-previews__visual">
            <img class="vtg-transition-previews__image" src="${imageUrl}" alt="Preview" />
          </button>
        </span>
      </div>
    </div>`)
  await page.locator('img').evaluate((image: HTMLImageElement) => image.decode())
  const grid = page.locator('.vtg-transition-previews')
  const preview = page.getByRole('button')
  for (const gridWidth of [720, 400]) {
    // Supply the measured grid width, as the component's existing useElementSize does.
    await grid.evaluate((element, width) => {
      if (!(element instanceof HTMLElement)) throw new Error('Missing grid')
      element.style.width = `${width}px`
      element.style.setProperty('--vtg-transition-preview-grid-width', `${width}px`)
    }, gridWidth)
    for (const columns of [1, 2, 3, 4, 5, 6, 1]) {
      await grid.evaluate((element, count) => {
        if (!(element instanceof HTMLElement)) throw new Error('Missing grid')
        element.style.setProperty('--vtg-transition-preview-columns', String(count))
      }, columns)
      await expect
        .poll(
          () =>
            preview.evaluate((button, count) => {
              const image = button.querySelector('img')
              const grid = button.closest('.vtg-transition-previews')
              if (!image || !grid) throw new Error('Missing thumbnail layout')
              const bounds = button.getBoundingClientRect()
              const imageBounds = image.getBoundingClientRect()
              const gap = parseFloat(getComputedStyle(grid).columnGap)
              const expectedSize = (grid.getBoundingClientRect().width - (count - 1) * gap) / count
              return Math.max(
                Math.abs(bounds.width - expectedSize),
                Math.abs(bounds.height - expectedSize),
                Math.abs(imageBounds.width - button.clientWidth),
                Math.abs(imageBounds.height - button.clientHeight),
              )
            }, columns),
          { message: `${gridWidth}px grid at ${columns} columns` },
        )
        .toBeLessThan(1)
    }
  }
})
