import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PropertyPanel from '@/features/editor/components/properties/PropertyPanel.vue'
import { usePropertiesStore } from '@/features/editor/stores/usePropertiesStore'
import type { SetterFunc, ValRetType } from '@/types/AnimTypes'

describe('PropertyPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('tracks expansion and renders the selected property form', async () => {
    const setter = vi.fn<SetterFunc>()
    const data: Record<string, ValRetType> = {
      paths: [true, true, 'true', false],
    }
    const wrapper = mount(PropertyPanel, {
      props: {
        panel: 'root',
        title: 'Root',
        data,
        vals: [{ name: 'paths', text: 'Paths', component: 'Boolean' }],
        setter,
        store: 'property-panel',
      },
    })
    const details = wrapper.get('details')
    const properties = usePropertiesStore('property-panel')

    expect(wrapper.get('.property-label-tooltip > .col1').text()).toBe('Paths:')
    expect(details.attributes('open')).toBeUndefined()
    ;(details.element as HTMLDetailsElement).open = true
    await details.trigger('toggle')
    expect(properties.pEXPANDED.root).toEqual(['root'])

    await wrapper.get('button.propval').trigger('click')
    expect(properties.pINPUT).toBe('root.paths')

    await wrapper.get<HTMLInputElement>('input[type="checkbox"]').setValue(false)
    expect(setter).toHaveBeenCalledWith('paths', false)
  })

  it('distinguishes defined, inherited, mismatched, and undefined values', () => {
    const wrapper = mount(PropertyPanel, {
      props: {
        panel: 'states',
        title: 'States',
        data: {
          defined: [1, true, '1', false],
          inherited: [1, true, '1', true],
          mismatched: [1, false, 'Mismatch', false],
          undefined: [undefined, true, 'Undefined', false],
        },
        vals: [
          { name: 'defined', text: 'Defined' },
          { name: 'inherited', text: 'Inherited' },
          { name: 'mismatched', text: 'Mismatched' },
          { name: 'undefined', text: 'Undefined' },
        ],
        store: 'property-states',
      },
    })

    const values = wrapper.findAll('button.propval')
    expect(values[0]?.classes()).toContain('val-def')
    expect(values[1]?.classes()).toContain('val-fall')
    expect(values[2]?.classes()).toContain('val-mism')
    expect(values[3]?.classes()).toContain('val-undef')
  })
})
