import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import {
  createDefaultVtgPropertySettings,
  cloneVtgPropertySettings,
} from '@/features/vtg/propertySettings'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { rootCompile } from '@/math/animation/AnimFunc'
import { shiftAnimationFrameRange } from '@/math/animation/shiftAnimationFrames'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'
import { useBaseQS } from '@/services/query/createBaseQS'
import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { findVtgPatternMatch } from '@/features/vtg/matchVtgAnimation'
import type { RootDataFinal } from '@/types/AnimTypes'

const editorShift = (animation: RootDataFinal, shiftCount: number): RootDataFinal => {
  const compiled = rootCompile(animation)
  return {
    ...animation,
    props: animation.props.map((prop, index) => {
      const anim = shiftAnimationFrameRange(
        prop.anim,
        compiled.props[index]!.anim,
        0,
        prop.anim.length - 1,
        {
          shiftCount,
          allowEndpointMismatch: true,
          preserveFinalOutgoing: true,
        },
      )
      if (!anim) throw new Error('Expected Shift reconstruction')
      return { ...prop, anim }
    }),
  }
}

describe('VTG property Beats', () => {
  it('keeps the reported warped hand aligned with the other head through half beats and reloads', async () => {
    const version = await loadSpiroAnimQSVersion(12)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      12,
    )
    const original = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew48uk11Y&p0=Q__.blE.5JE_98.......&x0=PW&m0=_1_mxqv__&p1=N__.blE.5JE-Rs.......&x1=QI__MUf_.____Oif_&c=_k_bhq&v=12&vs=m:100',
        ),
      ),
    )
    const selection = findVtgPatternMatch(original)
    if (!selection) throw new Error('Expected the reported pattern to match')
    setActivePinia(createPinia())
    const store = useConceptsStore()
    store.hydrateVtgPropertyControls(original, 0, selection.beat ?? 1)
    const properties = cloneVtgPropertySettings(store.getVtgPropertySettings())
    for (const beat of [1, 1.5, 2, 2.5, 3, 3.5, 4] as const) {
      const animation = createDefaultVtgAnimation({ ...selection, beat }, { properties })
      if (!animation) throw new Error(`Expected beat ${beat}`)
      const compiled = rootCompile(animation)
      compiled.props[0]!.anim.forEach((frame, index) => {
        frame.rot.forEach((value, axis) =>
          expect(value).toBeCloseTo(compiled.props[1]!.anim[index]!.warpPos[axis]!, 7),
        )
      })
      // Reloaded controls describe this physical start; regenerating at it must not shift twice.
      store.hydrateVtgPropertyControls(animation, 0, beat)
      const reloaded = createDefaultVtgAnimation(
        { ...selection, beat },
        { properties: store.getVtgPropertySettings() },
      )
      expect(reloaded).toBeDefined()
      const back = createDefaultVtgAnimation(
        { ...selection, beat: 1 },
        { properties: store.getVtgPropertySettings() },
      )
      expect(back).toBeDefined()
      const backCompiled = rootCompile(back!)
      backCompiled.props[0]!.anim.forEach((frame, index) => {
        frame.rot.forEach((value, axis) =>
          expect(value).toBeCloseTo(backCompiled.props[1]!.anim[index]!.warpPos[axis]!, 7),
        )
      })
    }
  })

  for (const qtr of [false, true]) {
    for (const swapProps of [false, true]) {
      it(`uses full editor Shift for Fold, Twist, Scale and Third Order (QTR=${qtr}, Swap=${swapProps})`, () => {
        const properties = createDefaultVtgPropertySettings()
        properties.twist = { mode: 'advanced', values: [{ '0.5': 45 }, { '1': -90 }] }
        properties.fold.values = [{ '2': { yaw: 45, rotate: 90 } }, {}]
        properties.fold.alternate = [true, true]
        properties.thirdOrder.settings = [{ initial: 45, timing: '2:3-pro', strength: 65 }, {}]
        properties.thirdOrder.opposed = true
        const generate = (beat: 1 | 1.5 | 2 | 4) => {
          const selection = {
            reference: '5-1' as const,
            speedRatio: '1:2v2:5' as const,
            reversePlane: true,
            swapProps,
            beat,
            orientation: -45 as const,
            propRotationOffsets: [90, -45] as [number, number],
            scaleSettings: {
              auto: false,
              base: 0.8,
              mode: 'advanced' as const,
              values: [{ '0': 0.5, '2': 0.7 }, { '0': 1.2 }] as [
                Record<string, number>,
                Record<string, number>,
              ],
            },
          }
          return qtr
            ? createDefaultQtrAnimation(
                { ...selection, quarters: 1 },
                { properties, minimumCycleCount: 2 },
              )
            : createDefaultVtgAnimation(selection, { properties, minimumCycleCount: 2 })
        }
        const original = generate(1)!
        expect(original).toBeDefined()
        for (const beat of [1.5, 2, 4] as const) {
          expect(generate(beat)).toEqual(editorShift(original, (beat - 1) * 2))
        }
      })
    }
  }
})
