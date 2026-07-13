import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BaseTooltip from '@/components/ui/BaseTooltip.vue'

describe('BaseTooltip', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens below its activator when bottom placement is requested', async () => {
    vi.useFakeTimers()
    const wrapper = mount(BaseTooltip, {
      props: {
        delay: 100,
        placement: 'bottom',
      },
      slots: {
        activator: '<button v-bind="props">Aspect ratio</button>',
        html: '<span>16:9 details</span>',
      },
    })

    await wrapper.get('button').trigger('mouseenter')
    vi.advanceTimersByTime(100)
    await nextTick()

    const tooltip = wrapper.get('[role="tooltip"]')
    expect(tooltip.classes()).toContain('tooltip-content--bottom')
    expect(tooltip.text()).toContain('16:9 details')
  })

  it('does not render tooltip content when disabled', async () => {
    vi.useFakeTimers()
    const wrapper = mount(BaseTooltip, {
      props: {
        delay: 0,
        disabled: true,
      },
      slots: {
        activator: '<button v-bind="props">Aspect ratio</button>',
        html: '<span>16:9 details</span>',
      },
    })

    await wrapper.get('button').trigger('mouseenter')
    vi.runAllTimers()
    await nextTick()

    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })
})
