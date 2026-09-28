import { describe, expect, it } from 'vitest'
import { applyConceptPattern } from '@/features/concepts/applyConceptPattern'
import {
  createThirdOrderAnimation,
  createThirdOrderPreviewAnimation,
  isThirdOrderSelectionSupported,
} from '@/features/third-order/createThirdOrderAnimation'
import { thirdOrderDefinitions } from '@/features/third-order/data/generatedDefinitions'
import { thirdOrderCells } from '@/features/third-order/data/thirdOrderMatrix'
import {
  createAnimationFromThirdOrderDefinition,
  getThirdOrderDefinitionRecipe,
} from '@/features/third-order/definitionCatalog'
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

describe('Third Order catalog patterns', () => {
  it.each([
    ['anti', 'anti'],
    ['anti', 'spin'],
    ['spin', 'anti'],
    ['spin', 'spin'],
  ] as const)(
    'reconstructs every %s / %s cell from the catalog without provisional overrides',
    (handDirection, propDirection) => {
      for (const cell of thirdOrderCells)
        for (const version of [1, 2] as const) {
          const request = { ...selection, ...cell, handDirection, propDirection, version }
          const pattern = createThirdOrderAnimation(undefined, request)!
          expect(isThirdOrderSelectionSupported(request)).toBe(true)
          expect(pattern).toEqual(
            createAnimationFromThirdOrderDefinition(thirdOrderDefinitions, request),
          )
          const recipe = getThirdOrderDefinitionRecipe(thirdOrderDefinitions, request)!
          const inputDriver = recipe.reversed ? 1 : 0
          const driver = recipe.swapProps ? 1 - inputDriver : inputDriver
          const preview = createThirdOrderPreviewAnimation(request)!
          expect(preview.props.map((prop) => prop.anim)).toEqual(
            pattern.props.map((prop) => prop.anim),
          )
          expect(preview.props[driver]).toMatchObject({
            paths: false,
            hands: false,
            arms: false,
            visible: false,
          })
          expect(preview.props[1 - driver]?.paths).toBe(true)
          expect(pattern.props.every((prop) => prop.paths !== false)).toBe(true)
          expect(pattern.props).toHaveLength(2)
          for (const [index, prop] of pattern.props.entries()) {
            const frames = resolveAnimationFrames(prop.anim)
            expect(frames.every((frame) => frame.scale === (index === driver ? 50 : 100))).toBe(
              true,
            )
            expect(frames[0]?.warp).toBe(index === driver ? 0 : recipe.adjust)
            for (const frame of frames.slice(1)) {
              expect(frame.warp).toBe(
                index === driver
                  ? 0
                  : createVtgThirdOrderWarp(
                      frame.arc,
                      `${cell.handRatio}-${handDirection === 'anti' ? 'anti' : 'pro'}`,
                    ),
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

  it('identifies unknown timing selections as unsupported', () => {
    const unsupported = { ...selection, handRatio: '1:99' as const }
    expect(isThirdOrderSelectionSupported(unsupported)).toBe(false)
  })

  it('preserves Customize prop identities through swapped, reversed recipes', () => {
    const request = {
      ...selection,
      propDirection: 'spin' as const,
      propRatio: '2:5' as const,
      version: 2 as const,
    }
    expect(getThirdOrderDefinitionRecipe(thirdOrderDefinitions, request)).toMatchObject({
      swapProps: true,
      reversed: true,
    })
    const animation = createThirdOrderAnimation(undefined, {
      ...request,
      left: false,
      propColors: ['Red', 'Blue'],
      spacing: 0.2,
    })!
    expect(animation.props.map((prop) => prop.color)).toEqual([0, 2])
    expect(animation.props[0]).toMatchObject({
      visible: false,
      paths: false,
      hands: false,
      arms: false,
    })
    expect(animation.props[1]?.visible).not.toBe(false)
    const preview = createThirdOrderPreviewAnimation({
      ...request,
      propColors: ['Red', 'Blue'],
      spacing: 0.2,
    })!
    expect(preview.props.map((prop) => prop.anim)).toEqual(animation.props.map((prop) => prop.anim))
  })
})
