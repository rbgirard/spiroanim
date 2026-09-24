import type { VtgScaleIntent } from '@/types/AnimationScale'

/** Optional authoring metadata; frame Scale remains the authoritative rendered data. */
export const encodeVtgScaleIntent = (intent: VtgScaleIntent): string =>
  `${intent.auto ? 'a' : intent.mode === 'advanced' ? 'd' : 'm'}:${Math.round(intent.base * 100)}`

export const decodeVtgScaleIntent = (value: unknown): VtgScaleIntent | undefined => {
  if (typeof value !== 'string') return undefined
  const match = /^([amd]):(\d+)$/.exec(value)
  if (!match) return undefined
  const base = Number(match[2]) / 100
  if (!Number.isFinite(base) || base < 0.5 || base > 1.4) return undefined
  return { auto: match[1] === 'a', base, mode: match[1] === 'd' ? 'advanced' : 'simple' }
}
