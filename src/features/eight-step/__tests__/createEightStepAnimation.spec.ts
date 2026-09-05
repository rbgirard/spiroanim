import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import {
  createDefaultEightStepAnimation,
  createEightStepAnimation,
  eightStepPlaybackMultiplier,
} from '@/features/eight-step/createEightStepAnimation'
import { eightStepPatternDefinitions } from '@/features/eight-step/data/eightStepPatternDefinitions'
import { vtgPlayerSettings } from '@/features/vtg/data/vtgPlayerSettings'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { rootCompile } from '@/math/animation/AnimFunc'
import { decodeReadable } from '@/services/animation/AnimReadableFunc'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CHARSET, VDEF } from '@/services/query/versions/SpiroAnimQSv12'
import { applyPatternFinalTransforms } from '@/features/concepts/applyPatternFinalTransforms'

const current = rootFinal(
  decodeReadable({
    bpm: 99,
    color: 'Blue',
    prop: 'Staff',
    smooth: false,
    guides: true,
    anchors: true,
    nodes: true,
    paths: false,
    hands: true,
    arms: false,
    visible: false,
    aspectx: 2,
    aspecty: 3,
    distance: 40,
    thick: 9,
    props: [],
  }),
)

describe('createEightStepAnimation', () => {
  it('assigns each authored relationship to the opposite prop by default', () => {
    const defaultAssignment = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '1-AA',
    })
    const swappedAssignment = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '1-AA',
      swapProps: true,
    })

    expect(defaultAssignment).toBeDefined()
    expect(swappedAssignment).toBeDefined()
    expect(defaultAssignment?.props[0]?.anim).toEqual(swappedAssignment?.props[1]?.anim)
    expect(defaultAssignment?.props[1]?.anim).toEqual(swappedAssignment?.props[0]?.anim)
  })

  it('builds a closed two-prop animation while preserving unrelated player settings', () => {
    const animation = createEightStepAnimation(current, {
      concept: '8stp',
      reference: '1-AA',
    })

    expect(animation).toBeDefined()
    expect(animation).toMatchObject({
      bpm: vtgPlayerSettings.bpm * eightStepPlaybackMultiplier,
      aspectx: vtgPlayerSettings.aspectx,
      aspecty: vtgPlayerSettings.aspecty,
      smooth: current.smooth,
      props: [{ color: 4 }, { color: 1 }],
    })
    expect(animation?.props.map(({ anim }) => anim.length)).toEqual([25, 25])
    expect(
      rootCompile(animation!).props.every((prop) =>
        prop.anim.slice(1).every((frame) => frame.arc === 45),
      ),
    ).toBe(true)
  })

  it('halves every compiled pattern Turn while preserving zero and Viewer Offset', () => {
    const normal = createDefaultEightStepAnimation({ concept: '8stp', reference: '7-IE' })
    const halved = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '7-IE',
      halve: true,
    })
    const offset = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '7-IE',
      halve: true,
      propRotationOffsets: [90, -90],
    })
    if (!normal || !halved || !offset) throw new Error('Expected supported Eight Step animations')

    const normalCompiled = rootCompile(normal)
    const halvedCompiled = rootCompile(halved)
    for (const [propIndex, prop] of normalCompiled.props.entries()) {
      for (const [frameIndex, frame] of prop.anim.entries()) {
        const halvedFrame = halvedCompiled.props[propIndex]?.anim[frameIndex]
        expect(halvedFrame?.turns).toBe(frame.turns === 0 ? 0 : frame.turns / 2)
      }
    }
    expect(
      halved.props.flatMap((prop) => prop.anim).every((frame) => !Object.is(frame.turns, -0)),
    ).toBe(true)
    expect((offset.props[0]?.anim[0]?.turns ?? 0) - (halved.props[0]?.anim[0]?.turns ?? 0)).toBe(90)
    expect((offset.props[1]?.anim[0]?.turns ?? 0) - (halved.props[1]?.anim[0]?.turns ?? 0)).toBe(
      -90,
    )
  })

  it('applies shared player controls and swaps complete tracks', () => {
    const base = createDefaultEightStepAnimation({ concept: '8stp', reference: '5-II' })
    const transformed = createEightStepAnimation(current, {
      concept: '8stp',
      reference: '5-II',
      swapProps: true,
      reversePlane: true,
      bpm: 84,
      scale: 1.2,
      thick: 11,
      paths: false,
      hands: true,
      arms: false,
    })

    expect(base).toBeDefined()
    expect(transformed).toBeDefined()
    expect(transformed).toMatchObject({
      bpm: 84 * eightStepPlaybackMultiplier,
      thick: 11,
      paths: false,
      hands: true,
      arms: false,
    })
    expect(transformed?.props.map(({ color }) => color)).toEqual([4, 1])
    expect(transformed?.props.every(({ anim }) => anim[0]?.scale === 120)).toBe(true)
    expect(rootCompile(transformed!).camera[0]!.orbit.offset).toEqual([0, 0, -23])
    expect(transformed?.props[0]?.anim).not.toEqual(base?.props[1]?.anim)
  })

  it('applies Swap and 180 only after Box is complete', () => {
    const selection = {
      concept: '8stp',
      reference: '5-II',
      shape: 'box',
    } as const
    const semantic = createDefaultEightStepAnimation(selection)
    const transformed = createDefaultEightStepAnimation({
      ...selection,
      swapProps: true,
      reversePlane: true,
    })
    if (!semantic) throw new Error('Expected an Eight Step animation')

    expect(transformed).toEqual(
      applyPatternFinalTransforms(semantic, { swapProps: true, reversePlane: true }),
    )
  })

  it('preserves the active playback speed when BPM rebuilds the pattern', () => {
    const animation = createEightStepAnimation(
      { ...current, speed: 0.5 },
      {
        concept: '8stp',
        reference: '5-II',
        bpm: 84,
      },
    )

    expect(animation).toMatchObject({
      bpm: 84 * eightStepPlaybackMultiplier,
      speed: 0.5,
    })
  })

  it('applies prop visibility overrides only to unchecked sides', () => {
    const visible = createDefaultEightStepAnimation({ concept: '8stp', reference: '1-AA' })
    const rightHidden = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '1-AA',
      right: false,
    })
    if (!visible || !rightHidden) throw new Error('Expected Eight Step animations')

    for (const key of ['paths', 'hands', 'arms', 'visible'] as const) {
      expect(visible.props[0]).not.toHaveProperty(key)
      expect(visible.props[1]).not.toHaveProperty(key)
      expect(rightHidden.props[0]).not.toHaveProperty(key)
      expect(rightHidden.props[1]?.[key]).toBe(false)
    }
  })

  it('does not mutate independently owned source definitions', () => {
    const first = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '1-AI',
      reversePlane: true,
      scale: 1.4,
    })
    const second = createDefaultEightStepAnimation({ concept: '8stp', reference: '1-AI' })

    expect(first?.props[0]?.anim[0]?.scale).toBe(140)
    expect(second?.props[0]?.anim[0]?.scale).toBe(80)
  })

  it('adds 45 degrees only to both initial arcs in Box mode', () => {
    const diamond = createDefaultEightStepAnimation({ concept: '8stp', reference: '1-AI' })
    const box = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '1-AI',
      shape: 'box',
    })
    const boxSwapped = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '1-AI',
      shape: 'box',
      swapProps: true,
    })

    expect(diamond).toBeDefined()
    expect(box).toBeDefined()
    if (!diamond || !box) return

    const diamondCompiled = rootCompile(diamond)
    const boxCompiled = rootCompile(box)
    expect(boxCompiled.props.map((prop) => prop.anim[0]!.arc)).toEqual(
      diamondCompiled.props.map((prop) => {
        const initial = prop.anim[0]!
        const delta = Math.abs(initial.plane) === 180 ? -45 : 45
        return (initial.arc + delta + 360) % 360
      }),
    )
    expect(boxCompiled.props.map((prop) => prop.anim.slice(1).map(({ arc }) => arc))).toEqual(
      diamondCompiled.props.map((prop) => prop.anim.slice(1).map(({ arc }) => arc)),
    )
    expect(boxSwapped?.props.map((prop) => prop.anim[0]?.arc)).toEqual(
      box.props.map((prop) => prop.anim[0]?.arc).reverse(),
    )
  })

  it('keeps quarter-column hand positions one quarter apart in Box mode', () => {
    for (const column of [5, 6, 7, 8] as const) {
      for (const reversePlane of [false, true]) {
        const animation = createDefaultEightStepAnimation({
          concept: '8stp',
          reference: `${column}-AA`,
          shape: 'box',
          reversePlane,
        })
        expect(animation).toBeDefined()
        if (!animation) continue

        const [first, second] = rootCompile(animation).props
        for (const [frameIndex, firstFrame] of first!.anim.entries()) {
          if (frameIndex % eightStepPlaybackMultiplier !== 0) continue
          const secondFrame = second!.anim[frameIndex]!
          const dot = firstFrame.pos.reduce(
            (sum, coordinate, index) => sum + coordinate * secondFrame.pos[index]!,
            0,
          )
          expect(dot, `column ${column}, 180° ${reversePlane}, frame ${frameIndex}`).toBeCloseTo(
            0,
            7,
          )
        }
      }
    }
  })

  it('round-trips through a compact shared URL without changing playback', async () => {
    const animation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '6-AI',
      swapProps: true,
      reversePlane: true,
      shape: 'box',
      bpm: 101,
      scale: 1.2,
      thick: 11,
      paths: false,
      hands: true,
      arms: false,
      right: false,
    })
    expect(animation).toBeDefined()
    if (!animation) return

    const codec = await useSpiroAnimQS(VDEF, useBaseQS(VDEF, { charset: CHARSET }), 12)
    const query = codec.encodeQS(animation, false)
    const decoded = await codec.decodeVer(query)

    expect(new URLSearchParams(query).toString().length).toBeLessThanOrEqual(225)
    expect(decoded).toMatchObject({
      bpm: animation.bpm,
      thick: animation.thick,
      paths: animation.paths,
      hands: animation.hands,
      arms: animation.arms,
    })
    expect(rootCompile(decoded).props).toEqual(rootCompile(animation).props)
    expect(decoded.props[1]).toMatchObject({
      paths: false,
      hands: false,
      arms: false,
      visible: false,
    })
  })

  it('round-trips every Eight Step cell and transform without changing playback', async () => {
    const codec = await useSpiroAnimQS(VDEF, useBaseQS(VDEF, { charset: CHARSET }), 12)

    for (const definition of eightStepPatternDefinitions) {
      for (const swapProps of [false, true]) {
        for (const reversePlane of [false, true]) {
          for (const shape of ['diamond', 'box'] as const) {
            const label = `${definition.reference}, Swap ${swapProps}, 180° ${reversePlane}, ${shape}`
            const animation = createDefaultEightStepAnimation({
              concept: '8stp',
              reference: definition.reference,
              swapProps,
              reversePlane,
              shape,
            })
            expect({ label, animationDefined: animation !== undefined }).toEqual({
              label,
              animationDefined: true,
            })
            if (!animation) continue

            const decoded = await codec.decodeVer(codec.encodeQS(animation, false))
            expect({ label, props: rootCompile(decoded).props }).toEqual({
              label,
              props: rootCompile(animation).props,
            })
          }
        }
      }
    }
  })
})
