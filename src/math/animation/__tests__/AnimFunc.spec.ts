import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { angularDistance, closestPoint, rootCompile } from '@/math/animation/AnimFunc'
import { PNTIND, PPOS } from '@/domain/animation/AnimStruct'
import { rootFinal } from '@/math/animation/PlayerFunc'
import type { RootData } from '@/types/AnimTypes'

describe('AnimFunc', () => {
  it('measures the shortest wrapped angular distance', () => {
    expect(angularDistance((10 * Math.PI) / 180, (350 * Math.PI) / 180)).toBeCloseTo(
      (20 * Math.PI) / 180,
    )
  })

  it('finds the closest point from all points or a restricted guide', () => {
    const position = PPOS[PNTIND.MBC]!.clone()

    expect(closestPoint(position)).toBe(PNTIND.MBC)
    expect(closestPoint(position, [PNTIND.FTC, PNTIND.BTC])).toBe(PNTIND.FTC)
    expect(closestPoint(new Vector3(100, 100, 100), [])).toBe(0)
  })

  it('compiles inherited values without modifying the editable source', () => {
    const root: RootData = {
      bpm: 60,
      prop: 1,
      color: 2,
      smooth: true,
      guides: true,
      paths: false,
      nodes: true,
      anchors: false,
      props: [{ anim: [{ beats: 2, turns: 90 }, {}] }],
      aspectx: 16,
      aspecty: 9,
      distance: 22,
      thick: 4,
    }
    const final = rootFinal(root)

    const compiled = rootCompile(final)

    expect(compiled.props[0]).toMatchObject({ prop: 1, color: 2, guides: true, thick: 4 })
    expect(compiled.props[0]!.anim[0]).toMatchObject({ beats: 2, turns: 90, scale: 10 })
    expect(compiled.props[0]!.anim[1]).toMatchObject({ beats: 2, turns: 90 })
    expect(final.props[0]!.anim[1]).toEqual({})
  })
})
