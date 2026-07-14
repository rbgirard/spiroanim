import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BaseTooltip from '@/components/ui/BaseTooltip.vue'

describe('BaseTooltip', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
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
        html: '<span><strong>16:9</strong> <em>details</em></span>',
      },
    })
    vi.spyOn(wrapper.get('.tooltip-root').element, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 50,
      top: 50,
      right: 150,
      bottom: 70,
      left: 100,
      width: 50,
      height: 20,
      toJSON: () => ({}),
    })

    await wrapper.get('button').trigger('mouseenter')
    vi.advanceTimersByTime(100)
    await nextTick()

    const tooltip = document.body.querySelector<HTMLElement>('[role="tooltip"]')
    if (tooltip === null) throw new Error('Expected teleported tooltip content')
    Object.defineProperty(tooltip, 'offsetWidth', { configurable: true, value: 100 })
    Object.defineProperty(tooltip, 'offsetHeight', { configurable: true, value: 20 })
    window.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    expect(tooltip.classList).toContain('tooltip-content--bottom')
    expect(tooltip.textContent).toContain('16:9 details')
    expect(tooltip.querySelector('strong')?.textContent).toBe('16:9')
    expect(tooltip.querySelector('em')?.textContent).toBe('details')
    expect(tooltip.style.left).toBe('125px')
    expect(tooltip.style.top).toBe('78px')

    wrapper.unmount()
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

    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    wrapper.unmount()
  })

  it('keeps wide tooltip content inside the viewport', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(500)
    const wrapper = mount(BaseTooltip, {
      props: { delay: 0 },
      slots: {
        activator: '<button v-bind="props">Help</button>',
        html: '<span>Long help text</span>',
      },
    })
    vi.spyOn(wrapper.get('.tooltip-root').element, 'getBoundingClientRect').mockReturnValue({
      x: 470,
      y: 100,
      top: 100,
      right: 490,
      bottom: 120,
      left: 470,
      width: 20,
      height: 20,
      toJSON: () => ({}),
    })

    await wrapper.get('button').trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()

    const tooltip = document.body.querySelector<HTMLElement>('[role="tooltip"]')
    if (tooltip === null) throw new Error('Expected teleported tooltip content')
    Object.defineProperty(tooltip, 'offsetWidth', { configurable: true, value: 300 })
    Object.defineProperty(tooltip, 'offsetHeight', { configurable: true, value: 20 })
    window.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(tooltip.style.left).toBe('342px')
    wrapper.unmount()
  })
})
