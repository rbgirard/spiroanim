import { createPinia, setActivePinia } from 'pinia'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import PropertyPanel from '@/features/editor/components/properties/PropertyPanel.vue'
import AdvancedPanel from '@/features/editor/components/properties/panels/AdvancedPanel.vue'
import AnimationsPanel from '@/features/editor/components/properties/panels/AnimationsPanel.vue'
import RootPanel from '@/features/editor/components/properties/panels/RootPanel.vue'
import type { DynamicVal } from '@/types/AnimTypes'

describe('editor property panel organization', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  const propertyNames = (component: typeof AnimationsPanel, store: string) => {
    const wrapper = shallowMount(component, {
      global: { provide: { store: ref(store) } },
    })
    const vals = wrapper.getComponent(PropertyPanel).props('vals') as DynamicVal[]
    const names = vals.map(({ name }) => name)
    wrapper.unmount()
    return names
  }

  it('keeps Arc first in Animation followed by the rotational controls', () => {
    expect(propertyNames(AnimationsPanel, 'animation-panel-order')).toEqual([
      'arc',
      'turns',
      'plane',
      'axis',
      'adjust',
      'scale',
      'depth',
    ])
  })

  it('moves the remaining animation controls into Advanced', () => {
    expect(propertyNames(AdvancedPanel, 'advanced-panel-order')).toEqual([
      'point',
      'path',
      'direct',
      'beats',
      'type',
      'move',
    ])
  })

  it('provides help content for every root display control', () => {
    const wrapper = shallowMount(RootPanel, {
      global: { provide: { store: ref('root-panel-tooltips') } },
    })
    const slots = wrapper.getComponent(PropertyPanel).vm.$slots

    expect(Object.keys(slots)).toEqual(
      expect.arrayContaining(['aspectx', 'aspecty', 'distance', 'thick']),
    )
    wrapper.unmount()
  })
})
