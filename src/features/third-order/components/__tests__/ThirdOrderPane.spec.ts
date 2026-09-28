import { createPinia, setActivePinia } from 'pinia'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThirdOrderPane from '@/features/third-order/components/ThirdOrderPane.vue'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { useViewportStore } from '@/stores/useViewportStore'
import { MOBILE_TOOLTIP_DISMISS_DELAY } from '@/components/ui/tooltip'

describe('ThirdOrderPane', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  enableAutoUnmount((unmount) => {
    afterEach(() => {
      unmount()
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })
  })

  it('describes headers and cells on hover/focus and updates with the dropdowns', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ThirdOrderPane)
    const column = wrapper.get('[data-role="to-column-header"][data-ratio="1:2"]')
    const row = wrapper.get('[data-role="to-row-header"][data-ratio="2:5"]')
    const cell = wrapper.get('[data-role="to-cell"][data-hand-ratio="1:2"][data-prop-ratio="2:5"]')
    expect(
      wrapper
        .findAll(
          '[data-role="to-cell"], [data-role="to-column-header"], [data-role="to-row-header"]',
        )
        .every((button) => button.attributes('aria-describedby')),
    ).toBe(true)
    await column.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Hand: 1:2 Anti')
    await row.trigger('focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelectorAll('[role="tooltip"]')).toHaveLength(1)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Prop: 2:5 Anti')
    await row.trigger('blur')
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    await cell.trigger('focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Hand: 1:2 Anti\nProp: 2:5 Anti\nVersion: 1',
    )
    expect(document.body.querySelector('[role="tooltip"]')?.id).toBe(
      cell.attributes('aria-describedby'),
    )
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
    await wrapper.get('[data-role="to-hand"]').setValue('spin')
    await wrapper.get('[data-role="to-prop"]').setValue('spin')
    await wrapper.get('[data-role="to-version"]').setValue('2')
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Hand: 1:2 Spin\nProp: 2:5 Spin\nVersion: 2',
    )
    await column.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Hand: 1:2 Spin')
    await row.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Prop: 2:5 Spin')
    await row.trigger('mouseleave')
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('keeps pattern tooltips available on touch and preserves cell selection on every tap', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(hover: none), (pointer: coarse)',
        media: query,
      })),
    )
    const wrapper = mount(ThirdOrderPane)
    // Like VTG's cells/headers, these use BaseTooltip, not optional general-control help.
    useViewportStore().showTooltips = false
    const cell = wrapper.get('[data-role="to-cell"]')
    const tap = async () => {
      cell.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
      await nextTick()
    }
    await tap()
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
    expect(wrapper.emitted('patternSelect')).toHaveLength(1)
    await tap()
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    expect(wrapper.emitted('patternSelect')).toHaveLength(2)
    await tap()
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
    await vi.advanceTimersByTimeAsync(MOBILE_TOOLTIP_DISMISS_DELAY)
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    await wrapper.get('[data-role="to-column-header"]').trigger('focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
    wrapper.unmount()
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('provides 8 hand timings, 17 prop timings, and Customize below 136 selectable cells', async () => {
    const wrapper = mount(ThirdOrderPane)
    expect(
      wrapper.findAll('[data-role="to-column-header"]').map((header) => header.text()),
    ).toEqual(['1:1', '1:2', '2:1', '1:3', '2:3', '1:4', '1:5', '2:5'])
    expect(wrapper.findAll('[data-role="to-row-header"]').map((header) => header.text())).toEqual([
      '1:1',
      '1:2',
      '2:1',
      '1:3',
      '2:3',
      '1:4',
      '1:5',
      '2:5',
      '1:6',
      '1:7',
      '2:7',
      '1:8',
      '1:9',
      '2:9',
      '1:10',
      '1:11',
      '2:11',
    ])
    expect(wrapper.findAll('[data-role="to-cell"]')).toHaveLength(136)
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(0)
    await wrapper.get('[data-role="to-hand"]').setValue('spin')
    expect(wrapper.get('[data-role="to-column-header"]').attributes('aria-label')).toBe(
      'Hand 1:1 Spin',
    )
    expect(wrapper.get('[data-role="to-row-header"]').attributes('aria-label')).toBe(
      'Prop 1:1 Anti',
    )
    await wrapper.get('[data-role="to-customize-toggle"]').trigger('click')
    await wrapper.get('[data-role="to-left-color"]').setValue('Red')
    await wrapper.get('[data-role="to-right-color"]').setValue('Blue')
    expect(useConceptsStore().leftPropColor).toBe('Red')
    expect(useConceptsStore().rightPropColor).toBe('Blue')
    expect(wrapper.element.lastElementChild?.getAttribute('data-role')).toBe('to-customize')
    wrapper.unmount()
  })

  it('preserves the opposite coordinate when selecting headers, and randomizes within bounds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const wrapper = mount(ThirdOrderPane)
    await wrapper.get('[data-role="to-column-header"][data-ratio="1:3"]').trigger('click')
    const selected = () => wrapper.get('[data-role="to-cell"][aria-pressed="true"]')
    expect(selected().attributes('data-prop-ratio')).toBe('2:11')
    await wrapper.get('[data-role="to-row-header"][data-ratio="1:7"]').trigger('click')
    expect(selected().attributes('data-hand-ratio')).toBe('1:3')
    expect(selected().attributes('data-prop-ratio')).toBe('1:7')
    await wrapper.get('[data-role="to-column-header"][data-ratio="2:1"]').trigger('click')
    expect(selected().attributes('data-prop-ratio')).toBe('1:7')
    await wrapper
      .get('[data-role="to-cell"][data-hand-ratio="1:1"][data-prop-ratio="1:1"]')
      .trigger('click')
    expect(selected().attributes('data-hand-ratio')).toBe('1:1')
    await wrapper.get('[data-role="to-shuffle"]').trigger('click')
    expect(selected().attributes('data-hand-ratio')).toBe('2:5')
    expect(selected().attributes('data-prop-ratio')).toBe('2:11')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      concept: 'to',
      handRatio: '2:5',
      propRatio: '2:11',
      version: 1,
      handDirection: 'anti',
      propDirection: 'anti',
    })
    expect(wrapper.emitted('animationUpdate')).toBeUndefined()
    wrapper.unmount()
  })

  it('reapplies versions, all direction combinations, and Customize changes', async () => {
    const wrapper = mount(ThirdOrderPane)
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    await wrapper.get('[data-role="to-version"]').setValue('2')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({ version: 2 })
    await wrapper.get('[data-role="to-customize-toggle"]').trigger('click')
    await wrapper.get('[data-role="to-left-color"]').setValue('Red')
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({
      propColors: ['Red', 'Green'],
    })
    expect(wrapper.find('[data-role="to-scale"]').exists()).toBe(false)
    await wrapper.get('[data-role="to-prop"]').setValue('spin')
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    await wrapper.get('[data-role="to-version"]').setValue('1')
    await wrapper.get('[data-role="to-left-color"]').setValue('Blue')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      handDirection: 'anti',
      propDirection: 'spin',
      version: 1,
    })
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({
      propColors: ['Blue', 'Green'],
    })
    await wrapper.get('[data-role="to-hand"]').setValue('spin')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      handDirection: 'spin',
      propDirection: 'spin',
    })
    expect(
      wrapper.findAll('[data-role="to-version"] option').map((option) => option.text()),
    ).toEqual(['1', '2'])
    await wrapper.get('[data-role="to-prop"]').setValue('anti')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      version: 1,
      handDirection: 'spin',
      propDirection: 'anti',
      propColors: ['Blue', 'Green'],
    })
    wrapper.unmount()
  })

  it('does not replace the player until its animation is ready', async () => {
    const wrapper = mount(ThirdOrderPane, { props: { animationReady: false } })
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
    await wrapper.setProps({ animationReady: true })
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    expect(wrapper.emitted('patternSelect')).toHaveLength(1)
    wrapper.unmount()
  })
})
