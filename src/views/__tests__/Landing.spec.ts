import { mount } from '@vue/test-utils'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import Landing from '@/views/LandingPage.vue'

describe('Landing view', () => {
  async function mountLanding() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Landing },
        { path: '/app', component: { template: '<div>Application</div>' } },
        { path: '/about', component: { template: '<div>About</div>' } },
      ],
    })
    await router.push('/')
    await router.isReady()

    return mount(Landing, {
      global: { plugins: [router] },
    })
  }

  it('renders the public landing content and navigation', async () => {
    const wrapper = await mountLanding()

    expect(wrapper.get('h1').text()).toBe('SpiroAnim.com')
    expect(wrapper.get('img.brand-mark').attributes('src')).toBe('/pwa-source.svg')
    expect(wrapper.get('img.brand-mark').attributes('alt')).toBe('')
    expect(wrapper.get('.project-note').text()).toContain('proof-of-concept rendering tool')
    expect(wrapper.get('.project-note').text()).toContain('including a VTG generator, a library')
    expect(wrapper.get('.offline-note').text()).toContain('Built to work offline')
    expect(wrapper.get('.offline-note').text()).toContain('After one online visit')
    expect(wrapper.get('.mobile-guidance').text()).toContain('high-end mobile device')
    expect(wrapper.get('.mobile-guidance').text()).toContain('Continuing on mobile')
    expect(wrapper.get('a.enter-button').attributes('href')).toBe('/app')
    expect(wrapper.get('a.about-button').attributes('href')).toBe('/about')
  })

  it('prerenders mobile guidance while deferring PWA controls until mounting', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: Landing }],
    })
    await router.push('/')
    await router.isReady()

    const html = await renderToString(createSSRApp(Landing).use(router))

    expect(html).toContain('high-end mobile device')
    expect(html).toContain('Continuing on mobile')
    expect(html).not.toContain('pwa-install')
  })
})
