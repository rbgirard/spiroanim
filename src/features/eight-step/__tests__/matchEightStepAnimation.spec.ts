import { describe, expect, it } from 'vitest'

import {
  createDefaultEightStepAnimation,
  eightStepPlaybackMultiplier,
} from '@/features/eight-step/createEightStepAnimation'
import {
  findEightStepPatternMatch,
  matchesEightStepSelection,
} from '@/features/eight-step/matchEightStepAnimation'
import { eightStepPatternDefinitions } from '@/features/eight-step/data/eightStepPatternDefinitions'
import { applyVtgPropRotationOffsets } from '@/features/vtg/createVtgAnimation'
import { applyVtgBuilderScaleSettings } from '@/features/builder/applyVtgBuilderScaleSettings'
import { applyVtgTwistSettings } from '@/features/vtg/applyVtgTwistSettings'
import { applyVtgFoldSettings } from '@/features/vtg/applyVtgFoldSettings'
import { prepareVtg45TransitionPattern } from '@/features/vtg/math/prepareVtg45TransitionPattern'
import { createVtgTransitionPreviewAnimations } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { applyVtgBuilderPortionProperties } from '@/features/builder/editVtgBuilderPortionProperties'
import { consolidateAnimationPlayback } from '@/math/animation/subdivideAnimationPlayback'
import { rootCompile } from '@/math/animation/AnimFunc'

describe('matchEightStepAnimation', () => {
  it.each([false, true])('recovers every Eight Step cell with Halve %s', (halve) => {
    for (const definition of eightStepPatternDefinitions) {
      const selection = {
        concept: '8stp',
        reference: definition.reference,
        ...(halve ? { halve: true } : undefined),
      } as const
      const animation = createDefaultEightStepAnimation(selection)
      const match = animation ? findEightStepPatternMatch(animation) : undefined

      expect({ reference: definition.reference, match }).toMatchObject({
        reference: definition.reference,
        match: {
          reference: definition.reference,
          ...(halve ? { halve: true } : undefined),
        },
      })
      expect(animation && matchesEightStepSelection(animation, selection)).toBe(true)
    }
  })

  it('recovers the cell and transforms from compiled geometry', () => {
    const selection = {
      concept: '8stp',
      reference: '7-IE',
      swapProps: true,
      reversePlane: true,
      shape: 'diamond',
      bpm: 91,
      scale: 1.1,
    } as const
    const animation = createDefaultEightStepAnimation(selection)

    expect(animation).toBeDefined()
    if (!animation) return

    expect(findEightStepPatternMatch(animation)).toEqual({
      reference: '7-IE',
      swapProps: true,
      reversePlane: true,
      shape: 'diamond',
      bpm: 91,
      scale: 1.1,
    })
    expect(matchesEightStepSelection(animation, selection)).toBe(true)
  })

  it('recovers the Box shape mode', () => {
    const selection = {
      concept: '8stp',
      reference: '6-AI',
      swapProps: true,
      reversePlane: true,
      shape: 'box',
      bpm: 87,
      scale: 1.3,
    } as const
    const animation = createDefaultEightStepAnimation(selection)

    expect(animation).toBeDefined()
    if (!animation) return

    expect(findEightStepPatternMatch(animation)).toEqual({
      reference: '6-AI',
      swapProps: true,
      reversePlane: true,
      shape: 'box',
      bpm: 87,
      scale: 1.3,
    })
    expect(matchesEightStepSelection(animation, selection)).toBe(true)
  })

  it('recovers the Turned shape mode', () => {
    const selection = {
      concept: '8stp',
      reference: '6-AI',
      swapProps: true,
      reversePlane: true,
      shape: 'turned',
      bpm: 87,
      scale: 1.3,
    } as const
    const animation = createDefaultEightStepAnimation(selection)
    if (!animation) throw new Error('Expected a supported Eight Step animation')

    expect(findEightStepPatternMatch(animation)).toEqual({
      reference: '6-AI',
      swapProps: true,
      reversePlane: true,
      shape: 'turned',
      bpm: 87,
      scale: 1.3,
    })
    expect(matchesEightStepSelection(animation, selection)).toBe(true)
  })

  it('recovers the Halve option', () => {
    const selection = {
      concept: '8stp',
      reference: '6-AI',
      halve: true,
      bpm: 87,
      scale: 1.3,
    } as const
    const animation = createDefaultEightStepAnimation(selection)

    expect(animation).toBeDefined()
    if (!animation) return

    expect(findEightStepPatternMatch(animation)).toEqual({
      reference: '6-AI',
      swapProps: false,
      reversePlane: false,
      shape: 'diamond',
      halve: true,
      bpm: 87,
      scale: 1.3,
    })
    expect(matchesEightStepSelection(animation, selection)).toBe(true)
  })

  it('ignores player-only rendering settings when matching geometry', () => {
    const animation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '3-EI',
      thick: 13,
      paths: false,
      hands: true,
      arms: false,
    })

    expect(animation).toBeDefined()
    expect(animation && findEightStepPatternMatch(animation)?.reference).toBe('3-EI')
  })

  it('recovers Viewer prop rotation offsets without losing the Eight-Step match', () => {
    const selection = {
      concept: '8stp',
      reference: '4-EE',
      swapProps: true,
      reversePlane: false,
      shape: 'diamond',
    } as const
    const base = createDefaultEightStepAnimation(selection)
    expect(base).toBeDefined()
    if (!base) return

    const animation = applyVtgPropRotationOffsets(base, [23, -37])

    expect(findEightStepPatternMatch(animation)).toEqual({
      reference: '4-EE',
      swapProps: true,
      reversePlane: false,
      shape: 'diamond',
      bpm: animation.bpm / eightStepPlaybackMultiplier,
      scale: 0.8,
      propRotationOffsets: [23, -37],
    })
    expect(
      matchesEightStepSelection(animation, { ...selection, propRotationOffsets: [23, -37] }),
    ).toBe(true)
    expect(matchesEightStepSelection(animation, selection)).toBe(false)
  })

  it('ignores Viewer Scale, Twist, Yaw, and Rotate properties when identifying choreography', () => {
    const selection = {
      concept: '8stp',
      reference: '8-II',
      swapProps: false,
      reversePlane: true,
      shape: 'box',
    } as const
    const base = createDefaultEightStepAnimation(selection)
    expect(base).toBeDefined()
    if (!base) return

    const scaled = applyVtgBuilderScaleSettings(base, 'advanced', [{ 0: 1.1, 2: 0.7 }, { 1: 1.3 }])
    const twisted = applyVtgTwistSettings(scaled, 'advanced', [{ 0.5: 45, 3: -90 }, { 1.5: 120 }])
    const customized = applyVtgFoldSettings(twisted, [
      { 0: { yaw: 45, rotate: 180 }, 2: { yaw: -15 } },
      { 1: { yaw: -30 }, 3: { rotate: -90 } },
    ])

    expect(findEightStepPatternMatch(customized)).toMatchObject({
      reference: '8-II',
      swapProps: false,
      reversePlane: true,
      shape: 'box',
    })
  })

  it('matches after Viewer properties are copied back from a reconstructed portion', () => {
    const base = createDefaultEightStepAnimation({ concept: '8stp', reference: '4-EI' })
    expect(base).toBeDefined()
    if (!base) return
    const prepared = prepareVtg45TransitionPattern(base)
    expect(prepared.supported).toBe(true)
    if (!prepared.supported) return
    const preview = createVtgTransitionPreviewAnimations(prepared.pattern)?.[0]
    expect(preview).toBeDefined()
    if (!preview) return

    const scaledPreview = applyVtgBuilderScaleSettings(preview, 'simple', [{ 0: 1.1 }, {}])
    const scaled = applyVtgBuilderPortionProperties(prepared.pattern, 0, scaledPreview, ['scale'])
    expect(scaled).toBeDefined()
    expect(scaled && findEightStepPatternMatch(scaled)?.reference).toBe('4-EI')
  })

  it('matches legacy 90-degree animations using the performer-facing BPM', () => {
    const selection = {
      concept: '8stp',
      reference: '7-IE',
      swapProps: true,
      reversePlane: true,
      shape: 'diamond',
      bpm: 91,
      scale: 1.1,
    } as const
    const canonical = createDefaultEightStepAnimation(selection)
    const legacy = canonical
      ? consolidateAnimationPlayback(canonical, eightStepPlaybackMultiplier)
      : undefined
    expect(legacy).toBeDefined()
    if (!legacy) return

    expect(legacy.bpm).toBe(91)
    expect(
      rootCompile(legacy).props.every((prop) =>
        prop.anim.slice(1).every((frame) => frame.arc === 90),
      ),
    ).toBe(true)
    expect(findEightStepPatternMatch(legacy)).toMatchObject({
      reference: '7-IE',
      bpm: 91,
      scale: 1.1,
    })
    expect(matchesEightStepSelection(legacy, selection)).toBe(true)
  })

  it('rejects non-Eight-Step frame geometry', () => {
    const animation = createDefaultEightStepAnimation({ concept: '8stp', reference: '1-AA' })
    expect(animation).toBeDefined()
    if (!animation) return

    animation.props[0]!.anim[4]!.arc = 30
    expect(findEightStepPatternMatch(animation)).toBeUndefined()
  })
})
