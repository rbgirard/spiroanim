import { describe, expect, it } from 'vitest'

import { tmpProp } from '@/domain/animation/tmpProp'

describe('tmpProp', () => {
  it('provides the complete decoded default animation', () => {
    expect(tmpProp).toMatchObject({
      bpm: 60,
      prop: 1,
      color: 1,
      aspectx: 16,
      aspecty: 9,
    })
    expect(tmpProp.props).toHaveLength(2)
    expect(tmpProp.props[0]).toMatchObject({ color: 2 })
    expect(tmpProp.props[0]!.anim).toHaveLength(9)
    expect(tmpProp.props[1]).toMatchObject({ color: 5 })
    expect(tmpProp.props[1]!.anim[0]).toMatchObject({
      arc: 90,
      plane: 180,
      turns: -540,
      move: [-2, 0, 0],
    })
  })
})
