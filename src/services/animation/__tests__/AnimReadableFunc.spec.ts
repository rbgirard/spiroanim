import { describe, expect, it } from 'vitest'

import { decodeReadable, encodeReadable } from '@/services/animation/AnimReadableFunc'
import type { RootData } from '@/types/AnimTypes'

describe('AnimReadableFunc', () => {
  const root: RootData = {
    bpm: 60,
    prop: 1,
    color: 2,
    smooth: true,
    guides: false,
    paths: true,
    nodes: true,
    anchors: false,
    props: [{ prop: 0, color: 3, anim: [{ type: 1, turns: 90 }] }],
    aspectx: 16,
    aspecty: 9,
    distance: 22,
    thick: 4,
  }

  it('encodes indexed animation fields as human-readable strings without modifying the source', () => {
    const readable = encodeReadable(root)

    expect(readable).toMatchObject({
      prop: 'Staff',
      color: 'Blue',
      props: [{ prop: 'POI', color: 'Yellow', anim: [{ type: 'Linear', turns: 90 }] }],
    })
    expect(root).toMatchObject({ prop: 1, color: 2, props: [{ prop: 0, color: 3 }] })
  })

  it('decodes readable fields and round-trips the original data', () => {
    expect(decodeReadable(encodeReadable(root))).toEqual(root)
  })
})
