import { MathUtils, Vector3 } from 'three'

import type { QstPosition } from '@/features/quarter-space-tech/types'
import type { AnimReadable } from '@/types/AnimTypes'

const qstPositionVectors = {
  top: new Vector3(0, 1, 0),
  left: new Vector3(1, 0, 0),
  front: new Vector3(0, 0, 1),
  right: new Vector3(-1, 0, 0),
  bottom: new Vector3(0, -1, 0),
  back: new Vector3(0, 0, -1),
} as const satisfies Readonly<Record<QstPosition, Vector3>>

const normalizeAngle = (angle: number) => {
  const epsilon = 1e-5
  let normalized = ((((angle + 180) % 360) + 360) % 360) - 180
  if (Math.abs(normalized) < epsilon) normalized = 0
  if (Math.abs(normalized - Math.round(normalized)) < epsilon) normalized = Math.round(normalized)
  return normalized
}

const getOrthogonalAngle = (source: Vector3, target: Vector3, reference: Vector3) => {
  const dot = target.dot(source)
  if (Math.abs(dot) > 0.9999) return 0

  const projected = target.clone().sub(source.clone().multiplyScalar(dot)).normalize()
  const cosine = Math.max(-1, Math.min(1, reference.dot(projected)))
  let angle = Math.acos(cosine)
  if (new Vector3().crossVectors(reference, projected).dot(source) < 0) angle = -angle
  return angle
}

const advanceOrientation = (plane: number, arc: number, source: Vector3, reference: Vector3) => {
  const projected = new Vector3()
    .addScaledVector(reference, Math.cos(plane))
    .addScaledVector(new Vector3().crossVectors(source, reference), Math.sin(plane))
  const axis = new Vector3().crossVectors(source, projected).normalize()
  source.applyAxisAngle(axis, arc).normalize()
  reference
    .copy(source)
    .applyAxisAngle(axis, Math.PI / 2)
    .normalize()
}

/** Recreates native readable animation frames for a derived QST position sequence. */
export const createQstFrames = (positions: readonly QstPosition[]): AnimReadable[] => {
  const source = new Vector3(0, -1, 0)
  const reference = new Vector3(1, 0, 0)

  return positions.map((position, index) => {
    const target = qstPositionVectors[position]
    const arc = source.angleTo(target)
    const plane = getOrthogonalAngle(source, target, reference)
    advanceOrientation(plane, arc, source, reference)

    return {
      arc: ((normalizeAngle(MathUtils.radToDeg(arc)) % 360) + 360) % 360,
      plane: normalizeAngle(MathUtils.radToDeg(plane)),
      ...(index === 0 ? { scale: 80, turns: 0 } : { turns: -360 }),
    }
  })
}
