import { describe, expect, it, vi } from 'vitest'

import { loadMobileDevTools } from '@/services/mobileDevTools'
import erudaScriptSource from 'eruda/eruda.js?url'
import type { Eruda } from 'eruda'

const mobileNavigator = {
  userAgent: 'Android',
  maxTouchPoints: 1,
}

describe('mobile development tools', () => {
  it('loads Eruda on mobile devices away from the production hostname', () => {
    const sourceDocument = document.implementation.createHTMLDocument()
    const init = vi.fn<Eruda['init']>()
    const sourceWindow = {
      location: { hostname: 'preview.example.test' },
      navigator: mobileNavigator,
      eruda: undefined as Pick<Eruda, 'init'> | undefined,
    }

    loadMobileDevTools(sourceWindow, sourceDocument)

    const script = sourceDocument.getElementById('spiroanim-eruda') as HTMLScriptElement
    expect(script.getAttribute('src')).toBe(erudaScriptSource)
    expect(script.src).not.toContain('cdn.jsdelivr.net')

    sourceWindow.eruda = {
      init,
    }
    script.onload?.(new Event('load'))
    expect(init).toHaveBeenCalledOnce()
  })

  it('does not load Eruda on spiroanim.com or desktop devices', () => {
    const productionDocument = document.implementation.createHTMLDocument()
    const desktopDocument = document.implementation.createHTMLDocument()

    loadMobileDevTools(
      {
        location: { hostname: 'spiroanim.com' },
        navigator: mobileNavigator,
      },
      productionDocument,
    )
    loadMobileDevTools(
      {
        location: { hostname: 'localhost' },
        navigator: { userAgent: 'Desktop', maxTouchPoints: 0 },
      },
      desktopDocument,
    )

    expect(productionDocument.scripts).toHaveLength(0)
    expect(desktopDocument.scripts).toHaveLength(0)
  })

  it('does not append a duplicate script while Eruda is loading', () => {
    const sourceDocument = document.implementation.createHTMLDocument()
    const sourceWindow = {
      location: { hostname: 'localhost' },
      navigator: mobileNavigator,
    }

    loadMobileDevTools(sourceWindow, sourceDocument)
    loadMobileDevTools(sourceWindow, sourceDocument)

    expect(sourceDocument.scripts).toHaveLength(1)
  })

  it('loads the local suite on desktop-identifying iPads', () => {
    const sourceDocument = document.implementation.createHTMLDocument()
    loadMobileDevTools(
      {
        location: { hostname: 'preview.example.test' },
        navigator: { userAgent: 'Macintosh', maxTouchPoints: 5 },
      },
      sourceDocument,
    )
    expect(sourceDocument.getElementById('spiroanim-eruda')?.getAttribute('src')).toBe(
      erudaScriptSource,
    )
  })

  it('reuses an existing Eruda instance without appending another script', () => {
    const sourceDocument = document.implementation.createHTMLDocument()
    const init = vi.fn<Eruda['init']>()
    loadMobileDevTools(
      { location: { hostname: 'localhost' }, navigator: mobileNavigator, eruda: { init } },
      sourceDocument,
    )
    expect(init).toHaveBeenCalledOnce()
    expect(sourceDocument.scripts).toHaveLength(0)
  })
})
