import { describe, expect, it } from 'vitest'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { applyVtgSwap } from '@/features/vtg/applyVtgSwap'
import { applyVtgCustomization } from '@/features/vtg/applyVtgCustomization'
import { createDefaultVtgPropertySettings } from '@/features/vtg/propertySettings'
import { createVtgPreviewCandidate } from '@/features/concepts/createVtgPreviewCandidate'
import { rootCompile } from '@/math/animation/AnimFunc'
import type { RootDataFinal } from '@/types/AnimTypes'
import type { VtgPatternSelection } from '@/features/vtg/types'

const compiledPaths = (animation: RootDataFinal) =>
  rootCompile(animation).props.map(({ anim, motion }) => ({ anim, motion }))

describe('VTG final Swap', () => {
  for (const qtr of [false, true]) {
    it.each([
      {},
      { transition: true },
      { transition: true, transitionQuad: true },
      { transition: true, transitionQuad: true, transitionSecond: true, transitionAfterBeat: true },
    ])(`preserves complete paths with QTR=${qtr} and playback %j`, (playback) => {
      const selection: VtgPatternSelection = {
        reference: '5-1',
        speedRatio: '1:2v2:5',
        spacing: 8,
        orientation: -45,
        reversePlane: true,
        beat: 2,
        propRotationOffsets: [90, -45],
        propColors: ['Red', 'Blue'],
        scaleSettings: {
          auto: false,
          base: 0.8,
          mode: 'advanced',
          values: [{ '0': 0.5, '2': 0.7 }, { '0': 1.2 }],
        },
        ...playback,
      }
      const properties = createDefaultVtgPropertySettings()
      properties.twist = { mode: 'advanced', values: [{ '0.5': 45 }, { '1': -90 }] }
      properties.fold.values = [{ '2': { yaw: 45, rotate: 90 } }, {}]
      properties.fold.alternate = [true, true]
      properties.thirdOrder.settings = [
        { initial: '1:3-anti', timing: '2:3-pro', strength: 65 },
        {},
      ]
      properties.thirdOrder.opposed = true
      const options = { properties, minimumCycleCount: 2 as const }
      const generate = (swapProps: boolean) =>
        qtr
          ? createDefaultQtrAnimation({ ...selection, quarters: 1, swapProps }, options)!
          : createDefaultVtgAnimation({ ...selection, swapProps }, options)!
      const original = generate(false)
      const swapped = generate(true)
      expect(compiledPaths(swapped)).toEqual(compiledPaths(original).reverse())
      expect(swapped.props.map(({ color }) => color)).toEqual(
        original.props.map(({ color }) => color),
      )
      expect(applyVtgSwap(swapped, true)).toEqual(original)
      expect(generate(false)).toEqual(original)
      const spacingSelection = { ...selection, spacing: 11 }
      expect(
        compiledPaths(applyVtgCustomization(swapped, { ...spacingSelection, swapProps: true })),
      ).toEqual(compiledPaths(applyVtgCustomization(original, spacingSelection)).reverse())
      expect(
        createVtgPreviewCandidate(
          { ...selection, ...(qtr ? { quarters: 1 as const } : {}), swapProps: true },
          { properties },
        ),
      ).toEqual(swapped)
    })
  }
})
