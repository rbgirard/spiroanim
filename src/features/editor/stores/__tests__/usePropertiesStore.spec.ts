import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useProperties } from '@/features/editor/composables/useProperties'
import { usePropertiesStore } from '@/features/editor/stores/usePropertiesStore'
import { usePlayerStore } from '@/stores/usePlayerStore'

const activatePersistedPinia = () => {
  const pinia = createPinia().use(piniaPluginPersistedstate)
  createApp({}).use(pinia)
  setActivePinia(pinia)
}

describe('usePropertiesStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  async function createPopulatedStore(id: string) {
    const player = usePlayerStore(id)
    const runtime = player.raw()
    runtime.ROOT.value = {
      ...runtime.ROOT.value,
      bpm: 60,
      props: [{ anim: [{ arc: 45, beats: 1 }, { beats: 1 }] }],
    }
    await nextTick()
    return { player, properties: usePropertiesStore(id) }
  }

  it('derives the active property and animation from the player selection', async () => {
    const { properties } = await createPopulatedStore('editor-selection')

    expect(properties.ACTIVE).toEqual([0])
    expect(properties.PROPS).toHaveLength(1)
    expect(properties.ANIMS).toHaveLength(1)
    expect(properties.IDENT).toEqual([{ prop: 0, index: 0 }])
    expect(properties.ARCDENOM).toBe(45)

    properties.pBOUND = false
    usePlayerStore('editor-selection').SELECTION = true
    usePlayerStore('editor-selection').SELECTED = [0, 1]
    await nextTick()

    expect(properties.ANIMS).toHaveLength(2)
    expect(properties.IDENT).toEqual([
      { prop: 0, index: 0 },
      { prop: 0, index: 1 },
    ])
  })

  it('updates the selected animation through the editor composable', async () => {
    const { player } = await createPopulatedStore('editor-update')
    const editor = useProperties('editor-update')
    player.PLAYING = false

    editor.animSet('beats', 2)

    expect(player.raw().ROOT.value.props[0]!.anim[0]!.beats).toBe(2)
    expect(editor.animGet('beats')).toEqual([2, true, '2', false])
  })

  it('hydrates only the documented editor preferences', () => {
    localStorage.setItem(
      'sa-properties-editor-persisted',
      JSON.stringify({
        pBOUND: false,
        pMULTI: true,
        pDESKTOP: { root: [] },
        pSELECTED: { 4: true },
      }),
    )
    activatePersistedPinia()

    const store = usePropertiesStore('editor-persisted')

    expect(store.pBOUND).toBe(false)
    expect(store.pMULTI).toBe(true)
    expect(store.pDESKTOP.root).toEqual([])
    expect(store.pDESKTOP.anim).toEqual(['anim'])
    expect(store.pSELECTED).toEqual({ 0: true })
  })
})
