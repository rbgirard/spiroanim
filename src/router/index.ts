import { createRouter, createWebHistory } from 'vue-router'

import { isBrowserSupported } from '@/services/browserSupport'

// TODO: This shouldn't be defined here. Its defined in legacy @/composables/SpiroAnim/useMainRoute
const paneNames = ['play', 'time', 'edit'] as const
const paneSplitAliases = paneNames.flatMap((left) =>
  paneNames.filter((right) => left !== right).map((right) => `/${left}-${right}`),
)

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/app',
      name: 'main',
      component: isBrowserSupported()
        ? () => import('@/views/SpiroAnim.vue')
        : () => import('@/views/BrowserSupport.vue'),
      alias: ['/', '/player', '/timeline', '/editor', ...paneSplitAliases],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFound.vue'),
    },
  ],
})

export default router
