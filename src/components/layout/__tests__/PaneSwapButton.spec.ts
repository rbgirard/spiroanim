import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PaneSwapButton from '@/components/layout/PaneSwapButton.vue'

describe('PaneSwapButton', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Desktop Browser')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('uses the shared tooltip and emits clicks', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PaneSwapButton, {
      props: {
        label: 'Swap Views',
        icon: 'M0 0',
      },
    })

    const button = wrapper.get('button[aria-label="Swap Views"]')
    await button.trigger('mouseenter')
    vi.advanceTimersByTime(249)
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)

    vi.advanceTimersByTime(1)
    await nextTick()

    expect(wrapper.get('[role="tooltip"]').text()).toBe('Swap Views')

    await button.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
