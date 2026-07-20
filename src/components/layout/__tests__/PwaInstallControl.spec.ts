import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PwaInstallControl from '@/components/layout/PwaInstallControl.vue'

class TestInstallPromptEvent extends Event {
  readonly platforms = ['web']
  readonly prompt = vi.fn<() => Promise<void>>(async () => undefined)
  readonly userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
}

describe('PwaInstallControl', () => {
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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows and invokes the deferred browser installation prompt', async () => {
    const wrapper = mount(PwaInstallControl)
    const event = new TestInstallPromptEvent('beforeinstallprompt', { cancelable: true })

    window.dispatchEvent(event)
    await wrapper.vm.$nextTick()

    const button = wrapper.get('button')
    expect(button.text()).toBe('Install App')

    await button.trigger('click')
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
