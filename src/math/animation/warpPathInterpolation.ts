import { Vector3 } from 'three'

/**
 * Combines the canonical and auxiliary unit hand-path vectors into `target`.
 *
 * Strength controls the auxiliary vector's contribution while Scale controls the complete
 * result's outer radius. Strength zero produces the established `canonical * scale` position.
 * At full Strength, opposing canonical and auxiliary vectors meet at the center.
 */
export const applyWarpPath = (
  canonical: Vector3,
  auxiliary: Vector3,
  scale: number,
  strength: number,
  target: Vector3,
): Vector3 => {
  const auxiliaryWeight = strength / 2
  return target
    .copy(canonical)
    .multiplyScalar(scale * (1 - auxiliaryWeight))
    .addScaledVector(auxiliary, scale * auxiliaryWeight)
}
