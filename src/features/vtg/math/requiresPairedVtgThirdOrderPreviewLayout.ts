import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import {
  applyVtgThirdOrderSettings,
  getVtgThirdOrderCycleCount,
  type VtgThirdOrderSettings,
} from '@/features/vtg/thirdOrder'
import type { VtgCellReference, VtgSpeedRatio } from '@/features/vtg/types'
import { toScaleMultiplier } from '@/domain/animation/scale'
import { toStrengthRatio } from '@/domain/animation/strength'
import { rootCompile } from '@/math/animation/AnimFunc'
import { applyWarpPath } from '@/math/animation/warpPathInterpolation'
import type { RootDataFinal } from '@/types/AnimTypes'
import { Vector3 } from 'three'

interface VtgThirdOrderPreviewLayoutOptions {
  mirror?: boolean
  opposed?: boolean
  createAnimation?: (
    reference: VtgCellReference,
    minimumCycleCount: ReturnType<typeof getVtgThirdOrderCycleCount>,
  ) => RootDataFinal | undefined
  createTransformedAnimation?: (
    reference: VtgCellReference,
    minimumCycleCount: ReturnType<typeof getVtgThirdOrderCycleCount>,
  ) => RootDataFinal | undefined
}

const sharedPreviewReferencePairs = [['1-6', '2-6']] as const satisfies readonly (readonly [
  VtgCellReference,
  VtgCellReference,
])[]

const normalizeCoordinate = (value: number) => Math.round(value * 1e9) / 1e9

const normalizePathPosition = (position: readonly number[], orientation: number) => {
  const radians = (orientation * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const x = position[0] ?? 0
  const y = position[1] ?? 0
  return [
    normalizeCoordinate(x * cosine + y * sine),
    normalizeCoordinate(-x * sine + y * cosine),
    normalizeCoordinate(position[2] ?? 0),
  ]
}

const renderedHandPosition = (
  frame: ReturnType<typeof rootCompile>['props'][number]['anim'][number],
) =>
  applyWarpPath(
    new Vector3().fromArray(frame.pos),
    new Vector3().fromArray(frame.warpPos),
    toScaleMultiplier(frame.scale),
    toStrengthRatio(frame.strength),
    new Vector3(),
  ).toArray()

/** Describes the visible hand-path change applied to one otherwise shareable VTG candidate. */
const createHandPathDifferenceSignature = (base: RootDataFinal, transformed: RootDataFinal) => {
  const compiledBase = rootCompile(base)
  const compiledTransformed = rootCompile(transformed)
  const initialFrame = compiledBase.props[0]?.anim[0]
  const initialPosition = initialFrame ? renderedHandPosition(initialFrame) : []
  const orientation = (Math.atan2(initialPosition[1] ?? 0, initialPosition[0] ?? 0) * 180) / Math.PI
  return JSON.stringify({
    paths: compiledTransformed.props.map((prop, propIndex) =>
      prop.anim
        .map((frame, frameIndex) => {
          const basePosition = normalizePathPosition(
            compiledBase.props[propIndex]?.anim[frameIndex]
              ? renderedHandPosition(compiledBase.props[propIndex]!.anim[frameIndex]!)
              : [],
            orientation,
          )
          const transformedPosition = normalizePathPosition(
            renderedHandPosition(frame),
            orientation,
          )
          return transformedPosition.map((value, index) =>
            normalizeCoordinate(value - (basePosition[index] ?? 0)),
          )
        })
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    ),
  })
}

/** Detects whether either hand path represented by a shared VTG thumbnail diverges. */
export const requiresPairedVtgThirdOrderPreviewLayout = (
  speedRatio: VtgSpeedRatio,
  settings: VtgThirdOrderSettings,
  options: VtgThirdOrderPreviewLayoutOptions = {},
): boolean => {
  const minimumCycleCount = getVtgThirdOrderCycleCount(settings, options.mirror)
  const createAnimation =
    options.createAnimation ??
    ((reference: VtgCellReference) =>
      createDefaultVtgAnimation({ reference, speedRatio }, { minimumCycleCount }))
  return sharedPreviewReferencePairs.some(([firstReference, secondReference]) => {
    const first = createAnimation(firstReference, minimumCycleCount)
    const second = createAnimation(secondReference, minimumCycleCount)
    if (!first || !second) return false
    const transformedFirst =
      options.createTransformedAnimation?.(firstReference, minimumCycleCount) ??
      applyVtgThirdOrderSettings(first, settings, options)
    const transformedSecond =
      options.createTransformedAnimation?.(secondReference, minimumCycleCount) ??
      applyVtgThirdOrderSettings(second, settings, options)
    const firstSignature = createHandPathDifferenceSignature(first, transformedFirst)
    const secondSignature = createHandPathDifferenceSignature(second, transformedSecond)
    return firstSignature !== secondSignature
  })
}
