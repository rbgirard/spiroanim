import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSplitterStore } from '@/stores/useSplitterStore'

describe('SpiroAnim view', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn<() => void>(),
      removeListener: vi.fn<() => void>(),
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
      dispatchEvent: vi.fn<() => boolean>(() => true),
    }))
  })

  afterEach(() => {
    document.documentElement.classList.remove('disable-scroll', 'disable-text-select')
    vi.unstubAllGlobals()
  })

  it('composes pane controls and the requested placeholder views', async () => {
    const pinia = createPinia().use(piniaPluginPersistedstate)
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
    })
    await router.push('/play-time')
    await router.isReady()
    const { default: SpiroAnim } = await import('@/views/SpiroAnim.vue')

    const wrapper = mount(SpiroAnim, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    })
    await flushPromises()

    expect(wrapper.get('[data-role="main-container"]').attributes('data-role')).toBe(
      'main-container',
    )
    expect(wrapper.get('[data-role="left-pane"]').text()).toContain('Player')
    expect(wrapper.get('[data-role="right-pane"]').text()).toContain('Timeline')
    expect(wrapper.text()).not.toContain('Editor')
    expect(wrapper.findAll('button[aria-label="Rotate View"]')).toHaveLength(2)
    expect(wrapper.get('button[aria-label="Resize"]').attributes('title')).toBe('Resize')
    expect(document.documentElement.classList.contains('disable-scroll')).toBe(true)

    const splitter = useSplitterStore('main')
    expect(splitter.leftPerc).toBe(50)

    wrapper.unmount()
    expect(document.documentElement.classList.contains('disable-scroll')).toBe(false)
  })
})
