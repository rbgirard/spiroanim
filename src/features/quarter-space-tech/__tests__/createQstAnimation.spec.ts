import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import {
  createDefaultQstAnimation,
  createQstLinePreviewAnimation,
  createQstPreviewAnimation,
  createQstAnimation,
} from '@/features/quarter-space-tech/createQstAnimation'
import { qstPatternDefinitions } from '@/features/quarter-space-tech/data/qstPatternCatalog'
import { analyzeQstPositionPairs } from '@/features/quarter-space-tech/math/analyzeQstAnimation'
import { rootCompile } from '@/math/animation/AnimFunc'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CHARSET, VDEF } from '@/services/query/versions/SpiroAnimQSv12'
import { applyPatternFinalTransforms } from '@/features/concepts/applyPatternFinalTransforms'

describe('createQstAnimation', () => {
  it('creates the expected first Breaks position sequence', () => {
    const animation = createDefaultQstAnimation({ concept: 'qst', reference: 'breaks-1' })
    if (!animation) throw new Error('Missing breaks-1')

    expect(analyzeQstPositionPairs(animation)).toEqual([
      ['bottom', 'left'],
      ['left', 'top'],
      ['top', 'front'],
      ['front', 'bottom'],
      ['bottom', 'left'],
    ])
  })

  it('applies animation and visibility controls without mutating the definition', () => {
    const transformed = createDefaultQstAnimation({
      concept: 'qst',
      reference: 'advanced-1',
      swapProps: true,
      reversePlane: true,
      bpm: 96,
      scale: 1.2,
      thick: 11,
      spacing: 6,
      paths: false,
      hands: true,
      arms: false,
      right: false,
    })
    const original = createDefaultQstAnimation({ concept: 'qst', reference: 'advanced-1' })
    if (!transformed || !original) throw new Error('Missing advanced-1')

    expect(transformed).toMatchObject({
      bpm: 96,
      thick: 11,
      paths: false,
      hands: true,
      arms: false,
    })
    expect(transformed.props.every(({ anim }) => anim[0]?.scale === 120)).toBe(true)
    expect(transformed.props[0]?.motion).toHaveLength(1)
    expect(transformed.props[1]).toMatchObject({
      paths: false,
      hands: false,
      arms: false,
      visible: false,
    })
    expect(rootCompile(transformed).props[0]?.anim).not.toEqual(
      rootCompile(original).props[0]?.anim,
    )
    expect(original.props.every(({ anim }) => anim[0]?.scale === 80)).toBe(true)
  })

  it('applies Swap and 180 only after the QST pattern is complete', () => {
    const selection = {
      concept: 'qst',
      reference: 'advanced-1',
      scale: 1.2,
      spacing: 6,
    } as const
    const semantic = createDefaultQstAnimation(selection)
    const transformed = createDefaultQstAnimation({
      ...selection,
      swapProps: true,
      reversePlane: true,
    })
    if (!semantic) throw new Error('Expected a QST animation')

    expect(transformed).toEqual(
      applyPatternFinalTransforms(semantic, { swapProps: true, reversePlane: true }),
    )
  })

  it('preserves the active playback speed when BPM rebuilds the pattern', () => {
    const current = createDefaultQstAnimation({ concept: 'qst', reference: 'breaks-1' })
    if (!current) throw new Error('Missing breaks-1')

    const animation = createQstAnimation(
      { ...current, speed: 4 },
      {
        concept: 'qst',
        reference: 'advanced-1',
        bpm: 96,
      },
    )

    expect(animation).toMatchObject({ bpm: 96, speed: 4 })
  })

  it('creates a distinct worker thumbnail animation for each configured line', () => {
    const first = createQstLinePreviewAnimation({ concept: 'qst', reference: 'advanced-1' }, 0, 4)
    const second = createQstLinePreviewAnimation({ concept: 'qst', reference: 'advanced-1' }, 1, 4)
    if (!first || !second) throw new Error('Missing advanced-1 line preview')

    expect(first.props.map(({ anim }) => anim.length)).toEqual([5, 5])
    expect(second.props.map(({ anim }) => anim.length)).toEqual([5, 5])
    expect(rootCompile(first).props).not.toEqual(rootCompile(second).props)
    expect(rootCompile(first).camera[0]?.orbit.offset).toEqual([0, 0, -18])
    expect(rootCompile(second).camera[0]?.orbit.offset).toEqual([0, 0, -18])
  })

  it('preserves Scale and its derived camera distance in line thumbnails', () => {
    const preview = createQstLinePreviewAnimation(
      { concept: 'qst', reference: 'advanced-1', scale: 1.2 },
      0,
      4,
    )
    if (!preview) throw new Error('Missing scaled advanced-1 line preview')

    expect(preview.props.every(({ anim }) => anim[0]?.scale === 120)).toBe(true)
    expect(
      rootCompile(preview).props.every(({ anim }) => anim.every(({ scale }) => scale === 120)),
    ).toBe(true)
    expect(rootCompile(preview).camera[0]?.orbit.offset).toEqual([0, 0, -23])
  })

  it('uses the standard concept camera for thumbnails', () => {
    const preview = createQstPreviewAnimation({ concept: 'qst', reference: 'breaks-1' })
    if (!preview) throw new Error('Missing breaks-1 preview')

    expect(rootCompile(preview).camera[0]?.orbit.offset).toEqual([0, 0, -18])
  })

  it('uses the historical QST camera orientation with Scale-derived orbit distance', () => {
    const defaultAnimation = createDefaultQstAnimation({ concept: 'qst', reference: 'breaks-1' })
    const scaledAnimation = createDefaultQstAnimation({
      concept: 'qst',
      reference: 'breaks-1',
      scale: 1.2,
    })

    expect(defaultAnimation?.camera).toEqual([
      {
        orbit: { distance: 18, arc: 110, plane: -115 },
        center: { distance: 1, arc: 135, plane: 180 },
      },
    ])
    expect(scaledAnimation?.camera).toEqual([
      {
        orbit: { distance: 23, arc: 110, plane: -115 },
        center: { distance: 1, arc: 135, plane: 180 },
      },
    ])
  })

  it('removes inherited frame values and round-trips every pattern through a compact URL', async () => {
    const codec = await useSpiroAnimQS(VDEF, useBaseQS(VDEF, { charset: CHARSET }), 12)

    for (const definition of qstPatternDefinitions) {
      const animation = createDefaultQstAnimation({
        concept: 'qst',
        reference: definition.reference,
      })
      if (!animation) throw new Error(`Missing ${definition.reference}`)

      for (const prop of animation.props) {
        expect(prop.anim.filter(({ turns }) => turns !== undefined)).toHaveLength(1)
        expect(prop.anim.some(({ plane }) => plane === 0)).toBe(false)
      }

      const query = codec.encodeQS(animation, false)
      expect(query.c).toBe('_i_89K~_1_J27')
      expect(new URLSearchParams(query).toString().length).toBeLessThanOrEqual(140)
      const compiled = rootCompile(animation)
      const decoded = rootCompile(codec.decodeQS(query))
      expect({ props: decoded.props, camera: decoded.camera }).toEqual({
        props: compiled.props,
        camera: compiled.camera,
      })
    }
  })
})
