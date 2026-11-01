import { MathUtils, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { applyPatternFinalTransforms } from '@/features/concepts/applyPatternFinalTransforms'
import { applyVtgSwap } from '@/features/vtg/applyVtgSwap'
import { createQtrAnimation as createQtrAnimationForSelection } from '@/features/vtg/qtr/createQtrAnimation'
import type { QtrPatternSelection, VtgCellReference } from '@/features/vtg/types'
import { getVtgBeats } from '@/features/vtg/types'
import { createVtgAnimation as createVtgAnimationForSelection } from '@/features/vtg/createVtgAnimation'
import { shiftVtgStartingBeat } from '@/features/vtg/math/shiftVtgStartingBeat'
import type { VtgPatternSelection } from '@/features/vtg/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import { rootFinal } from '@/math/animation/PlayerFunc'
import type { RootData, RootDataFinal } from '@/types/AnimTypes'
import { TTYPE } from '@/domain/animation/AnimStruct'
import { InitialPoint } from '@/math/animation/OrthogonalFunc'

const createVtgAnimation = (current: RootDataFinal, selection: VtgPatternSelection) =>
  createVtgAnimationForSelection(current, selection)

const createQtrAnimation = (current: RootDataFinal, selection: QtrPatternSelection) =>
  createQtrAnimationForSelection(current, selection)

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

describe('createQtrAnimation', () => {
  it('preserves every offset QTR prop path while changing the starting Beat', () => {
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
          quarters: 1,
          reversePlane: true,
          propRotationOffsets: [90, 0],
        } as const satisfies QtrPatternSelection
        const original = createQtrAnimation(createCurrentAnimation(), selection)
        if (!original) throw new Error(`Expected QTR animation for ${reference}`)
        const expected = pathKey(original)

        for (const beat of getVtgBeats(selection.speedRatio)) {
          const shifted = createQtrAnimation(createCurrentAnimation(), { ...selection, beat })
          if (!shifted) throw new Error(`Expected QTR animation for ${reference}/${beat}`)
          expect(pathKey(shifted), `${reference}/${beat}`).toEqual(expected)
        }
      }
    }
  })

  it('adds 90 degrees to only the first prop first-frame arc for Qtr #1', () => {
    const selection = { reference: '1-6', speedRatio: '1:1' } as const
    const standard = createVtgAnimation(createCurrentAnimation(), selection)
    const quarter = createQtrAnimation(createCurrentAnimation(), { ...selection, quarters: 1 })

    expect(quarter?.props[0]?.anim[0]?.arc).toBe((standard?.props[0]?.anim[0]?.arc ?? 0) + 90)
    expect(quarter?.props[0]?.anim.slice(1)).toEqual(standard?.props[0]?.anim.slice(1))
    expect(quarter?.props[1]?.anim).toEqual(standard?.props[1]?.anim)
  })

  it('keeps the Qtr adjustment on its original track when Swap is enabled', () => {
    const selection = {
      reference: '2-1',
      speedRatio: '1:3',
      quarters: 1,
    } as const
    const quarter = createQtrAnimation(createCurrentAnimation(), selection)
    const swapped = createQtrAnimation(createCurrentAnimation(), { ...selection, swapProps: true })

    expect(swapped?.props[0]?.anim).toEqual(quarter?.props[1]?.anim)
    expect(swapped?.props[1]?.anim).toEqual(quarter?.props[0]?.anim)
  })

  it('keeps legacy Qtr #2 explicit while applying Swap and 180 as final transforms', () => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      quarters: 1,
      beat: 3,
    } as const satisfies QtrPatternSelection
    const base = createQtrAnimation(createCurrentAnimation(), selection)
    const transformed = createQtrAnimation(createCurrentAnimation(), {
      ...selection,
      swapProps: true,
      reversePlane: true,
    })
    if (!base) throw new Error('Expected a completed Qtr animation')

    expect(transformed).toEqual(
      applyVtgSwap(applyPatternFinalTransforms(base, { reversePlane: true }), true),
    )
  })

  it('keeps QTR on its base orientation and only reverses the completed motion planes', () => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      quarters: 1,
    } as const satisfies QtrPatternSelection
    const base = createQtrAnimation(createCurrentAnimation(), selection)
    const reversed = createQtrAnimation(createCurrentAnimation(), {
      ...selection,
      reversePlane: true,
    })
    if (!base) throw new Error('Expected a completed Qtr animation')

    expect(reversed).toEqual(applyPatternFinalTransforms(base, { reversePlane: true }))
  })

  it.each(['1-1', '2-2', '5-5', '6-6'] as const)(
    'rotates every compiled Qtr #1 path by 90 degrees for Qtr #2 at %s',
    (reference) => {
      const selection = { reference, speedRatio: '1:3' } as const
      const firstQuarter = createQtrAnimation(createCurrentAnimation(), {
        ...selection,
        quarters: 1,
      })
      const secondQuarter = createQtrAnimation(createCurrentAnimation(), {
        ...selection,
        quarters: 2,
      })
      if (!firstQuarter || !secondQuarter) throw new Error('Expected both quarter modes')

      const firstCompiled = rootCompile(firstQuarter)
      const secondCompiled = rootCompile(secondQuarter)
      const frontAxis = new Vector3(0, 0, 1)

      for (const [propIndex, secondProp] of secondCompiled.props.entries()) {
        const firstProp = firstCompiled.props[propIndex]!
        for (const [frameIndex, secondFrame] of secondProp.anim.entries()) {
          const firstFrame = firstProp.anim[frameIndex]!
          for (const key of ['pos', 'rot', 'posx', 'rotx'] as const) {
            const expected = new Vector3()
              .fromArray(firstFrame[key])
              .applyAxisAngle(frontAxis, Math.PI / 2)
            secondFrame[key].forEach((coordinate, axis) =>
              expect(coordinate).toBeCloseTo(expected.getComponent(axis), 9),
            )
          }
        }
      }
    },
  )

  it('keeps paired Qtr #2 starting positions distinct', () => {
    const create = (reference: '1-1' | '2-2') =>
      createQtrAnimation(createCurrentAnimation(), {
        reference,
        speedRatio: '1:3',
        quarters: 2,
      })

    expect(create('1-1')?.props.map((prop) => prop.anim[0]?.arc)).toEqual([90, 0])
    expect(create('2-2')?.props.map((prop) => prop.anim[0]?.arc)).toEqual([90, 180])
  })

  it.each([1, 2, 3, 4] as const)('shifts the completed Qtr pattern to starting beat %s', (beat) => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      quarters: 1,
      swapProps: true,
      reversePlane: true,
    } as const satisfies QtrPatternSelection
    const completed = createQtrAnimation(createCurrentAnimation(), {
      ...selection,
      swapProps: false,
      reversePlane: false,
    })
    const shifted = createQtrAnimation(createCurrentAnimation(), { ...selection, beat })
    if (!completed) throw new Error('Expected a completed Qtr animation')

    const semanticShift = shiftVtgStartingBeat(completed, beat)
    expect(shifted).toEqual(
      semanticShift
        ? applyVtgSwap(applyPatternFinalTransforms(semanticShift, { reversePlane: true }), true)
        : undefined,
    )
  })

  it.each(['1:1', '1:2'] as const)(
    'enables the reciprocal transition at %s during development',
    (speedRatio) => {
      const selection = {
        reference: '5-1',
        speedRatio,
        quarters: 1,
      } as const satisfies QtrPatternSelection

      const original = createQtrAnimation(createCurrentAnimation(), selection)
      const transitioned = createQtrAnimation(createCurrentAnimation(), {
        ...selection,
        transition: true,
      })

      expect(transitioned?.bpm).toBe(original?.bpm)
    },
  )
})
