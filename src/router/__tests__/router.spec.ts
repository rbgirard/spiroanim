import { describe, expect, it } from 'vitest'

import router from '@/router'

describe('application routes', () => {
  it('serves the landing page at both public entry paths', () => {
    expect(router.resolve('/').name).toBe('landing')
    expect(router.resolve('/index').name).toBe('landing')
    expect(router.resolve('/app').name).toBe('main')
    expect(router.resolve('/about').name).toBe('about')
  })
})
