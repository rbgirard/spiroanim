// src\func\AnimFunc.ts

import { Vector3, Quaternion, MathUtils } from 'three'
import { TTYPE, RADIUS, PPOS, PROPCP } from '@/domain/animation/AnimStruct'

import { orthoNext, orthoPoint, InitialPoint, InitialOrtho } from './OrthogonalFunc'
import { compileMotionTrack, createDefaultCameraFrame } from './MotionFunc'
import { resolveAnimationFrames } from './frameSemantics'

import type {
  RootDataFinal,
  PropDataFinal,
  RootDataCompiled,
  PropDataCompiled,
  AnimDataCompiled,
  MotionDataCompiled,
  PointInd,
} from '@/types/AnimTypes'

const allPoints = Object.keys(PPOS).map((val) => parseInt(val, 10))

// Distance between two sets of Radians
export const angularDistance = (angle1: number, angle2: number) => {
  const diff = angle2 - angle1,
    fullRotation = 2 * Math.PI,
    wrappedDiff = ((((diff + Math.PI) % fullRotation) + fullRotation) % fullRotation) - Math.PI
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
    case 'travel':
      prop.travel = root.travel
      break
    case 'hands':
      prop.hands = root.hands
      break
    case 'arms':
      prop.arms = root.arms
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
    camera: compileCameraTrack(root.camera),
    props,
  }
}

const compileCameraTrack = (frames: RootDataFinal['camera']): RootDataCompiled['camera'] => {
  const defaultOrbit = createDefaultCameraFrame().orbit!
  const orbit = compileMotionTrack(
    frames.map((frame) => frame.orbit ?? {}),
    { firstFrameDefaults: defaultOrbit },
  )
  const center = compileMotionTrack(frames.map((frame) => frame.center ?? {}))

  return frames.map((_frame, index) => ({
    orbit: orbit[index]!,
    center: withoutBeats(center[index]!),
  }))
}

const withoutBeats = ({ beats: _beats, ...frame }: MotionDataCompiled) => frame

const posx = new Vector3(),
  warpx = new Vector3(),
  rotx = new Vector3(),
  yawx = new Vector3(),
  yawProjected = new Vector3(),
  adjustx = new Vector3(),
  adju = new Vector3()

// Converts an individual prop to be used by the animator
const propCompile = (prop: PropDataFinal): PropDataCompiled => {
  const anims: AnimDataCompiled[] = [],
    motions: MotionDataCompiled[] = [],
    // Initial points to begin calculations from
    pos = InitialPoint.clone(),
    warpPos = InitialPoint.clone(),
    rot = InitialPoint.clone(),
    plane = InitialOrtho.clone(),
    warpPlane = InitialOrtho.clone(),
    axis = InitialOrtho.clone(),
    primaryOrientation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), InitialPoint),
    secondaryOrientation = new Quaternion(),
    orientation = new Quaternion(),
    primaryRotation = new Quaternion(),
    secondaryRotation = new Quaternion()
  let twistRoll = 0,
    hasPendingSecondaryRotation = false

  for (const vars of resolveAnimationFrames(prop.anim)) {
    const // Angle on Orthogonal Plane
      radPlane = MathUtils.degToRad(vars.plane),
      radAxis = MathUtils.degToRad(vars.axis),
      // Angle to the next point
      radArc = MathUtils.degToRad(vars.arc),
      radWarp = radArc + MathUtils.degToRad(vars.warp),
      radRot = MathUtils.degToRad(vars.turns) + (vars.type == TTYPE.LINE ? 0 : radArc),
      radRotate = MathUtils.degToRad(vars.rotate)

    twistRoll += vars.twist

    // Preserve the completed Rotate quaternion exactly, then consume the temporary secondary
    // basis into primary orientation before the first subsequent Arc/Turns interval.
    const rebasePrimaryOrientation = vars.rotate === 0 && hasPendingSecondaryRotation
    if (rebasePrimaryOrientation) {
      primaryOrientation.copy(orientation)
      secondaryOrientation.identity()
      hasPendingSecondaryRotation = false
    }

    // Updates pos/rot, plane/axis, and directions for this loop
    orthoNext(radPlane, radArc, pos, plane, posx)
    // Warp is a Turns-like relative rotation applied only to an auxiliary hand-path vector.
    // Keeping it independent from both POS and ROT preserves VTG recognition and prop motion.
    orthoNext(radPlane, radWarp, warpPos, warpPlane, warpx)
    orthoNext(radAxis, radRot, rot, axis, rotx)

    // Primary and secondary rotations accumulate independently. Yaw is measured against the
    // fixed model basis, so subdividing one interval retains the same world axis on every piece.
    orthoPoint(MathUtils.degToRad(vars.yaw), InitialPoint, InitialOrtho, yawProjected)
    yawx.crossVectors(InitialPoint, yawProjected).normalize()
    primaryOrientation.premultiply(primaryRotation.setFromAxisAngle(rotx, radRot)).normalize()
    secondaryOrientation
      .premultiply(secondaryRotation.setFromAxisAngle(yawx, radRotate))
      .normalize()
    if (vars.rotate !== 0) hasPendingSecondaryRotation = true
    orientation.copy(secondaryOrientation).multiply(primaryOrientation).normalize()
    adjustx.copy(rotx)

    // Rotation Adjustment which gets blended during animation
    adju
      .set(0, 1, 0)
      .applyQuaternion(orientation)
      .applyAxisAngle(adjustx, MathUtils.degToRad(vars.adjust))

    // Compiled prop, ready to be sent to the Worker
    const push: AnimDataCompiled = {
      ...vars,
      twistRoll,
      rebasePrimaryOrientation,

      // Position, Rotation, and Rotation to blend from
      pos: pos.toArray(),
      warpPos: warpPos.toArray(),
      rot: rot.toArray(),
      adju: adju.toArray(),

      // Directions for computing from applyAxisAngle during animation
      posx: posx.toArray(),
      warpx: warpx.toArray(),
      rotx: rotx.toArray(),
      yawx: yawx.toArray(),
      adjustx: adjustx.toArray(),
      primaryOrient: primaryOrientation.toArray(),
      secondaryOrient: secondaryOrientation.toArray(),
      orient: orientation.toArray(),
    }

    anims.push(push)
  }

  motions.push(...compileMotionTrack(prop.motion ?? []))

  return {
    ...prop,
    anim: anims,
    motion: motions,
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
