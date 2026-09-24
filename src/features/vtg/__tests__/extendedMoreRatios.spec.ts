import { describe, expect, it } from 'vitest'
import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { inferVtgSpeedRatio } from '@/features/vtg/math/inferVtgSpeedRatio'
import { findVtgPatternMatch } from '@/features/vtg/matchVtgAnimation'
import { findQtrPatternMatch } from '@/features/vtg/qtr/matchQtrAnimation'
import { getAdjustedVtgScale } from '@/features/vtg/data/vtgPlayerSettings'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CURRENT_SPIRO_ANIM_QS_VERSION, loadSpiroAnimQSVersion } from '@/services/query/versions'
import type { VtgIndividualSpeedRatio } from '@/features/vtg/types'

const newRatios = [
  '1:7',
  '2:7',
  '1:9',
  '2:9',
  '1:11',
  '2:11',
  '1:13',
  '2:13',
] as const satisfies readonly VtgIndividualSpeedRatio[]

describe('extended MORE ratios', () => {
  it.each(newRatios)('generates and restores %s at full query precision', async (ratio) => {
    const version = await loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      CURRENT_SPIRO_ANIM_QS_VERSION,
    )
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: ratio })!
    expect(
      animation.props.every((prop) => prop.anim.length === (ratio.startsWith('2:') ? 17 : 9)),
    ).toBe(true)
    expect(getAdjustedVtgScale(0.8, ratio)).toBe(0.8)
    expect(inferVtgSpeedRatio(animation)).toBe(ratio)
    const decoded = codec.decodeQS(codec.encodeQS(animation, false))
    expect(inferVtgSpeedRatio(decoded)).toBe(ratio)
    expect(findVtgPatternMatch(decoded)).toMatchObject({ reference: '1-1', speedRatio: ratio })
  })

  it('supports a mixed 1:13 and 2:11 pairing in VTG and QTR', () => {
    const selection = { reference: '1-1' as const, speedRatio: '1:13v2:11' as const }
    const vtg = createDefaultVtgAnimation(selection)!
    const qtr = createDefaultQtrAnimation({ ...selection, quarters: 1 })!
    expect(inferVtgSpeedRatio(vtg)).toBe(selection.speedRatio)
    expect(inferVtgSpeedRatio(qtr)).toBe(selection.speedRatio)
    expect(findVtgPatternMatch(vtg)).toMatchObject(selection)
    expect(findQtrPatternMatch(qtr)).toMatchObject(selection)
  })
})
