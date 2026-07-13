import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createApp, defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { paneSplits, useMainRoute } from '@/composables/useMainRoute'
import { useMainPaneStore } from '@/stores/useMainPaneStore'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useSplitterStore } from '@/stores/useSplitterStore'

const mountedApps: ReturnType<typeof createApp>[] = []

const mountRoute = async (path: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
  })
  await router.push(path)
  await router.isReady()

  const pinia = createPinia().use(piniaPluginPersistedstate)
  const app = createApp(
    defineComponent({
      setup() {
        useMainRoute()
        return () => h('div')
      },
    }),
  )
  app.use(pinia)
  app.use(router)
  app.mount(document.createElement('div'))
  mountedApps.push(app)
  await nextTick()

  return {
    router,
    paneStore: useMainPaneStore(pinia),
    playerStore: usePlayerStore('main'),
    splitterStore: useSplitterStore('main'),
  }
}

describe('useMainRoute', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    while (mountedApps.length > 0) mountedApps.pop()!.unmount()
  })

  it('exports every ordered two-pane short-route combination', () => {
    expect(paneSplits).toEqual([
      '/play-time',
      '/play-edit',
      '/time-play',
      '/time-edit',
      '/edit-play',
      '/edit-time',
    ])
  })

  it('maps a single hidden view to the left pane and expands it fully', async () => {
    const { paneStore, playerStore, splitterStore } = await mountRoute('/editor')

    expect(paneStore.parents).toEqual({ player: 'hidden', editor: 'left', timeline: 'right' })
    expect(splitterStore.leftPerc).toBe(100)
    expect(playerStore.raw().ROOT.value).toMatchObject({ bpm: 60, props: [{}, {}] })
  })

  it('maps short split routes and resets a persisted snapped splitter', async () => {
    localStorage.setItem('sa-splitter-main', JSON.stringify({ leftPerc: 100 }))

    const { paneStore, splitterStore } = await mountRoute('/edit-time')

    expect(paneStore.parents).toEqual({ player: 'hidden', editor: 'left', timeline: 'right' })
    expect(splitterStore.leftPerc).toBe(50)
  })

  it('replaces the app route with the current pane layout path', async () => {
    const { router } = await mountRoute('/app')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/play-time')
  })
})
