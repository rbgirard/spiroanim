import { describe, expect, it } from 'vitest'

import { appendVtgBuilderPattern } from '@/features/builder/appendVtgBuilderPattern'
import {
  applyVtgBuilderPortionProperties,
  getVtgBuilderPortionRanges,
} from '@/features/builder/editVtgBuilderPortionProperties'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createVtgTransitionPreviewAnimations } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { prepareVtg45TransitionPattern } from '@/features/vtg/math/prepareVtg45TransitionPattern'
import { applyVtgThirdOrderSettings } from '@/features/vtg/thirdOrder'
import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { useBaseQS } from '@/services/query/createBaseQS'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'
import { rootCompile } from '@/math/animation/AnimFunc'
import type { RootDataFinal } from '@/types/AnimTypes'

const selection = { reference: '1-1', speedRatio: '1:3' } as const

const createThreePortions = (): RootDataFinal => {
  const first = createDefaultVtgAnimation(selection)
  const second = first && appendVtgBuilderPattern(first, { ...selection, reference: '1-2' })
  const third = second && appendVtgBuilderPattern(second, { ...selection, reference: '1-3' })
  if (!third) throw new Error('Expected three Builder portions')
  return third
}

const cloneAnimation = (animation: RootDataFinal): RootDataFinal => ({
  ...animation,
  props: animation.props.map((prop) => ({
    ...prop,
    anim: prop.anim.map((frame) => ({ ...frame })),
  })),
})

describe('editVtgBuilderPortionProperties', () => {
  it('identifies context and owned frames for first and later portions', () => {
    const animation = createThreePortions()
    const ranges = getVtgBuilderPortionRanges(animation)

    expect(ranges).toHaveLength(3)
    expect(ranges[0]?.firstOwnedFrameIndex).toBe(ranges[0]?.startFrameIndex)
    expect(ranges[1]?.firstOwnedFrameIndex).toBe((ranges[1]?.startFrameIndex ?? 0) + 1)
    expect(ranges[1]?.endFrameIndex).toBe(ranges[2]?.startFrameIndex)
    expect(ranges[1]?.successorFirstOwnedFrameIndex).toBe((ranges[2]?.startFrameIndex ?? 0) + 1)
  })

  it('discards a later portion context frame while retaining its editable final frame', () => {
    const animation = createThreePortions()
    const preview = createVtgTransitionPreviewAnimations(animation)?.[1]
    const range = getVtgBuilderPortionRanges(animation)[1]
    if (!preview || !range) throw new Error('Expected the middle Builder portion')

    const working = cloneAnimation(preview)
    working.props[0]!.anim[0]!.twist = 270
    working.props[0]!.anim[0]!.yaw = -90
    working.props[0]!.anim.at(-1)!.twist = 90
    working.props[0]!.anim.at(-1)!.yaw = -90

    const updated = applyVtgBuilderPortionProperties(animation, 1, working, ['twist', 'yaw'])
    expect(updated).toBeDefined()
    expect(updated?.props[0]?.anim[range.startFrameIndex]?.twist).toBe(
      animation.props[0]?.anim[range.startFrameIndex]?.twist,
    )
    expect(updated?.props[0]?.anim[range.startFrameIndex]?.yaw).toBe(
      animation.props[0]?.anim[range.startFrameIndex]?.yaw,
    )
    expect(updated?.props[0]?.anim[range.endFrameIndex]).toMatchObject({ twist: 90, yaw: -90 })
  })

  it('materializes the accumulated Twist gauge on a later portion context frame', () => {
    const animation = createThreePortions()
    animation.props[0]!.anim[1]!.twist = 45
    const range = getVtgBuilderPortionRanges(animation)[1]
    const preview = createVtgTransitionPreviewAnimations(animation)?.[1]
    if (!range || !preview) throw new Error('Expected the middle Builder portion')

    expect(rootCompile(preview).props[0]?.anim[0]?.twistRoll).toBe(
      rootCompile(animation).props[0]?.anim[range.startFrameIndex]?.twistRoll,
    )
  })

  it('adds only the successor guards required to preserve inherited Twist and Yaw', () => {
    const animation = createThreePortions()
    const preview = createVtgTransitionPreviewAnimations(animation)?.[1]
    const range = getVtgBuilderPortionRanges(animation)[1]
    if (!preview || !range?.successorFirstOwnedFrameIndex) {
      throw new Error('Expected a middle portion with a successor')
    }

    const working = cloneAnimation(preview)
    working.props[0]!.anim.at(-1)!.twist = 90
    working.props[0]!.anim.at(-1)!.yaw = -90
    const updated = applyVtgBuilderPortionProperties(animation, 1, working, ['twist', 'yaw'])
    if (!updated) throw new Error('Expected the property update')

    const successor = range.successorFirstOwnedFrameIndex
    expect(updated.props[0]?.anim[successor]).toMatchObject({ twist: 0, yaw: 90 })
    const compiledUpdated = rootCompile(updated)
    const compiledSource = rootCompile(animation)
    expect(compiledUpdated.props[0]?.anim[successor]).toMatchObject({ twist: 0, yaw: 90 })
    expect(compiledSource.props[0]?.anim[successor]).toMatchObject({ twist: 0, yaw: 90 })
    const carriedRollGauge =
      compiledUpdated.props[0]!.anim[range.endFrameIndex]!.twistRoll -
      compiledSource.props[0]!.anim[range.endFrameIndex]!.twistRoll
    for (
      let frameIndex = successor;
      frameIndex < compiledSource.props[0]!.anim.length;
      frameIndex += 1
    ) {
      expect(
        compiledUpdated.props[0]!.anim[frameIndex]!.twistRoll -
          compiledSource.props[0]!.anim[frameIndex]!.twistRoll,
      ).toBe(carriedRollGauge)
    }
  })

  it('removes successor guards after inheritance makes them redundant again', () => {
    const animation = createThreePortions()
    const preview = createVtgTransitionPreviewAnimations(animation)?.[1]
    const range = getVtgBuilderPortionRanges(animation)[1]
    if (!preview || !range?.successorFirstOwnedFrameIndex) {
      throw new Error('Expected a middle portion with a successor')
    }

    const twisted = cloneAnimation(preview)
    twisted.props[0]!.anim.at(-1)!.twist = 90
    const guarded = applyVtgBuilderPortionProperties(animation, 1, twisted, ['twist'])
    const guardedPreview = guarded && createVtgTransitionPreviewAnimations(guarded)?.[1]
    if (!guarded || !guardedPreview) throw new Error('Expected a guarded property update')

    const cleared = cloneAnimation(guardedPreview)
    for (const frame of cleared.props[0]!.anim.slice(1)) delete frame.twist
    const restored = applyVtgBuilderPortionProperties(guarded, 1, cleared, ['twist'])

    expect(restored?.props[0]?.anim[range.successorFirstOwnedFrameIndex]?.twist).toBeUndefined()
    expect(rootCompile(restored!).props[0]?.anim[range.successorFirstOwnedFrameIndex]?.twist).toBe(
      0,
    )
  })

  it('sets Scale at the portion start and minimally restores its successor inheritance', () => {
    const animation = createThreePortions()
    animation.props[0]!.anim[0] = { ...animation.props[0]!.anim[0], scale: 8 }
    const preview = createVtgTransitionPreviewAnimations(animation)?.[1]
    const range = getVtgBuilderPortionRanges(animation)[1]
    if (!preview || !range?.successorFirstOwnedFrameIndex) {
      throw new Error('Expected a middle portion with a successor')
    }

    const scaled = cloneAnimation(preview)
    scaled.props[0]!.anim[1] = { ...scaled.props[0]!.anim[1], scale: 14 }
    const updated = applyVtgBuilderPortionProperties(animation, 1, scaled, ['scale'])
    if (!updated) throw new Error('Expected a Scale update')

    expect(updated.props[0]?.anim[range.firstOwnedFrameIndex]?.scale).toBe(14)
    expect(updated.props[0]?.anim[range.successorFirstOwnedFrameIndex]?.scale).toBe(8)
    expect(rootCompile(updated).props[0]?.anim[range.successorFirstOwnedFrameIndex]?.scale).toBe(8)

    const updatedPreview = createVtgTransitionPreviewAnimations(updated)?.[1]
    if (!updatedPreview) throw new Error('Expected the updated middle portion')
    const cleared = cloneAnimation(updatedPreview)
    delete cleared.props[0]!.anim[1]!.scale
    const restored = applyVtgBuilderPortionProperties(updated, 1, cleared, ['scale'])

    expect(restored?.props[0]?.anim[range.firstOwnedFrameIndex]?.scale).toBeUndefined()
    expect(restored?.props[0]?.anim[range.successorFirstOwnedFrameIndex]?.scale).toBeUndefined()
    expect(rootCompile(restored!).props[0]?.anim[range.successorFirstOwnedFrameIndex]?.scale).toBe(
      8,
    )
  })

  it('preserves inherited Warp and Strength after editing one Builder portion', () => {
    const animation = createThreePortions()
    animation.props[0]!.anim[0] = {
      ...animation.props[0]!.anim[0],
      warp: 90,
      strength: 500,
    }
    const preview = createVtgTransitionPreviewAnimations(animation)?.[1]
    const range = getVtgBuilderPortionRanges(animation)[1]
    if (!preview || !range?.successorFirstOwnedFrameIndex) {
      throw new Error('Expected a middle portion with a successor')
    }

    const working = applyVtgThirdOrderSettings(preview, [{ strength: 25, timing: '1:2-pro' }, {}], {
      firstEditableFrameIndex: 1,
    })
    const updated = applyVtgBuilderPortionProperties(animation, 1, working, ['warp', 'strength'])
    if (!updated) throw new Error('Expected a Third Order update')

    const successor = range.successorFirstOwnedFrameIndex
    expect(updated.props[0]?.anim[range.firstOwnedFrameIndex]?.strength).toBe(250)
    expect(updated.props[0]?.anim[successor]).toMatchObject({ warp: 90, strength: 500 })
    expect(rootCompile(updated).props[0]?.anim[successor]).toMatchObject({
      warp: 90,
      strength: 500,
    })

    const updatedPreview = createVtgTransitionPreviewAnimations(updated)?.[1]
    if (!updatedPreview) throw new Error('Expected the updated middle portion')
    const cleared = applyVtgThirdOrderSettings(updatedPreview, [{}, {}], {
      firstEditableFrameIndex: 1,
    })
    const restored = applyVtgBuilderPortionProperties(updated, 1, cleared, ['warp', 'strength'])

    expect(restored?.props[0]?.anim[range.firstOwnedFrameIndex]?.strength).toBeUndefined()
    expect(restored?.props[0]?.anim[successor]?.warp).toBeUndefined()
    expect(restored?.props[0]?.anim[successor]?.strength).toBeUndefined()
    expect(rootCompile(restored!).props[0]?.anim[successor]).toMatchObject({
      warp: 90,
      strength: 500,
    })
  })

  it('reconstructs the supplied supported Builder pattern after editing Rotate', async () => {
    const query =
      'r=Ew68Yk11Y&p0=Q__.blE.5JEQpg........5GQQpg.......&x0=_r_&r0=............_ZML_&m0=_1_mxqv__&p1=N__.bn_.5L_Qpg........5GQQpg.......&x1=_r_&r1=............_Z3L_&c=_g_bhq&v=11'
    const version = await loadSpiroAnimQSVersion(11)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      11,
    )
    const animation = codec.decodeQS(Object.fromEntries(new URLSearchParams(query)))
    const prepared = prepareVtg45TransitionPattern(animation)
    const previews = createVtgTransitionPreviewAnimations(prepared.pattern)
    expect(prepared.supported).toBe(true)
    expect(previews).toHaveLength(2)
    expect(previews?.[1]?.props[0]?.anim[4]?.rotate).toBe(90)
    expect(previews?.[1]?.props[1]?.anim[4]?.rotate).toBe(-90)
  })
})
