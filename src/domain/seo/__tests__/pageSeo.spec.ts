import { describe, expect, it } from 'vitest'

import { getPageSeo } from '@/domain/seo/pageSeo'

describe('page SEO metadata', () => {
  it('makes the prerendered public pages indexable', () => {
    expect(getPageSeo('/')).toMatchObject({ canonicalPath: '/', robots: 'index, follow' })
    expect(getPageSeo('/index')).toEqual(getPageSeo('/'))
    expect(getPageSeo('/about')).toMatchObject({
      canonicalPath: '/about',
      robots: 'index, follow',
    })
  })

  it('keeps application and unknown routes out of search indexes', () => {
    expect(getPageSeo('/app').robots).toBe('noindex, nofollow')
    expect(getPageSeo('/missing').robots).toBe('noindex, nofollow')
  })
})
