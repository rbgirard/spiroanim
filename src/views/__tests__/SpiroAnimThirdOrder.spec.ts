import { createPinia, disposePinia, getActivePinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePlayerStore } from '@/stores/usePlayerStore'

const AnimPlayerStub = {
  props: ['controlsStartClearance', 'controlsEndClearance', 'selectionEnabled', 'conceptsVisible'],
  template:
    '<div data-role="player-view" :controls-start-clearance="controlsStartClearance" :controls-end-clearance="controlsEndClearance" :selection-enabled="selectionEnabled" :concepts-visible="conceptsVisible">Player</div>',
}

const AnimTimelineStub = {
  props: ['cols'],
  emits: ['quickSlotApply', 'quickSlotSave'],
  template:
    '<div data-role="timeline-content" :data-cols="cols"><div class="scrollbar" data-role="timeline-scroll" /></div>',
}

describe('SpiroAnim view', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sa-concepts', JSON.stringify({ vtgAdvanced: true }))
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
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        width: 412,
        height: 760,
        offsetLeft: 3,
        offsetTop: 48,
      }),
    })
  })

  enableAutoUnmount((unmount) => {
    afterEach(() => {
      try {
        unmount()
      } finally {
        const pinia = getActivePinia()
        if (pinia) disposePinia(pinia)
        setActivePinia(undefined)
        document.body.replaceChildren()
        document.documentElement.classList.remove('disable-scroll', 'disable-text-select')
        Object.defineProperty(window, 'visualViewport', {
          configurable: true,
          value: undefined,
        })
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
      }
    })
  })

  it('applies Third Order cells and customization to the player without matching', async () => {
    const pinia = createPinia().use(piniaPluginPersistedstate)
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
    })
    await router.push('/play-to')
    await router.isReady()
    const { default: SpiroAnim } = await import('@/views/SpiroAnim.vue')
    const wrapper = mount(SpiroAnim, {
      global: {
        plugins: [pinia, router],
        stubs: { Player: AnimPlayerStub, AnimTimeline: AnimTimelineStub },
      },
    })
    await flushPromises()
    const root = usePlayerStore('main').raw().ROOT
    const before = root.value
    await wrapper
      .get('[data-role="to-cell"][data-hand-ratio="1:2"][data-prop-ratio="1:3"]')
      .trigger('click')
    await flushPromises()
    expect(root.value).not.toBe(before)
    expect(root.value.props.map((prop) => prop.anim[0]?.scale)).toEqual([50, 100])
    expect(root.value.props[1]?.anim[0]?.warp).toBe(0)
    expect(root.value.props[1]?.anim[1]?.warp).toBe(-135)
    const firstVersion = root.value
    await wrapper.get('[data-role="to-version"]').setValue('2')
    await flushPromises()
    expect(root.value).not.toEqual(firstVersion)
    await wrapper.get('[data-role="to-customize-toggle"]').trigger('click')
    await wrapper.get('[data-role="to-right-color"]').setValue('Red')
    await flushPromises()
    expect(root.value.props[1]?.color).toBe(0)
    const anti = root.value
    await wrapper.get('[data-role="to-hand"]').setValue('spin')
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    await flushPromises()
    expect(root.value).not.toEqual(anti)
    expect(root.value.props[1]?.color).toBe(0)
    await wrapper.get('[data-role="to-prop"]').setValue('spin')
    await flushPromises()
    expect(root.value.props.map((prop) => prop.anim[0]?.scale)).toEqual([50, 100])
    expect(root.value.props[0]?.anim[0]?.warp).toBeUndefined()
    expect(root.value.props[1]?.anim[0]?.warp).toBe(0)
    await wrapper.get('[data-role="to-version"]').setValue('1')
    await flushPromises()
    expect(root.value.props.map((prop) => prop.anim[0]?.scale)).toEqual([50, 100])
    expect(root.value.props[0]?.anim[0]?.warp).toBeUndefined()
    expect(root.value.props[1]?.anim[0]?.warp).toBe(180)
    expect(wrapper.findAll('[data-role="to-version"] option')).toHaveLength(2)
  })
})
