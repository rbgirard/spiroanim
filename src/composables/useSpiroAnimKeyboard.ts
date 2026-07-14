import { usePlayerStore } from '@/stores/usePlayerStore'
import { useViewportStore } from '@/stores/useViewportStore'
import { usePlayerFrameNavigation } from '@/composables/usePlayerFrameNavigation'

const interactiveSelector =
  'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"])'

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(interactiveSelector) !== null
}

export function useSpiroAnimKeyboard(): () => void {
  const viewportStore = useViewportStore()
  const playerStore = usePlayerStore('main')
  const { rewind, forward } = usePlayerFrameNavigation('main')

  return useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.repeat || viewportStore.isTouchDevice() || isInteractiveTarget(event.target)) {
      return
    }

    switch (event.code) {
      case 'Space':
        playerStore.PLAYING = !playerStore.PLAYING
        break
      case 'ArrowLeft':
        rewind()
        break
      case 'ArrowRight':
        forward()
        break
      default:
        return
    }

    event.preventDefault()
  })
}
