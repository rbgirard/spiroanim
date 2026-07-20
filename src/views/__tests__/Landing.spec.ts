import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import Landing from '@/views/LandingPage.vue'

describe('Landing view', () => {
  it('introduces the desktop experience and enters the application', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Landing },
        { path: '/app', component: { template: '<div>Application</div>' } },
      ],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(Landing, {
      global: { plugins: [router] },
    })

    expect(wrapper.get('h1').text()).toBe('SpiroAnim.com')
    expect(wrapper.get('img.brand-mark').attributes('src')).toBe('/pwa-source.svg')
    expect(wrapper.get('img.brand-mark').attributes('alt')).toBe('')
    expect(wrapper.text()).toContain('high-end mobile device')
    expect(wrapper.text()).toContain('hover tooltips')
    expect(wrapper.get('a.enter-button').attributes('href')).toBe('/app')
  })
})
