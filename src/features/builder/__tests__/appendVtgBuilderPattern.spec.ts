import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import {
  appendVtgBuilderPattern,
  insertVtgBuilderPattern,
  swapVtgBuilderPatternProps,
} from '@/features/builder/appendVtgBuilderPattern'
import { preserveVtgBuilderScale } from '@/features/builder/preserveVtgBuilderScale'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import {
  createVtgTransitionPreviewAnimations,
  getVtgTransitionPreviewBeatCount,
  removeVtgTransitionPatternPreview,
} from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { rootCompile } from '@/math/animation/AnimFunc'
import { findExplicitPlaneOrTurnsFrameIndices } from '@/math/animation/findExplicitPlaneOrTurnsFrameIndices'
import { findVtgPatternMatch } from '@/features/vtg/matchVtgAnimation'
import {
  areVtgBuilderMotionsEqual,
  getVtgBuilderMotion,
} from '@/features/builder/describeVtgBuilderMotion'
import { useBaseQS } from '@/services/query/createBaseQS'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'
import type { AnimData, RootDataFinal } from '@/types/AnimTypes'
import type { VtgCellReference } from '@/features/vtg/types'
import { applyPatternFinalTransforms } from '@/features/concepts/applyPatternFinalTransforms'

const expectSameMotionAndDuration = (actual: RootDataFinal, expected: RootDataFinal) => {
  expect(
    areVtgBuilderMotionsEqual(getVtgBuilderMotion(actual), getVtgBuilderMotion(expected)),
  ).toBe(true)
  expect(getVtgTransitionPreviewBeatCount(actual)).toBe(getVtgTransitionPreviewBeatCount(expected))
}

const expectOnlyNecessaryFrameValues = (animation: RootDataFinal, frameIndex: number) => {
  const expected = rootCompile(animation).props
  const testedKeys = [
    'twist',
    'yaw',
    'rotate',
    'beats',
    'scale',
    'warp',
    'depth',
    'type',
    'adjust',
    'arc',
    'plane',
    'axis',
  ] as const satisfies readonly (keyof AnimData)[]

  animation.props.forEach((prop, propIndex) => {
    const frame = prop.anim[frameIndex]
    if (!frame) throw new Error(`Expected frame ${frameIndex} for prop ${propIndex}`)

    for (const key of testedKeys) {
      if (frame[key] === undefined) continue
      const withoutValue: RootDataFinal = {
        ...animation,
        props: animation.props.map((candidateProp, candidatePropIndex) => ({
          ...candidateProp,
          anim: candidateProp.anim.map((candidateFrame, candidateFrameIndex) => {
            const nextFrame = { ...candidateFrame }
            if (candidatePropIndex === propIndex && candidateFrameIndex === frameIndex) {
              delete nextFrame[key]
            }
            return nextFrame
          }),
        })),
      }
      expect(
        rootCompile(withoutValue).props,
        `prop ${propIndex} frame ${frameIndex} ${key}`,
      ).not.toEqual(expected)
    }
  })
}

describe('appendVtgBuilderPattern', () => {
  it.each([0, 1, 2])(
    'swaps props in portion %s while preserving that portion and its successor',
    (targetIndex) => {
      const selections = [
        { reference: '5-1', speedRatio: '1:3' },
        { reference: '5-1', speedRatio: '1:3' },
        { reference: '5-1', speedRatio: '1:3' },
      ] as const
      const build = () => {
        const first = createDefaultVtgAnimation(selections[0])
        const second = first ? appendVtgBuilderPattern(first, selections[1]) : undefined
        return second ? appendVtgBuilderPattern(second, selections[2]) : undefined
      }

      const source = build()
      const serializedSource = JSON.stringify(source)
      const updated = source ? swapVtgBuilderPatternProps(source, targetIndex) : undefined
      const twice = updated ? swapVtgBuilderPatternProps(updated, targetIndex) : undefined
      if (!source || !updated || !twice) {
        throw new Error(`Expected Builder portion ${targetIndex} to swap twice`)
      }

      const beforePreviews = createVtgTransitionPreviewAnimations(source)
      const updatedPreviews = createVtgTransitionPreviewAnimations(updated)
      const twicePreviews = createVtgTransitionPreviewAnimations(twice)
      expect(updatedPreviews).toHaveLength(3)
      expect(twicePreviews).toHaveLength(3)
      expect(JSON.stringify(source)).toBe(serializedSource)

      if (targetIndex < 2) {
        const updatedSuccessorFrame = findExplicitPlaneOrTurnsFrameIndices(updated, 2)[targetIndex]
        const twiceSuccessorFrame = findExplicitPlaneOrTurnsFrameIndices(twice, 2)[targetIndex]
        if (updatedSuccessorFrame === undefined || twiceSuccessorFrame === undefined) {
          throw new Error('Expected an explicit successor relationship frame')
        }
        expectOnlyNecessaryFrameValues(updated, updatedSuccessorFrame)
        expectOnlyNecessaryFrameValues(twice, twiceSuccessorFrame)
      }

      for (const previewIndex of [0, 1, 2]) {
        const beforeMotion = getVtgBuilderMotion(beforePreviews![previewIndex]!)
        const expectedMotion =
          previewIndex === targetIndex
            ? getVtgBuilderMotion(
                applyPatternFinalTransforms(beforePreviews![previewIndex]!, { swapProps: true }),
              )
            : beforeMotion
        expect(
          getVtgBuilderMotion(updatedPreviews![previewIndex]!),
          `target ${targetIndex}, preview ${previewIndex}`,
        ).toEqual(expectedMotion)
        expect(getVtgTransitionPreviewBeatCount(updatedPreviews![previewIndex]!)).toBe(
          getVtgTransitionPreviewBeatCount(beforePreviews![previewIndex]!),
        )
        expect(getVtgBuilderMotion(twicePreviews![previewIndex]!)).toEqual(
          getVtgBuilderMotion(beforePreviews![previewIndex]!),
        )
        expect(getVtgTransitionPreviewBeatCount(twicePreviews![previewIndex]!)).toBe(
          getVtgTransitionPreviewBeatCount(beforePreviews![previewIndex]!),
        )
      }
    },
  )

  it('preserves each prop Anti/In spin when appending an independently authored pattern', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const decode = (query: string) => codec.decodeQS(Object.fromEntries(new URLSearchParams(query)))
    const current = decode(
      'r=Ew09Ak11Y&p0=Q__.biQs8___s.5JEwm.......&m0=_1_mxqv__&p1=N__.biQxM___s.5L_s8.......&c=_i_bhq&v=6',
    )
    const cell = decode(
      'r=Ew09Ak11Y&p0=Q__.biQ_____s.5JEs8.......&m0=_1_mxqv__&p1=N__.biQ_____s.5JEs8.......&c=_i_bhq&v=6',
    )
    const selection = findVtgPatternMatch(cell)
    if (!selection) throw new Error('Expected exact 1:3 cell 1-1 match')
    const result = appendVtgBuilderPattern(current, selection)
    if (!result) throw new Error('Expected appended exact pattern')
    const compiledCell = rootCompile(cell)
    const compiledResult = rootCompile(result)
    const appendStart = current.props[0]!.anim.length
    const appendedPreview = createVtgTransitionPreviewAnimations(result)?.[1]
    if (!appendedPreview) throw new Error('Expected appended preview')
    expectSameMotionAndDuration(appendedPreview, cell)
    expect(compiledResult.props.map((prop) => prop.anim[appendStart]?.turns)).toEqual(
      compiledCell.props.map((prop) => prop.anim[1]?.turns),
    )
    expect(compiledResult.props.map((prop) => prop.anim[appendStart]?.arc)).toEqual(
      compiledCell.props.map((prop) => prop.anim[1]?.arc),
    )
  })

  it.each([
    {
      name: 'opposite-direction source',
      query:
        'r=Ew09Ak11Y&p0=Q__.biQ_____s.5JEs8.......&m0=_1_mxqv__&p1=N__.blE_____s.5JEs8.......&c=_i_bhq&v=6',
    },
    {
      name: 'same-direction source',
      query:
        'r=Ew09Ak11Y&p0=Q__.biQ_____s.5JEs8.......&m0=_1_mxqv__&p1=N__.biQ_____s.5JEs8.......&c=_i_bhq&v=6',
    },
  ])('preserves both prop spins from a dragged $name', async ({ query }) => {
    expect.hasAssertions()
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const decode = (value: string) => codec.decodeQS(Object.fromEntries(new URLSearchParams(value)))
    const current = decode(
      'r=Ew09Ak11Y&p0=Q__.biQs8___s.5JEwm.......&m0=_1_mxqv__&p1=N__.biQxM___s.5L_s8.......&c=_i_bhq&v=6',
    )
    const source = decode(query)
    const selection = findVtgPatternMatch(source)
    if (!selection) throw new Error('Expected the dragged source to match a VTG pattern')
    const result = appendVtgBuilderPattern(current, selection)
    if (!result) throw new Error('Expected cell 1-1 to append')

    const appendedPreview = createVtgTransitionPreviewAnimations(result)?.[1]
    if (!appendedPreview) throw new Error('Expected appended preview')
    expectSameMotionAndDuration(appendedPreview, source)
  })
  it('creates the initial Builder pattern when dropping onto an empty animation', () => {
    const template = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!template) throw new Error('Expected a supported VTG pattern')
    const empty = { ...template, props: [] }

    const result = appendVtgBuilderPattern(empty, {
      reference: '5-2',
      speedRatio: '1:3',
    })

    expect(result?.props).toHaveLength(2)
    expect(createVtgTransitionPreviewAnimations(result!)).toHaveLength(1)
  })

  it('appends a four-beat piece with its source travel direction', () => {
    const current = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const source = createDefaultVtgAnimation({ reference: '5-6', speedRatio: '1:3' })
    if (!current || !source) throw new Error('Expected supported VTG patterns')

    const result = appendVtgBuilderPattern(current, {
      reference: '5-6',
      speedRatio: '1:3',
    })
    if (!result) throw new Error('Expected an appended VTG pattern')

    expect(result.props.map((prop) => prop.anim.length)).toEqual(
      current.props.map((prop) => prop.anim.length + 8),
    )
    result.props.forEach((prop) => expect(prop.anim.at(-1)).toEqual({}))
    const previews = createVtgTransitionPreviewAnimations(result)
    expect(previews).toHaveLength(2)
    expect(previews?.map((preview) => preview.props[0]!.anim.length)).toEqual([9, 9])
  })

  it('appends the complete eight-beat cycle for a mixed-numerator ratio', () => {
    const current = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!current) throw new Error('Expected a supported VTG pattern')

    const result = appendVtgBuilderPattern(current, {
      reference: '5-6',
      speedRatio: '1:1v2:3',
    })
    if (!result) throw new Error('Expected an appended mixed-numerator pattern')

    const previews = createVtgTransitionPreviewAnimations(result)
    expect(previews).toHaveLength(2)
    expect(previews?.map(getVtgTransitionPreviewBeatCount)).toEqual([4, 8])
    expect(previews?.map((preview) => preview.props[0]?.anim.length)).toEqual([9, 17])
  })

  it('preserves AA / OO when appended to the supplied mixed-ratio pattern', async () => {
    const version = await loadSpiroAnimQSVersion(7)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      7,
    )
    const current = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Z&p0=Q__.mBE_______r_.5JE...............&m0=_1_mxqv__&p1=N__.mBE_______r_.5L_QzP...............&c=_g_bhq&v=7',
        ),
      ),
    )
    const references = [
      '1-1',
      '1-2',
      '1-3',
      '1-4',
      '6-1',
      '6-2',
      '6-3',
      '6-4',
    ] as const satisfies readonly VtgCellReference[]
    const reference = references.find((candidate) => {
      const source = createDefaultVtgAnimation({
        reference: candidate,
        speedRatio: '1:1v2:3',
      })
      return (
        source &&
        getVtgBuilderMotion(source).directions.every((direction) => direction === 'O') &&
        getVtgBuilderMotion(source).spins.every((spin) => spin === 'A')
      )
    })
    if (!reference) throw new Error('Expected an AA / OO Builder source')

    const result = appendVtgBuilderPattern(current, { reference, speedRatio: '1:1v2:3' })
    const appended = result && createVtgTransitionPreviewAnimations(result)?.at(-1)

    expect(appended && getVtgBuilderMotion(appended)).toEqual({
      spins: ['A', 'A'],
      directions: ['O', 'O'],
    })
  })

  it('preserves appended AA / OO after a version 8 query round trip', async () => {
    const version = await loadSpiroAnimQSVersion(8)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      8,
    )
    const current = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew48Yk11Y&p0=Q__.blE_______s_.5JEQpg.......&m0=_1_mxqv__&p1=N__.blE_______s_.5JEQpg.......&c=_i_bhq&v=8',
        ),
      ),
    )

    const result = appendVtgBuilderPattern(current, { reference: '1-2', speedRatio: '1:3' })
    const encoded = result && codec.encodeQS(result, false)
    const reloaded = encoded && codec.decodeQS(encoded)
    const appended = reloaded && createVtgTransitionPreviewAnimations(reloaded)?.at(-1)

    expect(appended && getVtgBuilderMotion(appended)).toEqual({
      spins: ['A', 'A'],
      directions: ['O', 'O'],
    })
  })

  it('preserves the VTG 180 transform after removing the source first frame', () => {
    const current = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!current) throw new Error('Expected a supported VTG pattern')

    const base = appendVtgBuilderPattern(current, {
      reference: '5-2',
      speedRatio: '1:3',
    })
    const reversed = appendVtgBuilderPattern(current, {
      reference: '5-2',
      speedRatio: '1:3',
      reversePlane: true,
    })
    if (!base || !reversed) throw new Error('Expected appended VTG patterns')

    const appendStart = current.props[0]!.anim.length
    expect(reversed.props.map((prop) => prop.anim[appendStart]?.plane)).not.toEqual(
      base.props.map((prop) => prop.anim[appendStart]?.plane),
    )
  })

  it('keeps a shifted source cell as one four-beat thumbnail', () => {
    const current = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!current) throw new Error('Expected a supported VTG pattern')

    const result = appendVtgBuilderPattern(current, {
      reference: '5-2',
      speedRatio: '1:3',
      beat: 4.5,
    })
    if (!result) throw new Error('Expected an appended VTG pattern')

    const previews = createVtgTransitionPreviewAnimations(result)
    expect(previews).toHaveLength(2)
    expect(previews?.map((preview) => preview.props[0]!.anim.length)).toEqual([9, 9])
    const appendStart = current.props[0]!.anim.length
    const source = createDefaultVtgAnimation({
      reference: '5-2',
      speedRatio: '1:3',
      beat: 4.5,
    })
    if (!source) throw new Error('Expected a shifted VTG source')
    const compiledSource = rootCompile(source)
    expect(result.props.map((prop) => prop.anim[appendStart]?.turns)).toEqual(
      compiledSource.props.map((prop) => prop.anim[1]!.turns),
    )
  })

  it.each([0, 2])(
    'inserts before preview %s while preserving the following authored pattern frames',
    (targetIndex) => {
      const current = createDefaultVtgAnimation({
        reference: '5-1',
        speedRatio: '1:3',
        transition: true,
        transitionBeats: 3,
        transitionQuad: true,
      })
      if (!current) throw new Error('Expected a supported VTG transition')
      const before = createVtgTransitionPreviewAnimations(current)
      if (!before) throw new Error('Expected VTG transition previews')
      const beforeCounts = before.map(getVtgTransitionPreviewBeatCount)
      const starts = [
        0,
        ...findExplicitPlaneOrTurnsFrameIndices(current, 2).map((frameIndex) => frameIndex - 1),
      ]
      const insertionIndex = starts[targetIndex]! + 1
      current.props.forEach((prop, propIndex) => {
        prop.anim[insertionIndex] = {
          ...prop.anim[insertionIndex],
          warp: propIndex === 0 ? 45 : -45,
        }
      })

      const result = insertVtgBuilderPattern(
        current,
        { reference: '5-2', speedRatio: '1:3' },
        targetIndex,
      )
      if (!result) throw new Error('Expected an inserted VTG pattern')
      const after = createVtgTransitionPreviewAnimations(result)
      if (!after) throw new Error('Expected inserted VTG previews')

      expect(after.map(getVtgTransitionPreviewBeatCount)).toEqual([
        ...beforeCounts.slice(0, targetIndex),
        4,
        ...beforeCounts.slice(targetIndex),
      ])
      const compiledBefore = rootCompile(current)
      const compiledAfter = rootCompile(result)
      result.props.forEach((prop, propIndex) => {
        expect(prop.anim.slice(insertionIndex + 9)).toEqual(
          current.props[propIndex]!.anim.slice(insertionIndex + 1),
        )
        const beforeRelationship = compiledBefore.props[propIndex]!.anim[insertionIndex]!
        const afterRelationship = compiledAfter.props[propIndex]!.anim[insertionIndex + 8]!
        expect({
          arc: afterRelationship.arc,
          warp: afterRelationship.warp,
          turns: afterRelationship.turns,
        }).toEqual({
          arc: beforeRelationship.arc,
          warp: beforeRelationship.warp,
          turns: beforeRelationship.turns,
        })
        expect(prop.anim[insertionIndex + 8]?.axis).toBe(
          current.props[propIndex]!.anim[insertionIndex]?.axis,
        )
      })
      expectSameMotionAndDuration(after[targetIndex + 1]!, before[targetIndex]!)
    },
  )

  it.each([false, true])(
    'preserves %s Anti when inserting a Spin/Anti pattern before the first thumbnail',
    (isAnti) => {
      const current = createDefaultVtgAnimation({
        reference: '5-1',
        speedRatio: '1:3',
        transition: true,
      })
      if (!current) throw new Error('Expected a supported VTG transition')

      const result = insertVtgBuilderPattern(
        current,
        { reference: '5-5', speedRatio: '1:3', isAnti },
        0,
      )
      if (!result) throw new Error('Expected an inserted VTG pattern')
      const inserted = createVtgTransitionPreviewAnimations(result)?.[0]
      if (!inserted) throw new Error('Expected an inserted first preview')

      expect(findVtgPatternMatch(inserted)).toMatchObject({ reference: '5-5', isAnti })
    },
  )

  it('deletes a middle piece while preserving the following Anti/In spins', () => {
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!first) throw new Error('Expected a supported VTG pattern')
    const second = appendVtgBuilderPattern(first, { reference: '5-2', speedRatio: '1:3' })
    const third = second
      ? appendVtgBuilderPattern(second, {
          reference: '5-5',
          speedRatio: '1:3',
          isAnti: true,
        })
      : undefined
    if (!third) throw new Error('Expected three Builder patterns')
    const before = createVtgTransitionPreviewAnimations(third)

    const result = removeVtgTransitionPatternPreview(third, 1)
    const after = result ? createVtgTransitionPreviewAnimations(result) : undefined

    expect(after).toHaveLength(2)
    expectSameMotionAndDuration(after![1]!, before![2]!)
    const beforeStarts = [
      0,
      ...findExplicitPlaneOrTurnsFrameIndices(third, 2).map((frameIndex) => frameIndex - 1),
    ]
    const afterStarts = [
      0,
      ...findExplicitPlaneOrTurnsFrameIndices(result!, 2).map((frameIndex) => frameIndex - 1),
    ]
    third.props.forEach((prop, propIndex) => {
      const sourceTarget = beforeStarts[2]! + 1
      const resultTarget = afterStarts[1]! + 1
      expect(result!.props[propIndex]!.anim[resultTarget]?.axis).toBe(prop.anim[sourceTarget]?.axis)
      expect(result!.props[propIndex]!.anim.slice(resultTarget + 1)).toEqual(
        prop.anim.slice(sourceTarget + 1),
      )
    })
  })

  it('preserves the following Anti/In shape against the supplied independently phased props', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const source = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yn11Y&p0=Q__.myQ_____q.5JEsR....._ZEvF............_ZEsR......&m0=_1_mxqv__&p1=N__.05E_____q.5L_sR..........._ZEvF............_ZEsR&c=_f_bhq&v=6',
        ),
      ),
    )

    const before = createVtgTransitionPreviewAnimations(source)
    const result = removeVtgTransitionPatternPreview(source, 2)
    const after = result ? createVtgTransitionPreviewAnimations(result) : undefined

    expect(after).toHaveLength(before!.length - 1)
    expectSameMotionAndDuration(after![2]!, before![3]!)
  })

  it('preserves the following Anti/In spins without exchanging prop tracks', async () => {
    expect.hasAssertions()
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const source = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yn11Y&p0=Q__.myQ_____q.5JEsR....._ZEvF............_ZEsR......&m0=_1_mxqv__&p1=N__.05E_____q.5L_sR..........._ZEvF............_ZEsR&c=_f_bhq&v=6',
        ),
      ),
    )

    const result = removeVtgTransitionPatternPreview(source, 1)
    const before = createVtgTransitionPreviewAnimations(source)?.[2]
    const after = result ? createVtgTransitionPreviewAnimations(result)?.[1] : undefined
    if (!before || !after) throw new Error('Expected the following preview before and after delete')
    expectSameMotionAndDuration(after, before)
  })

  it('rebases the next piece when deleting the first Builder pattern', () => {
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!first) throw new Error('Expected a supported VTG pattern')
    const second = appendVtgBuilderPattern(first, { reference: '5-2', speedRatio: '1:3' })
    if (!second) throw new Error('Expected two Builder patterns')
    const before = createVtgTransitionPreviewAnimations(second)

    second.props.forEach((prop, index) => {
      prop.anim[0] = { ...prop.anim[0], scale: 11 + index }
    })
    const removed = removeVtgTransitionPatternPreview(second, 0)
    const result = removed ? preserveVtgBuilderScale(second, removed) : undefined
    const remaining = result ? createVtgTransitionPreviewAnimations(result) : undefined

    expect(remaining).toHaveLength(1)
    expectSameMotionAndDuration(remaining![0]!, before![1]!)
    expect(result?.props.map((prop) => prop.anim[0]?.scale)).toEqual([11, 12])
  })

  it('returns to the empty Builder state when deleting its only pattern', () => {
    const only = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!only) throw new Error('Expected a supported VTG pattern')

    expect(removeVtgTransitionPatternPreview(only, 0)?.props).toEqual([])
  })
})
