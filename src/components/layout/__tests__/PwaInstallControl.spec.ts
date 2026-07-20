import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PwaInstallControl from '@/components/layout/PwaInstallControl.vue'
import { initializePwaInstallPromptCapture } from '@/composables/usePwaInstall'

class TestInstallPromptEvent extends Event {
  readonly platforms = ['web']
  readonly prompt = vi.fn<() => Promise<void>>(async () => undefined)
  readonly userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
}

describe('PwaInstallControl', () => {
  let stopPromptCapture: () => void
  const originalUserAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent')

  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn<() => void>(),
        removeEventListener: vi.fn<() => void>(),
        addListener: vi.fn<() => void>(),
        removeListener: vi.fn<() => void>(),
        dispatchEvent: vi.fn<() => boolean>(() => true),
      })),
    )
    stopPromptCapture = initializePwaInstallPromptCapture()
  })

  afterEach(() => {
    stopPromptCapture()
    vi.unstubAllGlobals()
    if (originalUserAgent) Object.defineProperty(navigator, 'userAgent', originalUserAgent)
    else Reflect.deleteProperty(navigator, 'userAgent')
  })

  it('shows and invokes a browser installation prompt captured before mounting', async () => {
    const event = new TestInstallPromptEvent('beforeinstallprompt', { cancelable: true })

    window.dispatchEvent(event)
    const wrapper = mount(PwaInstallControl)
    await wrapper.vm.$nextTick()

    const button = wrapper.get('button')
    expect(button.text()).toBe('Install App')

    await button.trigger('click')
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('explains Safari installation steps on iPad', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X)',
    })
    const wrapper = mount(PwaInstallControl)
    await wrapper.vm.$nextTick()

    const button = wrapper.get('button')
    expect(button.text()).toBe('Install from Safari')
    expect(button.attributes('aria-expanded')).toBe('false')

    await button.trigger('click')

    expect(button.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.instructions-title').text()).toContain('Home Screen')
    expect(wrapper.findAll('.install-instructions li').map((item) => item.text())).toEqual([
      expect.stringContaining('square with an arrow pointing up'),
      expect.stringContaining('Add to Home Screen'),
      expect.stringContaining('Open as Web App'),
    ])
  })
})
