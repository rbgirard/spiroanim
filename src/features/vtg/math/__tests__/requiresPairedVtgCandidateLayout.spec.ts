import { describe, expect, it } from 'vitest'

import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { requiresPairedVtgCandidateLayout } from '@/features/vtg/math/requiresPairedVtgCandidateLayout'
import {
  applyVtgPropertySettings,
  createDefaultVtgPropertySettings,
} from '@/features/vtg/propertySettings'
import type { VtgCellReference } from '@/features/vtg/types'

const createCandidate = (reference: VtgCellReference) =>
  createDefaultVtgAnimation({ reference, speedRatio: '1:3' })

describe('requiresPairedVtgCandidateLayout', () => {
  it('keeps identical final paths in the shared layout', () => {
    const candidate = createCandidate('1-6')
    expect(requiresPairedVtgCandidateLayout(() => candidate)).toBe(false)
  })

  it('keeps strength-only settings in the shared layout when no auxiliary path is applied', () => {
    const settings = createDefaultVtgPropertySettings()
    settings.thirdOrder.settings = [{ strength: 50 }, {}]

    expect(
      requiresPairedVtgCandidateLayout((reference) => {
        const animation = createCandidate(reference)
        return animation && applyVtgPropertySettings(animation, settings)
      }, createCandidate),
    ).toBe(false)
  })

  it('uses the paired layout when final property settings affect the paths differently', () => {
    const settings = createDefaultVtgPropertySettings()
    settings.thirdOrder.settings = [{ initial: '1:3-pro', strength: 1, timing: '1:3-pro' }, {}]

    expect(
      requiresPairedVtgCandidateLayout((reference) => {
        const animation = createCandidate(reference)
        return animation && applyVtgPropertySettings(animation, settings)
      }, createCandidate),
    ).toBe(true)
  })
})
