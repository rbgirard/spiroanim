import { ORIGRADIUS, PROP_PATH_RADIUS, RADIUS } from '@/domain/animation/AnimStruct'
import { toScaleMultiplier } from '@/domain/animation/scale'
import { toStrengthRatio } from '@/domain/animation/strength'
import type { VtgCellReference } from '@/features/vtg/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import { FRAMESTARTS } from '@/math/animation/PlayerFunc'
import { sampleCompiledMotion } from '@/math/animation/MotionFunc'
import { subdivideAnimationPlayback } from '@/math/animation/subdivideAnimationPlayback'
import { applyWarpPath } from '@/math/animation/warpPathInterpolation'
import type { RootDataFinal } from '@/types/AnimTypes'
import { Vector3 } from 'three'

type CreateVtgCandidate = (reference: VtgCellReference) => RootDataFinal | undefined

const normalizeCoordinate = (value: number) => Math.round(value * 1e7) / 1e7
const pointKey = (point: Vector3) =>
  `${normalizeCoordinate(point.x)},${normalizeCoordinate(point.y)},${normalizeCoordinate(point.z)}`

/** Compare path coverage, not the starting point, direction, or number of traversals. */
const createRenderedPathSignature = (animation: RootDataFinal): string | undefined => {
  // Sample between authored boundaries too: different prop curves can share their endpoints.
  // Use the existing path-preserving subdivision rather than interpolating rotations ourselves.
  const sampled = subdivideAnimationPlayback(animation, 4)
  if (!sampled) return undefined
  const compiled = rootCompile(sampled)
  const canonical = new Vector3()
  const auxiliary = new Vector3()
  const hand = new Vector3()
  const head = new Vector3()
  const rotation = new Vector3()
  const motion = new Vector3()

  return JSON.stringify(
    compiled.props.map((prop) => {
      const handPoints = new Set<string>()
      const headPoints = new Set<string>()
      const times = FRAMESTARTS(prop.anim, compiled.bpm)
      const motionTimes = FRAMESTARTS(prop.motion, compiled.bpm)
      const radius = (PROP_PATH_RADIUS * RADIUS) / ORIGRADIUS
      prop.anim.forEach((frame, index) => {
        applyWarpPath(
          canonical.fromArray(frame.pos),
          auxiliary.fromArray(frame.warpPos),
          toScaleMultiplier(frame.scale),
          toStrengthRatio(frame.strength),
          hand,
        ).multiplyScalar(RADIUS)
        sampleCompiledMotion(
          prop.motion,
          motionTimes,
          times[index] ?? 0,
          motion,
          (RADIUS * RADIUS) / ORIGRADIUS / 10,
        )
        hand.add(motion)
        rotation.fromArray(frame.adju).multiplyScalar(radius)
        head.copy(hand).addScaledVector(rotation, 1 + frame.depth / 10)
        hand.addScaledVector(rotation, frame.depth / 10)
        if (prop.paths) headPoints.add(pointKey(head))
        if (prop.hands) handPoints.add(pointKey(hand))
      })
      // World-space coordinates preserve the arrangement shown by the thumbnail. Normalizing each
      // candidate against its starting hand would rotate identical closed paths differently.
      return [[...headPoints].sort(), [...handPoints].sort()]
    }),
  )
}

/** Checks only the representative pair; comparing the complete grid is intentionally avoided. */
export const requiresPairedVtgCandidateLayout = (createCandidate: CreateVtgCandidate): boolean => {
  const first = createCandidate('1-6')
  const second = createCandidate('2-6')
  if (!first || !second) return false
  const firstSignature = createRenderedPathSignature(first)
  const secondSignature = createRenderedPathSignature(second)
  // If a candidate cannot be sampled faithfully, retain separate previews rather than hide it.
  return (
    firstSignature === undefined ||
    secondSignature === undefined ||
    firstSignature !== secondSignature
  )
}
