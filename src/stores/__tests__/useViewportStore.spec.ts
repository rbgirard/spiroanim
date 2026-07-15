import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useViewportStore } from '@/stores/useViewportStore'

describe('useViewportStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('tracks viewport size, orientation, pixel ratio, and touch capability', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Desktop Browser')
    const store = useViewportStore()

    expect(store.viewWidth).toBe(800)
    expect(store.viewHeight).toBe(600)
    expect(store.viewLeft).toBe(0)
    expect(store.viewTop).toBe(0)
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

  it('tracks visual viewport position and settles on the final orientation', () => {
    vi.useFakeTimers()
    const visualViewport = Object.assign(new EventTarget(), {
      width: 412,
      height: 760,
      offsetLeft: 0,
      offsetTop: 48,
    })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    })

    const store = useViewportStore()

    expect(store.viewWidth).toBe(412)
    expect(store.viewHeight).toBe(760)
    expect(store.viewTop).toBe(48)
    expect(store.isLandscape).toBe(false)

    visualViewport.width = 760
    visualViewport.height = 360
    visualViewport.offsetTop = 24
    visualViewport.dispatchEvent(new Event('resize'))

    expect(store.viewWidth).toBe(760)
    expect(store.viewHeight).toBe(360)
    expect(store.viewTop).toBe(24)
    expect(store.isLandscape).toBe(true)

    visualViewport.width = 412
    visualViewport.height = 744
    visualViewport.offsetTop = 56
    visualViewport.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(50)

    expect(store.viewWidth).toBe(412)
    expect(store.viewHeight).toBe(744)
    expect(store.viewTop).toBe(56)
    expect(store.isLandscape).toBe(false)

    visualViewport.offsetLeft = 3
    visualViewport.offsetTop = 64
    visualViewport.dispatchEvent(new Event('scroll'))

    expect(store.viewLeft).toBe(3)
    expect(store.viewTop).toBe(64)
  })
})
