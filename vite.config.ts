import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

import AutoImport from 'unplugin-auto-import/vite'
import { AutoImports } from './src/sys/auto-imports.ts'

// https://vite.dev/config/
export default defineConfig({
  //root: path.resolve(__dirname, 'src'),
  base: '/',
  //base: '/propanim/',
  build: {
    outDir: 'build',
    target: 'es2022',
  },
  server: {
    host: true,
    port: 8080,
  },
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'prompt',
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        id: '/',
        scope: '/',
        start_url: '/app',
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
        globPatterns: ['**/*.{css,html,ico,js,png,svg}'],
        navigateFallback: 'index.html',
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
})
