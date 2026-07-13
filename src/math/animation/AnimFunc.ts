// src\func\AnimFunc.ts

import { Vector3, MathUtils } from 'three'
import { TTYPE, RADIUS, PPOS, PROPCP } from '@/domain/animation/AnimStruct'

import { orthoNext, InitialPoint, InitialOrtho } from './OrthogonalFunc'

import type {
  RootDataFinal,
  PropDataFinal,
  RootDataCompiled,
  PropDataCompiled,
  AnimDataCompiled,
  PointInd,
} from '@/types/AnimTypes'

const allPoints = Object.keys(PPOS).map((val) => parseInt(val, 10))

// Distance between two sets of Radians
export const angularDistance = (angle1: number, angle2: number) => {
  const diff = angle2 - angle1,
    wrappedDiff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI
  return Math.abs(wrappedDiff)
}

// Determines the closest Point to a set of coordinates
// This was my Eureka! moment, cracking this project's 3d puzzle
export const closestPoint = (
  prot: Vector3,
  guide: PointInd[] | undefined = undefined,
): PointInd => {
  let closest: PointInd = 0, // previous closest item
    compare = RADIUS * 2 // previous shortest distance
  const points = guide === undefined ? allPoints : guide

  for (let i = 0; i < points.length; i++) {
    // Calculate distance to the current comparison
    const point = points[i] as PointInd,
      distance = prot.distanceTo(PPOS[point]!)

    if (distance < compare) {
      closest = point
      compare = distance
    }
  }

  return closest
}

const copyRootValue = (prop: PropDataFinal, root: RootDataFinal, key: (typeof PROPCP)[number]) => {
  switch (key) {
    case 'prop':
      prop.prop = root.prop
      break
    case 'color':
      prop.color = root.color
      break
    case 'guides':
      prop.guides = root.guides
      break
    case 'paths':
      prop.paths = root.paths
      break
    case 'hands':
      prop.hands = root.hands
      break
    case 'visible':
      prop.visible = root.visible
      break
    case 'anchors':
      prop.anchors = root.anchors
      break
    case 'nodes':
      prop.nodes = root.nodes
      break
    case 'thick':
      prop.thick = root.thick
  }
}

// Converts data to be used by the worker
export const rootCompile = (orig: RootDataFinal): RootDataCompiled => {
  const root = JSON.parse(JSON.stringify(orig)) as RootDataFinal, // json deep copy because its modified
    props: PropDataCompiled[] = []

  for (let pi = 0; pi < root.props.length; pi++) {
    const prop = root.props[pi]! // copy of prop bcuz modifying

    // Copy items from Root to each Prop if they don't exist
    for (let j = 0; j < PROPCP.length; j++) {
      const key = PROPCP[j]!
      if (prop[key] === undefined) copyRootValue(prop, root, key)
    }

    props.push(propCompile(prop))
  }

  return {
    ...root,
    props,
  }
}

const posx = new Vector3(),
  rotx = new Vector3(),
  adju = new Vector3()

// Converts an individual prop to be used by the animator
const propCompile = (prop: PropDataFinal): PropDataCompiled => {
  const anims: AnimDataCompiled[] = [],
    // Initial points to begin calculations from
    pos = InitialPoint.clone(),
    rot = InitialPoint.clone(),
    plane = InitialOrtho.clone(),
    axis = InitialOrtho.clone()

  for (let ai = 1; ai < prop.anim.length; ai++) {
    const anim = prop.anim[ai]!,
      prev = prop.anim[ai - 1]!
    if (anim.type === undefined) anim.type = prev.type
    if (anim.turns === undefined) anim.turns = prev.turns
    if (anim.adjust === undefined) anim.adjust = prev.adjust
    if (anim.scale === undefined) anim.scale = prev.scale
    if (anim.depth === undefined) anim.depth = prev.depth
    if (anim.beats === undefined) anim.beats = prev.beats
    if (anim.arc === undefined) anim.arc = prev.arc
  }

  for (let ai = 0; ai < prop.anim.length; ai++) {
    const anim = prop.anim[ai]!

    const vars = {
        turns: anim.turns ?? 0,
        scale: anim.scale ?? 10,
        depth: anim.depth ?? 0,
        beats: anim.beats ?? 1,
        adjust: anim.adjust ?? 0,
        arc: anim.arc ?? 0,
        plane: anim.plane ?? 0,
        axis: anim.axis ?? anim.plane ?? 0,
        type: anim.type ?? TTYPE.SPHE,
        move: anim.move ?? ([0, 0, 0] as [number, number, number]),
      },
      // Angle on Orthogonal Plane
      radPlane = MathUtils.degToRad(vars.plane),
      radAxis = MathUtils.degToRad(vars.axis),
      // Angle to the next point
      radArc = MathUtils.degToRad(vars.arc),
      radRot = MathUtils.degToRad(vars.turns) + (vars.type == TTYPE.LINE ? 0 : radArc)

    // Updates pos/rot, plane/axis, and directions for this loop
    orthoNext(radPlane, radArc, pos, plane, posx)
    orthoNext(radAxis, radRot, rot, axis, rotx)

    // Rotation Adjustment which gets blended during animation
    adju.copy(rot).applyAxisAngle(rotx, MathUtils.degToRad(vars.adjust ?? 0))

    // Compiled prop, ready to be sent to the Worker
    const push: AnimDataCompiled = {
      ...vars,

      // Position, Rotation, and Rotation to blend from
      pos: pos.toArray(),
      rot: rot.toArray(),
      adju: adju.toArray(),

      // Directions for computing from applyAxisAngle during animation
      posx: posx.toArray(),
      rotx: rotx.toArray(),
    }

    anims.push(push)
  }

  return {
    ...prop,
    anim: anims,
  }
}

// Testing a theory...
/*
const MIN_INCREMENT = 30

function calculateIncrement(value: number) {
  let divisor = 360

  // Calculate the Greatest Common Denominator (GCD)
  while (divisor !== 0) [value, divisor] = [divisor, value % divisor]

  // Reduce the value while maintaining divisibility and respecting the soft minimum
  while (value % 2 === 0) {
    const halved = value / 2
    if (halved >= MIN_INCREMENT) value = halved
    else break
  }

  return value
}

//const angles = [45, 90, 135, 180, 225, 270, 315];
//const angles = [72, 144, 216, 288]; // Come out to 9
//const angles = [60, 120, 180, 240, 300]; // Except for 180 which is expected, Comes out to 15
const angles = [...Array(361).keys()]
angles.forEach((angle) => {
  const increment = calculateIncrement(angle)
  console.log(`For an angle of ${angle}, the increment is ${increment}, ${360 / increment}`)
})

*/
