import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ManagePanel from '@/features/editor/components/properties/panels/ManagePanel.vue'

describe('ManagePanel', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('explains all four management actions', async () => {
    const wrapper = mount(ManagePanel, {
      global: {
        provide: { store: ref('manage-panel-tooltips') },
        stubs: {
          PropertyPanel: { template: '<section><slot /></section>' },
        },
      },
    })

    const expected = ['Insert Points', 'Delete Selection', 'Add Prop', 'Delete Props']
    const links = wrapper.findAll('a')
    expect(links.map((link) => link.text())).toEqual(expected)
    expect(wrapper.get('.manage-note').text()).toBe(
      'Manage tools are limited and still in development.',
    )

    for (const [index, text] of expected.entries()) {
      await links[index]!.trigger('mouseenter')
      vi.advanceTimersByTime(0)
      await nextTick()
      expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain(text)
      await links[index]!.trigger('mouseleave')
      await nextTick()
    }

    wrapper.unmount()
  })
})
