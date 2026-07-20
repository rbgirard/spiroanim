// vueuse.org
// https://pictogrammers.com/library/mdi/
// https://vtg-v3.web.app/

import '@/assets/styles/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import { initializePwaInstallPromptCapture } from '@/composables/usePwaInstall'

import App from './App.vue'
import router from './router'

initializePwaInstallPromptCapture()

const app = createApp(App)

const pinia = createPinia()

pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)

app.mount('#app')
