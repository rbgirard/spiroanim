import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import AppTooltip from '@/components/AppTooltip.vue'
import AnimProperties from '@/features/editor/components/AnimProperties.vue'
import { useMainPaneStore } from '@/stores/useMainPaneStore'
import { usePlayerStore } from '@/stores/usePlayerStore'

describe('AnimProperties', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('describes the editor toolbar controls with shared tooltips', () => {
    usePlayerStore('toolbar-tooltips').SELECTION = true
    const wrapper = mount(AnimProperties, {
      props: {
        dim: { width: 700, height: 400, perc: 60 },
        cols: 3,
        store: 'toolbar-tooltips',
      },
      global: {
        stubs: {
          Animations: true,
          Advanced: true,
          Root: true,
          Base: true,
          Manage: true,
          BaseIcon: true,
        },
      },
    })

    const tooltipText = wrapper
      .findAllComponents(AppTooltip)
      .map((tooltip) => tooltip.props('text'))
    expect(tooltipText).toEqual(
      expect.arrayContaining([
        'Back',
        'Forward',
        'Undo',
        'Position',
        'Modifying',
        'Select multiple props',
        'Only include props with points at both selection bounds',
      ]),
    )

    wrapper.unmount()
  })

  it('marks the toolbar for navigation clearance only when the editor is in the main left pane', async () => {
    const paneStore = useMainPaneStore()
    paneStore.setViewInPane('editor', 'left')

    const wrapper = mount(AnimProperties, {
      props: {
        dim: { width: 700, height: 400, perc: 60 },
        cols: 1,
        store: 'left-pane-clearance',
      },
      global: {
        stubs: {
          Animations: true,
          Advanced: true,
          Root: true,
          Base: true,
          Manage: true,
          BaseIcon: true,
        },
      },
    })

    expect(wrapper.get('.scrollbar').classes()).toContain('scrollbar--main-left')
    expect(wrapper.get('.properties-grid').classes()).toContain('properties-grid--single-column')

    paneStore.setViewInPane('editor', 'right')
    await nextTick()

    expect(wrapper.get('.scrollbar').classes()).not.toContain('scrollbar--main-left')

    wrapper.unmount()
  })
})
