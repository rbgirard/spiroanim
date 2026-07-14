import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSpiroAnimKeyboard } from '@/composables/useSpiroAnimKeyboard'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useViewportStore } from '@/stores/useViewportStore'

describe('useSpiroAnimKeyboard', () => {
  let stop: (() => void) | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    stop?.()
    stop = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('toggles playback with Space on desktop', () => {
    const playerStore = usePlayerStore('main')
    playerStore.PLAYING = false
    vi.spyOn(useViewportStore(), 'isTouchDevice').mockReturnValue(false)
    stop = useSpiroAnimKeyboard()

    const event = new KeyboardEvent('keydown', { code: 'Space', cancelable: true })
    window.dispatchEvent(event)

    expect(playerStore.PLAYING).toBe(true)
    expect(event.defaultPrevented).toBe(true)
  })

  it('does not toggle playback on touch devices', () => {
    const playerStore = usePlayerStore('main')
    playerStore.PLAYING = false
    vi.spyOn(useViewportStore(), 'isTouchDevice').mockReturnValue(true)
    stop = useSpiroAnimKeyboard()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))

    expect(playerStore.PLAYING).toBe(false)
  })

  it('navigates frames with the left and right arrow keys', () => {
    const playerStore = usePlayerStore('main')
    const { CURRENT } = playerStore.raw()
    playerStore.UTIMES = [0, 10, 20]
    playerStore.INDEX = 1
    CURRENT.value = 15
    vi.spyOn(useViewportStore(), 'isTouchDevice').mockReturnValue(false)
    stop = useSpiroAnimKeyboard()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
    expect(CURRENT.value).toBe(10)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    expect(CURRENT.value).toBe(19)
  })

  it('ignores Space from interactive controls and held-key repeats', () => {
    const playerStore = usePlayerStore('main')
    playerStore.PLAYING = false
    vi.spyOn(useViewportStore(), 'isTouchDevice').mockReturnValue(false)
    stop = useSpiroAnimKeyboard()

    const input = document.createElement('input')
    document.body.append(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true }))

    expect(playerStore.PLAYING).toBe(false)
  })
})
