import { describe, expect, it } from 'vitest'

import { migrateLegacyTurns } from '@/services/query/migrateLegacyTurns'
import type { RootDataFinal } from '@/types/AnimTypes'

const createRoot = (): RootDataFinal => ({
  speed: 1,
  type: 0,
  turns: 0,
  depth: 0,
  bpm: 120,
  prop: 0,
  color: 0,
  smooth: true,
  guides: false,
  paths: true,
  travel: false,
  hands: true,
  arms: false,
  visible: true,
  nodes: false,
  anchors: false,
  props: [
    {
      anim: [{ turns: -2200 }, { turns: 12.3 }, { turns: 1500 }, {}],
      motion: [],
    },
  ],
  aspectx: 1,
  aspecty: 1,
  camera: [],
  thick: 4,
})

describe('migrateLegacyTurns', () => {
  it('clamps and rounds authored Turns without materializing sparse frames', () => {
    const migrated = migrateLegacyTurns(createRoot())

    expect(migrated.props[0]!.anim).toEqual([
      { turns: -2160 },
      { turns: 12.5 },
      { turns: 1440 },
      {},
    ])
  })
})
