import { Box3, Mesh, MeshStandardMaterial, MeshToonMaterial, TorusGeometry, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { CLUBS, FANS, POI, STAFF, TRIADS } from '@/domain/animation/AnimModels'

describe('AnimModels prop lighting', () => {
  it.each([
    ['POI', POI],
    ['Staff', STAFF],
  ] as const)('uses opaque light-reactive materials for every %s part', (_name, createModel) => {
    const model = createModel(1, 4, 1)

    expect(model.children).toHaveLength(3)
    const tether = model.children[0]
    if (!(tether instanceof Mesh) || !(tether.material instanceof MeshStandardMaterial))
      throw new Error('Expected the tether to use MeshStandardMaterial')
    expect(tether.material.transparent).toBe(false)
    expect(tether.material.opacity).toBe(1)
    expect(tether.material.emissiveIntensity).toBe(0.01)
    expect(tether.material.metalness).toBe(0.035)
    expect(tether.material.roughness).toBe(0.5)
    expect(tether.material.customProgramCacheKey()).toContain('propRim')

    for (const child of model.children.slice(1)) {
      expect(child).toBeInstanceOf(Mesh)
      if (!(child instanceof Mesh)) continue
      expect(child.material).toBeInstanceOf(MeshToonMaterial)
      if (!(child.material instanceof MeshToonMaterial)) continue
      expect(child.material.transparent).toBe(false)
      expect(child.material.opacity).toBe(1)
      expect(child.material.emissiveIntensity).toBe(0.015)
      expect(child.geometry.index).toBeNull()
      expect(child.material.customProgramCacheKey()).toContain('propRim')
    }
  })

  it.each([1, 2])('builds opaque Juggling Clubs with the Poi length at girth %s', (girth) => {
    const clubs = CLUBS(1, 4, girth)
    const poi = POI(1, 4, girth)

    expect(clubs.children).toHaveLength(4)
    expect(clubs.size).toBe(poi.size)
    for (const child of clubs.children) {
      if (!(child instanceof Mesh)) throw new Error('Expected every Club part to be a Mesh')
      expect(child.material).toBeInstanceOf(
        child === clubs.children[1] ? MeshStandardMaterial : MeshToonMaterial,
      )
      expect(child.material.transparent).toBe(false)
      expect(child.material.opacity).toBe(1)
    }

    const clubBounds = new Box3().setFromObject(clubs)
    const poiBounds = new Box3().setFromObject(poi)
    expect(clubBounds.min.y).toBeCloseTo(poiBounds.min.y)
    expect(clubBounds.max.y).toBeCloseTo(poiBounds.max.y)
  })

  it('identifies every additional prop head in normalized local coordinates', () => {
    expect(STAFF(1, 0, 1).additionalPathHeadPositions).toEqual([[0, -1, 0]])
    expect(POI(1, 0, 1).additionalPathHeadPositions).toBeUndefined()
    expect(CLUBS(1, 0, 1).additionalPathHeadPositions).toBeUndefined()

    const fanHeads = FANS(1, 0, 1).additionalPathHeadPositions
    expect(fanHeads).toHaveLength(4)
    expect(fanHeads?.map(([x, y, z]) => [Math.round(x * 1000), Math.round(y * 1000), z])).toEqual([
      [-866, 500, 0],
      [-500, 866, 0],
      [500, 866, 0],
      [866, 500, 0],
    ])

    const triadHeads = TRIADS(1, 0, 1).additionalPathHeadPositions
    expect(triadHeads).toHaveLength(2)
    expect(triadHeads?.map(([x, y, z]) => [Math.round(x * 1000), Math.round(y * 1000), z])).toEqual(
      [
        [866, -500, 0],
        [-866, -500, 0],
      ],
    )
  })

  it('builds Fans with one ring, five spokes, five wicks, and two braces', () => {
    const fans = FANS(1, 4, 1)
    const poi = POI(1, 4, 1)
    const fanWicks = [2, 4, 6, 8, 10].map((index) => fans.children[index]!)

    expect(fans.children).toHaveLength(13)
    expect(fans.size).toBe(poi.size)
    for (const wick of fanWicks) expect(wick.position.length()).toBeCloseTo(fans.size)
  })

  it('builds Triads with the Fan grip, three identical spokes, and equal 120-degree angles', () => {
    const triads = TRIADS(1, 4, 1)
    const fans = FANS(1, 4, 1)
    const triadRing = triads.children[0]
    const fanRing = fans.children[0]

    expect(triads.children).toHaveLength(7)
    expect(triads.size).toBe(fans.size)
    for (const end of [triads.children[2]!, triads.children[4]!, triads.children[6]!])
      expect(end.position.length()).toBeCloseTo(triads.size)
    expect(triadRing).toBeInstanceOf(Mesh)
    expect(fanRing).toBeInstanceOf(Mesh)
    if (
      !(triadRing instanceof Mesh) ||
      !(fanRing instanceof Mesh) ||
      !(triadRing.geometry instanceof TorusGeometry) ||
      !(fanRing.geometry instanceof TorusGeometry)
    )
      throw new Error('Expected Triad and Fan grip rings')
    expect(triadRing.geometry.parameters.radius).toBe(fanRing.geometry.parameters.radius)
    expect(triadRing.geometry.parameters.tube).toBe(fanRing.geometry.parameters.tube)

    const directions = [
      new Vector3(0, 1, 0),
      ...(triads.additionalPathHeadPositions ?? []).map((position) =>
        new Vector3().fromArray(position),
      ),
    ]
    expect(directions).toHaveLength(3)
    for (let index = 0; index < directions.length; index++) {
      const current = directions[index]!
      const next = directions[(index + 1) % directions.length]!
      expect(current.length()).toBeCloseTo(1)
      expect(current.angleTo(next)).toBeCloseTo((Math.PI * 2) / 3)
    }
  })
})
