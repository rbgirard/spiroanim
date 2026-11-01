import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { resolveVtgBuilderPatternMatchAnimation } from '@/features/builder/resolveVtgBuilderPatternMatchAnimation'
import { createVtgBuilderDropPreview } from '@/features/builder/createVtgBuilderDropPreview'
import { resolveVtgCompactBuilderSelection } from '@/features/concepts/resolveVtgCompactBuilderSelection'
import { createVtgPreviewCandidate } from '@/features/concepts/createVtgPreviewCandidate'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { findVtgPatternMatch } from '@/features/vtg/matchVtgAnimation'
import { stripVtgPropertySettings } from '@/features/vtg/stripVtgPropertySettings'
import { getVtgPropertyCycleCount } from '@/features/vtg/propertySettings'
import { extractVtgTwistValues } from '@/features/vtg/applyVtgTwistSettings'
import { extractVtgFoldValues } from '@/features/vtg/applyVtgFoldSettings'
import { rootCompile } from '@/math/animation/AnimFunc'
import {
  createVtgTransitionPreviewAnimations,
  getVtgTransitionPreviewBeatCount,
  resizeVtgTransitionPatternPreview,
} from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { prepareVtg45TransitionPattern } from '@/features/vtg/math/prepareVtg45TransitionPattern'
import { useBaseQS } from '@/services/query/createBaseQS'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'

describe('resolveVtgBuilderPatternMatchAnimation', () => {
  const decodeQuery = async (query: string) => {
    const params = new URLSearchParams(query)
    const queryVersion = Number(params.get('v'))
    const version = await loadSpiroAnimQSVersion(queryVersion)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      queryVersion,
    )
    return codec.decodeQS(Object.fromEntries(params))
  }

  const createPreviews = () => {
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const second = createDefaultVtgAnimation({ reference: '2-3', speedRatio: '1:3' })
    if (!first || !second) throw new Error('Expected supported VTG animations')
    return [first, second] as const
  }

  it('uses the selected portion normalized to its exact timing cycle', () => {
    const previews = createPreviews()
    const shortOneCycle = resizeVtgTransitionPatternPreview(previews[0], 0, 2)
    const shortTwoCycle = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '2:3' })
    if (!shortOneCycle || !shortTwoCycle) throw new Error('Expected supported VTG animations')
    const resizedTwoCycle = resizeVtgTransitionPatternPreview(shortTwoCycle, 0, 4)
    if (!resizedTwoCycle) throw new Error('Expected a resized 2:3 animation')

    expect(
      getVtgTransitionPreviewBeatCount(resolveVtgBuilderPatternMatchAnimation([shortOneCycle], 0)!),
    ).toBe(4)
    expect(
      getVtgTransitionPreviewBeatCount(
        resolveVtgBuilderPatternMatchAnimation([resizedTwoCycle], 0)!,
      ),
    ).toBe(8)
  })

  it('uses the final portion at its actual length for the selected dummy drop cell', () => {
    const previews = createPreviews()
    const resizedFinal = resizeVtgTransitionPatternPreview(previews[1], 0, 6)
    if (!resizedFinal) throw new Error('Expected a resized final portion')
    const resizedPreviews = [previews[0], resizedFinal]

    const dropContext = resolveVtgBuilderPatternMatchAnimation(
      resizedPreviews,
      resizedPreviews.length,
    )
    expect(dropContext).toEqual(resizedFinal)
    expect(dropContext && getVtgTransitionPreviewBeatCount(dropContext)).toBe(6)
    expect(
      getVtgTransitionPreviewBeatCount(resolveVtgBuilderPatternMatchAnimation(resizedPreviews, 1)!),
    ).toBe(4)
  })

  it('does not provide a match animation without a selected existing portion', () => {
    expect(resolveVtgBuilderPatternMatchAnimation([], 0)).toBeUndefined()
    expect(resolveVtgBuilderPatternMatchAnimation(createPreviews(), undefined)).toBeUndefined()
  })

  it.each([
    'r=Ew68kk11Y&p0=Q__..bn_PZ8...........&x0=_s_&m0=_1_mxqv__&p1=N__..bg0Rhw.._U0PZ8._U0Rhw.._U0PZ8._U0Rhw.._U0PZ8._U0Rhw.._U0PZ8&x1=_s_&c=_i_bhq&v=11',
    'r=Ew68kk11Y&p0=Q__..bn_PZ8...........&x0=_s_&m0=_1_mxqv__&p1=N__..bg0PZ8.._U0QRo._U0PZ8.._U0QRo._U0PZ8.._U0QRo._U0PZ8.._U0QRo&x1=_s_&c=_i_bhq&v=11',
  ])('normalizes every Eight Step portion into a matchable catalog cycle', async (query) => {
    const params = new URLSearchParams(query)
    const queryVersion = Number(params.get('v'))
    const version = await loadSpiroAnimQSVersion(queryVersion)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      queryVersion,
    )
    const prepared = prepareVtg45TransitionPattern(codec.decodeQS(Object.fromEntries(params)))
    if (!prepared.supported) throw new Error('Expected a supported Builder pattern')
    const previews = createVtgTransitionPreviewAnimations(prepared.pattern)
    if (!previews) throw new Error('Expected Builder portions from the supplied query')

    expect(previews.map(getVtgTransitionPreviewBeatCount)).toEqual([2, 1, 2, 1, 2, 1, 2, 1])
    expect(
      previews.map((_, index) => {
        const candidate = resolveVtgBuilderPatternMatchAnimation(previews, index)
        return candidate
          ? {
              beats: getVtgTransitionPreviewBeatCount(candidate),
              matched: findVtgPatternMatch(candidate) !== undefined,
            }
          : undefined
      }),
    ).toEqual(previews.map(() => ({ beats: 4, matched: true })))
  })

  it('resolves the reported Builder portion to an exact compact preview', async () => {
    const pattern = await decodeQuery(
      'r=Gw496k11Y&p0=QR__v.bn_____U0.5L__6k_U0................_ZE-ZU................_ZE_6k.........._ZE-ZU.................._ZE_6k........_ZE-ZU.........._ZE_6k...............&x0=Qo__Oif_.____Luf_................____NBf_........____Luf_..................____NBf_............................................____Luf_&m0=_1_mxqv__&p1=NR__v.bn_____U0.5L__6k_U0........_ZE-ZU................_ZE_6k........_ZE-ZU.................._ZE_6k.........._ZE-ZU.........................._ZE_6k.......&x1=Qo__Oif_.____NBf_................____Luf_........____NBf_........____Luf_..................____NBf_..........____Luf_..........................____NBf_&c=_i_bhq&v=12',
    )
    const quickSlot = await decodeQuery(
      'r=Gw496k11Y&p0=QR__v.bn_____U0.5E0-ZU_WQ.......&x0=Qo__Luf_&m0=_1_mxqv__&p1=NR__v.bn_____U0.5L__6k_U0.......&x1=Qo__Luf_.____NBf_&c=_i_bhq&v=12',
    )
    const prepared = prepareVtg45TransitionPattern(pattern)
    if (!prepared.supported) throw new Error('Expected a supported Builder pattern')
    const previews = createVtgTransitionPreviewAnimations(prepared.pattern)
    // Q1 is the complete pattern, so Q5 corresponds to Preview pattern 4.
    const portion = resolveVtgBuilderPatternMatchAnimation(previews, 3)
    if (!portion) throw new Error('Expected the reported Builder portion')

    const portionMatch = findVtgPatternMatch(stripVtgPropertySettings(portion))
    const quickSlotMatch = findVtgPatternMatch(stripVtgPropertySettings(quickSlot))
    expect(portionMatch).toEqual(quickSlotMatch)
    if (!portionMatch) throw new Error('Expected the reported Builder portion to match VTG')
    setActivePinia(createPinia())
    const conceptsStore = useConceptsStore()
    conceptsStore.hydrateVtgPropertyControls(portion, 1)
    const settings = conceptsStore.getVtgPropertySettings()
    expect(extractVtgTwistValues(portion, 1)).toEqual(extractVtgTwistValues(quickSlot))
    expect(extractVtgFoldValues(portion, 1)).toEqual(extractVtgFoldValues(quickSlot))
    expect(rootCompile(portion).props).toEqual(rootCompile(quickSlot).props)

    const selection = resolveVtgCompactBuilderSelection({
      source: pattern,
      target: portion,
      targetIndex: 3,
      references: ['1-1', '1-3', '6-1', '6-3'],
      baseSelection: portionMatch,
      properties: settings,
    })
    expect(selection).toMatchObject({
      reference: '6-1',
      swapProps: false,
      reversePlane: false,
    })
    if (!selection) throw new Error('Expected an exact compact Builder selection')

    const candidate = createVtgBuilderDropPreview(pattern, selection, 3, {
      minimumCycleCount: getVtgPropertyCycleCount(settings),
      properties: settings,
    })
    expect(candidate && rootCompile(candidate).props).toEqual(rootCompile(quickSlot).props)

    const optimizedCandidate = createVtgPreviewCandidate(portionMatch, {
      source: portion,
      builderInsertionIndex: 1,
      properties: settings,
    })
    expect(
      optimizedCandidate && rootCompile(optimizedCandidate).props.map(({ anim }) => anim),
    ).toEqual(rootCompile(quickSlot).props.map(({ anim }) => anim))
  })
})
