import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSplitterStore } from '@/stores/useSplitterStore'

const activatePersistedPinia = () => {
  const pinia = createPinia().use(piniaPluginPersistedstate)
  createApp({}).use(pinia)
  setActivePinia(pinia)
}

describe('useSplitterStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('exposes the default dynamically named splitter contract', () => {
    const store = useSplitterStore('default')

    expect(store.leftPerc).toBe(50)
    expect(store.leftWidth).toBe(0)
    expect(store.leftHeight).toBe(0)
    expect(store.rightWidth).toBe(0)
    expect(store.rightHeight).toBe(0)
    expect(store.trackElements).toBeTypeOf('function')
  })

  it('supports custom pane names while preserving their inferred keys', () => {
    const store = useSplitterStore('editor', 'top', 'bottom')

    expect(store.topPerc).toBe(50)
    expect(store.topWidth).toBe(0)
    expect(store.topHeight).toBe(0)
    expect(store.bottomWidth).toBe(0)
    expect(store.bottomHeight).toBe(0)
  })

  it('hydrates only the dynamically named percentage', () => {
    localStorage.setItem('sa-splitter-persisted', JSON.stringify({ leftPerc: 35, leftWidth: 999 }))
    activatePersistedPinia()

    const store = useSplitterStore('persisted')

    expect(store.leftPerc).toBe(35)
    expect(store.leftWidth).toBe(0)
  })

  it('persists a custom first-pane percentage using its dynamic key', async () => {
    activatePersistedPinia()
    const store = useSplitterStore('custom-persisted', 'top', 'bottom')

    store.topPerc = 65
    await nextTick()

    expect(JSON.parse(localStorage.getItem('sa-splitter-custom-persisted')!)).toEqual({
      topPerc: 65,
    })
  })
})
