import '@/assets/styles/main.css'

import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory } from 'vue-router'

import { createSpiroAnimApp } from '@/createApp'
import { getPageSeo } from '@/domain/seo/pageSeo'
import { clientOnlyPaths } from '@/router'

export { clientOnlyPaths }

export async function render(url: string) {
  const parsedUrl = new URL(url, 'https://spiroanim.com')
  const { app, router } = createSpiroAnimApp(
    createMemoryHistory(import.meta.env.BASE_URL),
    'server',
  )

  await router.push(parsedUrl.pathname + parsedUrl.search)
  await router.isReady()

  return {
    appHtml: await renderToString(app),
    seo: getPageSeo(parsedUrl.pathname),
  }
}
