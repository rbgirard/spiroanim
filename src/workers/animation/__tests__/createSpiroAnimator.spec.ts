import {
  Group,
  Mesh,
  MeshToonMaterial,
  Quaternion,
  Scene,
  Vector3,
  type InterleavedBufferAttribute,
} from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { describe, expect, it } from 'vitest'

import { COLSET, MOTION_SHAPE, RADIUS, TTYPE } from '@/domain/animation/AnimStruct'
import { doubleAnimationFrames } from '@/features/editor/manage/resampleAnimationFrames'
import { rootCompile } from '@/math/animation/AnimFunc'
import { applyWarpPath } from '@/math/animation/warpPathInterpolation'
import { cartesianToMotionAngles, createMotionDirectionState } from '@/math/animation/MotionFunc'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { createSpiroAnimator, type LineMaterial2 } from '@/workers/animation/createSpiroAnimator'
import type { MotionData, RootData } from '@/types/AnimTypes'

type CartesianMotionFrame = Omit<MotionData, 'arc' | 'plane' | 'distance'> & {
  move?: [number, number, number]
}

const angularMotion = (frames: CartesianMotionFrame[]): MotionData[] => {
  const state = createMotionDirectionState()
  return frames.map(({ move, ...frame }) => {
    if (move === undefined) return frame
    const [plane, arc, distance] = cartesianToMotionAngles(move, state)
    return { ...frame, plane, arc, distance }
  })
}

const getLineByColor = (scene: Scene, color: number): Line2 | undefined =>
  scene
    .getObjectsByProperty('isLine2', true)
    .find(
      (object): object is Line2 =>
        object instanceof Line2 && (object.material as LineMaterial2).color.getHex() === color,
    )

const getLineEndpoints = (line: Line2) => {
  const starts = line.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute
  const ends = line.geometry.getAttribute('instanceEnd') as InterleavedBufferAttribute

  return {
    first: new Vector3(starts.getX(0), starts.getY(0), starts.getZ(0)),
    last: new Vector3(
      ends.getX(ends.count - 1),
      ends.getY(ends.count - 1),
      ends.getZ(ends.count - 1),
    ),
  }
}

const getLinePoints = (line: Line2): Vector3[] => {
  const starts = line.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute
  const ends = line.geometry.getAttribute('instanceEnd') as InterleavedBufferAttribute
  const points = Array.from(
    { length: starts.count },
    (_, index) => new Vector3(starts.getX(index), starts.getY(index), starts.getZ(index)),
  )

  points.push(
    new Vector3(ends.getX(ends.count - 1), ends.getY(ends.count - 1), ends.getZ(ends.count - 1)),
  )
  return points
}

const createRoot = (arms: boolean, hands = false): RootData => ({
  bpm: 60,
  prop: 0,
  color: 2,
  smooth: true,
  guides: false,
  paths: false,
  hands,
  arms,
  visible: true,
  nodes: false,
  anchors: false,
  props: [
    {
      motion: angularMotion([{ beats: 1, move: [2, 0, 0] }, {}]),
      anim: [
        { beats: 1, scale: 100 },
        { scale: 200, arc: 90 },
      ],
    },
  ],
  aspectx: 16,
  aspecty: 9,
  distance: 22,
  thick: 7,
})

const createAnimator = (arms: boolean, hands = false) => {
  const scene = new Scene()
  const compiled = rootCompile(rootFinal(createRoot(arms, hands)))
  const animator = createSpiroAnimator({
    scene,
    speed: 1,
    girth: 2,
    bpm: compiled.bpm,
    smooth: compiled.smooth,
    prop: compiled.props[0]!,
    completed: () => undefined,
    width: 800,
    height: 600,
    distance: 22,
    fov: 45,
    timeline: false,
  })

  return { animator, scene }
}

const getAnimatedModelGroup = (scene: Scene): Group => {
  let modelGroup: Group | undefined
  scene.traverse((child) => {
    if (
      modelGroup === undefined &&
      child instanceof Group &&
      child.children.some((item) => 'size' in item)
    )
      modelGroup = child
  })
  if (!modelGroup) throw new Error('Expected the animated model group')
  return modelGroup
}

it('draws and toggles the additional Staff head path', () => {
  const root = createRoot(false)
  root.prop = 1
  root.paths = true
  const scene = new Scene()
  const compiled = rootCompile(rootFinal(root))
  const animator = createSpiroAnimator({
    scene,
    speed: 1,
    girth: 2,
    bpm: compiled.bpm,
    smooth: compiled.smooth,
    prop: compiled.props[0]!,
    completed: () => undefined,
    width: 800,
    height: 600,
    distance: 22,
    fov: 45,
    timeline: false,
  })
  const paths = scene
    .getObjectsByProperty('isLine2', true)
    .filter(
      (object): object is Line2 =>
        object instanceof Line2 &&
        (object.material as LineMaterial2).color.getHex() === COLSET[2]![0],
    )
  const additionalPath = paths.find((path) => path.parent?.parent?.parent === scene)

  expect(paths).toHaveLength(2)
  expect(additionalPath).toBeDefined()
  expect(additionalPath?.parent?.visible).toBe(true)
  const primaryPath = paths.find((path) => path !== additionalPath)
  if (!primaryPath || !additionalPath) throw new Error('Expected both Staff endpoint paths')
  expect(
    getLinePoints(primaryPath)[0]!.distanceTo(getLinePoints(additionalPath)[0]!),
  ).toBeGreaterThan(0)

  animator.setAllHeadPaths(false)
  expect(additionalPath?.parent?.visible).toBe(false)
  animator.setAllHeadPaths(true)
  expect(additionalPath?.parent?.visible).toBe(true)
})

it('draws a path for all five Fan heads and rotates them with Twist', () => {
  const root = createRoot(false)
  root.prop = 3
  root.paths = true
  root.props[0]!.anim = [{ beats: 1, twist: 90 }, { twist: 0 }]
  const scene = new Scene()
  const compiled = rootCompile(rootFinal(root))
  const animator = createSpiroAnimator({
    scene,
    speed: 1,
    girth: 2,
    bpm: compiled.bpm,
    smooth: compiled.smooth,
    prop: compiled.props[0]!,
    completed: () => undefined,
    width: 800,
    height: 600,
    distance: 22,
    fov: 45,
    timeline: false,
  })
  const paths = scene
    .getObjectsByProperty('isLine2', true)
    .filter(
      (object): object is Line2 =>
        object instanceof Line2 &&
        (object.material as LineMaterial2).color.getHex() === COLSET[2]![0],
    )
  const additionalPaths = paths.filter((path) => path.parent?.parent?.parent === scene)

  expect(paths).toHaveLength(5)
  expect(additionalPaths).toHaveLength(4)
  const firstAdditionalPoint = getLinePoints(additionalPaths[0]!)[0]!
  expect(Math.abs(firstAdditionalPoint.z)).toBeGreaterThan(0)

  animator.setAllHeadPaths(false)
  expect(additionalPaths.every((path) => path.parent?.visible === false)).toBe(true)
  animator.setAllHeadPaths(true)
  expect(additionalPaths.every((path) => path.parent?.visible === true)).toBe(true)
})

describe('createSpiroAnimator Arms rendering', () => {
  it('does not create an arm when Arms is false', () => {
    const { scene } = createAnimator(false)

    expect(scene.getObjectsByProperty('isLine2', true)).toHaveLength(0)
  })

  it('uses the poi handle color and Thick + 4 width while following the scaled hand position', () => {
    const { animator, scene } = createAnimator(true)
    const armLine = scene.getObjectsByProperty('isLine2', true)[0]

    expect(armLine).toBeInstanceOf(Line2)
    if (!(armLine instanceof Line2)) throw new Error('Expected an Arms Line2')

    const material = armLine.material as LineMaterial2
    expect(material.color.getHex()).toBe(COLSET[2]![1])
    expect(material.linewidth2).toBeCloseTo(0.22)
    expect(material.vertexColors).toBe(false)
    expect(armLine.children).toHaveLength(0)
    expect(material.customProgramCacheKey()).toContain('armSurfaceHighlight')

    animator.seek(500)

    const start = armLine.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute
    const end = armLine.geometry.getAttribute('instanceEnd') as InterleavedBufferAttribute
    const startPosition = [start.getX(0), start.getY(0), start.getZ(0)] as const
    const armLength = Math.hypot(
      end.getX(0) - startPosition[0],
      end.getY(0) - startPosition[1],
      end.getZ(0) - startPosition[2],
    )

    expect(startPosition).toEqual([0, 0, 0])
    expect(armLength).toBeCloseTo(7.5)

    scene.updateMatrixWorld(true)
    expect(armLine.localToWorld(new Vector3(...startPosition)).toArray()).toEqual([1, 0, 0])

    animator.dimensions(1600, 900, 30, 60)
    expect(material.resolution.toArray()).toEqual([1600, 900])
    expect(material.linewidth).toBeCloseTo((0.22 * 900) / (2 * Math.tan(Math.PI / 6) * 30))
  })

  it('uses the poi tether color for Hands', () => {
    const { scene } = createAnimator(false, true)
    const handLine = scene.getObjectsByProperty('isLine2', true)[0]

    expect(handLine).toBeInstanceOf(Line2)
    if (!(handLine instanceof Line2)) throw new Error('Expected a Hands Line2')

    const material = handLine.material as LineMaterial2
    expect(material.color.getHex()).toBe(COLSET[2]![2])
  })

  it('can hide and restore Arms for image export', () => {
    const { animator, scene } = createAnimator(true)
    const armLine = scene.getObjectsByProperty('isLine2', true)[0]
    if (!(armLine instanceof Line2)) throw new Error('Expected an Arms Line2')

    animator.setExportHidden(['arms'], true)
    expect(armLine.parent?.visible).toBe(false)

    animator.setExportHidden(['arms'], false)
    expect(armLine.parent?.visible).toBe(true)
  })
})

describe('createSpiroAnimator export rendering', () => {
  it('hides editor-only active lines without hiding authored path lines', () => {
    const root = createRoot(false)
    root.paths = true
    root.hands = false
    const scene = new Scene()
    const finalized = rootFinal(root)
    finalized.props[0]!.active = true
    const compiled = rootCompile(finalized)
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })
    const authoredPath = getLineByColor(scene, COLSET[2]![0])
    const editorHandPath = getLineByColor(scene, COLSET[2]![2])
    if (!authoredPath || !editorHandPath) throw new Error('Expected authored and editor path lines')

    animator.setExporting(true)
    expect(authoredPath.parent?.visible).toBe(true)
    expect(editorHandPath.parent?.visible).toBe(false)

    animator.setExporting(false)
    expect(authoredPath.parent?.visible).toBe(true)
    expect(editorHandPath.parent?.visible).toBe(true)
  })
})

describe('createSpiroAnimator prop orientation', () => {
  it('keeps the same smooth orientation and baked path after doubling Rotate', () => {
    const root = createRoot(false)
    root.paths = true
    root.props[0]!.motion = []
    root.props[0]!.anim = [{ arc: 270 }, { arc: 90, turns: 180, rotate: 180 }, {}, {}]

    const original = rootFinal(root)
    const doubled = doubleAnimationFrames(original)
    if (!doubled) throw new Error('Expected the animation to be safely doubled')

    const createTestAnimator = (animation: ReturnType<typeof rootFinal>) => {
      const scene = new Scene()
      const compiled = rootCompile(animation)
      const animator = createSpiroAnimator({
        scene,
        speed: 1,
        girth: 2,
        bpm: compiled.bpm,
        smooth: compiled.smooth,
        prop: compiled.props[0]!,
        completed: () => undefined,
        width: 800,
        height: 600,
        distance: 22,
        fov: 45,
        timeline: false,
      })
      return { animator, model: getAnimatedModelGroup(scene), scene }
    }

    const originalResult = createTestAnimator(original)
    const doubledResult = createTestAnimator(doubled)
    for (let milliseconds = 0; milliseconds <= 3000; milliseconds += 25) {
      originalResult.animator.seek(milliseconds)
      doubledResult.animator.seek(milliseconds)
      expect(
        Math.abs(originalResult.model.quaternion.dot(doubledResult.model.quaternion)),
      ).toBeCloseTo(1, 10)
      expect(originalResult.model.position.distanceTo(doubledResult.model.position)).toBeLessThan(
        1e-9,
      )
    }

    const originalPath = getLineByColor(originalResult.scene, COLSET[2]![0])
    const doubledPath = getLineByColor(doubledResult.scene, COLSET[2]![0])
    if (!originalPath || !doubledPath) throw new Error('Expected both baked Paths')
    const originalPoints = getLinePoints(originalPath)
    const doubledPoints = getLinePoints(doubledPath)
    expect(doubledPoints).toHaveLength(originalPoints.length * 2)
    const pointDifferences = originalPoints.map((point, index) => {
      const segmentIndex = Math.floor(index / 100)
      const segmentPointIndex = index % 100
      const doubledIndex =
        segmentIndex * 200 +
        (segmentPointIndex <= 49 ? segmentPointIndex * 2 : segmentPointIndex * 2 + 1)
      return point.distanceTo(doubledPoints[doubledIndex]!)
    })
    expect(Math.max(...pointDifferences)).toBeLessThan(1e-6)
  })

  it('consumes the completed Rotate basis after its smooth interval', () => {
    const root = createRoot(false)
    root.prop = 3
    root.props[0]!.motion = []
    root.props[0]!.anim = [{ arc: 270 }, { arc: 90, turns: 180, rotate: 180 }, {}, {}]

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })
    const model = getAnimatedModelGroup(scene)
    const sample = (milliseconds: number) => {
      animator.seek(milliseconds)
      return {
        hand: model.position.clone().normalize(),
        prop: new Vector3(0, 1, 0).applyQuaternion(model.quaternion).normalize(),
      }
    }
    const seam = sample(1000)
    const after = sample(1001)
    const handDirection = seam.hand.clone().cross(after.hand)
    const propDirection = seam.prop.clone().cross(after.prop)

    expect(compiled.props[0]!.anim[1]!.rebasePrimaryOrientation).toBe(false)
    expect(compiled.props[0]!.anim[2]!.rebasePrimaryOrientation).toBe(true)
    expect(handDirection.dot(propDirection)).toBeGreaterThan(0)
  })

  it('applies precompiled inherited Twist around the transported local prop axis', () => {
    const root = createRoot(false)
    root.prop = 3
    root.props[0]!.motion = []
    root.props[0]!.anim = [{}, { twist: 90 }, {}, { twist: 0 }]

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })
    const modelGroup = getAnimatedModelGroup(scene)
    const sampleNormal = (milliseconds: number) => {
      animator.seek(milliseconds)
      return new Vector3(0, 0, 1).applyQuaternion(modelGroup.quaternion)
    }
    const baseOrientation = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      new Vector3().fromArray(compiled.props[0]!.anim[0]!.rot),
    )
    const expectedNormal = (degrees: number) =>
      new Vector3(0, 0, 1)
        .applyAxisAngle(new Vector3(0, 1, 0), (degrees * Math.PI) / 180)
        .applyQuaternion(baseOrientation)

    expect(sampleNormal(500).distanceTo(expectedNormal(45))).toBeLessThan(1e-9)
    expect(sampleNormal(1500).distanceTo(expectedNormal(135))).toBeLessThan(1e-9)
    expect(sampleNormal(2500).distanceTo(expectedNormal(180))).toBeLessThan(1e-9)

    // Seeking backward must use compiled frame state rather than playback history.
    expect(sampleNormal(500).distanceTo(expectedNormal(45))).toBeLessThan(1e-9)
  })

  it('keeps Fans roll continuous while crossing the local +Y antipode', () => {
    const root = createRoot(false)
    root.prop = 3
    root.props[0]!.motion = []
    root.props[0]!.anim = [
      { arc: 180, scale: 70 },
      { arc: 90, turns: -360 },
      { plane: 90 },
      {},
      { plane: 90 },
      {},
      {},
      {},
      {},
    ]

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })
    const modelGroup = getAnimatedModelGroup(scene)
    const sampleNormal = (milliseconds: number) => {
      animator.seek(milliseconds)
      return new Vector3(0, 0, 1).applyQuaternion(modelGroup.quaternion)
    }

    const before = sampleNormal(5999)
    const antipode = sampleNormal(6000)
    const after = sampleNormal(6001)
    animator.seek(6000)
    const directionAtAntipode = new Vector3(0, 1, 0).applyQuaternion(modelGroup.quaternion)

    expect(before.angleTo(antipode)).toBeLessThan(0.01)
    expect(antipode.angleTo(after)).toBeLessThan(0.01)
    expect(
      directionAtAntipode.distanceTo(new Vector3().fromArray(compiled.props[0]!.anim[6]!.rot)),
    ).toBeLessThan(1e-9)
  })
})

describe('createSpiroAnimator linear scaling', () => {
  it('moves through the straight midpoint between scaled endpoints', () => {
    const root = createRoot(false)
    root.props[0]!.motion = []
    root.props[0]!.anim[1]!.type = TTYPE.LINE

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const prop = compiled.props[0]!
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })
    const modelGroup = getAnimatedModelGroup(scene)

    animator.seek(500)

    const start = new Vector3()
      .fromArray(prop.anim[0]!.pos)
      .multiplyScalar((RADIUS * prop.anim[0]!.scale) / 100)
    const end = new Vector3()
      .fromArray(prop.anim[1]!.pos)
      .multiplyScalar((RADIUS * prop.anim[1]!.scale) / 100)
    const expectedMidpoint = start.lerp(end, 0.5)

    expect(modelGroup.position.distanceTo(expectedMidpoint)).toBeCloseTo(0)
  })

  it('keeps Linear endpoints canonical and connects them with a straight line', () => {
    const root = createRoot(false)
    root.props[0]!.motion = []
    root.props[0]!.anim[0]!.warp = -45
    root.props[0]!.anim[1]!.warp = 90
    root.props[0]!.anim[1]!.type = TTYPE.LINE

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const prop = compiled.props[0]!
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })

    animator.seek(500)

    const expected = new Vector3()
      .fromArray(prop.anim[0]!.pos)
      .multiplyScalar(RADIUS * (prop.anim[0]!.scale / 100))
      .lerp(
        new Vector3()
          .fromArray(prop.anim[1]!.pos)
          .multiplyScalar(RADIUS * (prop.anim[1]!.scale / 100)),
        0.5,
      )
    expect(getAnimatedModelGroup(scene).position.distanceTo(expected)).toBeCloseTo(0)
  })

  it('traces an auxiliary spherical rotation without changing prop orientation', () => {
    const warpedRoot = createRoot(false)
    warpedRoot.props[0]!.motion = []
    warpedRoot.props[0]!.anim[1]!.warp = 90
    warpedRoot.props[0]!.anim[1]!.strength = 1000
    const canonicalRoot = structuredClone(warpedRoot)
    delete canonicalRoot.props[0]!.anim[1]!.warp

    const create = (root: RootData) => {
      const scene = new Scene()
      const compiled = rootCompile(rootFinal(root))
      const animator = createSpiroAnimator({
        scene,
        speed: 1,
        girth: 2,
        bpm: compiled.bpm,
        smooth: compiled.smooth,
        prop: compiled.props[0]!,
        completed: () => undefined,
        width: 800,
        height: 600,
        distance: 22,
        fov: 45,
        timeline: false,
      })
      animator.seek(500)
      return getAnimatedModelGroup(scene)
    }

    const warped = create(warpedRoot)
    const canonical = create(canonicalRoot)

    expect(warped.position.distanceTo(canonical.position)).toBeGreaterThan(0.1)
    expect(Math.abs(warped.quaternion.dot(canonical.quaternion))).toBeCloseTo(1)
  })

  it('uses Strength for the Warp deformation independently from Scale', () => {
    const root = createRoot(false, true)
    root.paths = true
    root.props[0]!.motion = []
    root.props[0]!.anim = [
      { beats: 1, arc: 0, warp: 0, strength: 500, scale: 80 },
      { arc: 90, warp: 90, strength: 500, scale: 80 },
    ]

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const prop = compiled.props[0]!
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })

    animator.seek(500)

    const canonical = new Vector3()
      .fromArray(prop.anim[0]!.pos)
      .applyAxisAngle(new Vector3().fromArray(prop.anim[1]!.posx), Math.PI / 4)
    const auxiliary = new Vector3()
      .fromArray(prop.anim[0]!.warpPos)
      .applyAxisAngle(new Vector3().fromArray(prop.anim[1]!.warpx), Math.PI / 2)
    const expected = applyWarpPath(canonical, auxiliary, 0.8, 0.5, new Vector3()).multiplyScalar(
      RADIUS,
    )
    const position = getAnimatedModelGroup(scene).position
    const pathLine = getLineByColor(scene, COLSET[2]![2])
    if (!pathLine) throw new Error('Expected the Warp-adjusted hand line')
    const nearestPathPoint = Math.min(
      ...getLinePoints(pathLine).map((point) => point.distanceTo(expected)),
    )

    expect(position.distanceTo(expected)).toBeCloseTo(0)
    expect(position.length()).toBeGreaterThan(0)
    expect(nearestPathPoint).toBeLessThan(0.1)
  })

  it('interpolates Motion independently from the animation frames', () => {
    const root = createRoot(false)
    root.props[0]!.motion = angularMotion([{ beats: 1, move: [0, 0, 0] }, { move: [10, 0, 0] }])

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })

    const motionGroup = scene.children[0]
    if (!(motionGroup instanceof Group)) throw new Error('Expected the Motion group')

    animator.seek(500)
    expect(motionGroup.position.toArray()).toEqual([2.5, 0, 0])

    animator.seek(1000)
    expect(motionGroup.position.toArray()).toEqual([5, 0, 0])
  })

  it('draws Travel with the Hands color and closes a 100% Circle', () => {
    const root = createRoot(false)
    root.travel = true
    root.props[0]!.motion = [
      { beats: 1, distance: 0 },
      { distance: 10, shape: MOTION_SHAPE.CIRCLE, amount: 100 },
    ]

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })

    const travelLine = getLineByColor(scene, COLSET[2]![2])
    if (!travelLine) throw new Error('Expected a Travel line')
    const points = getLinePoints(travelLine)

    expect(points.at(-1)!.distanceTo(points[0]!)).toBeCloseTo(0)
    expect(Math.max(...points.map((point) => point.distanceTo(points[0]!)))).toBeGreaterThan(0)

    animator.seek(500)
    expect(scene.children[0]!.position.length()).toBeGreaterThan(0)
    animator.seek(1000)
    expect(scene.children[0]!.position.length()).toBeCloseTo(0)

    animator.setExportHidden(['travel'], true)
    expect(travelLine.parent?.visible).toBe(false)
  })

  it('bakes Motion into Paths and Hands without moving the completed lines', () => {
    const root = createRoot(false, true)
    root.paths = true
    root.nodes = true
    root.props[0]!.anim = [
      { beats: 1, scale: 100, arc: 0, turns: 0 },
      { scale: 100, arc: 0, turns: 0 },
      { scale: 100, arc: 0, turns: 0 },
    ]
    root.props[0]!.motion = angularMotion([
      { beats: 1, move: [0, 0, 0] },
      { move: [10, 0, 0] },
      { move: [0, 0, 0] },
    ])

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })

    const pathLine = getLineByColor(scene, COLSET[2]![0])
    const handLine = getLineByColor(scene, COLSET[2]![2])
    if (!pathLine || !handLine) throw new Error('Expected Paths and Hands lines')

    const pathEndpoints = getLineEndpoints(pathLine)
    const handEndpoints = getLineEndpoints(handLine)
    expect(pathEndpoints.last.x - pathEndpoints.first.x).toBeCloseTo(5)
    expect(handEndpoints.last.x - handEndpoints.first.x).toBeCloseTo(5)
    expect((pathLine.material as LineMaterial2).vertexColors).toBe(true)
    expect((handLine.material as LineMaterial2).vertexColors).toBe(true)
    expect((pathLine.material as LineMaterial2).customProgramCacheKey()).toContain(
      'vPropLineViewDepth',
    )
    expect((handLine.material as LineMaterial2).depthCenterUniform?.value).toBe(22)
    expect(pathLine.geometry.getAttribute('instanceColorStart')).toBeDefined()
    expect(handLine.geometry.getAttribute('instanceColorStart')).toBeDefined()
    expect(pathLine.parent?.parent).toBe(scene)
    expect(handLine.parent?.parent).toBe(scene)

    const pathSegmentCount = pathLine.geometry.getAttribute('instanceStart').count
    animator.setProgressivePaths(true)
    animator.seek(0)
    expect(pathLine.geometry.instanceCount).toBe(0)
    animator.seek(500)
    expect(pathLine.geometry.instanceCount).toBeGreaterThan(0)
    expect(pathLine.geometry.instanceCount).toBeLessThan(pathSegmentCount)
    animator.setProgressivePaths(false)
    expect(pathLine.geometry.instanceCount).toBe(pathSegmentCount)

    const nodesGroup = scene.children.find(
      (child): child is Group =>
        child instanceof Group && child.children.some((item) => item.type === 'Mesh'),
    )
    if (!nodesGroup) throw new Error('Expected the Nodes group')
    expect(nodesGroup.children).toHaveLength(2)
    const firstNode = nodesGroup.children[0]
    if (!(firstNode instanceof Mesh) || !(firstNode.material instanceof MeshToonMaterial))
      throw new Error('Expected a toon-shaded node Mesh')
    expect(firstNode.material.emissiveIntensity).toBe(0.025)
    expect(nodesGroup.children[1]!.position.x - nodesGroup.children[0]!.position.x).toBeCloseTo(5)

    animator.seek(500)
    scene.updateMatrixWorld(true)

    expect(pathLine.getWorldPosition(new Vector3()).toArray()).toEqual([0, 0, 0])
    expect(handLine.getWorldPosition(new Vector3()).toArray()).toEqual([0, 0, 0])
    expect(nodesGroup.getWorldPosition(new Vector3()).toArray()).toEqual([0, 0, 0])
    expect(scene.children[0]!.position.toArray()).toEqual([2.5, 0, 0])
  })

  it('continues baked Paths and Hands when Motion outlasts Animation', () => {
    const root = createRoot(false, true)
    root.paths = true
    root.props[0]!.anim = [{ beats: 1, scale: 100, arc: 0, turns: 0 }]
    root.props[0]!.motion = angularMotion([{ beats: 1, move: [0, 0, 0] }, { move: [10, 0, 0] }])

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })

    const pathLine = getLineByColor(scene, COLSET[2]![0])
    const handLine = getLineByColor(scene, COLSET[2]![2])
    if (!pathLine || !handLine) throw new Error('Expected extended Paths and Hands lines')

    const pathEndpoints = getLineEndpoints(pathLine)
    const handEndpoints = getLineEndpoints(handLine)
    expect(pathEndpoints.last.x - pathEndpoints.first.x).toBeCloseTo(5)
    expect(handEndpoints.last.x - handEndpoints.first.x).toBeCloseTo(5)
  })

  it('includes unaligned Motion boundaries exactly in the baked path', () => {
    const root = createRoot(false)
    root.paths = true
    root.props[0]!.anim = [
      { beats: 4, scale: 100, arc: 0, turns: 0 },
      { scale: 100, arc: 0, turns: 0 },
    ]
    root.props[0]!.motion = angularMotion([
      { beats: 1, move: [0, 0, 0] },
      { beats: 1, move: [10, 0, 0] },
      { beats: 2, move: [0, 10, 0] },
      { move: [0, 0, 0] },
    ])

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })

    const pathLine = getLineByColor(scene, COLSET[2]![0])
    if (!pathLine) throw new Error('Expected a Paths line')

    const points = getLinePoints(pathLine)
    const firstPoint = points[0]!.clone()
    const offsets = points.map((point) => point.clone().sub(firstPoint))
    expect(offsets.some((offset) => offset.distanceTo(new Vector3(5, 0, 0)) < 0.000001)).toBe(true)
    expect(offsets.some((offset) => offset.distanceTo(new Vector3(5, 5, 0)) < 0.000001)).toBe(true)
  })

  it('holds the final animated pose while longer Motion continues', () => {
    const root = createRoot(false)
    root.props[0]!.anim = [
      { beats: 1, scale: 100, arc: 0 },
      { scale: 100, arc: 90 },
    ]
    root.props[0]!.motion = angularMotion([
      { beats: 1, move: [0, 0, 0] },
      { beats: 1, move: [10, 0, 0] },
      { move: [10, 0, 0] },
    ])

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    const animator = createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })

    const motionGroup = scene.children[0]
    if (!(motionGroup instanceof Group)) throw new Error('Expected the Motion group')
    const modelGroup = motionGroup.children.find(
      (child): child is Group =>
        child instanceof Group && child.children.some((item) => 'size' in item),
    )
    if (!modelGroup) throw new Error('Expected the animated model group')

    animator.seek(1000)
    const finalAnimatedPosition = modelGroup.position.clone()

    animator.seek(1500)
    expect(modelGroup.position.distanceTo(finalAnimatedPosition)).toBeCloseTo(0)
    expect(motionGroup.position.toArray()).toEqual([7.5, 0, 0])
  })

  it('connects consecutive head paths at their shared endpoint', () => {
    const root = createRoot(false)
    root.paths = true
    root.props[0]!.anim = [
      { beats: 1, scale: 100 },
      { type: TTYPE.LINE, scale: 200, arc: 90 },
      { type: TTYPE.LINE, scale: 150, arc: 90 },
    ]

    const scene = new Scene()
    const compiled = rootCompile(rootFinal(root))
    createSpiroAnimator({
      scene,
      speed: 1,
      girth: 2,
      bpm: compiled.bpm,
      smooth: compiled.smooth,
      prop: compiled.props[0]!,
      completed: () => undefined,
      width: 800,
      height: 600,
      distance: 22,
      fov: 45,
      timeline: false,
    })

    const pathLine = scene.getObjectsByProperty('isLine2', true)[0]
    if (!(pathLine instanceof Line2)) throw new Error('Expected a Paths Line2')

    const starts = pathLine.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute
    const ends = pathLine.geometry.getAttribute('instanceEnd') as InterleavedBufferAttribute
    const seamIndex = (starts.count - 1) / 2
    const seamStart = new Vector3(
      starts.getX(seamIndex),
      starts.getY(seamIndex),
      starts.getZ(seamIndex),
    )
    const seamEnd = new Vector3(ends.getX(seamIndex), ends.getY(seamIndex), ends.getZ(seamIndex))

    expect(Number.isInteger(seamIndex)).toBe(true)
    expect(seamStart.distanceTo(seamEnd)).toBeCloseTo(0)
  })
})
