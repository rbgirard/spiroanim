import type { Router } from 'vue-router'

import { getPageSeo, SITE_ORIGIN, SOCIAL_IMAGE_URL } from '@/domain/seo/pageSeo'

function setMetaContent(selector: string, attributes: Record<string, string>, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
    document.head.appendChild(element)
  }
  element.content = content
}

function applyPageSeo(path: string) {
  const seo = getPageSeo(path)
  const canonicalUrl = new URL(seo.canonicalPath, SITE_ORIGIN).href
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  document.title = seo.title
  setMetaContent('meta[name="description"]', { name: 'description' }, seo.description)
  setMetaContent('meta[name="robots"]', { name: 'robots' }, seo.robots)
  setMetaContent('meta[property="og:title"]', { property: 'og:title' }, seo.title)
  setMetaContent('meta[property="og:description"]', { property: 'og:description' }, seo.description)
  setMetaContent('meta[property="og:type"]', { property: 'og:type' }, 'website')
  setMetaContent('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl)
  setMetaContent('meta[property="og:image"]', { property: 'og:image' }, SOCIAL_IMAGE_URL)

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = canonicalUrl
}

export function installClientSeoUpdates(router: Router) {
  router.afterEach((route) => applyPageSeo(route.path))
}
