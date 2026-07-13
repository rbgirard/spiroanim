import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { orthoAngle, orthoNext, orthoPoint } from '@/math/animation/OrthogonalFunc'

describe('OrthogonalFunc', () => {
  const source = new Vector3(0, 0, 1)
  const reference = new Vector3(0, 1, 0)

  it('constructs and recovers a signed orthogonal angle', () => {
    const target = orthoPoint(Math.PI / 2, source, reference)

    expect(target.x).toBeCloseTo(-1)
    expect(target.y).toBeCloseTo(0)
    expect(target.z).toBeCloseTo(0)
    expect(orthoAngle(source, target, reference)).toBeCloseTo(Math.PI / 2)
  })

  it('keeps chained source and reference vectors normalized and orthogonal', () => {
    const nextSource = source.clone()
    const nextReference = reference.clone()
    const direction = new Vector3()

    orthoNext(Math.PI / 4, Math.PI / 3, nextSource, nextReference, direction)

    expect(nextSource.length()).toBeCloseTo(1)
    expect(nextReference.length()).toBeCloseTo(1)
    expect(nextSource.dot(nextReference)).toBeCloseTo(0)
    expect(direction.length()).toBeCloseTo(1)
  })

  it('returns zero for identical and antipodal targets', () => {
    expect(orthoAngle(source, source, reference)).toBe(0)
    expect(orthoAngle(source, source.clone().negate(), reference)).toBe(0)
  })
})
