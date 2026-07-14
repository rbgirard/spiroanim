import { createPinia, setActivePinia } from 'pinia'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import PropertyPanel from '@/features/editor/components/properties/PropertyPanel.vue'
import AdvancedPanel from '@/features/editor/components/properties/panels/AdvancedPanel.vue'
import AnimationsPanel from '@/features/editor/components/properties/panels/AnimationsPanel.vue'
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

  it('keeps Turns first in Animation followed by the rotational controls', () => {
    expect(propertyNames(AnimationsPanel, 'animation-panel-order')).toEqual([
      'turns',
      'arc',
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
})
