import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { createAppRouter } from '@/router'

describe('application routes', () => {
  it('serves the landing page at both public entry paths', () => {
    const router = createAppRouter(createMemoryHistory())

    expect(router.resolve('/').name).toBe('landing')
    expect(router.resolve('/index').name).toBe('landing')
    expect(router.resolve('/app').name).toBe('main')
    expect(router.resolve('/about').name).toBe('about')
  })
})
