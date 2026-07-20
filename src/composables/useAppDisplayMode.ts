import { useMediaQuery } from '@vueuse/core'

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent
  const isIosDevice = /iPhone|iPad|iPod/.test(userAgent)
  const isTouchMac = userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1

  return isIosDevice || isTouchMac
}

function detectIosStandalone(): boolean {
  if (typeof navigator === 'undefined') return false

  return Reflect.get(navigator, 'standalone') === true
}

export function useAppDisplayMode() {
  const standalone = useMediaQuery('(display-mode: standalone)')
  const fullscreen = useMediaQuery('(display-mode: fullscreen)')
  const minimalUi = useMediaQuery('(display-mode: minimal-ui)')
  const windowControlsOverlay = useMediaQuery('(display-mode: window-controls-overlay)')
  const isIos = ref(false)
  const iosStandalone = ref(false)

  onMounted(() => {
    isIos.value = detectIos()
    iosStandalone.value = detectIosStandalone()
  })

  const isInstalledDisplay = computed(
    () =>
      standalone.value ||
      fullscreen.value ||
      minimalUi.value ||
      windowControlsOverlay.value ||
      iosStandalone.value,
  )

  return {
    isInstalledDisplay: readonly(isInstalledDisplay),
    isIos: readonly(isIos),
  }
}
