import { toScaleMultiplier } from '@/domain/animation/scale'
import { toStrengthRatio } from '@/domain/animation/strength'
import type { VtgCellReference } from '@/features/vtg/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import { applyWarpPath } from '@/math/animation/warpPathInterpolation'
import type { RootDataFinal } from '@/types/AnimTypes'
import { Vector3 } from 'three'

type CreateVtgCandidate = (reference: VtgCellReference) => RootDataFinal | undefined

const normalizeCoordinate = (value: number) => Math.round(value * 1e9) / 1e9

const renderedHandPosition = (
  frame: ReturnType<typeof rootCompile>['props'][number]['anim'][number],
  target: Vector3,
  canonical: Vector3,
  auxiliary: Vector3,
) =>
  applyWarpPath(
    canonical.fromArray(frame.pos),
    auxiliary.fromArray(frame.warpPos),
    toScaleMultiplier(frame.scale),
    toStrengthRatio(frame.strength),
    target,
  )

/** Describes the final visible paths independently of their shared starting orientation. */
const createRenderedPathSignature = (animation: RootDataFinal): string => {
  const compiled = rootCompile(animation)
  const canonical = new Vector3()
  const auxiliary = new Vector3()
  const renderedPosition = new Vector3()
  const initialPosition = compiled.props[0]?.anim[0]
  const position = initialPosition
    ? renderedHandPosition(initialPosition, renderedPosition, canonical, auxiliary)
    : renderedPosition.set(0, 0, 0)
  const orientation = -Math.atan2(position.y, position.x)
  const rotationAxis = new Vector3(0, 0, 1)

  return JSON.stringify(
    compiled.props.map((prop) =>
      prop.anim
        .map((frame) => {
          const rendered = renderedHandPosition(
            frame,
            renderedPosition,
            canonical,
            auxiliary,
          ).applyAxisAngle(rotationAxis, orientation)
          return `${normalizeCoordinate(rendered.x)},${normalizeCoordinate(
            rendered.y,
          )},${normalizeCoordinate(rendered.z)}`
        })
        .sort(),
    ),
  )
}

/** Checks the representative pair that normally shares one VTG path thumbnail. */
export const requiresPairedVtgCandidateLayout = (
  createCandidate: CreateVtgCandidate,
  createBaselineCandidate?: CreateVtgCandidate,
): boolean => {
  const first = createCandidate('1-6')
  const second = createCandidate('2-6')
  if (!first || !second) return false

  const firstSignature = createRenderedPathSignature(first)
  const secondSignature = createRenderedPathSignature(second)
  if (firstSignature === secondSignature) return false
  if (!createBaselineCandidate) return true

  const baselineFirst = createBaselineCandidate('1-6')
  const baselineSecond = createBaselineCandidate('2-6')
  return !(
    baselineFirst &&
    baselineSecond &&
    firstSignature === createRenderedPathSignature(baselineFirst) &&
    secondSignature === createRenderedPathSignature(baselineSecond)
  )
}
