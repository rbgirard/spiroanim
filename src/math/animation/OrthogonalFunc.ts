import { PPOS, PNTIND } from '@/domain/animation/AnimStruct'
import { Vector3 } from 'three'

export const InitialPoint = PPOS[PNTIND.MBC]!
export const InitialOrtho = PPOS[PNTIND.ML]!

// Computes the Second Point given an Angle, a Source Point, and an Orthogonal Reference Point.
export const orthoPoint = (
  angle: number, // Angle from Reference Point on the Orthogonal Axis (in radians)
  normSrc: Vector3, // Source Point, must be Normalized
  normRef: Vector3, // Reference Point, MUST be Orthogonal to Source (exactly 90 degrees)
  target = new Vector3(), // Optional target to store the result
) => {
  // Validate Reference is Orthogonal to Source
  if (Math.abs(normSrc.dot(normRef)) > 1e-6)
    console.warn('Reference must be orthogonal to Source!\n' + new Error().stack)

  // Compute the cross product between Source and Reference to get the orthogonal direction.
  normCross.crossVectors(normSrc, normRef)

  // Return target by scaling the reference vector and cross product,
  // weighted by cos(angle) and sin(angle) respectively.
  return target
    .set(0, 0, 0) // Initialize it at 0/0/0 for when target is passed as an Arg
    .addScaledVector(normRef, Math.cos(angle)) // Component along the reference vector
    .addScaledVector(normCross, Math.sin(angle)) // Component along the cross product (orthogonal)
}

// Computes the Orthogonal Angle between Source, Second Point, and an Orthogonal Reference Point.
export const orthoAngle = (
  normSrc: Vector3, // Source Point, must be Normalized
  norm2nd: Vector3, // Second Point, must be Normalized
  normRef: Vector3, // Reference Point, must be Orthogonal to Source (exactly 90 degrees)
) => {
  // Validate Reference is Orthogonal to Source
  if (Math.abs(normSrc.dot(normRef)) > 1e-6)
    console.warn('Reference must be orthogonal to Source!\n' + new Error().stack)

  // The dot product gives the length of the component of norm2nd along normSrc.
  const dotProduct = norm2nd.dot(normSrc)

  // Check if norm2nd is too close to being identical or antipodal to normSrc
  if (Math.abs(dotProduct) > 0.9999) return 0 // return 0 if they are nearly the same or antipodal

  // Project the Second Point onto the tangent plane perpendicular to the Source.
  // Subtract that component from norm2nd to get its projection onto the tangent plane.
  normProjected.subVectors(norm2nd, multSrc.copy(normSrc).multiplyScalar(dotProduct)).normalize()

  // Compute the angle between the projected vector and the reference vector.
  let angle = Math.acos(normRef.dot(normProjected))

  // Compute the cross product to determine the sign of the angle.
  normCross.crossVectors(normRef, normProjected)

  // If the cross product points in the opposite direction of the source, negate the angle.
  if (normCross.dot(normSrc) < 0) angle = -angle

  return angle
}

// Computes the angle adjustment required to align with a new target point, based on the previous angle and direction.
// I did it this way as the Direction is being stored for animations, and not the original orthogonal point
export const orthoModify = (
  angle: number, // Angle previously used to calculate a different orthogonal point
  normSrc: Vector3, // Source Point, must be Normalized
  norm2nd: Vector3, // New point we're targeting, must be Normalized
  normCross: Vector3, // Direction previously used to calculate a different point
) => {
  // Compute the rotated point perpendicular to the source
  normAngled.copy(normSrc).applyAxisAngle(normCross, Angle90)

  // Calculate the original Orthogonal Point by negating the angle
  orthoPoint(-angle, normSrc, normAngled, normOrtho)

  // Return the angle between the source and new target relative to this orthogonal reference
  return orthoAngle(normSrc, norm2nd, normOrtho)
}

// Constructs chained rotations in a looped manner by using a source, reference, and cross-product direction vector.
export const orthoNext = (
  angle: number, // Angle from Reference Point on the Orthogonal Axis (in radians)
  arc: number, // Arc from Source to the Next Point (in radians)
  normSrc: Vector3, // Source Point, must be Normalized
  normRef: Vector3, // Reference Point, MUST be Orthogonal to Source (exactly 90 degrees)
  normCross = new Vector3(), // Direction used to compute the Next Point
) => {
  // Validate Reference is Orthogonal to Source
  if (Math.abs(normSrc.dot(normRef)) > 1e-6)
    console.warn('Reference must be orthogonal to Source!\n' + new Error().stack)

  // Determine Orthogonal Point from Angle, for the Plane/Axis
  orthoPoint(angle, normSrc, normRef, normProjected)

  // Directional vector for use with applyAxisAngle
  normCross.crossVectors(normSrc, normProjected)

  // Compute current Positon
  normSrc.applyAxisAngle(normCross, arc).normalize() // Occasional bug fix

  // Update Othogonal Path / Axis for the next loop
  normRef.copy(normSrc).applyAxisAngle(normCross, Angle90)
}

// Pre-allocated vectors for reuse in calculations (to avoid creating new objects in each function call).
const multSrc = new Vector3(),
  normCross = new Vector3(),
  normProjected = new Vector3(),
  normAngled = new Vector3(),
  normOrtho = new Vector3(),
  Angle90 = Math.PI / 2
