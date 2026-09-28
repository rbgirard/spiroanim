import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThirdOrderPane from '@/features/third-order/components/ThirdOrderPane.vue'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'

describe('ThirdOrderPane', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.restoreAllMocks())

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

  it('reapplies version and Customize changes, but does not emit unsupported patterns', async () => {
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
    const selections = wrapper.emitted('patternSelect')?.length
    const customizations = wrapper.emitted('customize')?.length
    await wrapper.get('[data-role="to-prop"]').setValue('spin')
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    await wrapper.get('[data-role="to-version"]').setValue('1')
    await wrapper.get('[data-role="to-left-color"]').setValue('Blue')
    expect(wrapper.emitted('patternSelect')).toHaveLength(selections!)
    expect(wrapper.emitted('customize')).toHaveLength(customizations!)
    expect(wrapper.find('[data-role="to-cell-preview"]').exists()).toBe(false)
    await wrapper.get('[data-role="to-prop"]').setValue('anti')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      version: 1,
      propColors: ['Blue', 'Green'],
    })
    wrapper.unmount()
  })
})
