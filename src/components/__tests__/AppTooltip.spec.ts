import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AppTooltip from '@/components/AppTooltip.vue'
import { useViewportStore } from '@/stores/useViewportStore'

describe('AppTooltip', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Desktop Browser')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('centrally respects the application tooltip preference', async () => {
    const wrapper = mount(AppTooltip, {
      props: {
        text: 'Shared tooltip',
        delay: 0,
      },
      slots: {
        activator: '<button v-bind="props">Activator</button>',
      },
    })
    const viewport = useViewportStore()
    const button = wrapper.get('button')

    viewport.showTooltips = false
    await button.trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()

    viewport.showTooltips = true
    await button.trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Shared tooltip')
    wrapper.unmount()
  })
})
