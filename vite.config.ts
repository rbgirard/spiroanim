import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

import AutoImport from 'unplugin-auto-import/vite'
import { AutoImports } from './src/sys/auto-imports.ts'

function hashSourceDirectory(directory: string, hash = createHash('sha256')) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory() && entry.name !== '__tests__') hashSourceDirectory(entryPath, hash)
    else if (entry.name !== 'auto-imports-generated.d.ts' && /\.(?:css|ts|vue)$/.test(entry.name))
      hash.update(readFileSync(entryPath))
  }

  return hash
}

function getPublicPageRevision() {
  const hash = hashSourceDirectory(fileURLToPath(new URL('./src', import.meta.url)))
  hash.update(readFileSync(fileURLToPath(new URL('./index.html', import.meta.url))))
  return hash.digest('hex')
}

export function createViteConfig(isSsrBuild: boolean) {
  const publicPageRevision = getPublicPageRevision()

  return {
    //root: path.resolve(__dirname, 'src'),
    base: '/',
    //base: '/propanim/',
    build: {
      outDir: 'build',
      target: 'es2022',
      rollupOptions: isSsrBuild
        ? undefined
        : {
            input: {
              main: fileURLToPath(new URL('index.html', import.meta.url)),
              'app-shell': fileURLToPath(new URL('app-shell.html', import.meta.url)),
            },
          },
    },
    server: {
      host: true,
      port: 8080,
    },
    plugins: [
      vue(),
      !isSsrBuild && vueDevTools(),
      !isSsrBuild &&
        VitePWA({
          registerType: 'prompt',
          manifestFilename: 'manifest.webmanifest',
          manifest: {
            id: '/',
            scope: '/',
            start_url: '/',
            name: 'Spiro Animator',
            short_name: 'SpiroAnim',
            description: 'Create, edit, and play procedural spiro animations.',
            lang: 'en',
            display: 'standalone',
            background_color: '#090b0f',
            theme_color: '#090b0f',
            icons: [
              {
                src: '/pwa-64x64.png',
                sizes: '64x64',
                type: 'image/png',
              },
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/maskable-icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
            shortcuts: [
              {
                name: 'Open Player',
                short_name: 'Player',
                url: '/player',
                icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
              },
              {
                name: 'Open Editor',
                short_name: 'Editor',
                url: '/editor',
                icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
              },
              {
                name: 'Open Timeline',
                short_name: 'Timeline',
                url: '/timeline',
                icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
              },
            ],
          },
          workbox: {
            clientsClaim: true,
            cleanupOutdatedCaches: true,
            additionalManifestEntries: [
              { url: 'index.html', revision: publicPageRevision },
              { url: 'about.html', revision: publicPageRevision },
              { url: 'about/index.html', revision: publicPageRevision },
            ],
            globPatterns: ['**/*.{css,ico,js,png,svg}', 'app-shell.html'],
            navigateFallback: 'app-shell.html',
            navigateFallbackDenylist: [/^\/(?:index\/?|about\/?)?$/],
          },
          devOptions: {
            enabled: false,
          },
        }),
      AutoImport({
        imports: [AutoImports],
        dts: 'src/sys/auto-imports-generated.d.ts',
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      include: ['three'], // Explicitly include Three.js for optimization
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => createViteConfig(isSsrBuild ?? false))
