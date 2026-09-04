import { createRouter, type RouteRecordRaw, type RouterHistory } from 'vue-router'

import { paneSplits } from '@/composables/useMainRoute'
import { isBrowserSupported } from '@/services/browserSupport'

const appRouteAliases = [
  '/player',
  '/timeline',
  '/editor',
  '/concepts',
  '/vulcan-tech-gospel',
  '/quarterspacing',
  '/eight-step',
  '/quarter-space-tech',
  '/the-kinetic-alphabet',
  ...paneSplits,
]

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingPage.vue'),
    alias: '/index',
  },
  {
    path: '/app',
    name: 'main',
    component: () =>
      isBrowserSupported() ? import('@/views/SpiroAnim.vue') : import('@/views/BrowserSupport.vue'),
    alias: appRouteAliases,
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutPage.vue'),
  },
  {
    path: '/tips',
    name: 'tips',
    component: () => import('@/views/TipsPage.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
  },
]

export const clientOnlyPaths = ['/app', ...appRouteAliases]

export function createAppRouter(history: RouterHistory) {
  return createRouter({ history, routes })
}
