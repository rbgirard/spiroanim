import { describe, expect, it } from 'vitest'
import { createThirdOrderHeaderAnimation } from '@/features/third-order/createThirdOrderHeaderAnimation'
import { thirdOrderPropRatios } from '@/features/third-order/data/thirdOrderMatrix'
import { resolveAnimationFrames } from '@/math/animation/frameSemantics'

describe('Third Order header paths', () => {
  it.each(thirdOrderPropRatios)(
    'closes both directions of %s with the exact requested scale',
    (ratio) => {
      const [numerator, denominator] = ratio.split(':').map(Number)
      if (!numerator || !denominator) throw new Error('Missing timing')
      for (const direction of ['anti', 'spin'] as const) {
        for (const scale of [0.5, 1] as const) {
          const animation = createThirdOrderHeaderAnimation({
            ratio,
            direction,
            scale,
            color: 'Magenta',
            prop: 2,
          })
          expect(animation.props).toHaveLength(1)
          expect(animation.prop).toBe(2)
          expect(animation.props[0]?.color).toBe(5)
          const frames = resolveAnimationFrames(animation.props[0]!.anim)
          // Plane 180 reverses the local arc sign: a -90-degree rotation moves 90 to 180.
          expect(frames[0]?.plane).toBe(180)
          expect(frames[0]?.arc).toBe(180)
          expect(frames).toHaveLength(8 * numerator + 1)
          expect(frames.every((frame) => frame.scale === scale * 100)).toBe(true)
          const totalArc = frames.slice(1).reduce((sum, frame) => sum + frame.arc, 0)
          const totalTurns = frames.slice(1).reduce((sum, frame) => sum + frame.turns, 0)
          expect(totalArc).toBe(360 * numerator)
          expect(totalArc + totalTurns).toBeCloseTo(
            360 * denominator * (direction === 'anti' ? -1 : 1),
          )
        }
      }
    },
  )
})
