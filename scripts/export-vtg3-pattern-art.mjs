import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

const exportSize = 512
const scaleControlValue = 0.8
const outputRoot = path.resolve(process.cwd(), 'public/vtg3/assets/patterns')
const ratios = ['1:1', '1:3', '1:5']
const patterns = [
  { reference: '1-1', fileName: '1-1.png' },
  { reference: '1-3', fileName: '1-3.png' },
  { reference: '1-5', fileName: '1-5.png' },
  { reference: '3-1', fileName: '3-1.png' },
  { reference: '3-3', fileName: '3-3.png' },
  { reference: '3-5', fileName: '3-5.png' },
  { reference: '5-1', fileName: '5-1.png' },
  { reference: '5-3', fileName: '5-3.png' },
  { reference: '5-5', fileName: '5-5-spin.png', isAnti: false },
  { reference: '5-5', fileName: '5-5-anti.png', isAnti: true },
]

const exportPage = String.raw`<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"><title>VTG3 pattern exporter</title></head>
  <body>
    <script type="module">
      import { createVtgPreviewAnimation } from '/src/features/vtg/createVtgAnimation.ts'
      import { rootCompile } from '/src/math/animation/AnimFunc.ts'
      import { createMessageChannel } from '/src/workers/createMessageChannel.ts'

      const worker = new Worker(new URL('/src/workers/AnimWorker.ts', window.location.origin), {
        type: 'module',
      })
      const channel = createMessageChannel(worker)
      channel.warnStr(await channel.call('warnStr', 'VTG3 Art Export'))
      const initialized = await channel.call('initialize', {
        girth: 2,
        timeline: false,
        thumbnail: true,
      })
      if (!initialized) throw new Error('The animation worker did not initialize.')

      const blobAsBase64 = (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.addEventListener('load', () => resolve(String(reader.result).split(',')[1]))
          reader.addEventListener('error', () => reject(reader.error))
          reader.readAsDataURL(blob)
        })

      const inspectTransparency = async (blob) => {
        const bitmap = await createImageBitmap(blob)
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('A 2D canvas context could not be created.')

        context.drawImage(bitmap, 0, 0)
        bitmap.close()
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        let minX = canvas.width
        let minY = canvas.height
        let maxX = -1
        let maxY = -1

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }

        return {
          width: canvas.width,
          height: canvas.height,
          transparentCorner: pixels[3] === 0,
          bounds: { minX, minY, maxX, maxY },
        }
      }

      window.renderVtgPattern = async ({ reference, speedRatio, scale, isAnti, size }) => {
        const animation = createVtgPreviewAnimation({
          reference,
          speedRatio,
          scale,
          spacing: 1,
          propColors: ['Cyan', 'Green'],
          prop: 2,
          ...(isAnti === undefined ? {} : { isAnti }),
        })
        if (!animation) throw new Error('No VTG animation exists for ' + speedRatio + '/' + reference)
        const adjustedScale = (animation.props[0]?.anim[0]?.scale ?? 0) / 100
        const cameraDistance = animation.camera[0]?.orbit?.distance

        channel.send('resize', { width: size, height: size, ratio: 1 })
        channel.send('projection', { fov: 45, aspect: 1, near: 0.1, far: 1000 })
        channel.send('data', rootCompile(animation))
        const urls = await channel.call('reqimgs', [{ index: 0, time: 0 }])
        const url = urls[0]
        if (!url) throw new Error('The worker did not produce an image.')

        try {
          const blob = await fetch(url).then((response) => response.blob())
          const [base64, inspection] = await Promise.all([
            blobAsBase64(blob),
            inspectTransparency(blob),
          ])
          return { base64, adjustedScale, cameraDistance, ...inspection }
        } finally {
          URL.revokeObjectURL(url)
        }
      }

      window.vtgArtExporterReady = true
    </script>
  </body>
</html>`

const server = await createServer({
  appType: 'spa',
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
  plugins: [
    {
      name: 'vtg3-pattern-art-export-page',
      configureServer(viteServer) {
        viteServer.middlewares.use('/__vtg3-pattern-export__', (_request, response) => {
          response.statusCode = 200
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end(exportPage)
        })
      },
    },
  ],
})

let browser

try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local port.')

  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
  } catch {
    browser = await chromium.launch({ headless: true })
  }
  const page = await browser.newPage()
  page.on('pageerror', (error) => console.error(error))
  await page.goto(`http://127.0.0.1:${address.port}/__vtg3-pattern-export__`)
  await page.waitForFunction(() => window.vtgArtExporterReady === true)

  const manifest = []
  for (const speedRatio of ratios) {
    const ratioDirectory = speedRatio.replace(':', '-')
    const outputDirectory = path.join(outputRoot, ratioDirectory)
    await mkdir(outputDirectory, { recursive: true })

    for (const pattern of patterns) {
      const result = await page.evaluate((selection) => window.renderVtgPattern(selection), {
        reference: pattern.reference,
        speedRatio,
        scale: scaleControlValue,
        isAnti: pattern.isAnti,
        size: exportSize,
      })
      if (!result.transparentCorner) {
        throw new Error(`${speedRatio}/${pattern.fileName} does not have a transparent background.`)
      }
      if (result.width !== exportSize || result.height !== exportSize) {
        throw new Error(`${speedRatio}/${pattern.fileName} was rendered at the wrong size.`)
      }

      const outputPath = path.join(outputDirectory, pattern.fileName)
      await writeFile(outputPath, Buffer.from(result.base64, 'base64'))
      manifest.push({
        speedRatio,
        reference: pattern.reference,
        variant: pattern.isAnti === undefined ? undefined : pattern.isAnti ? 'anti' : 'spin',
        scaleControlValue,
        adjustedScale: result.adjustedScale,
        cameraDistance: result.cameraDistance,
        width: result.width,
        height: result.height,
        transparent: result.transparentCorner,
        contentBounds: result.bounds,
        file: path.relative(outputRoot, outputPath).replaceAll('\\', '/'),
      })
      console.log(`Generated ${speedRatio}/${pattern.fileName}`)
    }
  }

  await writeFile(
    path.join(outputRoot, 'manifest.json'),
    `${JSON.stringify({ generatedBy: 'npm run generate:vtg3-art', images: manifest }, null, 2)}\n`,
  )
  console.log(`Generated ${manifest.length} transparent ${exportSize}x${exportSize} VTG3 images.`)
} finally {
  await browser?.close()
  await server.close()
}
