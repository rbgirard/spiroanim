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
    expect(wrapper.get<HTMLElement>('.selection-fill').element.style.insetInlineStart).toBe('0%')
    expect(wrapper.get<HTMLElement>('.selection-fill').element.style.insetInlineEnd).toBe('62.5%')
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

  it('fills only the selected range and allows the handles to cross', async () => {
    const store = usePlayerStore('progress-selection-crossing')
    store.UTIMES = [0, 1000, 2000, 3000, 4000]
    store.COUNT = 4
    store.SELECTED = [1, 3]
    store.SELECTION = true
    const wrapper = mountProgress('progress-selection-crossing')
    const fill = wrapper.get<HTMLElement>('.selection-fill')
    const start = wrapper.get<HTMLInputElement>('input[aria-label="Selection start"]')

    expect(fill.element.style.insetInlineStart).toBe('25%')
    expect(fill.element.style.insetInlineEnd).toBe('25%')

    await start.trigger('pointerdown')
    await start.setValue(4)
    expect(store.SELECTED).toEqual([3, 4])
    expect(start.element.value).toBe('4')

    await start.trigger('pointerup')
    expect(start.element.value).toBe('3')
    expect(fill.element.style.insetInlineStart).toBe('75%')
    expect(fill.element.style.insetInlineEnd).toBe('0%')
  })

  it('keeps the stationary handle in place when the end handle crosses it', async () => {
    const store = usePlayerStore('progress-end-crossing')
    store.UTIMES = [0, 1000, 2000, 3000, 4000]
    store.COUNT = 4
    store.SELECTED = [1, 3]
    store.SELECTION = true
    const wrapper = mountProgress('progress-end-crossing')
    const start = wrapper.get<HTMLInputElement>('input[aria-label="Selection start"]')
    const end = wrapper.get<HTMLInputElement>('input[aria-label="Selection end"]')

    // Thumb identity must not depend on separate pointer event bookkeeping.
    await end.setValue(0)

    expect(store.SELECTED).toEqual([0, 1])
    expect(start.element.value).toBe('1')
    expect(end.element.value).toBe('0')
  })

  it('synchronizes its handles when selection mode mutates the range in place', async () => {
    const store = usePlayerStore('progress-mode-switch')
    store.UTIMES = [0, 1000, 2000, 3000, 4000]
    store.COUNT = 4
    const wrapper = mountProgress('progress-mode-switch')

    store.SELECTION = true
    store.SELECTED[0] = 2
    store.SELECTED[1] = 4
    await nextTick()

    expect(wrapper.get<HTMLInputElement>('input[aria-label="Selection start"]').element.value).toBe(
      '2',
    )
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Selection end"]').element.value).toBe(
      '4',
    )
    expect(wrapper.get<HTMLElement>('.selection-fill').element.style.insetInlineStart).toBe('50%')
    expect(wrapper.get<HTMLElement>('.selection-fill').element.style.insetInlineEnd).toBe('0%')

    store.SELECTION = false
    await nextTick()
    store.SELECTION = true
    store.SELECTED[0] = 1
    store.SELECTED[1] = 2
    await nextTick()

    expect(wrapper.get<HTMLInputElement>('input[aria-label="Selection start"]').element.value).toBe(
      '1',
    )
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Selection end"]').element.value).toBe(
      '2',
    )
    expect(wrapper.get<HTMLElement>('.selection-fill').element.style.insetInlineStart).toBe('25%')
    expect(wrapper.get<HTMLElement>('.selection-fill').element.style.insetInlineEnd).toBe('50%')
  })
})
