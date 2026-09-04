import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createApp, defineComponent, h, triggerRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { paneSplits, useMainRoute } from '@/composables/useMainRoute'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { useMainPaneStore } from '@/stores/useMainPaneStore'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useQueryVersionStore } from '@/stores/useQueryVersionStore'
import { useQSMainStore } from '@/stores/useQSMainStore'
import { useSplitterStore } from '@/stores/useSplitterStore'
import type { RootDataFinal } from '@/types/AnimTypes'

const mountedApps: ReturnType<typeof createApp>[] = []

const mountRoute = async (path: string, initialAnimation?: RootDataFinal) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
  })
  await router.push(path)
  await router.isReady()

  const pinia = createPinia().use(piniaPluginPersistedstate)
  let animationReady: ReturnType<typeof useMainRoute>['animationReady'] | undefined
  let saveCurrentPatternToQuickSlot:
    | ReturnType<typeof useMainRoute>['saveCurrentPatternToQuickSlot']
    | undefined
  let saveAnimationsToQuickSlots:
    | ReturnType<typeof useMainRoute>['saveAnimationsToQuickSlots']
    | undefined
  const app = createApp(
    defineComponent({
      setup() {
        if (initialAnimation) usePlayerStore('main').raw().ROOT.value = initialAnimation
        const routeState = useMainRoute()
        animationReady = routeState.animationReady
        saveCurrentPatternToQuickSlot = routeState.saveCurrentPatternToQuickSlot
        saveAnimationsToQuickSlots = routeState.saveAnimationsToQuickSlots
        return () => h('div')
      },
    }),
  )
  app.use(pinia)
  app.use(router)
  app.mount(document.createElement('div'))
  mountedApps.push(app)
  await nextTick()
  if (!animationReady) throw new Error('Main route state was not created')
  if (!saveCurrentPatternToQuickSlot) throw new Error('Quick Slot saver was not created')
  if (!saveAnimationsToQuickSlots) throw new Error('Quick Slot batch saver was not created')

  return {
    animationReady,
    saveCurrentPatternToQuickSlot,
    saveAnimationsToQuickSlots,
    router,
    paneStore: useMainPaneStore(pinia),
    conceptsStore: useConceptsStore(pinia),
    playerStore: usePlayerStore('main'),
    queryVersionStore: useQueryVersionStore(pinia),
    splitterStore: useSplitterStore('main'),
  }
}

const createLoadedAnimation = () => {
  const animation = createDefaultVtgAnimation({
    reference: '1-1',
    speedRatio: '1:3',
  })
  if (!animation) throw new Error('Expected a supported VTG animation')
  return animation
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
      '/play-cnc',
      '/play-vtg',
      '/play-qtr',
      '/play-8stp',
      '/play-qst',
      '/play-tka',
      '/time-play',
      '/time-edit',
      '/time-cnc',
      '/time-vtg',
      '/time-qtr',
      '/time-8stp',
      '/time-qst',
      '/time-tka',
      '/edit-play',
      '/edit-time',
      '/edit-cnc',
      '/edit-vtg',
      '/edit-qtr',
      '/edit-8stp',
      '/edit-qst',
      '/edit-tka',
      '/cnc-play',
      '/cnc-time',
      '/cnc-edit',
      '/vtg-play',
      '/vtg-time',
      '/vtg-edit',
      '/qtr-play',
      '/qtr-time',
      '/qtr-edit',
      '/8stp-play',
      '/8stp-time',
      '/8stp-edit',
      '/qst-play',
      '/qst-time',
      '/qst-edit',
      '/tka-play',
      '/tka-time',
      '/tka-edit',
    ])
  })

  it('maps a single hidden view to the left pane and expands it fully', async () => {
    const { paneStore, splitterStore } = await mountRoute('/editor', createLoadedAnimation())

    expect(paneStore.parents).toEqual({
      player: 'hidden',
      editor: 'left',
      timeline: 'hidden',
      concepts: 'right',
      builder: 'hidden',
    })
    expect(splitterStore.leftPerc).toBe(100)
  })

  it('switches an empty animation to the play-vtg layout', async () => {
    const { paneStore, playerStore, router, splitterStore } = await mountRoute('/editor')
    await flushPromises()

    expect(paneStore.parents).toEqual({
      player: 'left',
      editor: 'hidden',
      timeline: 'hidden',
      concepts: 'right',
      builder: 'hidden',
    })
    expect(splitterStore.leftPerc).toBe(50)
    expect(playerStore.raw().ROOT.value).toMatchObject({ bpm: 120, props: [] })
    expect(router.currentRoute.value.path).toBe('/play-vtg')
  })

  it('restores a selected Quick Slot before running the empty-animation fallback', async () => {
    setActivePinia(createPinia())
    const targetAnimation = createLoadedAnimation()
    const encoded = useQSMainStore().encodeQS(targetAnimation, false)
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(encoded)) {
      if (value !== undefined && value !== null) search.set(key, String(value))
    }
    const savedPath = `/play-time?${search.toString()}`
    localStorage.setItem(
      'sa-concepts',
      JSON.stringify({
        quickSlotCount: 4,
        selectedQuickSlot: 1,
        quickSlotPaths: [savedPath, null, null, null],
      }),
    )

    const { animationReady, conceptsStore, paneStore, playerStore, router } =
      await mountRoute('/app')
    await flushPromises()

    expect(animationReady.value).toBe(true)
    expect(useQSMainStore().encodeQS(playerStore.raw().ROOT.value, false)).toEqual(encoded)
    expect(conceptsStore.selectedQuickSlot).toBe(1)
    expect(conceptsStore.quickSlotPaths[0]).toBe(savedPath)
    expect(router.currentRoute.value.path).toBe('/play-time')
    expect(paneStore.parents.player).toBe('left')
    expect(paneStore.parents.timeline).toBe('right')
    expect(paneStore.parents.editor).toBe('hidden')
  })

  it('reconciles a populated route with its matching Quick Slot', async () => {
    setActivePinia(createPinia())
    const targetAnimation = createLoadedAnimation()
    const encoded = useQSMainStore().encodeQS(targetAnimation, false)
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(encoded)) {
      if (value !== undefined && value !== null) search.set(key, String(value))
    }
    const savedPath = `/play-vtg?${search.toString()}`
    localStorage.setItem(
      'sa-concepts',
      JSON.stringify({
        quickSlotCount: 4,
        selectedQuickSlot: 1,
        quickSlotPaths: [null, savedPath, null, null],
      }),
    )

    const { conceptsStore } = await mountRoute(savedPath)
    await flushPromises()

    expect(conceptsStore.selectedQuickSlot).toBe(2)
  })

  it('keeps an empty Quick Slot selected across a concept-only route change', async () => {
    setActivePinia(createPinia())
    const encoded = useQSMainStore().encodeQS(createLoadedAnimation(), false)
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(encoded)) {
      if (value !== undefined && value !== null) search.set(key, String(value))
    }
    const { conceptsStore, router } = await mountRoute(`/play-vtg?${search.toString()}`)
    await flushPromises()

    conceptsStore.restoreQuickSlots()
    conceptsStore.selectedQuickSlot = 3
    conceptsStore.selectedConcept = '8stp'
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/play-8stp')
    expect(conceptsStore.quickSlotPaths[2]).toBeNull()
    expect(conceptsStore.selectedQuickSlot).toBe(3)
  })

  it.each([
    ['/editor', '/timeline'],
    ['/play-edit', '/play-time'],
    ['/edit-play', '/time-play'],
    ['/play-vtg', '/play-vtg'],
    ['/vtg-play', '/vtg-play'],
    ['/edit-time', '/edit-time'],
  ])(
    'stores Quick Slot animation data from %s at the appropriate route %s',
    async (source, saved) => {
      const { conceptsStore, playerStore } = await mountRoute(source, createLoadedAnimation())
      conceptsStore.restoreQuickSlots()
      conceptsStore.selectedQuickSlot = 1

      const runtime = playerStore.raw()
      runtime.ROOT.value = { ...runtime.ROOT.value, bpm: 61 }
      await flushPromises()

      expect(conceptsStore.quickSlotPaths[0]).toMatch(
        new RegExp(`^${saved.replace('/', '\\/')}\\?r=`),
      )
    },
  )

  it.each([
    ['/editor', '/timeline'],
    ['/play-edit', '/play-time'],
    ['/edit-play', '/time-play'],
    ['/play-vtg', '/play-vtg'],
  ])('immediately saves an empty Quick Slot from %s at %s', async (source, saved) => {
    const { conceptsStore, saveCurrentPatternToQuickSlot } = await mountRoute(
      source,
      createLoadedAnimation(),
    )
    conceptsStore.restoreQuickSlots()
    conceptsStore.selectedQuickSlot = 2

    saveCurrentPatternToQuickSlot(2)

    expect(conceptsStore.quickSlotPaths[1]).toMatch(
      new RegExp(`^${saved.replace('/', '\\/')}\\?r=`),
    )
  })

  it('saves generated animations as an unselected Quick Slot set', async () => {
    const first = createLoadedAnimation()
    const second = createDefaultVtgAnimation({
      reference: '3-3',
      speedRatio: '1:3',
      transition: true,
    })
    if (!second) throw new Error('Expected a supported VTG transition')
    const { conceptsStore, saveAnimationsToQuickSlots } = await mountRoute('/play-vtg', first)
    conceptsStore.restoreQuickSlots()
    conceptsStore.selectedQuickSlot = 2

    expect(saveAnimationsToQuickSlots([first, second])).toBe(true)

    expect(conceptsStore.quickSlotCount).toBe(2)
    expect(conceptsStore.quickSlotPaths).toHaveLength(2)
    expect(conceptsStore.quickSlotPaths.every((path) => path?.startsWith('/play-vtg?r='))).toBe(
      true,
    )
    expect(conceptsStore.selectedQuickSlot).toBeNull()
  })

  it('does not rewrite a selected Quick Slot when only the pane route changes', async () => {
    const animation = createLoadedAnimation()
    const { conceptsStore, playerStore, router } = await mountRoute('/play-time', animation)
    const query = useQSMainStore().encodeQS(animation, false)
    const savedPath = router.resolve({ path: '/play-time', query }).fullPath
    conceptsStore.restoreQuickSlots()
    conceptsStore.selectedQuickSlot = 1
    conceptsStore.quickSlotPaths[0] = savedPath

    await router.replace({ path: '/play-edit', query })
    await flushPromises()
    triggerRef(playerStore.raw().ROOT)
    await flushPromises()

    expect(conceptsStore.quickSlotPaths[0]).toBe(savedPath)
  })

  it('does not populate a selected empty Quick Slot from a pane-only animation notification', async () => {
    const animation = createLoadedAnimation()
    const { conceptsStore, playerStore, router } = await mountRoute('/play-time', animation)
    conceptsStore.restoreQuickSlots()
    conceptsStore.selectedQuickSlot = 1

    await router.replace({ path: '/play-edit', query: useQSMainStore().encodeQS(animation, false) })
    await flushPromises()
    triggerRef(playerStore.raw().ROOT)
    await flushPromises()

    expect(conceptsStore.quickSlotPaths[0]).toBeNull()
  })

  it('does not force play-vtg when animation data is cleared after startup', async () => {
    const { paneStore, playerStore, router, splitterStore } = await mountRoute(
      '/editor',
      createLoadedAnimation(),
    )

    const runtime = playerStore.raw()
    runtime.ROOT.value = { ...runtime.ROOT.value, props: [] }
    await flushPromises()

    expect(paneStore.parents).toEqual({
      player: 'hidden',
      editor: 'left',
      timeline: 'hidden',
      concepts: 'right',
      builder: 'hidden',
    })
    expect(splitterStore.leftPerc).toBe(100)
    expect(router.currentRoute.value.path).toBe('/editor')
  })

  it('preserves the empty animation, requested panes, and route when a future version is unsupported', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { animationReady, paneStore, playerStore, queryVersionStore, router, splitterStore } =
      await mountRoute('/editor?r=future-format&p0=untouched&v=999')
    const initialAnimation = structuredClone(toRaw(playerStore.raw().ROOT.value))
    await flushPromises()

    expect(playerStore.raw().ROOT.value).toEqual(initialAnimation)
    expect(paneStore.parents).toEqual({
      player: 'hidden',
      editor: 'left',
      timeline: 'hidden',
      concepts: 'right',
      builder: 'hidden',
    })
    expect(splitterStore.leftPerc).toBe(100)
    expect(router.currentRoute.value.fullPath).toBe('/editor?r=future-format&p0=untouched&v=999')
    expect(queryVersionStore.unsupportedVersion).toBe(999)
    expect(animationReady.value).toBe(false)
    expect(consoleWarn).toHaveBeenCalledWith(
      'Failed to load animation data from the route.',
      expect.objectContaining({ name: 'UnsupportedSpiroAnimQSVersionError', version: 999 }),
    )
  })

  it('maps short split routes and resets a persisted snapped splitter', async () => {
    localStorage.setItem('sa-splitter-main', JSON.stringify({ leftPerc: 100 }))

    const { paneStore, splitterStore } = await mountRoute('/edit-time', createLoadedAnimation())

    expect(paneStore.parents).toEqual({
      player: 'hidden',
      editor: 'left',
      timeline: 'right',
      concepts: 'hidden',
      builder: 'hidden',
    })
    expect(splitterStore.leftPerc).toBe(50)
  })

  it('replaces the app route with the current pane layout path', async () => {
    const { router } = await mountRoute('/app')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/play-vtg')
  })

  it('maps the Vulcan Tech Gospel route to the full-width Concepts pane', async () => {
    const { paneStore, conceptsStore, router, splitterStore } = await mountRoute(
      '/vulcan-tech-gospel',
      createLoadedAnimation(),
    )

    expect(paneStore.parents).toEqual({
      player: 'left',
      editor: 'hidden',
      timeline: 'hidden',
      concepts: 'right',
      builder: 'hidden',
    })
    expect(conceptsStore.selectedConcept).toBe('vtg')
    expect(splitterStore.leftPerc).toBe(0)
    expect(router.currentRoute.value.path).toBe('/vulcan-tech-gospel')
  })

  it('maps the legacy Quarter Spacing route to full-width VTG with QTR enabled', async () => {
    const { paneStore, conceptsStore, router, splitterStore } = await mountRoute(
      '/quarterspacing',
      createLoadedAnimation(),
    )
    await flushPromises()

    expect(paneStore.parents).toEqual({
      player: 'left',
      editor: 'hidden',
      timeline: 'hidden',
      concepts: 'right',
      builder: 'hidden',
    })
    expect(conceptsStore.selectedConcept).toBe('vtg')
    expect(conceptsStore.qtrEnabled).toBe(true)
    expect(splitterStore.leftPerc).toBe(0)
    expect(router.currentRoute.value.path).toBe('/vulcan-tech-gospel')
  })

  it('maps the Eight Step route to the full-width Eight Step pane', async () => {
    const { paneStore, conceptsStore, router, splitterStore } = await mountRoute(
      '/eight-step',
      createLoadedAnimation(),
    )

    expect(paneStore.parents).toEqual({
      player: 'left',
      editor: 'hidden',
      timeline: 'hidden',
      concepts: 'right',
      builder: 'hidden',
    })
    expect(conceptsStore.selectedConcept).toBe('8stp')
    expect(splitterStore.leftPerc).toBe(0)
    expect(router.currentRoute.value.path).toBe('/eight-step')

    conceptsStore.selectedConcept = 'vtg'
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/vulcan-tech-gospel')

    conceptsStore.selectedConcept = '8stp'
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/eight-step')
  })

  it('maps The Kinetic Alphabet route to its full-width Concepts pane', async () => {
    const { paneStore, conceptsStore, router, splitterStore } = await mountRoute(
      '/the-kinetic-alphabet',
      createLoadedAnimation(),
    )

    expect(paneStore.parents).toEqual({
      player: 'left',
      editor: 'hidden',
      timeline: 'hidden',
      concepts: 'right',
      builder: 'hidden',
    })
    expect(conceptsStore.selectedConcept).toBe('tka')
    expect(splitterStore.leftPerc).toBe(0)
    expect(router.currentRoute.value.path).toBe('/the-kinetic-alphabet')
  })

  it('maps the Quarter Space Tech route and short key to its Concepts pane', async () => {
    const { conceptsStore, paneStore, router, splitterStore } = await mountRoute(
      '/quarter-space-tech',
      createLoadedAnimation(),
    )

    expect(paneStore.parents).toEqual({
      player: 'left',
      editor: 'hidden',
      timeline: 'hidden',
      concepts: 'right',
      builder: 'hidden',
    })
    expect(conceptsStore.selectedConcept).toBe('qst')
    expect(splitterStore.leftPerc).toBe(0)
    expect(router.currentRoute.value.path).toBe('/quarter-space-tech')

    paneStore.setViewInPane('player', 'left')
    paneStore.setViewInPane('concepts', 'right')
    splitterStore.leftPerc = 50
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/play-qst')
  })

  it('canonicalizes a generic Concepts route and unsupported saved state to VTG', async () => {
    localStorage.setItem('sa-concepts', JSON.stringify({ selectedConcept: 'unknown' }))

    const { conceptsStore, router } = await mountRoute('/play-cnc', createLoadedAnimation())
    await flushPromises()

    expect(conceptsStore.selectedConcept).toBe('vtg')
    expect(router.currentRoute.value.path).toBe('/play-vtg')
  })

  it('canonicalizes the full Concepts route to VTG when no child has been saved', async () => {
    const { conceptsStore, router } = await mountRoute('/concepts', createLoadedAnimation())
    await flushPromises()

    expect(conceptsStore.selectedConcept).toBe('vtg')
    expect(router.currentRoute.value.path).toBe('/vulcan-tech-gospel')
  })
})
