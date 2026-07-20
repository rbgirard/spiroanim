import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import AppNavigationMenu from '@/components/layout/AppNavigationMenu.vue'

async function mountMenu() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/about', component: { template: '<div>About</div>' } },
      { path: '/player', component: { template: '<div>Player</div>' } },
      { path: '/editor', component: { template: '<div>Editor</div>' } },
      { path: '/timeline', component: { template: '<div>Timeline</div>' } },
    ],
  })
  await router.push('/player?r=animation-data')
  await router.isReady()

  const wrapper = mount(AppNavigationMenu, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        AppTooltip: {
          template: '<div><slot name="activator" :props="{}" /></div>',
        },
      },
    },
  })

  return { router, wrapper }
}

describe('AppNavigationMenu', () => {
  it('opens page navigation with mobile-sized menu items', async () => {
    const { wrapper } = await mountMenu()
    const trigger = wrapper.get('button')

    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role="menu"]').attributes('aria-labelledby')).toBe(
      trigger.attributes('id'),
    )
    expect(wrapper.findAll('[role="menuitem"]').map((item) => item.text())).toEqual([
      'Home',
      'About',
    ])

    wrapper.unmount()
  })

  it('supports keyboard opening, movement, and dismissal', async () => {
    const { wrapper } = await mountMenu()
    const trigger = wrapper.get('button')

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toContain('Home')

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toContain('About')

    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)

    wrapper.unmount()
  })
})
