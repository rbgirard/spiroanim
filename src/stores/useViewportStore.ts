import { useDocumentVisibility } from '@vueuse/core'
import { debounceImmediate } from '@/utils/UtilFunc'

export const useViewportStore = defineStore(
  'sa-viewport',
  () => {
    const debounceDelay = 50
    const visibility = useDocumentVisibility()

    const viewWidth = ref(window.visualViewport?.width || window.innerWidth)
    const viewHeight = ref(window.visualViewport?.height || window.innerHeight)
    const pixelRatio = ref(window.devicePixelRatio)

    const isLandscape = computed(() => viewWidth.value > viewHeight.value)
    const isVisible = computed(() => visibility.value === 'visible')

    /*
    // TODO: something like (and in btn/FullScreen.vue)
    function getDeviceContext() {
      const ua = navigator.userAgent
      const legacyMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)

      const modernIPad = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
      const platform = (navigator as Navigator & { platform?: string }).platform
      const isTouchMac = platform === 'MacIntel' && navigator.maxTouchPoints > 1

      const isIOS = /iPhone|iPad|iPod/.test(ua)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches

      const isTouch = legacyMobile || modernIPad
      const isLikelyIPad = isTouchMac || modernIPad || /iPad/.test(ua)

      return {
        isTouch,
        isStandalone,
        isLikelyIPad,
        isIOS,
      }
    }

    const { isTouch, isStandalone, isLikelyIPad } = getDeviceContext()
    */

    function isTouchDevice() {
      const ua = navigator.userAgent
      const legacyMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      const modernIPad = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
      return legacyMobile || modernIPad
    }

    const showTooltips = ref(!isTouchDevice())

    function updateViewSize() {
      viewWidth.value = window.visualViewport?.width || window.innerWidth
      viewHeight.value = window.visualViewport?.height || window.innerHeight
      pixelRatio.value = window.devicePixelRatio
    }

    useEventListener(
      window.visualViewport,
      'resize',
      debounceImmediate(updateViewSize, debounceDelay),
    )

    // Watch for pixelRatio changes independent of resize
    let lastPixelRatio = window.devicePixelRatio
    setInterval(() => {
      const current = window.devicePixelRatio
      if (current !== lastPixelRatio) {
        lastPixelRatio = current
        pixelRatio.value = current
      }
    }, 1000) // adjust frequency as needed

    return {
      viewWidth: readonly(viewWidth),
      viewHeight: readonly(viewHeight),
      pixelRatio: readonly(pixelRatio),
      isLandscape: readonly(isLandscape),
      isVisible: readonly(isVisible),
      showTooltips,
      isTouchDevice,
      updateViewSize,
    }
  },
  {
    persist: {
      pick: ['showTooltips'],
    },
  },
)
