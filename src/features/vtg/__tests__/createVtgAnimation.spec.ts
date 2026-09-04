import { MathUtils, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  createDefaultVtgAnimation,
  createVtgAnimation as createVtgAnimationForSelection,
  createVtgPreviewAnimation as createVtgPreviewAnimationForSelection,
} from '@/features/vtg/createVtgAnimation'
import { buildVtgPattern as buildSelectedVtgPattern } from '@/features/vtg/data/vtgPatternCatalog'
import {
  getAdjustedVtgScale,
  vtgPlayerSettings,
  vtgScaleAdjustmentByDenominator,
} from '@/features/vtg/data/vtgPlayerSettings'
import { getVtgBeats, vtgSpeedRatios } from '@/features/vtg/types'
import type { VtgCellReference, VtgPatternSelection, VtgRuleNumber } from '@/features/vtg/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import { inferVtgTiming } from '@/features/vtg/math/inferVtgSpeedRatio'
import { reverseAngle } from '@/math/animation/AngleFunc'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { doublePlaybackMultiplier } from '@/math/animation/subdivideAnimationPlayback'
import type { RootData, RootDataFinal } from '@/types/AnimTypes'
import { TTYPE } from '@/domain/animation/AnimStruct'
import { InitialPoint } from '@/math/animation/OrthogonalFunc'

const createVtgAnimation = (current: RootDataFinal, selection: VtgPatternSelection) =>
  createVtgAnimationForSelection(current, selection)

const createVtgPreviewAnimation = (selection: VtgPatternSelection) =>
  createVtgPreviewAnimationForSelection(selection)

const buildVtgPattern = (selection: VtgPatternSelection) => buildSelectedVtgPattern(selection)

const createCurrentAnimation = () =>
  rootFinal({
    bpm: 90,
    prop: 0,
    color: 0,
    smooth: true,
    guides: true,
    paths: false,
    hands: true,
    arms: false,
    visible: true,
    nodes: true,
    anchors: true,
    props: [{ anim: [{ arc: 45 }] }],
    aspectx: 16,
    aspecty: 9,
    distance: 30,
    thick: 8,
  } satisfies RootData)

const expectVectorClose = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, 9))
}

describe('createVtgAnimation', () => {
  it('uses the same doubled cycle for a Third Order minimum as a native 2:* timing', () => {
    const doubled = createVtgAnimationForSelection(
      createCurrentAnimation(),
      { reference: '1-1', speedRatio: '1:3' },
      { minimumCycleCount: 2 },
    )
    const native = createVtgAnimationForSelection(createCurrentAnimation(), {
      reference: '1-1',
      speedRatio: '2:3',
    })
    const doubledTransition = createVtgAnimationForSelection(
      createCurrentAnimation(),
      { reference: '1-1', speedRatio: '1:3', transition: true },
      { minimumCycleCount: 2 },
    )
    const nativeTransition = createVtgAnimationForSelection(createCurrentAnimation(), {
      reference: '1-1',
      speedRatio: '2:3',
      transition: true,
    })
    if (!doubled || !native || !doubledTransition || !nativeTransition) {
      throw new Error('Expected one-cycle and two-cycle VTG animations')
    }

    expect(doubled.props[0]?.anim).toHaveLength(17)
    expect(doubled.props[0]?.anim).toHaveLength(native.props[0]?.anim.length ?? 0)
    expect(doubledTransition.props[0]?.anim).toHaveLength(
      nativeTransition.props[0]?.anim.length ?? 0,
    )
  })

  it('assigns compound ratios to prop indexes', () => {
    const propRatios = (speedRatio: '1:2v3' | '1:3v2') => {
      const animation = createDefaultVtgAnimation({ reference: '1-5', speedRatio })
      return animation ? inferVtgTiming(animation)?.props.map(({ ratio }) => ratio) : undefined
    }

    expect(propRatios('1:2v3')).toEqual(['1:2', '1:3'])
    expect(propRatios('1:3v2')).toEqual(['1:3', '1:2'])
  })

  it('leaves compound Swap out of table generation and swaps completed tracks', () => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:2v3',
      swapProps: true,
    } as const satisfies VtgPatternSelection
    const basePattern = buildSelectedVtgPattern({ ...selection, swapProps: false })
    const swappedPattern = buildSelectedVtgPattern(selection)

    expect(swappedPattern).toEqual(basePattern)

    const original = createDefaultVtgAnimation({ ...selection, swapProps: false })
    const swapped = createDefaultVtgAnimation(selection)

    expect(swapped?.props[0]?.anim).toEqual(original?.props[1]?.anim)
    expect(swapped?.props[1]?.anim).toEqual(original?.props[0]?.anim)
  })

  it.each([
    ['1:1', 0.1, 90, 19],
    ['1:2', -0.2, 60, 15],
    ['1:3', 0, 80, 18],
    ['1:4', 0.1, 90, 19],
    ['1:5', 0.2, 100, 20],
  ] as const)(
    'adds the %s Scale adjustment before converting to raw scale',
    (speedRatio, adjustment, rawScale, distance) => {
      const pattern = buildVtgPattern({ reference: '1-6', speedRatio })

      expect(vtgScaleAdjustmentByDenominator[Number(speedRatio.slice(2))]).toBe(adjustment)
      expect(pattern?.props.map((prop) => prop.anim[0]?.scale)).toEqual([rawScale, rawScale])
      expect(pattern?.distance).toBe(distance)
    },
  )

  it('lists every ratio adjustment and clamps adjusted Scale to the control bounds', () => {
    expect(vtgScaleAdjustmentByDenominator).toEqual({ 1: 0.1, 2: -0.2, 3: 0, 4: 0.1, 5: 0.2 })
    expect(getAdjustedVtgScale(0.5, '1:2')).toBe(0.5)
    expect(getAdjustedVtgScale(1.4, '1:5')).toBe(1.4)
  })

  it.each([
    ['2:1', '1:3'],
    ['2:3', '1:2'],
    ['2:5', '1:4'],
    ['1:3v2', '1:3'],
    ['2:3v5', '1:4'],
  ] as const)('loads %s one Scale level below the corresponding 1:x ratio', (actual, expected) => {
    expect(getAdjustedVtgScale(0.8, actual)).toBe(getAdjustedVtgScale(0.8, expected))
  })

  it('keeps every removable transition-subdivision continuation frame empty', () => {
    const ruleNumbers = [1, 2, 3, 4, 5, 6] as const satisfies readonly VtgRuleNumber[]
    const booleanOptions = [false, true] as const
    const spinToggleCells: ReadonlySet<VtgCellReference> = new Set(['5-6', '6-6', '5-5', '6-5'])

    for (const column of ruleNumbers) {
      for (const row of ruleNumbers) {
        const reference = `${row}-${column}` as VtgCellReference
        const antiOptions = spinToggleCells.has(reference) ? booleanOptions : ([false] as const)
        for (const speedRatio of vtgSpeedRatios) {
          for (const isAnti of antiOptions) {
            for (const beat of getVtgBeats(speedRatio)) {
              for (const swapProps of booleanOptions) {
                for (const reversePlane of booleanOptions) {
                  const animation = createDefaultVtgAnimation({
                    reference,
                    speedRatio,
                    isAnti,
                    beat,
                    swapProps,
                    reversePlane,
                    transition: true,
                  })
                  if (!animation) continue

                  for (const prop of animation.props) {
                    expect(prop.anim[4]).toEqual({})
                    expect(prop.anim[6]).toEqual({})
                  }
                }
              }
            }
          }
        }
      }
    }
  }, 15_000)

  it.each(getVtgBeats('1:3'))('uses Shift to start the closed cycle on beat %s', (beat) => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      swapProps: true,
      reversePlane: true,
    } as const satisfies VtgPatternSelection
    const originalAnimation = createVtgAnimationForSelection(createCurrentAnimation(), selection)
    const shiftedAnimation = createVtgAnimationForSelection(createCurrentAnimation(), {
      ...selection,
      beat,
    })
    if (!originalAnimation || !shiftedAnimation) throw new Error('Expected both VTG animations')

    const original = rootCompile(originalAnimation)
    const shifted = rootCompile(shiftedAnimation)

    expect(shifted.props).toHaveLength(original.props.length)

    for (const [propIndex, shiftedProp] of shifted.props.entries()) {
      const originalFrames = original.props[propIndex]!.anim
      const cycleLength = originalFrames.length - 1

      for (const [frameIndex, shiftedFrame] of shiftedProp.anim.entries()) {
        const originalIndex = ((beat - 1) * 2 + (frameIndex % cycleLength)) % cycleLength
        const expectedFrame = originalFrames[originalIndex]!

        expectVectorClose(shiftedFrame.pos, expectedFrame.pos)
        expectVectorClose(shiftedFrame.rot, expectedFrame.rot)
      }
    }
  })

  it('preserves every offset prop path while changing the starting Beat', () => {
    const pathKey = (animation: RootDataFinal) =>
      rootCompile(animation).props.map((prop) =>
        prop.anim
          .slice(1)
          .flatMap((target, targetOffset) => {
            const start = prop.anim[targetOffset]!
            return [0.25, 0.5, 0.75, 1].map((progress) => {
              const primaryStart = new Quaternion().fromArray(
                target.rebasePrimaryOrientation ? start.orient : start.primaryOrient,
              )
              const secondaryStart = target.rebasePrimaryOrientation
                ? new Quaternion()
                : new Quaternion().fromArray(start.secondaryOrient)
              const primary = new Quaternion()
                .setFromAxisAngle(
                  new Vector3().fromArray(target.rotx),
                  MathUtils.degToRad(target.turns + (target.type === TTYPE.LINE ? 0 : target.arc)) *
                    progress,
                )
                .multiply(primaryStart)
              const secondary = new Quaternion()
                .setFromAxisAngle(
                  new Vector3().fromArray(target.yawx),
                  MathUtils.degToRad(target.rotate) * progress,
                )
                .multiply(secondaryStart)
              const orientation = InitialPoint.clone().applyQuaternion(secondary.multiply(primary))
              const center = new Vector3()
                .fromArray(start.pos)
                .applyAxisAngle(
                  new Vector3().fromArray(target.posx),
                  MathUtils.degToRad(target.arc) * progress,
                )
              return [
                ...center.toArray(),
                ...orientation.toArray(),
                ...center.add(orientation).toArray(),
              ]
                .map((coordinate) => Math.round(coordinate * 1e9) / 1e9)
                .join(',')
            })
          })
          .sort(),
      )

    for (const row of [1, 2, 3, 4, 5, 6] as const) {
      for (const column of [1, 2, 3, 4, 5, 6] as const) {
        const reference = `${row}-${column}` as VtgCellReference
        const selection = {
          reference,
          speedRatio: '1:3',
          propRotationOffsets: [90, 0],
        } as const satisfies VtgPatternSelection
        const original = createDefaultVtgAnimation(selection)
        if (!original) throw new Error(`Expected VTG animation for ${reference}`)
        const expected = pathKey(original)

        for (const beat of getVtgBeats(selection.speedRatio)) {
          const shifted = createDefaultVtgAnimation({ ...selection, beat })
          if (!shifted) throw new Error(`Expected VTG animation for ${reference}/${beat}`)
          expect(pathKey(shifted), `${reference}/${beat}`).toEqual(expected)
        }
      }
    }
  })

  it('applies the transition directly to the doubled base playback', () => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      bpm: 87,
    } as const satisfies VtgPatternSelection
    const original = createVtgAnimationForSelection(createCurrentAnimation(), selection)
    const transitioned = createVtgAnimationForSelection(createCurrentAnimation(), {
      ...selection,
      transition: true,
    })
    if (!original || !transitioned) throw new Error('Expected normal and transitioned animations')

    const originalCompiled = rootCompile(original)
    const transitionedCompiled = rootCompile(transitioned)

    expect(transitioned.bpm).toBe(original.bpm)
    expect(transitioned.props[0]!.anim[2]).toEqual({})
    for (const frame of transitioned.props[0]!.anim.slice(1)) {
      expect(frame).not.toHaveProperty('beats')
      expect(frame).not.toHaveProperty('scale')
      expect(frame).not.toHaveProperty('depth')
      expect(frame).not.toHaveProperty('type')
      expect(frame).not.toHaveProperty('adjust')
    }
    for (const [propIndex, originalProp] of originalCompiled.props.entries()) {
      const transitionedFrames = transitionedCompiled.props[propIndex]!.anim
      for (const [frameIndex, originalFrame] of originalProp.anim.slice(0, -1).entries()) {
        const transitionedFrame = transitionedFrames[frameIndex]!
        expectVectorClose(transitionedFrame.pos, originalFrame.pos)
        expectVectorClose(transitionedFrame.rot, originalFrame.rot)
        expect(transitionedFrame.scale).toBe(originalFrame.scale)
        expect(transitionedFrame.depth).toBe(originalFrame.depth)
      }
    }
  })

  it.each(['1:1', '1:2'] as const)(
    'enables the reciprocal transition at %s in every build',
    (speedRatio) => {
      const selection = {
        reference: '5-1',
        speedRatio,
      } as const satisfies VtgPatternSelection
      const original = createVtgAnimationForSelection(createCurrentAnimation(), selection)
      const transitioned = createVtgAnimationForSelection(createCurrentAnimation(), {
        ...selection,
        transition: true,
      })

      expect(transitioned?.bpm).toBe(original?.bpm)
    },
  )

  it('applies Thick to main player data without changing preview thickness', () => {
    const selection = {
      reference: '1-6',
      speedRatio: '1:3',
      thick: 12,
    } as const
    const animation = createVtgAnimation(createCurrentAnimation(), selection)
    const preview = createVtgPreviewAnimation(selection)

    expect(animation?.thick).toBe(12)
    expect(preview?.thick).toBe(15)
  })

  it('applies the Hands control to thumbnails while retaining lightweight preview rendering', () => {
    const selection = {
      reference: '1-6',
      speedRatio: '1:3',
      paths: false,
      hands: true,
      arms: true,
    } as const
    const animation = createVtgAnimation(createCurrentAnimation(), selection)
    const preview = createVtgPreviewAnimation(selection)
    if (!animation || !preview) throw new Error('Expected player and preview animations')

    expect(animation).toMatchObject({ paths: false, hands: true, arms: true })
    expect(
      rootCompile(animation).props.every(
        (prop) => !prop.paths && prop.hands === true && prop.arms === true,
      ),
    ).toBe(true)
    expect(preview).toMatchObject({ paths: true, hands: true, arms: false })
    expect(
      preview.props.every(
        (prop) => prop.paths === true && prop.hands === true && prop.arms === false,
      ),
    ).toBe(true)
  })

  it('applies prop visibility overrides only to unchecked sides', () => {
    const visible = createVtgAnimationForSelection(createCurrentAnimation(), {
      reference: '1-6',
      speedRatio: '1:3',
    })
    const leftHidden = createVtgAnimationForSelection(createCurrentAnimation(), {
      reference: '1-6',
      speedRatio: '1:3',
      left: false,
    })
    if (!visible || !leftHidden) throw new Error('Expected VTG animations')

    for (const key of ['paths', 'hands', 'arms', 'visible'] as const) {
      expect(visible.props[0]).not.toHaveProperty(key)
      expect(visible.props[1]).not.toHaveProperty(key)
      expect(leftHidden.props[0]?.[key]).toBe(false)
      expect(leftHidden.props[1]).not.toHaveProperty(key)
    }
  })

  it('builds the first SO/TS cell from the edited readable template', () => {
    const current = createCurrentAnimation()
    const animation = createVtgAnimation(current, {
      reference: '1-6',
      speedRatio: '1:1',
    })

    expect(animation).toMatchObject({
      bpm: vtgPlayerSettings.bpm * doublePlaybackMultiplier,
      aspectx: vtgPlayerSettings.aspectx,
      aspecty: vtgPlayerSettings.aspecty,
      speed: vtgPlayerSettings.speed,
      props: [
        {
          color: 4,
          anim: [{ plane: 180, arc: 90 }, { plane: 180, arc: 45 }, {}, {}, {}, {}, {}, {}, {}],
        },
        {
          color: 1,
          anim: [{ plane: 180, arc: 90 }, { arc: 45, turns: -90 }, {}, {}, {}, {}, {}, {}, {}],
        },
      ],
    })
    expect(animation?.smooth).toBe(true)
  })

  it('preserves the active playback speed when BPM rebuilds the pattern', () => {
    const current = createCurrentAnimation()
    current.speed = 2

    const animation = createVtgAnimation(current, {
      reference: '1-6',
      speedRatio: '1:3',
      bpm: 90,
    })

    expect(animation).toMatchObject({ bpm: 180, speed: 2 })
  })

  it('returns fresh data without mutating the player state', () => {
    const current = createCurrentAnimation()
    const currentSnapshot = structuredClone(current)

    const first = createVtgAnimation(current, {
      reference: '1-6',
      speedRatio: '1:1',
    })
    const second = createVtgAnimation(current, {
      reference: '1-6',
      speedRatio: '1:1',
    })

    expect(first).not.toBe(second)
    expect(current).toEqual(currentSnapshot)
    expect(first?.props[0]?.anim).not.toBe(second?.props[0]?.anim)
    expect(first?.props.every((prop) => prop.anim.length === 9)).toBe(true)
    expect(first?.props[0]?.anim[2]).not.toBe(first?.props[0]?.anim[3])
  })

  it('stores the complete doubled cycle in the row definition', () => {
    const selection = {
      reference: '1-6',
      speedRatio: '1:1',
    } as const

    expect(buildVtgPattern(selection)?.props[0]?.anim).toHaveLength(9)
    expect(createVtgAnimation(createCurrentAnimation(), selection)?.props[0]?.anim).toHaveLength(9)
  })

  it.each([
    ['1:3', 9, 4],
    ['1:2v3', 9, 4],
    ['2:1', 17, 8],
    ['2:3', 17, 8],
    ['2:5', 17, 8],
  ] as const)('generates the complete %s cycle', (speedRatio, frameCount, beatCount) => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio })
    if (!animation) throw new Error(`Expected the ${speedRatio} pattern to be defined`)

    expect(animation.props.every((prop) => prop.anim.length === frameCount)).toBe(true)
    expect((frameCount - 1) / doublePlaybackMultiplier).toBe(beatCount)
  })

  it('uses player VTG settings with preview-only visibility and thickness overrides', () => {
    const preview = createVtgPreviewAnimation({
      reference: '1-6',
      speedRatio: '1:1',
    })
    if (preview === undefined) throw new Error('Expected the VTG preview pattern to be defined')

    expect(preview).toMatchObject({
      bpm: vtgPlayerSettings.bpm * doublePlaybackMultiplier,
      paths: vtgPlayerSettings.paths,
      hands: vtgPlayerSettings.hands,
      arms: false,
      visible: false,
      thick: 15,
    })
    expect(preview.camera[0]!.orbit?.distance).toBe(19)
    expect(preview.props.every((prop) => prop.anim.length === 9)).toBe(true)
    expect(
      preview.props.every(
        (prop) =>
          prop.paths === vtgPlayerSettings.paths &&
          prop.hands === false &&
          prop.arms === false &&
          prop.visible === false &&
          prop.thick === 15,
      ),
    ).toBe(true)
    expect(
      rootCompile(preview).props.every(
        (prop) =>
          prop.hands === false &&
          prop.arms === false &&
          prop.visible === false &&
          prop.thick === 15 &&
          prop.anim.length === 9,
      ),
    ).toBe(true)
  })

  it('adds the 1:1 adjustment to VTG base frames and inherits it through compilation', () => {
    const animation = createVtgAnimation(createCurrentAnimation(), {
      reference: '1-6',
      speedRatio: '1:1',
    })
    if (animation === undefined) throw new Error('Expected the VTG pattern to be defined')

    expect(animation.props.map((prop) => prop.anim.map((frame) => frame.scale))).toEqual([
      [90, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined],
      [90, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined],
    ])
    expect(
      rootCompile(animation).props.every((prop) => prop.anim.every((frame) => frame.scale === 90)),
    ).toBe(true)
  })

  it('builds SS/TO from its replacement query values', () => {
    const animation = createVtgAnimation(createCurrentAnimation(), {
      reference: '2-6',
      speedRatio: '1:1',
    })

    expect(animation?.props[0]?.anim.slice(0, 2)).toEqual([
      { plane: 180, arc: 90, scale: 90 },
      { plane: 180, arc: 45 },
    ])
    expect(animation?.props[1]?.anim.slice(0, 2)).toEqual([
      { arc: 90, scale: 90 },
      { arc: 45, turns: -90 },
    ])
  })

  it('builds the fourth row 1 cell from its replacement query values', () => {
    const animation = createVtgAnimation(createCurrentAnimation(), {
      reference: '4-6',
      speedRatio: '1:1',
    })

    expect(animation?.props[0]?.anim.slice(0, 2)).toEqual([
      { plane: 180, arc: 90, turns: -180, scale: 90 },
      { plane: 180, arc: 45, turns: 0 },
    ])
    expect(animation?.props[1]?.anim.slice(0, 2)).toEqual([
      { arc: 90, turns: 180, scale: 90 },
      { arc: 45, turns: -90 },
    ])
  })

  it('swaps column 6 animation properties without changing root prop colors', () => {
    const animation = createVtgAnimation(createCurrentAnimation(), {
      reference: '6-6',
      speedRatio: '1:1',
      isAnti: false,
    })

    expect(animation?.props.map((prop) => prop.color)).toEqual([4, 1])
    expect(animation?.props[0]?.anim.slice(0, 2)).toEqual([{ arc: 90, scale: 90 }, { arc: 45 }])
    expect(animation?.props[1]?.anim.slice(0, 2)).toEqual([
      { plane: 180, arc: 90, turns: 180, scale: 90 },
      { plane: 180, arc: 45, turns: 0 },
    ])
  })

  it('swaps selected animation tracks without changing root prop colors', () => {
    const current = createCurrentAnimation()
    const original = createVtgAnimation(current, {
      reference: '1-6',
      speedRatio: '1:1',
    })
    const swapped = createVtgAnimation(current, {
      reference: '1-6',
      speedRatio: '1:1',
      swapProps: true,
    })

    expect(swapped?.props.map((prop) => prop.color)).toEqual([4, 1])
    expect(swapped?.props[0]?.anim).toEqual(original?.props[1]?.anim)
    expect(swapped?.props[1]?.anim).toEqual(original?.props[0]?.anim)
  })

  it('leaves final Swap and 180 transforms out of the VTG pattern catalog', () => {
    const original = buildVtgPattern({
      reference: '2-6',
      speedRatio: '1:1',
    })
    const reversed = buildVtgPattern({
      reference: '2-6',
      speedRatio: '1:1',
      reversePlane: true,
    })

    expect(original?.props.map((prop) => prop.anim[0]?.plane)).toEqual([180, undefined])
    expect(reversed).toEqual(original)

    const baseAnimation = createDefaultVtgAnimation({
      reference: '5-2',
      speedRatio: '1:1',
    })
    const reversedAnimation = createDefaultVtgAnimation({
      reference: '5-2',
      speedRatio: '1:1',
      reversePlane: true,
    })
    expect(reversedAnimation?.props.map((prop) => prop.anim[0]?.plane)).toEqual(
      baseAnimation?.props.map((prop) => reverseAngle(prop.anim[0]?.plane ?? 0)),
    )
  })

  it('caps BPM and Scale while mapping Scale to Distance', () => {
    expect(vtgPlayerSettings.distance).toBe(18)

    const minimum = buildVtgPattern({
      reference: '1-6',
      speedRatio: '1:1',
      bpm: 20,
      scale: 0.2,
    })
    const maximum = buildVtgPattern({
      reference: '1-6',
      speedRatio: '1:1',
      bpm: 200,
      scale: 2,
    })
    const pivot = buildVtgPattern({
      reference: '1-6',
      speedRatio: '1:1',
      scale: 0.5,
    })

    expect(minimum).toMatchObject({ bpm: 40, distance: 14 })
    expect(minimum?.props.map((prop) => prop.anim[0]?.scale)).toEqual([50, 50])
    expect(pivot).toMatchObject({ distance: 15 })
    expect(maximum).toMatchObject({ bpm: 280, distance: 25 })
    expect(maximum?.props.map((prop) => prop.anim[0]?.scale)).toEqual([140, 140])
  })

  it('builds a restored 1:5 pattern', () => {
    const animation = createVtgAnimation(createCurrentAnimation(), {
      reference: '5-2',
      speedRatio: '1:5',
    })

    expect(animation?.props[0]?.anim.slice(0, 2)).toEqual([
      { arc: 90, scale: 100 },
      { arc: 45, turns: 180 },
    ])
    expect(animation?.props[1]?.anim.slice(0, 2)).toEqual([
      { arc: 90, turns: 180, scale: 100 },
      { plane: 180, arc: 45, turns: -270 },
    ])
  })

  it('uses the explicit 1:3 Anti values for a special cell', () => {
    const animation = createVtgAnimation(createCurrentAnimation(), {
      reference: '5-5',
      speedRatio: '1:3',
      isAnti: true,
    })

    expect(animation?.props[0]?.anim.slice(0, 2)).toEqual([
      { arc: 90, scale: 80 },
      { plane: 180, arc: 45, turns: -180 },
    ])
    expect(animation?.props[1]?.anim.slice(0, 2)).toEqual([
      { arc: 90, turns: 180, scale: 80 },
      { plane: 180, arc: 45, turns: -180 },
    ])
  })
})
