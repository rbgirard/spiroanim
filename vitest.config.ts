import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import { createViteConfig } from './vite.config.ts'

export default mergeConfig(
  createViteConfig(false),
  defineConfig({
    test: {
      environment: 'jsdom',
      // Bound CPU/memory contention between jsdom and the pattern-matching suites.
      maxWorkers: 2,
      exclude: [
        ...configDefaults.exclude,
        'e2e/**',
        'src/features/vtg/__tests__/exhaustiveVtgPatternDetection.*.spec.ts',
      ],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
