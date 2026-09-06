import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ConceptDocsMenu from '@/features/concepts/components/ConceptDocsMenu.vue'

describe('ConceptDocsMenu', () => {
  it('opens the bundled VTG documents and the TKA guide from an accessible menu', async () => {
    const wrapper = mount(ConceptDocsMenu, {
      props: { returnPath: '/play-vtg?r=pattern#selected' },
    })
    const trigger = wrapper.get('button')

    expect(trigger.text()).toBe('Docs')
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role="menu"]').attributes('aria-labelledby')).toBe(
      trigger.attributes('id'),
    )
    expect(
      wrapper.findAll('[role="menuitem"]').map((item) => ({
        href: item.attributes('href'),
        text: item.text(),
      })),
    ).toEqual([
      {
        href: '/vtg4/?returnTo=%2Fplay-vtg%3Fr%3Dpattern%23selected',
        text: 'VTG4 Expansion',
      },
      {
        href: '/vtg3/?returnTo=%2Fplay-vtg%3Fr%3Dpattern%23selected',
        text: 'VTG3 Reference',
      },
      {
        href: 'https://tkaflowarts.com/guide',
        text: 'The Kinetic Alphabet',
      },
    ])

    const tkaLink = wrapper.get('[role="menuitem"][href="https://tkaflowarts.com/guide"]')
    expect(tkaLink.attributes('target')).toBe('_blank')
    expect(tkaLink.attributes('rel')).toBe('noopener')
  })
})
