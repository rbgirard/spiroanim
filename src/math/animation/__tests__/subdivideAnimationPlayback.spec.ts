import { describe, expect, it } from 'vitest'

import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { rootCompile } from '@/math/animation/AnimFunc'
import { doubleAnimationPlayback } from '@/math/animation/subdivideAnimationPlayback'

const createStrengthChange = (initialWarp?: number) => {
  const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
  if (!animation) throw new Error('Expected a supported VTG animation')

  animation.props[0]!.anim[0] = {
    ...animation.props[0]!.anim[0],
    strength: 1000,
    ...(initialWarp === undefined ? undefined : { warp: initialWarp }),
  }
  animation.props[0]!.anim[1] = {
    ...animation.props[0]!.anim[1],
    strength: 500,
    warp: 90,
  }
  return animation
}

describe('subdivideAnimationPlayback Strength transitions', () => {
  it('uses target Strength at an inserted frame when the original start is shared', () => {
    const doubled = doubleAnimationPlayback(createStrengthChange())
    if (!doubled) throw new Error('Expected the animation to support subdivision')

    expect(rootCompile(doubled).props[0]?.anim[1]?.strength).toBe(500)
  })

  it('interpolates Strength at an inserted frame when changing it would move the start', () => {
    const doubled = doubleAnimationPlayback(createStrengthChange(90))
    if (!doubled) throw new Error('Expected the animation to support subdivision')

    expect(rootCompile(doubled).props[0]?.anim[1]?.strength).toBe(750)
  })
})
