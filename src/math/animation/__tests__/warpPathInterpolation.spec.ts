import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { applyWarpPath } from '@/math/animation/warpPathInterpolation'

describe('applyWarpPath', () => {
  it('preserves established Scale behavior while both vectors are aligned', () => {
    const canonical = new Vector3(0.1, 0.2, 0.3)
    expect(applyWarpPath(canonical, canonical, 0.8, 0.75, new Vector3()).toArray()).toEqual([
      0.08000000000000002, 0.16000000000000003, 0.24,
    ])
  })

  it('uses Strength for deformation while Scale controls the outer radius', () => {
    const result = applyWarpPath(
      new Vector3(0, 1, 0),
      new Vector3(1, 0, 0),
      0.8,
      0.5,
      new Vector3(),
    )

    expect(result.x).toBeCloseTo(0.2)
    expect(result.y).toBeCloseTo(0.6)
  })
})
