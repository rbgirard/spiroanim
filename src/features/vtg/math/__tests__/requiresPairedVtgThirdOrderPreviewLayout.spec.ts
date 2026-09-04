import { describe, expect, it } from 'vitest'

import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { requiresPairedVtgThirdOrderPreviewLayout } from '@/features/vtg/math/requiresPairedVtgThirdOrderPreviewLayout'

describe('requiresPairedVtgThirdOrderPreviewLayout', () => {
  it('keeps ordinary 1:3 thumbnails shared without Third Order settings', () => {
    expect(requiresPairedVtgThirdOrderPreviewLayout('1:3', [{}, {}])).toBe(false)
  })

  it('keeps thumbnails shared when the final candidate changes are equivalent', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    expect(
      requiresPairedVtgThirdOrderPreviewLayout(
        '1:3',
        [{ initial: '1:3-pro', strength: 1, timing: '1:3-pro' }, {}],
        { mirror: true, createAnimation: () => structuredClone(animation) },
      ),
    ).toBe(false)
  })
})
