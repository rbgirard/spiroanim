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
import { applyVtgSwap } from '@/features/vtg/applyVtgSwap'
import { stripVtgPropertySettings } from '@/features/vtg/stripVtgPropertySettings'
import { matchVtgPatternRequest } from '@/workers/pattern-matching/handlePatternMatchingRequest'
import type { VtgBeat } from '@/features/vtg/types'
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
  it('retains the reported 45 mode through half-beat changes and URL reloads', async () => {
    const version = await loadSpiroAnimQSVersion(12)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      12,
    )
    const original = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew496k11Y&p0=Q__.blE.5JE-ZU..._ZE_6k........_ZE-ZU....&x0=Qo&m0=_1_mxqv__&p1=N__.bn_.5JE-ZU......._ZE_6k........_ZE-ZU&x1=Qo&c=_i_bhq&v=12&vs=a:80',
        ),
      ),
    )
    const preferences = { swapProps: false, reversePlane: false, quarters: 1 } as const
    const initial = await matchVtgPatternRequest({ animation: original, preferences })
    if (initial.status !== 'matched' || initial.source !== 'vtg') {
      throw new Error('Expected the reported VTG transition to match')
    }
    expect(initial.match).toMatchObject({
      transition: true,
      transitionBeats: 2,
      transitionQuad: true,
    })
    expect(initial.match.transitionAfterBeat).not.toBe(true)
    setActivePinia(createPinia())
    const store = useConceptsStore()
    let animation = original
    let previousBeat: VtgBeat = initial.match.beat ?? 1
    for (const beat of [1.5, 1] as const) {
      store.hydrateVtgPropertyControls(
        applyVtgSwap(animation, initial.match.swapProps),
        0,
        previousBeat,
      )
      const generated = createDefaultVtgAnimation(
        { ...initial.match, beat },
        { properties: store.getVtgPropertySettings() },
      )
      if (!generated) throw new Error(`Expected beat ${beat} to generate`)
      animation = codec.decodeQS(codec.encodeQS(generated, false))
      const reloaded = await matchVtgPatternRequest({
        animation: stripVtgPropertySettings(animation),
        preferences,
      })
      expect(reloaded.status).toBe('matched')
      if (reloaded.status !== 'matched') throw new Error(`Expected beat ${beat} to match`)
      expect(reloaded.match).toMatchObject({
        transition: true,
        transitionBeats: 2,
        transitionQuad: true,
      })
      expect(reloaded.match.transitionAfterBeat).not.toBe(true)
      expect(reloaded.match.beat ?? 1).toBe(beat)
      previousBeat = beat
    }
  })

  it.each([
    { qtr: false, transitionAfterBeat: false },
    { qtr: false, transitionAfterBeat: true },
    { qtr: true, transitionAfterBeat: false },
    { qtr: true, transitionAfterBeat: true },
  ])(
    'treats empty hydrated properties as ordinary transition generation with %j',
    ({ qtr, transitionAfterBeat }) => {
      const properties = createDefaultVtgPropertySettings()
      for (const [initialBeat, beat] of [
        [1, 1.5],
        [1.5, 1],
      ] as const) {
        properties.initialBeat = initialBeat
        const selection = {
          reference: '2-1',
          speedRatio: '1:3',
          beat,
          transition: true,
          transitionQuad: true,
          transitionBeats: 2,
          transitionAfterBeat,
        } as const
        const base = qtr
          ? createDefaultQtrAnimation({ ...selection, quarters: 1 })
          : createDefaultVtgAnimation(selection)
        const withEmptyProperties = qtr
          ? createDefaultQtrAnimation({ ...selection, quarters: 1 }, { properties })
          : createDefaultVtgAnimation(selection, { properties })
        expect(base).toBeDefined()
        expect(withEmptyProperties?.props.map(({ anim }) => anim)).toEqual(
          base?.props.map(({ anim }) => anim),
        )
      }
    },
  )

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
    it(`preserves manual Scale's authoring beat with empty properties (QTR=${qtr})`, () => {
      const properties = createDefaultVtgPropertySettings()
      properties.initialBeat = 1
      const generate = (beat: VtgBeat) => {
        const selection = {
          reference: '2-1' as const,
          speedRatio: '1:3' as const,
          beat,
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
          ? createDefaultQtrAnimation({ ...selection, quarters: 1 }, { properties })
          : createDefaultVtgAnimation(selection, { properties })
      }
      const original = generate(1)
      if (!original) throw new Error('Expected manual Scale to generate')
      expect(generate(1.5)).toEqual(editorShift(original, 1))
    })

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
