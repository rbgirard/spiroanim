import { useAppDisplayMode } from '@/composables/useAppDisplayMode'

interface InstallPromptChoice {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

interface DeferredInstallPrompt extends Event {
  platforms: string[]
  prompt: () => Promise<void>
  userChoice: Promise<InstallPromptChoice>
}

function isDeferredInstallPrompt(event: Event): event is DeferredInstallPrompt {
  return (
    'prompt' in event &&
    typeof event.prompt === 'function' &&
    'userChoice' in event &&
    event.userChoice instanceof Promise
  )
}

export function usePwaInstall() {
  const { isInstalledDisplay, isIos } = useAppDisplayMode()
  const deferredPrompt = shallowRef<DeferredInstallPrompt>()
  const installedThisSession = ref(false)

  const isInstalled = computed(() => isInstalledDisplay.value || installedThisSession.value)
  const canPromptInstall = computed(() => !isInstalled.value && deferredPrompt.value !== undefined)
  const canShowIosInstructions = computed(
    () => !isInstalled.value && isIos.value && deferredPrompt.value === undefined,
  )

  function handleInstallPrompt(event: Event) {
    if (!isDeferredInstallPrompt(event)) return

    event.preventDefault()
    deferredPrompt.value = event
  }

  function handleInstalled() {
    installedThisSession.value = true
    deferredPrompt.value = undefined
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
    window.removeEventListener('appinstalled', handleInstalled)
  })

  async function promptInstall(): Promise<InstallPromptChoice | undefined> {
    const prompt = deferredPrompt.value
    if (!prompt) return undefined

    await prompt.prompt()
    const choice = await prompt.userChoice
    deferredPrompt.value = undefined
    if (choice.outcome === 'accepted') installedThisSession.value = true

    return choice
  }

  return {
    canPromptInstall: readonly(canPromptInstall),
    canShowIosInstructions: readonly(canShowIosInstructions),
    isInstalled: readonly(isInstalled),
    promptInstall,
  }
}
