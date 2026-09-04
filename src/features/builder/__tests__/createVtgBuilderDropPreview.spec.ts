import { describe, expect, it } from 'vitest'

import {
  appendVtgBuilderPattern,
  insertVtgBuilderPattern,
} from '@/features/builder/appendVtgBuilderPattern'
import { createVtgBuilderDropPreview } from '@/features/builder/createVtgBuilderDropPreview'
import { getVtgBuilderMotion } from '@/features/builder/describeVtgBuilderMotion'
import { describePatternRelationships } from '@/features/concepts/math/describePatternRelationships'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { createVtgTransitionPreviewAnimations } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { prepareVtg45TransitionPattern } from '@/features/vtg/math/prepareVtg45TransitionPattern'
import type { QtrPatternSelection, VtgPatternSelection } from '@/features/vtg/types'
import { rootCompile } from '@/math/animation/AnimFunc'

const createTwoPortionPattern = () => {
  const first = createDefaultVtgAnimation({ reference: '5-6', speedRatio: '1:3' })
  const result = first
    ? appendVtgBuilderPattern(first, { reference: '2-3', speedRatio: '1:3' })
    : undefined
  if (!result) throw new Error('Expected a two-portion Builder pattern')
  return result
}

describe('createVtgBuilderDropPreview', () => {
  const selection = {
    reference: '6-2',
    speedRatio: '1:3',
    reversePlane: true,
  } as const satisfies VtgPatternSelection

  it('uses the standalone pattern for the first insertion target', () => {
    const source = createTwoPortionPattern()
    const preview = createVtgBuilderDropPreview(source, selection, 0)
    const standalone = createDefaultVtgAnimation(selection)

    expect(preview).toEqual(standalone)
    expect(JSON.stringify(source)).toBe(JSON.stringify(createTwoPortionPattern()))
  })

  it('returns the portion produced by insertion before an existing target', () => {
    const source = createTwoPortionPattern()
    const prepared = prepareVtg45TransitionPattern(source)
    if (!prepared.supported) throw new Error('Expected a supported Builder pattern')
    const inserted = insertVtgBuilderPattern(prepared.pattern, selection, 1)
    if (!inserted) throw new Error('Expected insertion before the second portion')

    const expected = createVtgTransitionPreviewAnimations(inserted)?.[1]
    const preview = createVtgBuilderDropPreview(source, selection, 1)

    expect(preview).toEqual(expected)
    expect(preview && getVtgBuilderMotion(preview)).toEqual(
      expected && getVtgBuilderMotion(expected),
    )
  })

  it('returns the appended portion for the trailing drop target', () => {
    const source = createTwoPortionPattern()
    const appended = appendVtgBuilderPattern(source, selection)
    if (!appended) throw new Error('Expected an appended Builder portion')

    const expected = createVtgTransitionPreviewAnimations(appended)?.[2]
    const preview = createVtgBuilderDropPreview(source, selection, 2)

    expect(preview).toEqual(expected)
    expect(createVtgBuilderDropPreview(source, selection, 3)).toBeUndefined()
  })

  it('uses the native two-cycle 45 degree duration for Third Order 2:* previews', () => {
    const source = createTwoPortionPattern()
    const standalone = createVtgBuilderDropPreview(source, selection, 0, {
      minimumCycleCount: 2,
      thirdOrder: {
        settings: [{ strength: 55, timing: '2:3-anti' }, {}],
        mirror: true,
        opposed: false,
      },
    })
    const inserted = createVtgBuilderDropPreview(source, selection, 1, {
      minimumCycleCount: 2,
    })

    expect(standalone?.props[0]?.anim).toHaveLength(17)
    expect(inserted?.props[0]?.anim).toHaveLength(17)
    expect(standalone?.props[0]?.anim[0]?.strength).toBe(550)
    expect(standalone?.props[0]?.anim[1]?.warp).toBeTypeOf('number')
    expect(standalone?.props[0]?.anim.slice(2).every((frame) => frame.warp === undefined)).toBe(
      true,
    )
  })

  it('renders inherited Third Order values at a later insertion point', () => {
    const source = createTwoPortionPattern()
    source.props[0]!.anim[0] = {
      ...source.props[0]!.anim[0],
      warp: 90,
      strength: 650,
    }
    const preview = createVtgBuilderDropPreview(source, selection, 1)
    if (!preview) throw new Error('Expected a contextual Builder preview')

    expect(rootCompile(preview).props[0]?.anim[0]).toMatchObject({
      warp: 90,
      strength: 650,
    })
  })

  it('rebases the candidate relationships onto later insertion targets', () => {
    const source = createTwoPortionPattern()
    const candidate = { reference: '1-1', speedRatio: '1:3' } as const
    const first = createVtgBuilderDropPreview(source, candidate, 0)
    const second = createVtgBuilderDropPreview(source, candidate, 1)
    const trailing = createVtgBuilderDropPreview(source, candidate, 2)
    if (!first || !second || !trailing) throw new Error('Expected all contextual previews')

    expect(describePatternRelationships(first).label).toBe('TS / TS')
    expect(describePatternRelationships(second).label).toBe('TS / SS')
    expect(describePatternRelationships(trailing).label).toBe('TS / SS')
  })

  it('builds Quarter previews for standalone and contextual insertion targets', () => {
    const source = createTwoPortionPattern()
    const quarterSelection = {
      reference: '1-1',
      speedRatio: '1:3',
      quarters: 1,
    } as const satisfies QtrPatternSelection
    const standalone = createVtgBuilderDropPreview(source, quarterSelection, 0)
    const contextual = createVtgBuilderDropPreview(source, quarterSelection, 1)
    const expectedStandalone = createDefaultQtrAnimation(quarterSelection)
    const inserted = insertVtgBuilderPattern(source, quarterSelection, 1)
    const expectedContextual = inserted
      ? createVtgTransitionPreviewAnimations(inserted)?.[1]
      : undefined

    expect(standalone).toEqual(expectedStandalone)
    expect(contextual).toEqual(expectedContextual)
    expect(contextual).toBeDefined()
  })
})
