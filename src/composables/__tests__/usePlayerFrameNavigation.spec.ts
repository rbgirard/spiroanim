import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePlayerFrameNavigation } from '@/composables/usePlayerFrameNavigation'
import { usePlayerStore } from '@/stores/usePlayerStore'

describe('usePlayerFrameNavigation', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('moves backward and forward using the existing frame-edge behavior', () => {
    const playerStore = usePlayerStore('frame-navigation')
    const { CURRENT } = playerStore.raw()
    const { rewind, forward } = usePlayerFrameNavigation('frame-navigation')
    playerStore.UTIMES = [0, 10, 20]
    playerStore.INDEX = 1
    CURRENT.value = 15

    rewind()
    expect(CURRENT.value).toBe(10)

    forward()
    expect(CURRENT.value).toBe(19)
  })

  it('does not navigate outside the active selection', () => {
    const playerStore = usePlayerStore('selection-navigation')
    const { CURRENT } = playerStore.raw()
    const { rewind, forward } = usePlayerFrameNavigation('selection-navigation')
    playerStore.UTIMES = [0, 10, 20, 30]
    playerStore.SELECTION = true
    playerStore.SELECTED = [1, 2]

    playerStore.INDEX = 1
    CURRENT.value = 10
    rewind()
    expect(CURRENT.value).toBe(10)

    playerStore.INDEX = 1
    CURRENT.value = 19
    forward()
    expect(CURRENT.value).toBe(19)
  })
})
