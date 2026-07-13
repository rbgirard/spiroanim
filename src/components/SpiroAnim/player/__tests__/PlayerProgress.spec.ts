import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import PlayerProgress from '@/components/SpiroAnim/player/PlayerProgress.vue'
import { usePlayerStore } from '@/stores/usePlayerStore'

describe('PlayerProgress', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  function mountProgress(id: string) {
    return mount(PlayerProgress, {
      props: { store: id },
      global: {
        provide: {
          dim: { width: 600, height: 400 },
        },
      },
    })
  }

  it('updates the current position and reports the modification', async () => {
    const store = usePlayerStore('progress-position')
    store.MAX = 2000
    const update = store.UPDATE
    const wrapper = mountProgress('progress-position')
    const slider = wrapper.get<HTMLInputElement>('input[aria-label="Animation position"]')

    await slider.setValue(750)

    expect(store.raw().CURRENT.value).toBe(750)
    expect(store.UPDATE).not.toBe(update)
    expect(slider.attributes('max')).toBe('2000')
  })

  it('pauses during interaction and resumes only when it was already playing', async () => {
    const store = usePlayerStore('progress-playback')
    const wrapper = mountProgress('progress-playback')
    const slider = wrapper.get('input[aria-label="Animation position"]')

    store.PLAYING = true
    await slider.trigger('pointerdown')
    expect(store.PLAYING).toBe(false)
    await slider.trigger('pointerup')
    expect(store.PLAYING).toBe(true)

    store.PLAYING = false
    await slider.trigger('pointerdown')
    await slider.trigger('pointerup')
    expect(store.PLAYING).toBe(false)
  })

  it('uses frame indices in selection mode and preserves the endpoint timing rule', async () => {
    const store = usePlayerStore('progress-selection')
    store.UTIMES = [0, 1000, 2000]
    store.COUNT = 2
    store.SELECTED = [0, 1]
    store.SELECTION = true
    const wrapper = mountProgress('progress-selection')
    const start = wrapper.get<HTMLInputElement>('input[aria-label="Selection start"]')
    const end = wrapper.get<HTMLInputElement>('input[aria-label="Selection end"]')

    expect(end.attributes('max')).toBe('2')

    await end.setValue(2)
    expect(store.SELECTED).toEqual([0, 2])
    expect(store.raw().CURRENT.value).toBe(1999)

    await start.setValue(1)
    expect(store.SELECTED).toEqual([1, 2])
    expect(store.raw().CURRENT.value).toBe(1000)
  })
})
