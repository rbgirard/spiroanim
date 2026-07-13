import { afterEach, describe, expect, it, vi } from 'vitest'

import { isBrowserSupported } from '@/services/browserSupport'

describe('isBrowserSupported', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('accepts a browser with the required rendering features', () => {
    const canvas = document.createElement('canvas')
    canvas.transferControlToOffscreen = vi.fn<() => OffscreenCanvas>()
    vi.spyOn(canvas, 'getContext').mockReturnValue({} as WebGL2RenderingContext)

    vi.spyOn(document, 'createElement').mockReturnValue(canvas)
    vi.stubGlobal('OffscreenCanvas', class OffscreenCanvas {})

    expect(isBrowserSupported()).toBe(true)
  })

  it('rejects a browser without WebGL 2 support', () => {
    const canvas = document.createElement('canvas')
    canvas.transferControlToOffscreen = vi.fn<() => OffscreenCanvas>()
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)

    vi.spyOn(document, 'createElement').mockReturnValue(canvas)
    vi.stubGlobal('OffscreenCanvas', class OffscreenCanvas {})

    expect(isBrowserSupported()).toBe(false)
  })
})
