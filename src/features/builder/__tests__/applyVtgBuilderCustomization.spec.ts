import { describe, expect, it } from 'vitest'

import { applyVtgBuilderCustomization } from '@/features/builder/applyVtgBuilderCustomization'
import { getVtgDistanceForScale } from '@/features/vtg/data/vtgPlayerSettings'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'

describe('applyVtgBuilderCustomization', () => {
  it('preserves authored Scale and frames the camera from its highest effective value', () => {
    const source = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:3',
      scale: 0.8,
    })
    if (!source) throw new Error('Expected a supported VTG animation')
    source.props[0]!.anim[3] = { ...source.props[0]!.anim[3], scale: 130 }
    const originalAnimations = source.props.map((prop) => structuredClone(prop.anim))

    const customized = applyVtgBuilderCustomization(source, {
      reference: '1-1',
      speedRatio: '1:3',
      scale: 0.5,
      thick: 9,
      paths: false,
    })
    const customizedAtAnotherScale = applyVtgBuilderCustomization(source, {
      reference: '1-1',
      speedRatio: '1:3',
      scale: 1.4,
      thick: 9,
      paths: false,
    })

    expect(customized.props.map((prop) => prop.anim)).toEqual(originalAnimations)
    expect(customized.camera[0]?.orbit?.distance).toBe(getVtgDistanceForScale(1.3))
    expect(customizedAtAnotherScale).toEqual(customized)
    expect(customized.thick).toBe(9)
    expect(customized.paths).toBe(false)
    expect(customized.props.every((prop) => prop.thick === 9 && prop.paths === false)).toBe(true)
  })
})
