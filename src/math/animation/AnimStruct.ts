// src/math/animation/AnimStruct.ts

import type {
  PointTypes,
  PointInd,
  PointStr,
  ManCmdStr,
  ManCmdInd,
  PropCommonKeys,
  //  AllVars,
  //  qsTransform,
  GrefItem,
} from '@/types/AnimTypes'

import { Vector3, Spherical } from 'three'

// NOTE: The two following can and probably will differ slightly when more models are added
// Text displayed in the UI
export const PTEXT = ['POI', 'Staff'] as const

// Name of the model / object (No spaces, etc. so its separate from the text)
export const PROPSR = ['POI', 'STAFF'] as const

export const COLORS = ['Red', 'Green', 'Blue', 'Yellow', 'Cyan', 'Magenta', 'Orange'] as const

// Color definitions used for the Props
export const COLSET: [number, number, number][] = [
  /* Red     */ [0xff0000, 0x880000, 0x550000] as const,
  /* Green   */ [0x00ff00, 0x008800, 0x005500] as const,
  /* Blue    */ [0x0000ff, 0x000088, 0x000055] as const,
  /* Yellow  */ [0xffff00, 0x888800, 0x555500] as const,
  /* Cyan    */ [0x00ffff, 0x008888, 0x005555] as const,
  /* Magenta */ [0xff00ff, 0x880088, 0x550055] as const,
  /* Orange  */ [0xffa500, 0x88a500, 0x551a00] as const,
] as const

export const TTEXT = ['Spherical', 'Linear'] as const
export const TTYPE = {
  SPHE: 0,
  LINE: 1,
} as const

export const CMODES = {
  points: 0,
} as const

// --- Define Point Data

export const gsize = 0.02 // Size of guide lines
export const rsize = 0.2 // Size of rotation / path lines
export const psize = 0.06 // Default size of anchors
export const csize = 0.5 // Size of points when in Click Mode
export const nsize = 0.07 // Size of nodes

export const PTYPE = {
  oct: 1, // "Octahedral" Points (6 total, but forms 8 sides)
  box: 2, // "Box Mode" Points
  out: 3, // Corner Points
} as const

// Colors and sizes of Points
export const PPROP: {
  [key in PointTypes]: {
    color: number // Hex / Integer RGB
    size: number // Size property
    click: number // Click property
    node: number
  }
} = {
  [PTYPE.oct]: {
    color: COLORS.indexOf('Yellow'),
    size: psize,
    click: csize,
    node: nsize,
  } as const,
  [PTYPE.box]: {
    color: COLORS.indexOf('Cyan'),
    size: psize,
    click: csize,
    node: nsize,
  } as const,
  [PTYPE.out]: {
    color: COLORS.indexOf('Magenta'),
    size: psize,
    click: csize,
    node: nsize,
  } as const,
} as const

// Point String Representations
export const INDPNT = [
  'FTL',
  'FTC',
  'FTR',
  'FL',
  'FC',
  'FR',
  'FBL',
  'FBC',
  'FBR',
  'MTL',
  'MTC',
  'MTR',
  'ML',
  'MR',
  'MBL',
  'MBC',
  'MBR',
  'BTL',
  'BTC',
  'BTR',
  'BL',
  'BC',
  'BR',
  'BBL',
  'BBC',
  'BBR',
] as const

// Generate String to Index
export const PNTIND: Record<PointStr, PointInd> = INDPNT.reduce(
  (acc, point, index) => {
    acc[point] = index as PointInd
    return acc
  },
  {} as Record<PointStr, PointInd>,
)
// --- Define data for Rotation / Flip

// Generate the Manipulations Table
export const MANPNT: PointInd[][] = [
  /* COUNTER,  CLOCK,    LEFT,     RIGHT,    FORWARD,  BACKWARD, VERTICAL, HORIZONT, DEPTH */
  /* FTL */ ['FL', 'FTC', 'MTL', 'FTC', 'FL', 'MTL', 'FBL', 'FTR', 'BTL'] as const,
  /* FTC */ ['FTL', 'FTR', 'FTL', 'FTR', 'FC', 'MTC', 'FBC', 'FTC', 'BTC'] as const,
  /* FTR */ ['FTC', 'FR', 'FTC', 'MTR', 'FR', 'MTR', 'FBR', 'FTL', 'BTR'] as const,
  /* FL  */ ['FBL', 'FTL', 'ML', 'FC', 'FBL', 'FTL', 'FL', 'FR', 'BL'] as const,
  /* FC  */ ['FC', 'FC', 'FL', 'FR', 'FBC', 'FTC', 'FC', 'FC', 'BC'] as const,
  /* FR  */ ['FTR', 'FBR', 'FC', 'MR', 'FBR', 'FTR', 'FR', 'FL', 'BR'] as const,
  /* FBL */ ['FBC', 'FL', 'MBL', 'FBC', 'MBL', 'FL', 'FTL', 'FBR', 'BBL'] as const,
  /* FBC */ ['FBR', 'FBL', 'FBL', 'FBR', 'MBC', 'FC', 'FTC', 'FBC', 'BBC'] as const,
  /* FBR */ ['FR', 'FBC', 'FBC', 'MBR', 'MBR', 'FR', 'FTR', 'FBL', 'BBR'] as const,

  /* MTL */ ['ML', 'MTC', 'BTL', 'FTL', 'FTL', 'BTL', 'MBL', 'MTR', 'MTL'] as const,
  /* MTC */ ['MTL', 'MTR', 'MTC', 'MTC', 'FTC', 'BTC', 'MBC', 'MTC', 'MTC'] as const,
  /* MTR */ ['MTC', 'MR', 'FTR', 'BTR', 'FTR', 'BTR', 'MBR', 'MTL', 'MTR'] as const,
  /* ML  */ ['MBL', 'MTL', 'BL', 'FL', 'ML', 'ML', 'ML', 'MR', 'ML'] as const,

  /* MR  */ ['MTR', 'MBR', 'FR', 'BR', 'MR', 'MR', 'MR', 'ML', 'MR'] as const,
  /* MBL */ ['MBC', 'ML', 'BBL', 'FBL', 'BBL', 'FBL', 'MTL', 'MBR', 'MBL'] as const,
  /* MBC */ ['MBR', 'MBL', 'MBC', 'MBC', 'BBC', 'FBC', 'MTC', 'MBC', 'MBC'] as const,
  /* MBR */ ['MR', 'MBC', 'FBR', 'BBR', 'BBR', 'FBR', 'MTR', 'MBL', 'MBR'] as const,

  /* BTL */ ['BL', 'BTC', 'BTC', 'MTL', 'MTL', 'BL', 'BBL', 'BTR', 'FTL'] as const,
  /* BTC */ ['BTL', 'BTR', 'BTR', 'BTL', 'MTC', 'BC', 'BBC', 'BTC', 'FTC'] as const,
  /* BTR */ ['BTC', 'BR', 'MTR', 'BTC', 'MTR', 'BR', 'BBR', 'BTL', 'FTR'] as const,
  /* BL  */ ['BBL', 'BTL', 'BC', 'ML', 'BTL', 'BBL', 'BL', 'BR', 'FL'] as const,
  /* BC  */ ['BC', 'BC', 'BR', 'BL', 'BTC', 'BBC', 'BC', 'BC', 'FC'] as const,
  /* BR  */ ['BTR', 'BBR', 'MR', 'BC', 'BTR', 'BBR', 'BR', 'BL', 'FR'] as const,
  /* BBL */ ['BBC', 'BL', 'BBC', 'MBL', 'BL', 'MBL', 'BTL', 'BBR', 'FBL'] as const,
  /* BBC */ ['BBR', 'BBL', 'BBR', 'BBL', 'BC', 'MBC', 'BTC', 'BBC', 'FBC'] as const,
  /* BBR */ ['BR', 'BBC', 'MBR', 'BBC', 'BR', 'MBR', 'BTR', 'BBL', 'FBR'] as const,
].map((manipulation) => manipulation.map((point) => PNTIND[point] as PointInd)) // Convert Strings to Numbers

// Manipulations: Index to String
export const MANCMD = [
  'COUNTER',
  'CLOCK',
  'LEFT',
  'RIGHT',
  'FORWARD',
  'BACKWARD',
  'VERTICAL',
  'HORIZONT',
  'DEPTH',
] as const

// Generate String to Index
export const CMDMAN = MANCMD.reduce(
  (acc, point, index) => {
    acc[point] = index as ManCmdInd
    return acc
  },
  {} as Record<ManCmdStr, ManCmdInd>,
)

export const RADIUS = 5
export const ORIGRADIUS = 5 // For calculating a multiplier, if/when changing Radius

// Cartesian Points, converted to Spherical for PHI/THETA, and resulting 1 is discarded.
export const POINTS: [PointTypes, number, number, number][] = [
  // Front 9 Points
  [PTYPE.out, 1, 1, 1] as const, // Front Top Left
  [PTYPE.box, 0, 1, 1] as const, // Front Top
  [PTYPE.out, -1, 1, 1] as const, // Front Top Right
  [PTYPE.box, 1, 0, 1] as const, // Front Left
  [PTYPE.oct, 0, 0, 1] as const, // Front
  [PTYPE.box, -1, 0, 1] as const, // Front Right
  [PTYPE.out, 1, -1, 1] as const, // Front Bottom Left
  [PTYPE.box, 0, -1, 1] as const, // Front Bottom Center
  [PTYPE.out, -1, -1, 1] as const, // Front Bottom Right
  // Middle 8 Points
  [PTYPE.box, 1, 1, 0] as const, // Middle Top Left
  [PTYPE.oct, 0, 1, 0] as const, // Middle Top
  [PTYPE.box, -1, 1, 0] as const, // Middle Top Right
  [PTYPE.oct, 1, 0, 0] as const, // Middle Left
  // Center point is not defined nor used, as these are for defining circular paths
  [PTYPE.oct, -1, 0, 0] as const, // Middle Right
  [PTYPE.box, 1, -1, 0] as const, // Middle Bottom Left
  [PTYPE.oct, 0, -1, 0] as const, // Middle Bottom
  [PTYPE.box, -1, -1, 0] as const, // Middle Bottom Right
  // Back 9 Points
  [PTYPE.out, 1, 1, -1] as const, // Back Top Left
  [PTYPE.box, 0, 1, -1] as const, // Back Top
  [PTYPE.out, -1, 1, -1] as const, // Back Top Right
  [PTYPE.box, 1, 0, -1] as const, // Back Left
  [PTYPE.oct, 0, 0, -1] as const, // Back
  [PTYPE.box, -1, 0, -1] as const, // Back Right
  [PTYPE.out, 1, -1, -1] as const, // Back Bottom Left
  [PTYPE.box, 0, -1, -1] as const, // Back Bottom
  [PTYPE.out, -1, -1, -1] as const, // Back Bottom Right
] as const

// Convert Coordinates to Normalized Vectors by converting to Spherical with a Radius of 1
export const PPOS = POINTS.map((p) => {
  const sph1 = new Spherical().setFromCartesianCoords(p[1], p[2], p[3])
  return new Vector3().setFromSphericalCoords(1, sph1.phi, sph1.theta)
}) as Vector3[]
// --- Define Properties

// Properties copied from Root to Prop if they're undefined on Prop
export const PROPCP: PropCommonKeys[] = [
  'prop',
  'color',
  'guides',
  'paths',
  'hands',
  'visible',
  'anchors',
  'nodes',
  'thick',
] as const

// --- Define Guides (paths around the sphere)

export const GUIDES = (() => {
  const DOT_TOLERANCE = 0.00001,
    ANGLE_TOLERANCE = 0.001,
    comp: { normal: Vector3; points: PointInd[] }[] = [],
    normal = new Vector3()

  for (const i in PPOS) {
    const p1 = parseInt(i, 10) as PointInd,
      v1 = PPOS[p1]

    if (v1 === undefined) continue

    for (const j in PPOS) {
      const p2 = parseInt(j, 10) as PointInd,
        v2 = PPOS[p2]

      if (v2 === undefined) continue

      const angle = v1.angleTo(v2)

      // Skip if angle is approximately 0 or 180 degrees
      if (Math.abs(angle) < ANGLE_TOLERANCE || Math.abs(angle - Math.PI) < ANGLE_TOLERANCE) continue

      // Compute the normal vector of the plane formed by v1 and v2
      normal.crossVectors(v1, v2)
      if (normal.lengthSq() < 1e-8) continue // Skip if cross product is near zero (vectors are parallel)
      normal.normalize()

      let found = -1

      // Compare with existing groups
      for (let k = 0; k < comp.length; k++) {
        const n2 = comp[k]!.normal

        if (Math.abs(normal.dot(n2)) > 1 - DOT_TOLERANCE) {
          found = k
          break
        }
      }

      // Add points to group
      if (found > -1) {
        const group = comp[found]!
        if (group.points.indexOf(p1) == -1) group.points.push(p1)

        if (group.points.indexOf(p2) == -1) group.points.push(p2)

        // Create a new group
      } else comp.push({ normal: normal.clone(), points: [p1, p2] })
    }
  }

  const centroid = new Vector3(),
    refVec = new Vector3(),
    relVec = new Vector3(),
    projVec = new Vector3(),
    normMult = new Vector3(),
    crossVec = new Vector3()

  // Now, for each group, we will order the points
  // This is crucial for navigating and generating rotations
  comp.forEach((group) => {
    const normal = group.normal,
      pointVectors = group.points.map((p) => PPOS[p]!) // vectors of points in group

    // Calculate the centroid of the group
    pointVectors.forEach((vec) => centroid.add(vec))
    centroid.divideScalar(pointVectors.length)

    // Define a reference vector from the centroid to the first point
    refVec.subVectors(pointVectors[0]!, centroid).normalize()

    // For each point, compute the angle around the normal vector
    const angles = pointVectors.map((vec, idx) => {
      // Vector from centroid to the point
      relVec.subVectors(vec, centroid)

      // Project the relative vector onto the plane
      projVec
        .copy(relVec)
        .sub(normMult.copy(normal).multiplyScalar(relVec.dot(normal)))
        .normalize()

      return {
        index: idx,

        // Compute the angle between the reference vector and the projected vector
        angle: Math.atan2(normal.dot(crossVec.crossVectors(refVec, projVec)), refVec.dot(projVec)),
      }
    })

    // Sort the points by angle
    angles.sort((a, b) => a.angle - b.angle)

    // Update the group's points in the sorted order
    group.points = angles.map((a) => group.points[a.index]!)

    // Reset centroid to zero
    centroid.set(0, 0, 0)
  })

  // Sort the points by length and value and return them
  return comp
    .map((val) => val.points)
    .sort((a, b) => {
      // Compare lengths first
      if (a.length !== b.length) return a.length - b.length
      else {
        // Lengths are equal, compare values inside the arrays
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!
        // All elements are equal
        return 0
      }
    })
})()

// Map for referencing a guide from point to point
export const GREF = GUIDES.reduce(
  (acc, objs, i) => {
    objs.forEach((key) => {
      if (!acc[key]) acc[key] = {} as GrefItem // Initialize if it doesn't exist
      objs.forEach((key2) => {
        // Skip the same and opposing points
        if (key !== key2 && PPOS[key]!.distanceTo(PPOS[key2]!) <= RADIUS * 2 * 0.99)
          acc[key][key2] = i as PointInd
      })
    })
    return acc
  },
  {} as Record<PointInd, GrefItem>,
)
