import { mount } from '@vue/test-utils'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Landing from '@/views/LandingPage.vue'

describe('Landing view', () => {
  async function mountLanding(isDesktop: boolean) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(hover: hover) and (pointer: fine)' ? isDesktop : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn<() => void>(),
        removeEventListener: vi.fn<() => void>(),
        addListener: vi.fn<() => void>(),
        removeListener: vi.fn<() => void>(),
        dispatchEvent: vi.fn<() => boolean>(() => true),
      })),
    )

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

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps mobile usage guidance out of the desktop landing page', async () => {
    const wrapper = await mountLanding(true)

    expect(wrapper.get('h1').text()).toBe('SpiroAnim.com')
    expect(wrapper.get('img.brand-mark').attributes('src')).toBe('/pwa-source.svg')
    expect(wrapper.get('img.brand-mark').attributes('alt')).toBe('')
    expect(wrapper.get('.project-note').text()).toContain('proof-of-concept rendering tool')
    expect(wrapper.get('.project-note').text()).toContain('More features are on the way')
    expect(wrapper.text()).not.toContain('high-end mobile device')
    expect(wrapper.text()).not.toContain('Continuing on mobile')
    expect(wrapper.get('a.enter-button').attributes('href')).toBe('/app')
    expect(wrapper.get('a.about-button').attributes('href')).toBe('/about')
  })

  it('shows mobile usage guidance on a touch-first device', async () => {
    const wrapper = await mountLanding(false)

    expect(wrapper.text()).toContain('high-end mobile device')
    expect(wrapper.text()).toContain('hover tooltips')
    expect(wrapper.text()).toContain('Continuing on mobile')
  })

  it('defers device-specific content until the page mounts', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: Landing }],
    })
    await router.push('/')
    await router.isReady()

    const html = await renderToString(createSSRApp(Landing).use(router))

    expect(html).not.toContain('high-end mobile device')
    expect(html).not.toContain('Continuing on mobile')
    expect(html).not.toContain('pwa-install')
  })
})
