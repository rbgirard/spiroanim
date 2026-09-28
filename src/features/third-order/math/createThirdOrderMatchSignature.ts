import { rootCompile } from '@/math/animation/AnimFunc'
import { inferVtgTimingFromCompiled } from '@/features/vtg/math/inferVtgSpeedRatio'
import type { RootDataCompiled, RootDataFinal } from '@/types/AnimTypes'
import type { VtgIndividualSpeedRatio } from '@/features/vtg/types'

const tolerance = 1e-7
const radians = Math.PI / 180
const rounded = (value: number) => Math.round(value * 1e7) / 1e7 || 0
const channels = [
  { vector: 'pos', axis: 'posx', amount: (arc: number, _warp: number, _turns: number) => arc },
  {
    vector: 'warpPos',
    axis: 'warpx',
    amount: (arc: number, warp: number, _turns: number) => arc + warp,
  },
  {
    vector: 'rot',
    axis: 'rotx',
    amount: (arc: number, _warp: number, turns: number) => arc + turns,
  },
] as const

export interface ThirdOrderMatchSignature {
  ratios: readonly [VtgIndividualSpeedRatio, VtgIndividualSpeedRatio]
  key: string
}

/** Validate continuous uniform planar motion, then encode its six angular channels.
 * Scale and presentation are deliberately absent. Relative phase, warp strength and rates remain.
 * Normalizing by the first hand's rate also tolerates uniform tempo and frame subdivision changes.
 */
const signatureFromCompiled = (
  props: RootDataCompiled['props'],
  swapped: boolean,
): string | undefined => {
  const ordered = swapped ? [props[1]!, props[0]!] : props
  const anchor = ordered[0]?.anim[0]?.pos
  const next = ordered[0]?.anim[1]
  const beat = ordered[0]?.anim[0]?.beats
  if (!anchor || !next || !beat) return undefined
  const rateScale = Math.abs((next.posx[2] * next.arc) / beat)
  if (!Number.isFinite(rateScale) || rateScale < tolerance) return undefined
  const orientation = Math.atan2(anchor[1], anchor[0])
  const cos = Math.cos(orientation),
    sin = Math.sin(orientation)
  const signature: number[][] = []
  let commonDuration: number | undefined
  for (const prop of ordered) {
    const first = prop.anim[0]!,
      continuation = prop.anim[1]
    if (!continuation) return undefined
    const rates = channels.map(
      ({ axis, amount }) =>
        (continuation[axis][2] * amount(continuation.arc, continuation.warp, continuation.turns)) /
        first.beats,
    )
    if (!rates.every(Number.isFinite) || !Number.isFinite(first.strength)) return undefined
    let elapsed = 0
    for (const [index, frame] of prop.anim.entries()) {
      if (index > 0) {
        const duration = prop.anim[index - 1]!.beats
        if (!Number.isFinite(duration) || duration <= 0) return undefined
        elapsed += duration
      }
      if (
        frame.type !== 0 ||
        frame.rotate ||
        frame.adjust ||
        frame.twist ||
        frame.depth ||
        frame.strength !== first.strength
      )
        return undefined
      for (const [channelIndex, { vector, axis, amount }] of channels.entries()) {
        const rate = rates[channelIndex]!
        const phase = elapsed * rate * radians
        const initial = first[vector],
          actual = frame[vector]
        const error = Math.hypot(
          initial[0] * Math.cos(phase) - initial[1] * Math.sin(phase) - actual[0],
          initial[0] * Math.sin(phase) + initial[1] * Math.cos(phase) - actual[1],
          actual[2],
        )
        if (!Number.isFinite(error) || error > tolerance) return undefined
        if (index > 0) {
          const angle = amount(frame.arc, frame.warp, frame.turns)
          const actualRate = (frame[axis][2] * angle) / prop.anim[index - 1]!.beats
          if (
            Math.abs(actualRate - rate) > tolerance ||
            (angle !== 0 && Math.abs(Math.abs(frame[axis][2]) - 1) > tolerance)
          )
            return undefined
        }
      }
    }
    if (commonDuration !== undefined && Math.abs(elapsed - commonDuration) > tolerance)
      return undefined
    // A truncated orbit that jumps at the loop seam is not the catalog's closed choreography.
    const last = prop.anim.at(-1)!
    if (
      channels.some(
        ({ vector }) =>
          Math.hypot(
            last[vector][0] - first[vector][0],
            last[vector][1] - first[vector][1],
            last[vector][2] - first[vector][2],
          ) > tolerance,
      )
    )
      return undefined
    commonDuration = elapsed
    signature.push([
      rounded(first.strength),
      ...channels.flatMap(({ vector }, index) => [
        rounded(rates[index]! / rateScale),
        rounded(first[vector][0] * cos + first[vector][1] * sin),
        rounded(-first[vector][0] * sin + first[vector][1] * cos),
      ]),
    ])
  }
  return JSON.stringify(signature)
}

/** Compile once; the second signature allows recognition after VTG Swap without publishing it. */
export const createThirdOrderMatchSignatures = (
  animation: RootDataFinal,
): readonly ThirdOrderMatchSignature[] => {
  if (animation.props.length !== 2 || animation.props.some((prop) => prop.motion.length > 1))
    return []
  try {
    const compiled = rootCompile(animation)
    const timing = inferVtgTimingFromCompiled(animation, compiled)
    if (!timing) return []
    const direct = signatureFromCompiled(compiled.props, false)
    if (!direct) return []
    const swapped = signatureFromCompiled(compiled.props, true)
    const left = timing.props[0].ratio,
      right = timing.props[1].ratio
    return [
      { ratios: [left, right], key: direct },
      ...(swapped ? [{ ratios: [right, left] as const, key: swapped }] : []),
    ]
  } catch {
    return []
  }
}
