import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { appendVtgBuilderPattern } from '@/features/builder/appendVtgBuilderPattern'
import { getVtgBuilderMotion } from '@/features/builder/describeVtgBuilderMotion'
import { findVtgPatternMatch } from '@/features/vtg/matchVtgAnimation'
import {
  createVtgTransitionPreviewAnimation,
  createVtgTransitionQuickSlotAnimationCandidates,
  createVtgTransitionPreviewAnimations,
  getVtgTransitionPreviewCount,
  getVtgTransitionPreviewBeatCount,
  resizeVtgTransitionPatternPreview,
  reverseVtgTransitionPatternPreview,
  resolveVtgTransitionQuickSlotAnimations,
} from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { findQtrPatternMatch } from '@/features/vtg/qtr/matchQtrAnimation'
import { matchVtgPatternRequest } from '@/workers/pattern-matching/handlePatternMatchingRequest'
import { describePatternRelationships } from '@/features/concepts/math/describePatternRelationships'
import { prepareVtg45TransitionPattern } from '@/features/vtg/math/prepareVtg45TransitionPattern'
import { doubleAnimationPlayback } from '@/math/animation/subdivideAnimationPlayback'
import { findExplicitPlaneOrTurnsFrameIndices } from '@/math/animation/findExplicitPlaneOrTurnsFrameIndices'
import { rootCompile } from '@/math/animation/AnimFunc'
import { useBaseQS } from '@/services/query/createBaseQS'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'

const queryFrom = (query: string) => Object.fromEntries(new URLSearchParams(query))

const findMatchKind = (
  animation: Parameters<typeof findVtgPatternMatch>[0],
  rotationFilter: Parameters<typeof findVtgPatternMatch>[2],
) => {
  const matches = [
    findVtgPatternMatch(animation, undefined, rotationFilter),
    findQtrPatternMatch(animation, undefined, rotationFilter),
  ].filter((match) => match !== undefined)

  if (matches.some((match) => match.initialTurnsOffset === undefined)) return 'exact'
  return matches.length > 0 ? 'transitionTurns' : false
}

const selectDetectableAnimations = (
  candidates: ReturnType<typeof createVtgTransitionQuickSlotAnimationCandidates>,
) => {
  if (!candidates) throw new Error('Expected Quick Slot candidates')
  return resolveVtgTransitionQuickSlotAnimations(candidates, findMatchKind).then((resolution) => {
    if (resolution.status !== 'matched') {
      const slots = resolution.unmatchedSlots.join(', ')
      throw new Error(`Expected Quick Slot ${slots} to match`)
    }
    return resolution.animations
  })
}

describe('createVtgTransitionQuickSlotAnimations', () => {
  it('extracts one preview without changing the full-list result', () => {
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const second = first
      ? appendVtgBuilderPattern(first, { reference: '5-2', speedRatio: '1:3' })
      : undefined
    const source = second
      ? appendVtgBuilderPattern(second, { reference: '5-5', speedRatio: '1:3' })
      : undefined
    if (!source) throw new Error('Expected three Builder portions')

    const previews = createVtgTransitionPreviewAnimations(source)
    expect(getVtgTransitionPreviewCount(source)).toBe(3)
    expect(previews).toHaveLength(3)
    previews?.forEach((preview, index) => {
      expect(createVtgTransitionPreviewAnimation(source, index)).toEqual(preview)
    })
    expect(createVtgTransitionPreviewAnimation(source, 3)).toBeUndefined()
  })

  it('rotates the supplied Anti portion without changing its spin classification', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const source = codec.decodeQS(
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.5GQvF___q._U0sR........5GQrrHj.......&m0=_1_mxqv__&p1=N__.gZEuf___q.5E0vF........5GQx3.......&c=_f_bhq&v=6',
      ),
    )
    const before = createVtgTransitionPreviewAnimations(source)
    const updated = reverseVtgTransitionPatternPreview(source, 1)
    const after = updated ? createVtgTransitionPreviewAnimations(updated) : undefined

    expect(before).toHaveLength(2)
    expect(after).toHaveLength(2)
    expect(after!.map((preview) => getVtgBuilderMotion(preview))).toEqual(
      before!.map((preview) => getVtgBuilderMotion(preview)),
    )

    const starts = [
      0,
      ...findExplicitPlaneOrTurnsFrameIndices(source, 2).map((frameIndex) => frameIndex - 1),
    ]
    const targetFrameIndex = starts[1]! + 1
    const compiledBefore = rootCompile(source)
    const compiledAfter = rootCompile(updated!)
    for (const propIndex of [0, 1]) {
      expect(
        Math.abs(
          compiledAfter.props[propIndex]!.anim[targetFrameIndex]!.plane -
            compiledBefore.props[propIndex]!.anim[targetFrameIndex]!.plane,
        ),
      ).toBe(180)
      expect(
        Math.abs(
          compiledAfter.props[propIndex]!.anim[targetFrameIndex]!.axis -
            compiledBefore.props[propIndex]!.anim[targetFrameIndex]!.axis,
        ),
      ).toBe(180)
    }
  })

  it('keeps a supplied Builder pattern matchable after reversing one segment twice', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const source = codec.decodeQS(
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.mBE_____q.5JEsR....._ZEvF............_ZEsR......&m0=_1_mxqv__&p1=N__.07______q.5L_sR..........._ZEvF............_ZEsR&c=_f_bhq&v=6',
      ),
    )
    const once = reverseVtgTransitionPatternPreview(source, 1)
    const twice = once && reverseVtgTransitionPatternPreview(once, 1)
    if (!twice) throw new Error('Expected the second Builder segment to reverse twice')

    expect(rootCompile(twice)).toEqual(rootCompile(source))
    expect(findVtgPatternMatch(twice)).toBeDefined()

    const legacyNegativeHalfTurn = codec.decodeQS(
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.mBE_____q.5JEsR....._U0vF......_WQ......_ZEsR......&m0=_1_mxqv__&p1=N__.07______q.5L_sR....._WQ......_U0vF............_ZEsR&c=_f_bhq&v=6',
      ),
    )
    expect(findVtgPatternMatch(legacyNegativeHalfTurn)).toBeDefined()
  })

  it('reverses both prop planes for one segment and its immediate successor', () => {
    const source = createDefaultVtgAnimation({
      reference: '5-1',
      speedRatio: '1:3',
      transition: true,
      transitionQuad: true,
      transitionSecond: true,
    })
    if (!source) throw new Error('Expected a supported VTG transition')

    const starts = [
      0,
      ...findExplicitPlaneOrTurnsFrameIndices(source, 2).map((frameIndex) => frameIndex - 1),
    ]
    const updated = reverseVtgTransitionPatternPreview(source, 1)
    if (!updated) throw new Error('Expected the preview direction to reverse')
    const before = rootCompile(source)
    const after = rootCompile(updated)
    const changedFrames = [starts[1]! + 1, starts[2]! + 1]

    for (const propIndex of [0, 1]) {
      for (const frameIndex of changedFrames) {
        expect(
          Math.abs(
            after.props[propIndex]!.anim[frameIndex]!.plane -
              before.props[propIndex]!.anim[frameIndex]!.plane,
          ),
        ).toBe(180)
      }
      expect(after.props[propIndex]!.anim[starts[3]! + 1]!.plane).toBe(
        before.props[propIndex]!.anim[starts[3]! + 1]!.plane,
      )
    }
  })

  it('matches the VTG 180 transform on the selected Builder portion and its successor', () => {
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const second = first
      ? appendVtgBuilderPattern(first, { reference: '5-2', speedRatio: '1:3' })
      : undefined
    const source = second
      ? appendVtgBuilderPattern(second, { reference: '5-5', speedRatio: '1:3' })
      : undefined
    if (!source) throw new Error('Expected three Builder portions')

    const updated = reverseVtgTransitionPatternPreview(source, 0)
    const previews = updated ? createVtgTransitionPreviewAnimations(updated) : undefined
    const expectedFirst = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:3',
      reversePlane: true,
    })
    const expectedSecond = expectedFirst
      ? appendVtgBuilderPattern(expectedFirst, {
          reference: '5-2',
          speedRatio: '1:3',
          reversePlane: true,
        })
      : undefined
    const expected = expectedSecond
      ? appendVtgBuilderPattern(expectedSecond, {
          reference: '5-5',
          speedRatio: '1:3',
        })
      : undefined
    const expectedPreviews = expected ? createVtgTransitionPreviewAnimations(expected) : undefined

    expect(previews).toHaveLength(3)
    expect(rootCompile(previews![0]!)).toEqual(rootCompile(expectedPreviews![0]!))
    expect(rootCompile(previews![1]!)).toEqual(rootCompile(expectedPreviews![1]!))
  })

  it('grows and shrinks a working preview with trailing inherited frames', () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!source) throw new Error('Expected a supported VTG pattern')

    const shorter = resizeVtgTransitionPatternPreview(source, 0, 2)
    const longer = resizeVtgTransitionPatternPreview(source, 0, 6)
    if (!shorter || !longer) throw new Error('Expected the full pattern to resize')

    expect(source.props[0]?.anim).toHaveLength(9)
    expect(shorter.props[0]?.anim).toHaveLength(5)
    expect(longer.props[0]?.anim).toHaveLength(13)
    expect(getVtgTransitionPreviewBeatCount(shorter)).toBe(2)
    expect(getVtgTransitionPreviewBeatCount(longer)).toBe(6)
    expect(longer.props[0]?.anim.slice(9)).toEqual([{}, {}, {}, {}])
  })

  it('resizes one region in the full pattern and regenerates every following preview', () => {
    const source = createDefaultVtgAnimation({
      reference: '5-1',
      speedRatio: '1:3',
      transition: true,
      transitionBeats: 5,
      transitionQuad: true,
      transitionSecond: true,
    })
    if (!source) throw new Error('Expected a supported VTG transition')
    const before = createVtgTransitionPreviewAnimations(source)
    if (!before) throw new Error('Expected transition previews')
    const beforeCounts = before.map(getVtgTransitionPreviewBeatCount)

    const updated = resizeVtgTransitionPatternPreview(source, 0, beforeCounts[0]! + 0.5)
    if (!updated) throw new Error('Expected the full pattern to resize')
    const after = createVtgTransitionPreviewAnimations(updated)
    if (!after) throw new Error('Expected updated transition previews')

    expect(updated.props[0]!.anim.length).toBe(source.props[0]!.anim.length + 1)
    expect(after.map(getVtgTransitionPreviewBeatCount)).toEqual([
      beforeCounts[0]! + 0.5,
      ...beforeCounts.slice(1),
    ])
  })

  it('resizes the supplied short appended pieces without modifying or merging neighbors', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const queries = [
      'r=Ew08Yk11Y&p0=Q__.bn___w3_q.5L_sRw3....._ZEvF......_ZEsR......_ZEvF......_ZEsR.5GQvFw3.......&m0=_1_mxqv__&p1=N__.bg0__Hj_q.5E0sRHj....._ZEvF......_ZEsR......_ZEvF......_ZEsR.5GQvFHj.......&c=_f_bhq&v=6',
      'r=Ew08Yk11Y&p0=Q__.bn___w3_q.5L_sRw3....._ZEvF......_ZEsR......_ZEvF......_ZEsR..5JEs8.......&m0=_1_mxqv__&p1=N__.bg0__Hj_q.5E0sRHj....._ZEvF......_ZEsR......_ZEvF......_ZEsR..5JEs8.......&c=_f_bhq&v=6',
    ]

    for (const [queryIndex, query] of queries.entries()) {
      const animation = codec.decodeQS(queryFrom(query))
      const before = createVtgTransitionPreviewAnimations(animation)
      if (!before) throw new Error('Expected supplied transition previews')
      const beforeCounts = before.map(getVtgTransitionPreviewBeatCount)
      const targetBeatCount = queryIndex === 0 ? 0.5 : 1
      const targetIndex = beforeCounts.lastIndexOf(targetBeatCount)
      expect(targetIndex).toBeGreaterThanOrEqual(0)

      const nextBeatCount = targetBeatCount === 0.5 ? 1 : 0.5
      const updated = resizeVtgTransitionPatternPreview(animation, targetIndex, nextBeatCount)
      if (!updated) throw new Error('Expected supplied preview to resize')
      const after = createVtgTransitionPreviewAnimations(updated)
      if (!after) throw new Error('Expected resized transition previews')

      expect(after).toHaveLength(before.length)
      expect(after.map(getVtgTransitionPreviewBeatCount)).toEqual(
        beforeCounts.map((count, index) => (index === targetIndex ? nextBeatCount : count)),
      )
    }
  })

  it('creates more than four previews when either prop contains additional relationships', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const source = codec.decodeQS(
      queryFrom(
        'r=Ew08kk11Y&p0=Q__._ZE_____s.bg0pk.._U0uY._U0pk.._U0uY._U0pk.._U0uY._U0pk.._U0uY&m0=_1_mxqv__&p1=N__._ZE_____s.bn_pk...........&c=_i_bhq&v=6',
      ),
    )
    const prepared = prepareVtg45TransitionPattern(source)
    const relationshipCount = findExplicitPlaneOrTurnsFrameIndices(prepared.pattern, 2).length
    const previews = createVtgTransitionPreviewAnimations(prepared.pattern)

    expect(prepared.supported).toBe(true)
    expect(relationshipCount).toBeGreaterThan(3)
    expect(previews).toHaveLength(relationshipCount + 1)
  })

  it('extracts every contiguous preview at its natural frame length', () => {
    const animation = createDefaultVtgAnimation({
      reference: '5-1',
      speedRatio: '1:3',
      transition: true,
      transitionBeats: 5,
      transitionQuad: true,
      transitionSecond: true,
    })
    if (!animation) throw new Error('Expected a supported VTG transition')

    const changes = findExplicitPlaneOrTurnsFrameIndices(animation, 2)
    const starts = [0, ...changes.map((frameIndex) => frameIndex - 1)]
    const expectedLengths = starts.map((start, index) => {
      const nextStart = starts[index + 1]
      return nextStart === undefined
        ? animation.props[0]!.anim.length - start
        : nextStart - start + 1
    })
    const previews = createVtgTransitionPreviewAnimations(animation)

    expect(previews).toHaveLength(changes.length + 1)
    expect(previews?.map((preview) => preview.props[0]?.anim.length)).toEqual(expectedLengths)
    expect(previews?.map(getVtgTransitionPreviewBeatCount)).toEqual(
      expectedLengths.map((length) => (length - 1) / 2),
    )
    expect(previews?.reduce((total, preview) => total + preview.props[0]!.anim.length - 1, 0)).toBe(
      animation.props[0]!.anim.length - 1,
    )
    expect(new Set(expectedLengths)).not.toEqual(new Set([9]))
  })

  it('reproduces the supplied four-beat transition extractions', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const sourceQuery = queryFrom(
      'r=Ew08Yk11Y&p0=Q__.blE_____s.5JEs8......._ZEwm........_ZEs8........_ZEwm........_ZEs8&m0=_1_mxqv__&p1=N__.blE_____s.5L_s8......._ZEwm........_ZEs8........_ZEwm........_ZEs8&c=_i_bhq&v=6',
    )
    const animations = await selectDetectableAnimations(
      createVtgTransitionQuickSlotAnimationCandidates(codec.decodeQS(sourceQuery)),
    )

    expect(animations).toHaveLength(5)
    expect(animations?.map((animation) => codec.encodeQS(animation, false))).toEqual([
      sourceQuery,
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.blE_____s.5JEs8.......&m0=_1_mxqv__&p1=N__.blE_____s.5L_s8.......&c=_i_bhq&v=6',
      ),
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.g_______s.5E0wm.......&m0=_1_mxqv__&p1=N__.5L______s.___wm.......&c=_i_bhq&v=6',
      ),
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.5E0wmHj_s._U0s8Hj.......&m0=_1_mxqv__&p1=N__.gU0tyHj_s.5L_s8w3.......&c=_i_bhq&v=6',
      ),
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.g_______s.5E0wm.......&m0=_1_mxqv__&p1=N__.5L______s.___wm.......&c=_i_bhq&v=6',
      ),
    ])
  })

  it('matches each raw doubled-cycle extraction without phase shifting', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const sourceQuery = queryFrom(
      'r=Ew08Yk11Y&p0=Q__.bn______s.5L_s8......._ZEwm................_ZEs8........&m0=_1_mxqv__&p1=N__.bn______s.5L_s8..............._ZEwm................_ZEs8&c=_i_bhq&v=6',
    )

    const animations = await selectDetectableAnimations(
      createVtgTransitionQuickSlotAnimationCandidates(codec.decodeQS(sourceQuery)),
    )

    expect(animations).toHaveLength(5)
    expect(
      animations
        ?.slice(1)
        .every(
          (animation) =>
            findVtgPatternMatch(animation) !== undefined ||
            findQtrPatternMatch(animation) !== undefined,
        ),
    ).toBe(true)
    expect(animations?.map((animation) => codec.encodeQS(animation, false))).toEqual([
      sourceQuery,
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.bn______s.5L_s8.......&m0=_1_mxqv__&p1=N__.bn______s.5L_s8.......&c=_i_bhq&v=6',
      ),
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.5E0_____s.___wm.......&m0=_1_mxqv__&p1=N__.g__tyw3_s.5L_s8w3.......&c=_i_bhq&v=6',
      ),
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.5E0_____s.___wm.......&m0=_1_mxqv__&p1=N__.5E0_____s.___wm.......&c=_i_bhq&v=6',
      ),
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.g__tyw3_s.5L_s8w3.......&m0=_1_mxqv__&p1=N__.5E0_____s.___wm.......&c=_i_bhq&v=6',
      ),
    ])
  })

  it('directly matches a cycle extracted from a transition shifted by one authored frame', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const sourceQuery = queryFrom(
      'r=Ew08Yk11Y&p0=Q__.bn______s.5L_s8......._ZEwm........_ZEs8........_ZEwm........_ZEs8&m0=_1_mxqv__&p1=N__.bn______s.5L_s8......._ZEwm........_ZEs8........_ZEwm........_ZEs8&c=_i_bhq&v=6',
    )
    const candidates = createVtgTransitionQuickSlotAnimationCandidates(codec.decodeQS(sourceQuery))
    const animations = await selectDetectableAnimations(candidates)

    expect(
      animations
        ?.slice(1)
        .every(
          (animation) =>
            findVtgPatternMatch(animation) !== undefined ||
            findQtrPatternMatch(animation) !== undefined,
        ),
    ).toBe(true)
    const fourthAnimation = animations[3]
    if (!fourthAnimation) throw new Error('Expected the fourth Quick Slot animation')
    expect(findVtgPatternMatch(fourthAnimation)).toMatchObject({
      reference: '1-1',
      speedRatio: '1:3',
    })
    const suppliedCanonicalMatch = doubleAnimationPlayback(
      codec.decodeQS(
        queryFrom(
          'r=Ew08kk11Y&p0=Q__.bn______s.___pk...&m0=_1_mxqv__&p1=N__.bn______s.___pk...&c=_i_bhq&v=6',
        ),
      ),
    )
    if (!suppliedCanonicalMatch)
      throw new Error('Expected the supplied canonical pattern to double')
    expect(findVtgPatternMatch(suppliedCanonicalMatch)).toMatchObject({
      speedRatio: '1:3',
    })
    expect(animations.map((animation) => codec.encodeQS(animation, false))).toEqual([
      sourceQuery,
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.bn______s.5L_s8.......&m0=_1_mxqv__&p1=N__.bn______s.5L_s8.......&c=_i_bhq&v=6',
      ),
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.5E0_____s.___wm.......&m0=_1_mxqv__&p1=N__.5E0_____s.___wm.......&c=_i_bhq&v=6',
      ),
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.g__tyw3_s.5L_s8w3.......&m0=_1_mxqv__&p1=N__.g__tyw3_s.5L_s8w3.......&c=_i_bhq&v=6',
      ),
      queryFrom(
        'r=Ew08Yk11Y&p0=Q__.5E0_____s.___wm.......&m0=_1_mxqv__&p1=N__.5E0_____s.___wm.......&c=_i_bhq&v=6',
      ),
    ])
  })

  it.each([
    { transitionBeats: 2, transitionQuad: false, transitionSecond: false },
    { transitionBeats: 3, transitionQuad: true, transitionSecond: false },
    { transitionBeats: 4, transitionQuad: true, transitionSecond: true },
    { transitionBeats: 5, transitionQuad: false, transitionSecond: false },
    { transitionBeats: 6, transitionQuad: true, transitionSecond: true },
  ] as const)(
    'creates five nine-frame patterns for $transitionBeats beats, Quad $transitionQuad, Second $transitionSecond',
    (selection) => {
      const animation = createDefaultVtgAnimation({
        reference: '5-1',
        speedRatio: '1:3',
        transition: true,
        ...selection,
      })
      if (!animation) throw new Error('Expected a supported VTG transition')

      const quickSlotCandidates = createVtgTransitionQuickSlotAnimationCandidates(animation)

      expect(quickSlotCandidates).toHaveLength(5)
      expect(quickSlotCandidates?.[0]).toEqual(animation)
      expect(
        quickSlotCandidates
          ?.slice(1)
          .flatMap((candidate) => candidate.props.map((prop) => prop.anim.length)),
      ).toEqual(Array(8).fill(9))
    },
  )

  it('stores a complete eight-beat cycle for 2:3 transition Quick Slots', () => {
    const animation = createDefaultVtgAnimation({
      reference: '5-1',
      speedRatio: '2:3',
      transition: true,
      transitionBeats: 4,
    })
    if (!animation) throw new Error('Expected a supported VTG transition')

    const quickSlotCandidates = createVtgTransitionQuickSlotAnimationCandidates(animation, 8)

    expect(quickSlotCandidates).toHaveLength(5)
    expect(quickSlotCandidates?.slice(1).map(getVtgTransitionPreviewBeatCount)).toEqual(
      Array(4).fill(8),
    )
  })

  it('detects pattern boundaries from authored Plane or Turns frames instead of beat spacing', () => {
    const base = createDefaultVtgAnimation({ reference: '5-1', speedRatio: '1:3' })
    if (!base) throw new Error('Expected a supported VTG animation')
    const explicitFrames = Array.from({ length: 12 }, () => ({}))
    explicitFrames[0] = { arc: 0, turns: 0 }
    explicitFrames[3] = { plane: 0 }
    explicitFrames[6] = { turns: 0 }
    explicitFrames[10] = { plane: 0, turns: 0 }
    const animation = {
      ...base,
      props: base.props.map((prop) => ({
        ...prop,
        anim: explicitFrames.map((frame) => ({ ...frame })),
      })),
    }

    expect(findExplicitPlaneOrTurnsFrameIndices(animation)).toEqual([3, 6, 10])
    const quickSlotCandidates = createVtgTransitionQuickSlotAnimationCandidates(animation)

    expect(quickSlotCandidates).toHaveLength(5)
    expect(
      quickSlotCandidates
        ?.slice(1)
        .flatMap((candidate) => candidate.props.map((prop) => prop.anim.length)),
    ).toEqual(Array(8).fill(9))
  })

  it('resolves a complete matchable relationship group at every transition interval', async () => {
    const createPatternGroup = async (transitionBeats: 2 | 3 | 4 | 5 | 6) => {
      const animation = createDefaultVtgAnimation({
        reference: '5-1',
        speedRatio: '1:3',
        transition: true,
        transitionBeats,
        transitionQuad: true,
        transitionSecond: true,
      })
      if (!animation) throw new Error('Expected a supported VTG transition')

      const candidates = createVtgTransitionQuickSlotAnimationCandidates(animation)?.slice(1)
      if (!candidates) return undefined
      return Promise.all(
        candidates.map(async (candidate) => {
          const result = await matchVtgPatternRequest({
            animation: candidate,
            preferences: { swapProps: false, reversePlane: false, quarters: 1 },
          })
          if (result.status !== 'matched') return undefined
          return describePatternRelationships(candidate).label
        }),
      )
    }

    for (const transitionBeats of [2, 3, 4, 5, 6] as const) {
      const group = await createPatternGroup(transitionBeats)
      expect(group).toHaveLength(4)
      expect(group?.every((relationship) => relationship !== undefined)).toBe(true)
    }
  })

  it('rejects an ordinary non-transition pattern', () => {
    const animation = createDefaultVtgAnimation({ reference: '5-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG pattern')

    expect(createVtgTransitionQuickSlotAnimationCandidates(animation)).toBeUndefined()
  })

  it('retains raw extractions when no cyclic phase matches', async () => {
    const animation = createDefaultVtgAnimation({
      reference: '5-1',
      speedRatio: '1:3',
      transition: true,
    })
    if (!animation) throw new Error('Expected a supported VTG transition')
    const candidates = createVtgTransitionQuickSlotAnimationCandidates(animation)
    if (!candidates) throw new Error('Expected Quick Slot candidates')

    await expect(resolveVtgTransitionQuickSlotAnimations(candidates, () => false)).resolves.toEqual(
      {
        status: 'partial',
        animations: candidates,
        unmatchedSlots: [2, 3, 4, 5],
      },
    )
  })
})
