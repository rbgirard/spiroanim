import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePatternPropertyControls } from '@/features/concepts/composables/usePatternPropertyControls'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createVtgThirdOrderWarp } from '@/features/vtg/thirdOrder'
import { resolveAnimationFrames } from '@/math/animation/frameSemantics'
import type { RootDataFinal } from '@/types/AnimTypes'

describe('usePatternPropertyControls', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shares advanced modes and fold scheduling while emitting complete animations', () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:1' })
    const animation = shallowRef<RootDataFinal | undefined>(source)
    const updates: RootDataFinal[] = []
    const controls = usePatternPropertyControls({
      animation,
      onAnimationUpdate: (updated) => updates.push(updated),
    })

    controls.updateTwistMode('advanced')
    expect(controls.vtgTwistMode.value).toBe('advanced')

    controls.updateFoldMirror(false)
    controls.updateFoldSetting(0, 2, 'rotate', 4)

    expect(controls.vtgFoldMirror.value).toBe(false)
    expect(updates.at(-1)?.props[0]?.anim.some((frame) => frame.rotate !== undefined)).toBe(true)
    expect(updates.at(-1)?.props[1]?.anim.some((frame) => frame.rotate !== undefined)).toBe(false)
  })

  it('preserves frame zero Warp when Timing changes Initial into a slider value', () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const animation = shallowRef<RootDataFinal | undefined>(source)
    const controls = usePatternPropertyControls({
      animation,
      onAnimationUpdate: (updated) => {
        animation.value = updated
      },
      rebuildAnimationForThirdOrderCycle: (minimumCycleCount) =>
        createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' }, { minimumCycleCount }),
    })

    controls.updateThirdOrderInitial(0, '1:3-pro')
    const initialWarp = animation.value?.props[0]?.anim[0]?.warp
    expect(initialWarp).toBeTypeOf('number')
    expect(controls.vtgThirdOrderSettings.value[0]).toEqual({ initial: '1:3-pro' })
    expect(controls.vtgThirdOrderDisplaySettings.value.timing[0]).toBe('1:3-pro')
    expect(
      animation.value?.props[0]?.anim.slice(1).every((frame) => frame.warp === undefined),
    ).toBe(true)

    controls.updateThirdOrderTiming(0, '2:3-anti')

    expect(controls.vtgThirdOrderSettings.value[0]).toEqual({
      initial: initialWarp,
      timing: '2:3-anti',
    })
    expect(animation.value?.props[0]?.anim[0]?.warp).toBe(initialWarp)
    expect(animation.value?.props[0]?.anim[1]?.warp).toBeTypeOf('number')
    expect(animation.value?.props[0]?.anim).toHaveLength(17)

    controls.updateThirdOrderTiming(0)
    expect(controls.vtgThirdOrderSettings.value[0]).toEqual({ initial: '1:3-pro' })
    expect(controls.vtgThirdOrderDisplaySettings.value.timing[0]).toBe('1:3-pro')
    expect(animation.value?.props[0]?.anim[1]?.warp).toBeUndefined()
    expect(animation.value?.props[0]?.anim).toHaveLength(9)

    controls.updateThirdOrderInitial(0)
    controls.updateThirdOrderTiming(0, '1:1-pro')
    expect(controls.vtgThirdOrderSettings.value[0]).toEqual({ timing: '1:1-pro' })
    expect(animation.value?.props[0]?.anim[0]?.warp).toBeUndefined()
    expect(controls.vtgThirdOrderDisplaySettings.value.initial[0]).toBe(0)
  })

  it('uses an inherited 2:* Initial to expand the complete hand-path cycle', () => {
    const selection = { reference: '1-1', speedRatio: '1:3' } as const
    const animation = shallowRef<RootDataFinal | undefined>(createDefaultVtgAnimation(selection))
    const controls = usePatternPropertyControls({
      animation,
      onAnimationUpdate: (updated) => {
        animation.value = updated
      },
      rebuildAnimationForThirdOrderCycle: (minimumCycleCount) =>
        createDefaultVtgAnimation(selection, { minimumCycleCount }),
    })

    controls.updateThirdOrderInitial(0, '2:3-anti')

    expect(controls.vtgThirdOrderSettings.value[0]).toEqual({ initial: '2:3-anti' })
    expect(controls.vtgThirdOrderDisplaySettings.value.timing[0]).toBe('2:3-anti')
    expect(animation.value?.props[0]?.anim).toHaveLength(17)
    expect(
      animation.value?.props[0]?.anim.slice(1).every((frame) => frame.warp === undefined),
    ).toBe(true)

    controls.updateThirdOrderInitial(0, '1:3-anti')
    expect(animation.value?.props[0]?.anim).toHaveLength(9)
  })

  it('materializes the opposed Right side before Mirror is disabled', () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!source) throw new Error('Expected a supported VTG animation')
    const animation = shallowRef<RootDataFinal | undefined>(source)
    const controls = usePatternPropertyControls({
      animation,
      onAnimationUpdate: (updated) => {
        animation.value = updated
      },
    })

    controls.updateThirdOrderInitial(0, '1:3-anti')
    controls.updateThirdOrderStrength(0, 50)
    controls.updateThirdOrderTiming(0, '2:3-anti')
    controls.updateThirdOrderOpposed(true)

    const opposed = animation.value
    if (!opposed) throw new Error('Expected an opposed animation')
    const rightArc = resolveAnimationFrames(source.props[1]!.anim)[1]!.arc
    expect(opposed.props[1]?.anim[1]?.warp).toBe(createVtgThirdOrderWarp(rightArc, '2:3-pro'))
    expect(opposed.props[1]?.anim[0]?.strength).toBe(500)

    controls.updateThirdOrderMirror(false)

    expect(controls.vtgThirdOrderMirror.value).toBe(false)
    expect(controls.vtgThirdOrderOpposed.value).toBe(false)
    expect(controls.vtgThirdOrderSettings.value[1]?.timing).toBe('2:3-pro')
    expect(animation.value).toEqual(opposed)
  })
})
