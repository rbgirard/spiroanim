import { createThirdOrderHeaderAnimation } from '@/features/third-order/createThirdOrderHeaderAnimation'
import type { ThirdOrderDirection } from '@/features/third-order/data/thirdOrderMatrix'
import type { VtgIndividualSpeedRatio } from '@/features/vtg/types'
import type { RootDataFinal } from '@/types/AnimTypes'
import { alignmentTolerance, extractPlanarPattern } from './planarPattern'

const tau = 2 * Math.PI
const signedAngle = (angle: number): number => ((((angle + Math.PI) % tau) + tau) % tau) - Math.PI

export interface ThirdOrderHeaderAlignment {
  rotation: number
  /** Comparison-only phase in radians over one header cycle. */
  phase: number
  timeScale: number
  circular: boolean
}

/** Match the top-timing prop's outline, allowing a cycle phase and traversal direction change
 * for comparison only. Playback is never shifted or reversed; both props receive one rotation.
 */
export const getThirdOrderHeaderAlignment = (
  animation: RootDataFinal,
  driverIndex: 0 | 1,
  ratio: VtgIndividualSpeedRatio,
  direction: ThirdOrderDirection,
): ThirdOrderHeaderAlignment => {
  const header = createThirdOrderHeaderAnimation({
    ratio,
    direction,
    scale: 0.5,
    color: 'Cyan',
    prop: 2,
  })
  // The planar extractor expects two tracks; duplicating the header adds no new motion.
  const target = extractPlanarPattern({ ...header, props: [header.props[0]!, header.props[0]!] })
  const source = extractPlanarPattern(animation)
  const hand = source[driverIndex * 2]!
  const head = source[driverIndex * 2 + 1]!
  if (hand.length !== 1 || head.length !== 1 || target[0].length !== 1)
    throw new Error('Expected a uniform unwarped top-timing prop')
  const h = hand[0]!,
    p = head[0]!,
    th = target[0][0]!,
    tp = target[1][0]!
  const timeScale = th.frequency / h.frequency
  if (Math.abs(p.frequency * timeScale - tp.frequency) > alignmentTolerance)
    throw new Error('Top-timing prop does not match header direction or ratio')
  const difference = tp.frequency - th.frequency
  // Spin 1:1 traces a circle (or collapses to a point). Rotation cannot change its outline
  // or make different radii equal, so preserve the selected definition without inventing a phase.
  if (difference === 0) return { rotation: 0, phase: 0, timeScale, circular: true }
  const handAngle = Math.atan2(th.y, th.x) - Math.atan2(h.y, h.x)
  const headAngle = Math.atan2(tp.y, tp.x) - Math.atan2(p.y, p.x)
  const candidates = Array.from({ length: Math.abs(difference) }, (_, root) => {
    const phase = (headAngle - handAngle + tau * root) / difference
    const rotation = signedAngle(handAngle - th.frequency * phase)
    return { rotation, phase }
  }).sort((a, b) => Math.abs(a.rotation) - Math.abs(b.rotation) || a.rotation - b.rotation)
  const best = candidates[0]!
  return {
    rotation: Math.round(((best.rotation * 180) / Math.PI) * 1e10) / 1e10 || 0,
    phase: best.phase,
    timeScale,
    circular: false,
  }
}
