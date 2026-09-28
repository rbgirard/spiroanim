import { describe, expect, it } from 'vitest'
import { applyConceptPattern } from '@/features/concepts/applyConceptPattern'
import {
  createThirdOrderAnimation,
  createThirdOrderPreviewAnimation,
} from '@/features/third-order/createThirdOrderAnimation'
import type { ThirdOrderPatternSelection } from '@/features/third-order/types'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createVtgThirdOrderWarp } from '@/features/vtg/thirdOrder'
import { resolveAnimationFrames } from '@/math/animation/frameSemantics'

const selection: ThirdOrderPatternSelection = {
  concept: 'to',
  handRatio: '1:2',
  propRatio: '1:3',
  handDirection: 'anti',
  propDirection: 'anti',
  version: 1,
}

describe('Third Order Anti / Anti patterns', () => {
  it.each([
    ['1:1', '1-3'],
    ['1:2', '1-3'],
    ['2:1', '1-3'],
    ['1:3', '3-3'],
    ['2:3', '3-3'],
    ['1:4', '3-3'],
    ['1:5', '1-3'],
    ['2:5', '1-3'],
  ] as const)(
    'uses the correct VTG definitions for first timing %s in both versions',
    (handRatio, versionTwoReference) => {
      for (const version of [1, 2] as const) {
        const pattern = createThirdOrderAnimation(undefined, {
          ...selection,
          handRatio,
          propRatio: '2:11',
          version,
        })!
        const base = createDefaultVtgAnimation({
          reference: version === 1 ? '5-5' : versionTwoReference,
          isAnti: true,
          speedRatio: `${handRatio}v2:11`,
          orientation: version === 1 || handRatio === '1:4' ? 90 : -90,
        })!
        expect(pattern.props).toHaveLength(2)
        for (const [index, prop] of pattern.props.entries()) {
          const frames = resolveAnimationFrames(prop.anim)
          const baseFrames = resolveAnimationFrames(base.props[index]!.anim)
          expect(frames).toHaveLength(17)
          expect(frames.map(({ plane, arc, turns }) => ({ plane, arc, turns }))).toEqual(
            baseFrames.map(({ plane, arc, turns }) => ({ plane, arc, turns })),
          )
          expect(frames.every((frame) => frame.scale === (index === 0 ? 50 : 100))).toBe(true)
          expect(frames[0]?.warp).toBe(
            index === 1 && version === 2 && versionTwoReference === '3-3' ? 180 : 0,
          )
          for (const frame of frames.slice(1)) {
            expect(frame.warp).toBe(
              index === 0 ? 0 : createVtgThirdOrderWarp(frame.arc, `${handRatio}-anti`),
            )
          }
        }
      }
    },
  )

  it('routes selections through the shared player entry point and preserves the current playback speed', () => {
    const current = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })!
    current.speed = 1.5
    const before = structuredClone(current)
    const selected = {
      ...selection,
      propColors: ['Red', 'Blue'] as const,
      prop: 2 as const,
      bpm: 80,
      spacing: 0,
      hands: true,
      arms: false,
      thick: 9,
    }
    const animation = applyConceptPattern(current, selected)!
    expect(animation.speed).toBe(1.5)
    expect(animation.bpm).toBe(160)
    expect(animation.prop).toBe(2)
    expect(animation.hands).toBe(true)
    expect(animation.arms).toBe(false)
    expect(animation.thick).toBe(9)
    expect(animation.props.map((prop) => prop.color)).toEqual([0, 2])
    expect(animation.props.every((prop) => prop.motion.length === 0)).toBe(true)
    expect(current).toEqual(before)
    const preview = createThirdOrderPreviewAnimation(selected)!
    expect(preview.props.map((prop) => prop.anim)).toEqual(animation.props.map((prop) => prop.anim))
  })

  it.each([
    ['anti', 'spin'],
    ['spin', 'anti'],
    ['spin', 'spin'],
  ] as const)(
    'does not generate unsupported %s / %s selections',
    (handDirection, propDirection) => {
      const unsupported = { ...selection, handDirection, propDirection }
      expect(createThirdOrderAnimation(undefined, unsupported)).toBeUndefined()
      expect(createThirdOrderPreviewAnimation(unsupported)).toBeUndefined()
    },
  )
})
