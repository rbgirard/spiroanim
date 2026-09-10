import { describe, expect, it } from 'vitest'

import { appendVtgBuilderPattern } from '@/features/builder/appendVtgBuilderPattern'
import { applyVtgCustomization } from '@/features/vtg/applyVtgCustomization'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'

describe('applyVtgCustomization', () => {
  it('applies default POI and every non-Scale Customize field to the complete Builder pattern', () => {
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3', prop: 2 })
    const source = first
      ? appendVtgBuilderPattern(first, { reference: '5-1', speedRatio: '1:3', prop: 2 })
      : undefined
    if (!source) throw new Error('Expected a two-portion Builder pattern')

    const customized = applyVtgCustomization(source, {
      reference: '1-1',
      speedRatio: '1:3',
      bpm: 91,
      thick: 9,
      spacing: 7,
      paths: false,
      hands: true,
      arms: false,
      left: false,
      propColors: ['Magenta', 'Yellow'],
      // POI is intentionally omitted because Customize selections encode defaults sparsely.
    })

    expect(customized).toMatchObject({
      prop: 0,
      bpm: 182,
      thick: 9,
      paths: false,
      hands: true,
      arms: false,
    })
    expect(customized.props).toHaveLength(source.props.length)
    expect(customized.props[0]).toMatchObject({
      visible: false,
      paths: false,
      hands: false,
      arms: false,
      thick: 9,
      color: 5,
    })
    expect(customized.props[1]).toMatchObject({
      paths: false,
      hands: true,
      arms: false,
      thick: 9,
      color: 3,
    })
    expect(customized.props.every(({ motion }) => motion.length === 1)).toBe(true)
    expect(customized.props.map(({ anim }) => anim.length)).toEqual(
      source.props.map(({ anim }) => anim.length),
    )
  })
})
