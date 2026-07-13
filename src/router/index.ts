import { createRouter, createWebHistory } from 'vue-router'

import { paneSplits } from '@/composables/useMainRoute'
import { isBrowserSupported } from '@/services/browserSupport'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  //history: createWebHistory('/spiroanim/'), // Replace with your subdirectory path
  routes: [
    {
      path: '/app',
      name: 'main',
      component: isBrowserSupported()
        ? () => import('@/views/SpiroAnim.vue')
        : () => import('@/views/BrowserSupport.vue'),
      alias: ['/', '/player', '/timeline', '/editor', ...paneSplits],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFound.vue'),
    },
  ],
})

export default router
