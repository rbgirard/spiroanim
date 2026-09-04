import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import airIconUrl from '@austencloud/tka-elements/icons/air.webp'
import earthIconUrl from '@austencloud/tka-elements/icons/earth.webp'
import fireIconUrl from '@austencloud/tka-elements/icons/fire.webp'
import moonIconUrl from '@austencloud/tka-elements/icons/moon.webp'
import sunIconUrl from '@austencloud/tka-elements/icons/sun.webp'
import waterIconUrl from '@austencloud/tka-elements/icons/water.webp'
import ElementalRelationshipIcons from '@/features/concepts/components/ElementalRelationshipIcons.vue'

describe('ElementalRelationshipIcons', () => {
  it('renders the TKA element artwork at the requested dimensions', () => {
    const wrapper = mount(ElementalRelationshipIcons, {
      props: {
        hands: { timing: 'T', direction: 'S' },
        props: { timing: 'S', direction: 'O' },
        size: 18,
      },
    })
    const icons = wrapper.findAll<HTMLImageElement>('img')

    expect(wrapper.attributes('aria-label')).toBe('Earth / Fire')
    expect(icons).toHaveLength(2)
    expect(icons[0]?.attributes('src')).toBe(earthIconUrl)
    expect(icons[1]?.attributes('src')).toBe(fireIconUrl)
    expect(icons.every((icon) => icon.attributes('width') === '18')).toBe(true)
    expect(icons.every((icon) => icon.attributes('height') === '18')).toBe(true)
  })

  it('uses the TKA Sun and Moon artwork for quarter relationships', () => {
    const wrapper = mount(ElementalRelationshipIcons, {
      props: {
        hands: { timing: 'Q', direction: 'S' },
        props: { timing: 'Q', direction: 'O' },
      },
    })
    const icons = wrapper.findAll<HTMLImageElement>('img')

    expect(wrapper.attributes('aria-label')).toBe('Sun / Moon')
    expect(icons[0]?.attributes('src')).toBe(sunIconUrl)
    expect(icons[1]?.attributes('src')).toBe(moonIconUrl)
  })

  it('uses the TKA Water and Air artwork for the remaining relationships', () => {
    const wrapper = mount(ElementalRelationshipIcons, {
      props: {
        hands: { timing: 'S', direction: 'S' },
        props: { timing: 'T', direction: 'O' },
      },
    })
    const icons = wrapper.findAll<HTMLImageElement>('img')

    expect(wrapper.attributes('aria-label')).toBe('Water / Air')
    expect(icons[0]?.attributes('src')).toBe(waterIconUrl)
    expect(icons[1]?.attributes('src')).toBe(airIconUrl)
  })

  it('retains the prohibited symbol for indeterminate relationships', () => {
    const wrapper = mount(ElementalRelationshipIcons, {
      props: {
        handsIndeterminate: true,
        propsIndeterminate: true,
      },
    })

    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(wrapper.findAll('svg.base-icon')).toHaveLength(2)
    expect(wrapper.attributes('aria-label')).toBe('Indeterminate / Indeterminate')
  })
})
