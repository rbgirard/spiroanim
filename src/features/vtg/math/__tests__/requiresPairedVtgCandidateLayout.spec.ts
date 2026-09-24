import { describe, expect, it, vi } from 'vitest'

import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { requiresPairedVtgCandidateLayout } from '@/features/vtg/math/requiresPairedVtgCandidateLayout'
import {
  applyVtgPropertySettings,
  createDefaultVtgPropertySettings,
} from '@/features/vtg/propertySettings'
import type { VtgCellReference } from '@/features/vtg/types'
import { shiftVtgStartingBeat } from '@/features/vtg/math/shiftVtgStartingBeat'
import { resolveAnimationFrames } from '@/math/animation/frameSemantics'

const createCandidate = (reference: VtgCellReference) =>
  createDefaultVtgAnimation({ reference, speedRatio: '1:3' })

describe('requiresPairedVtgCandidateLayout', () => {
  it('keeps identical final paths in the shared layout', () => {
    const candidate = createCandidate('1-6')
    expect(requiresPairedVtgCandidateLayout(() => candidate)).toBe(false)
  })

  it('only generates the representative pair', () => {
    const create = vi.fn<typeof createCandidate>(createCandidate)
    requiresPairedVtgCandidateLayout(create)
    expect(create.mock.calls).toEqual([['1-6'], ['2-6']])
  })

  it('distinguishes prop curves with identical hand paths and authored endpoints', () => {
    const original = createCandidate('1-6')!
    const candidate = (turns: number) => ({
      ...original,
      props: original.props.map((prop) => ({
        ...prop,
        anim: [
          { ...prop.anim[0]!, arc: 0, turns: 0 },
          { arc: 0, turns },
        ],
      })),
    })
    expect(
      requiresPairedVtgCandidateLayout((reference) => candidate(reference === '1-6' ? 0 : 360)),
    ).toBe(true)
  })

  it('ignores a different starting point and repeated traversal of the same closed path', () => {
    const original = createCandidate('1-6')!
    const shifted = shiftVtgStartingBeat(original, 2)!
    const repeated = {
      ...shifted,
      props: shifted.props.map((prop) => {
        const frames = resolveAnimationFrames(prop.anim)
        return { ...prop, anim: [...frames, ...frames.slice(1)] }
      }),
    }
    expect(
      requiresPairedVtgCandidateLayout((reference) => (reference === '1-6' ? original : repeated)),
    ).toBe(false)
  })

  it('keeps strength-only settings in the shared layout when no auxiliary path is applied', () => {
    const settings = createDefaultVtgPropertySettings()
    settings.thirdOrder.settings = [{ strength: 50 }, {}]

    expect(
      requiresPairedVtgCandidateLayout((reference) => {
        const animation = createCandidate(reference)
        return animation && applyVtgPropertySettings(animation, settings)
      }),
    ).toBe(false)
  })

  it('uses the paired layout when final property settings affect the paths differently', () => {
    const settings = createDefaultVtgPropertySettings()
    settings.thirdOrder.settings = [{ initial: '1:3-pro', strength: 1, timing: '1:3-pro' }, {}]

    expect(
      requiresPairedVtgCandidateLayout((reference) => {
        const animation = createCandidate(reference)
        return animation && applyVtgPropertySettings(animation, settings)
      }),
    ).toBe(true)
  })
})

it.each([
  ['1:1', false],
  ['1:2', true],
  ['1:3', false],
  ['1:4', true],
  ['1:5', false],
  ['2:1', true],
  ['2:3', true],
  ['2:5', true],
  ['1:1v3', false],
  ['1:1v2', true],
  ['1:1v2:3', true],
  ['1:7', false],
  ['2:7', true],
] as const)('compares the actual paths for %s', (speedRatio, expected) => {
  expect(
    requiresPairedVtgCandidateLayout((reference) =>
      createDefaultVtgAnimation({ reference, speedRatio }),
    ),
  ).toBe(expected)
})
