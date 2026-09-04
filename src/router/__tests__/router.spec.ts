import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { createAppRouter } from '@/router'

describe('application routes', () => {
  it('serves the landing page at both public entry paths', () => {
    const router = createAppRouter(createMemoryHistory())

    expect(router.resolve('/').name).toBe('landing')
    expect(router.resolve('/index').name).toBe('landing')
    expect(router.resolve('/app').name).toBe('main')
    expect(router.resolve('/concepts').name).toBe('main')
    expect(router.resolve('/play-cnc').name).toBe('main')
    expect(router.resolve('/play-vtg').name).toBe('main')
    expect(router.resolve('/quarter-space-tech').name).toBe('main')
    expect(router.resolve('/play-qst').name).toBe('main')
    expect(router.resolve('/third-order').name).toBe('not-found')
    expect(router.resolve('/play-to').name).toBe('not-found')
    expect(router.resolve('/about').name).toBe('about')
    expect(router.resolve('/tips').name).toBe('tips')
  })
})
