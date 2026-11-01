import { describe, expect, it } from 'vitest'
import { thirdOrderDefinitions } from '@/features/third-order/data/generatedDefinitions'
import {
  createAnimationFromThirdOrderDefinition,
  getThirdOrderDefinitionDuplicateCount,
} from '@/features/third-order/definitionCatalog'
import { findThirdOrderPatternMatch } from '@/features/third-order/matchThirdOrderAnimation'
import {
  applyPatternInitialArcRotation,
  swapAnimationTracks,
} from '@/features/concepts/applyPatternFinalTransforms'
import { doubleAnimationPlayback } from '@/math/animation/subdivideAnimationPlayback'
import type { ThirdOrderPatternMatch } from '@/features/third-order/types'
import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CURRENT_SPIRO_ANIM_QS_VERSION, loadSpiroAnimQSVersion } from '@/services/query/versions'

const selection: ThirdOrderPatternMatch = {
  handRatio: '1:2',
  propRatio: '1:7',
  handDirection: 'anti',
  propDirection: 'spin',
  version: 2,
  duplicate: 3,
}
const create = (match = selection) =>
  createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, match)!

describe('Third Order matching', () => {
  it('recognizes URL round trips across every top ratio and direction combination', async () => {
    const version = await loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      CURRENT_SPIRO_ANIM_QS_VERSION,
    )
    for (const handRatio of thirdOrderDefinitions.handRatios)
      for (const handDirection of ['anti', 'spin'] as const)
        for (const propDirection of ['anti', 'spin'] as const)
          for (const version of [1, 2] as const) {
            const match = {
              ...selection,
              handRatio,
              handDirection,
              propDirection,
              propRatio: '2:11' as const,
              version,
              duplicate: 1,
            }
            const animation = applyPatternInitialArcRotation(create(match), 123.456)
            const query = codec.encodeQS(animation, false)
            const decoded = await codec.decodeVer(
              Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])),
            )
            expect(findThirdOrderPatternMatch(decoded, match)).toEqual(match)
          }
  })
  it('recognizes every published definition and keeps the preferred duplicate when ambiguous', () => {
    for (const handRatio of thirdOrderDefinitions.handRatios)
      for (const propRatio of thirdOrderDefinitions.propRatios)
        for (const handDirection of ['anti', 'spin'] as const)
          for (const propDirection of ['anti', 'spin'] as const)
            for (const version of [1, 2] as const) {
              const identity = { handRatio, propRatio, handDirection, propDirection, version }
              const count = getThirdOrderDefinitionDuplicateCount(thirdOrderDefinitions, identity)
              for (let duplicate = 1; duplicate <= count; duplicate++) {
                const match = { ...identity, duplicate }
                expect(findThirdOrderPatternMatch(create(match), match)).toEqual(match)
                expect(findThirdOrderPatternMatch(create(match))).toMatchObject(identity)
              }
            }
  }, 30000)

  it.each([0, 45, 90, 123.456, 180, 270, -45])(
    'ignores rotation %s, independent scales and presentation without mutation',
    (rotation) => {
      const animation = applyPatternInitialArcRotation(create(), rotation)
      animation.bpm = 173
      animation.speed = 0.67
      animation.thick = 9
      animation.paths = false
      animation.props.forEach((prop, index) => {
        prop.anim[0]!.scale = index === 0 ? 175 : 32
        prop.color = index === 0 ? 0 : 1
        prop.visible = false
      })
      const before = structuredClone(animation)
      expect(findThirdOrderPatternMatch(animation, selection)).toEqual(selection)
      expect(animation).toEqual(before)
    },
  )

  it('recognizes a VTG Swap through its published counterpart without changing the player', () => {
    const animation = swapAnimationTracks(applyPatternInitialArcRotation(create(), 45), {
      includeMotion: true,
    })
    const before = structuredClone(animation)
    expect(findThirdOrderPatternMatch(animation, selection)).toEqual(selection)
    expect(findThirdOrderPatternMatch(animation)).toMatchObject({
      handRatio: '1:2',
      propRatio: '1:7',
    })
    expect(animation).toEqual(before)
  })

  it('matches uniform subdivision and tempo changes', () => {
    const animation = doubleAnimationPlayback(create())!
    expect(findThirdOrderPatternMatch(animation, selection)).toEqual(selection)
  })

  it('chooses a deterministic first match without a matching preference', () => {
    const animation = create()
    const first = findThirdOrderPatternMatch(animation)!
    expect(first).toBeDefined()
    expect(findThirdOrderPatternMatch(animation, { ...selection, propRatio: '2:11' })).toEqual(
      first,
    )
  })

  it.each(['warp', 'strength', 'turns', 'depth', 'beats'] as const)(
    'rejects unsupported changes to %s',
    (field) => {
      const animation = create()
      const frame = animation.props[1]!.anim[2]!
      frame[field] = 19
      expect(findThirdOrderPatternMatch(animation)).toBeUndefined()
    },
  )

  it('rejects other prop counts and missing continuation frames', () => {
    const animation = create()
    expect(findThirdOrderPatternMatch({ ...animation, props: [] })).toBeUndefined()
    animation.props[0]!.anim = animation.props[0]!.anim.slice(0, 1)
    expect(findThirdOrderPatternMatch(animation)).toBeUndefined()
  })

  it('rejects a truncated cycle even when the remaining intervals retain uniform rates', () => {
    const animation = create()
    animation.props.forEach((prop) => prop.anim.pop())
    expect(findThirdOrderPatternMatch(animation)).toBeUndefined()
  })
})
