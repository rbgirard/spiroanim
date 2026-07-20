import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FullScreen from '@/components/layout/FullScreen.vue'

const fullscreenState = vi.hoisted(() => ({
  isFullscreen: { value: false },
  isSupported: { value: true },
  toggle: vi.fn<() => Promise<void>>(async () => undefined),
}))

const displayState = vi.hoisted(() => ({
  isInstalledDisplay: { value: false },
  isIos: { value: false },
}))

vi.mock('@vueuse/core', () => ({
  useFullscreen: () => fullscreenState,
}))

vi.mock('@/composables/useAppDisplayMode', () => ({
  useAppDisplayMode: () => displayState,
}))

describe('FullScreen', () => {
  beforeEach(() => {
    fullscreenState.isFullscreen.value = false
    fullscreenState.isSupported.value = true
    fullscreenState.toggle.mockClear()
    displayState.isInstalledDisplay.value = false
    displayState.isIos.value = false
  })

  function mountFullScreen() {
    return mount(FullScreen, {
      global: {
        stubs: {
          AppTooltip: {
            template: '<div><slot name="activator" :props="{}" /></div>',
          },
          BaseIcon: {
            props: ['path'],
            template: '<svg :data-path="path" />',
          },
        },
      },
    })
  }

  it('offers entry into full screen and invokes the toggle', async () => {
    const wrapper = mountFullScreen()
    const button = wrapper.get('button')

    expect(button.attributes('aria-label')).toBe('Enter full screen')
    await button.trigger('click')
    expect(fullscreenState.toggle).toHaveBeenCalledOnce()
  })

  it('keeps the control available in an installed display mode', () => {
    displayState.isInstalledDisplay.value = true

    expect(mountFullScreen().find('button').exists()).toBe(true)
  })

  it('keeps the control available on iOS while fullscreen support is being tested', () => {
    displayState.isIos.value = true

    expect(mountFullScreen().find('button').exists()).toBe(true)
  })

  it('hides the control when the Fullscreen API is unavailable', () => {
    fullscreenState.isSupported.value = false

    expect(mountFullScreen().find('button').exists()).toBe(false)
  })
})
