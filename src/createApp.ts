import { createApp, createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import type { RouterHistory } from 'vue-router'

import App from '@/App.vue'
import { createAppRouter } from '@/router'

export type AppRenderMode = 'client' | 'hydrate' | 'server'

export function createSpiroAnimApp(history: RouterHistory, mode: AppRenderMode) {
  const app = mode === 'client' ? createApp(App) : createSSRApp(App)
  const pinia = createPinia()
  const router = createAppRouter(history)

  if (mode !== 'server') pinia.use(piniaPluginPersistedstate)

  app.use(pinia)
  app.use(router)

  return { app, pinia, router }
}
