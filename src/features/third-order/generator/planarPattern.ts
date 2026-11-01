import { rootCompile } from '@/math/animation/AnimFunc'
import type { RootDataFinal } from '@/types/AnimTypes'

/** Complex Fourier coefficients in the XY plane; time is one complete animation cycle. */
export interface PlanarTerm {
  frequency: number
  x: number
  y: number
}
export type PlanarSignal = PlanarTerm[]
/** Each prop contributes its hand position and its unit head direction. */
export type PlanarPattern = [PlanarSignal, PlanarSignal, PlanarSignal, PlanarSignal]
export const alignmentTolerance = 1e-7
const tau = 2 * Math.PI

const sumSignals = (...signals: PlanarSignal[]): PlanarSignal => {
  const terms = new Map<number, PlanarTerm>()
  for (const signal of signals)
    for (const term of signal) {
      const previous = terms.get(term.frequency) ?? { frequency: term.frequency, x: 0, y: 0 }
      terms.set(term.frequency, {
        frequency: term.frequency,
        x: previous.x + term.x,
        y: previous.y + term.y,
      })
    }
  return [...terms.values()].sort((a, b) => a.frequency - b.frequency)
}

export const combineSignals = (...signals: PlanarSignal[]): PlanarSignal =>
  sumSignals(...signals).filter((t) => Math.hypot(t.x, t.y) > 1e-12)

export const scaleSignal = (signal: PlanarSignal, scale: number): PlanarSignal =>
  signal.map((t) => ({ ...t, x: t.x * scale, y: t.y * scale }))

/** Upper bound for the position error at ANY time, not only selected sample instants. */
export const signalErrorBound = (first: PlanarSignal, second: PlanarSignal): number =>
  sumSignals(first, scaleSignal(second, -1)).reduce((sum, t) => sum + Math.hypot(t.x, t.y), 0)

export const rotatePlanarTerm = (term: PlanarTerm, radians: number): PlanarTerm => ({
  frequency: term.frequency,
  x: term.x * Math.cos(radians) - term.y * Math.sin(radians),
  y: term.x * Math.sin(radians) + term.y * Math.cos(radians),
})

/** Reject unsupported motion instead of giving a false equivalence result. Static spacing is ignored. */
export const extractPlanarPattern = (animation: RootDataFinal): PlanarPattern => {
  if (animation.props.length !== 2 || animation.props.some((p) => p.motion.length > 1)) {
    throw new Error('Expected two props with no moving translation')
  }
  const compiled = rootCompile(animation)
  const signals: PlanarSignal[] = []
  let commonDuration: number | undefined
  for (const prop of compiled.props) {
    const first = prop.anim[0]!
    const next = prop.anim[1]
    if (!next) throw new Error('Missing continuation')
    const duration = prop.anim.slice(0, -1).reduce((sum, f) => sum + f.beats, 0)
    if (commonDuration !== undefined && Math.abs(duration - commonDuration) > alignmentTolerance)
      throw new Error('Unequal cycle durations')
    commonDuration = duration
    const channels = [
      { vector: 'pos', axis: 'posx', angle: next.arc },
      { vector: 'warpPos', axis: 'warpx', angle: next.arc + next.warp },
      { vector: 'rot', axis: 'rotx', angle: next.arc + next.turns },
    ] as const
    const terms = channels.map(({ vector, axis, angle }) => {
      const frequency = (((next[axis][2] * angle) / first.beats) * duration) / 360
      if (Math.abs(frequency - Math.round(frequency)) > alignmentTolerance)
        throw new Error('Cycle does not close')
      return { frequency: Math.round(frequency), x: first[vector][0], y: first[vector][1] }
    })
    let elapsed = 0
    for (const [index, frame] of prop.anim.entries()) {
      if (index > 0) elapsed += prop.anim[index - 1]!.beats
      if (
        frame.type !== 0 ||
        frame.rotate ||
        frame.adjust ||
        frame.twist ||
        frame.depth ||
        frame.scale !== first.scale ||
        frame.strength !== first.strength
      )
        throw new Error('Unsupported nonuniform or nonplanar controls')
      channels.forEach(({ vector, axis }, channel) => {
        const term = terms[channel]!
        const predicted = rotatePlanarTerm(term, (tau * term.frequency * elapsed) / duration)
        if (
          Math.hypot(
            predicted.x - frame[vector][0],
            predicted.y - frame[vector][1],
            frame[vector][2],
          ) > alignmentTolerance
        )
          throw new Error('Not a uniform planar orbit')
        if (index > 0) {
          const angle =
            channel === 0
              ? frame.arc
              : channel === 1
                ? frame.arc + frame.warp
                : frame.arc + frame.turns
          const actualRate =
            (((frame[axis][2] * angle) / prop.anim[index - 1]!.beats) * duration) / 360
          if (
            Math.abs(actualRate - term.frequency) > alignmentTolerance ||
            (angle !== 0 && Math.abs(Math.abs(frame[axis][2]) - 1) > alignmentTolerance)
          )
            throw new Error('Nonuniform angular velocity')
        }
      })
    }
    const strength = first.strength / 1000
    signals.push(
      combineSignals(
        scaleSignal([terms[0]!], (first.scale / 100) * (1 - strength / 2)),
        scaleSignal([terms[1]!], ((first.scale / 100) * strength) / 2),
      ),
      [terms[2]!],
    )
  }
  return [signals[0]!, signals[1]!, signals[2]!, signals[3]!]
}

export interface CanonicalTransform {
  swapped: boolean
  turnedOver: boolean
  phaseDegrees: number
  rotationDegrees: number
}
export interface CanonicalPattern {
  key: string
  transform: CanonicalTransform
}

/** Exact finite search over continuous phase/rotation freedoms, not a time-sampling grid.
 * A half-turn about an in-plane axis conjugates the XY coordinates (a proper 3D rotation).
 * Time reversal and independent per-prop rotations are deliberately NOT equivalences.
 */
export const canonicalizePlanarPattern = (pattern: PlanarPattern): CanonicalPattern => {
  let best: CanonicalPattern | undefined
  const rounded = (n: number) => Math.round(n * 1e8) / 1e8 || 0
  for (const swapped of [false, true])
    for (const turnedOver of [false, true]) {
      const ordered = swapped ? [pattern[2], pattern[3], pattern[0], pattern[1]] : pattern
      const signals = ordered.map((s) =>
        s
          .map((t) => (turnedOver ? { frequency: -t.frequency, x: t.x, y: -t.y } : t))
          .sort((a, b) => a.frequency - b.frequency),
      )
      const anchor = signals.flat()[0]
      if (!anchor) throw new Error('Empty pattern')
      const other = signals.flat().find((t) => t.frequency !== anchor.frequency)
      const difference = other ? other.frequency - anchor.frequency : 1
      const angle = Math.atan2(anchor.y, anchor.x)
      for (let root = 0; root < Math.abs(difference); root++) {
        const phase = other ? (angle - Math.atan2(other.y, other.x) + tau * root) / difference : 0
        const rotation = -angle - anchor.frequency * phase
        const key = JSON.stringify(
          signals.map((signal) =>
            signal.map((t) => {
              const transformed = rotatePlanarTerm(t, rotation + t.frequency * phase)
              return [t.frequency, rounded(transformed.x), rounded(transformed.y)]
            }),
          ),
        )
        if (!best || key < best.key)
          best = {
            key,
            transform: {
              swapped,
              turnedOver,
              phaseDegrees: rounded((phase * 180) / Math.PI),
              rotationDegrees: rounded((rotation * 180) / Math.PI),
            },
          }
      }
    }
  return best!
}
