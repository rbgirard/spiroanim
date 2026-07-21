import '@/assets/styles/main.css'

// vueuse.org
// https://pictogrammers.com/library/mdi/
// https://vtg-v3.web.app/

import { createWebHistory } from 'vue-router'

import { createSpiroAnimApp } from '@/createApp'
import { initializePwaInstallPromptCapture } from '@/composables/usePwaInstall'
import { installClientSeoUpdates } from '@/services/pageSeo'

const container = document.querySelector<HTMLElement>('#app')
const mode = container?.dataset.prerendered === 'true' ? 'hydrate' : 'client'
const { app, router } = createSpiroAnimApp(createWebHistory(import.meta.env.BASE_URL), mode)

installClientSeoUpdates(router)
initializePwaInstallPromptCapture()

await router.isReady()
app.mount('#app')
