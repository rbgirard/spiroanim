import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useViewportStore } from '@/stores/useViewportStore'

describe('useViewportStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
  })

  it('tracks viewport size, orientation, pixel ratio, and touch capability', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Desktop Browser')
    const store = useViewportStore()

    expect(store.viewWidth).toBe(800)
    expect(store.viewHeight).toBe(600)
    expect(store.pixelRatio).toBe(2)
    expect(store.isLandscape).toBe(true)
    expect(store.isTouchDevice()).toBe(false)
    expect(store.showTooltips).toBe(true)
  })

  it('updates dimensions from the current window values', () => {
    const store = useViewportStore()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })

    store.updateViewSize()

    expect(store.viewWidth).toBe(500)
    expect(store.viewHeight).toBe(900)
    expect(store.isLandscape).toBe(false)
  })
})
