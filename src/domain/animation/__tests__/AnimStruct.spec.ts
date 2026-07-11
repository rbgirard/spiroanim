import { describe, expect, it } from 'vitest'

import { COLORS, GREF, GUIDES, INDPNT, PPOS, PTEXT, TTEXT } from '@/domain/animation/AnimStruct'

describe('AnimStruct', () => {
  it('preserves stable serialized catalog ordering', () => {
    expect(PTEXT).toEqual(['POI', 'Staff'])
    expect(COLORS).toEqual(['Red', 'Green', 'Blue', 'Yellow', 'Cyan', 'Magenta', 'Orange'])
    expect(TTEXT).toEqual(['Spherical', 'Linear'])
  })

  it('constructs a position and guide map for every point', () => {
    expect(PPOS).toHaveLength(INDPNT.length)
    expect(GUIDES.length).toBeGreaterThan(0)
    expect(Object.keys(GREF)).toHaveLength(INDPNT.length)
  })
})
