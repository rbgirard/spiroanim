import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

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
