import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { useBaseQS } from '@/services/query/createBaseQS'
import { VDEF } from '@/services/query/versions/SpiroAnimQSv1'
import type { RootDataFinal } from '@/types/AnimTypes'

describe('useSpiroAnimQS', () => {
  it('preserves the version-1 query representation', async () => {
    const query = await useSpiroAnimQS(VDEF, useBaseQS(VDEF), 1)
    const root: RootDataFinal = {
      speed: 1,
      type: 0,
      turns: 0,
      depth: 0,
      smooth: true,
      bpm: 60,
      color: 1,
      prop: 1,
      guides: false,
      anchors: false,
      nodes: true,
      paths: true,
      hands: true,
      visible: true,
      aspectx: 16,
      aspecty: 9,
      distance: 22,
      thick: 4,
      props: [
        {
          color: 2,
          anim: [{ arc: 90, plane: 0, turns: -540, move: [2, 0, 0] }],
        },
      ],
    }

    const encoded = query.encodeQS(root, false)

    expect(encoded).toEqual({
      r: 'GE28EPi9g',
      p0: 'O--.biQmw-------wuu',
      v: '1',
    })
    expect(query.encodeQS(query.decodeQS(encoded), false)).toEqual(encoded)
  })

  it('falls back to the current decoder for unavailable versions', async () => {
    const query = await useSpiroAnimQS(VDEF, useBaseQS(VDEF), 1)

    const decoded = await query.decodeVer({ r: 'GE28EPi9g', v: '999' })

    expect(decoded).toMatchObject({ bpm: 60, speed: 1, type: 0 })
  })
})
