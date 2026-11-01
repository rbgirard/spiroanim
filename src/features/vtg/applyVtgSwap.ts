import { swapAnimationTracks } from '@/features/concepts/applyPatternFinalTransforms'
import type { RootDataFinal } from '@/types/AnimTypes'

/** Exchanges complete VTG paths, including spacing, without moving prop identity or colors.
 * The same operation restores authoring order when reading or editing a swapped animation.
 */
export const applyVtgSwap = (animation: RootDataFinal, swapped = false): RootDataFinal =>
  swapped ? swapAnimationTracks(animation, { includeMotion: true }) : animation
