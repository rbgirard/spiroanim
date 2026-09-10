import { describe, expect, it } from 'vitest'

import { useVtgBuilderPortionProperties } from '@/features/builder/composables/useVtgBuilderPortionProperties'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import {
  applyVtgThirdOrderSettings,
  detectVtgThirdOrderRelationship,
} from '@/features/vtg/thirdOrder'
import type { VtgPatternSelection } from '@/features/vtg/types'
import { resizeVtgTransitionPatternPreview } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import type { RootDataFinal } from '@/types/AnimTypes'
import {
  appendVtgBuilderPattern,
  swapVtgBuilderPatternProps,
} from '@/features/builder/appendVtgBuilderPattern'
import { createVtgTransitionPreviewAnimations } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { prepareVtg45TransitionPattern } from '@/features/vtg/math/prepareVtg45TransitionPattern'

describe('useVtgBuilderPortionProperties Third Order controls', () => {
  it('keeps the opposed control synchronized when the selected portion is swapped', async () => {
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const source = first
      ? appendVtgBuilderPattern(first, { reference: '5-1', speedRatio: '1:3' })
      : undefined
    if (!source) throw new Error('Expected a two-portion Builder pattern')
    const pattern = shallowRef<RootDataFinal>(source)
    const selectedIndex = ref<number>()
    const controls = useVtgBuilderPortionProperties({
      pattern: computed(() => pattern.value),
      previews: computed(() => createVtgTransitionPreviewAnimations(pattern.value)),
      speedRatio: ref('1:3'),
      initialPropRotationOffsets: ref<VtgPatternSelection['propRotationOffsets']>(),
      selectedIndex,
      commit: (updated) => {
        pattern.value = updated
      },
    })

    selectedIndex.value = 1
    await nextTick()
    controls.updateThirdOrderTiming(0, '1:3-anti')
    controls.updateThirdOrderOpposed(true)
    expect(controls.thirdOrderOpposed.value).toBe(true)

    const prepared = prepareVtg45TransitionPattern(pattern.value)
    const swapped = prepared.supported ? swapVtgBuilderPatternProps(prepared.pattern, 1) : undefined
    if (!swapped) throw new Error('Expected the selected Builder portion to swap')
    pattern.value = swapped
    await nextTick()

    expect(controls.thirdOrderOpposed.value).toBe(
      detectVtgThirdOrderRelationship(controls.selectedControlAnimation.value!, 1).opposed,
    )
  })

  it('rehydrates relationship controls when the selected animation changes in place', async () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!source) throw new Error('Expected a supported VTG animation')
    const opposed = applyVtgThirdOrderSettings(
      source,
      [{ initial: 90, strength: 60, timing: '1:3-anti' }, {}],
      { mirror: true, opposed: true },
    )
    const pattern = shallowRef<RootDataFinal>(opposed)
    const controls = useVtgBuilderPortionProperties({
      pattern: computed(() => pattern.value),
      previews: computed(() => [pattern.value]),
      speedRatio: ref('1:3'),
      initialPropRotationOffsets: ref<VtgPatternSelection['propRotationOffsets']>(),
      selectedIndex: ref(0),
      commit: (updated) => {
        pattern.value = updated
      },
    })

    pattern.value = applyVtgThirdOrderSettings(
      opposed,
      [{ initial: 90, strength: 60, timing: '1:3-anti' }, {}],
      { mirror: true, opposed: false },
    )
    await nextTick()

    expect(controls.thirdOrderMirror.value).toBe(true)
    expect(controls.thirdOrderOpposed.value).toBe(false)
  })

  it('resizes a 45 degree portion like a native 2:* pattern when Timing changes', async () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!source) throw new Error('Expected a supported VTG animation')
    const customLength = resizeVtgTransitionPatternPreview(source, 0, 6)
    if (!customLength) throw new Error('Expected a resized Builder portion')
    const pattern = shallowRef<RootDataFinal>(customLength)
    const selectedIndex = ref<number>(0)
    const controls = useVtgBuilderPortionProperties({
      pattern: computed(() => pattern.value),
      previews: computed(() => [pattern.value]),
      speedRatio: ref('1:3'),
      initialPropRotationOffsets: ref<VtgPatternSelection['propRotationOffsets']>(),
      selectedIndex,
      commit: (updated) => {
        pattern.value = updated
      },
    })

    controls.updateThirdOrderInitial(0, '1:3-anti')
    controls.updateThirdOrderStrength(0, 55)
    expect(pattern.value.props[0]?.anim).toHaveLength(13)

    controls.updateThirdOrderInitial(0, '2:3-anti')
    expect(pattern.value.props[0]?.anim).toHaveLength(17)
    expect(controls.thirdOrderSettings.value[0]).toEqual({
      initial: '2:3-anti',
      strength: 55,
    })
    expect(controls.thirdOrderDisplaySettings.value.timing[0]).toBe('2:3-anti')

    await nextTick()
    controls.updateThirdOrderInitial(0)
    expect(pattern.value.props[0]?.anim).toHaveLength(9)
  })

  it('detects opposed mirroring and materializes Right before unmirroring', async () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!source) throw new Error('Expected a supported VTG animation')
    const pattern = shallowRef<RootDataFinal>(
      applyVtgThirdOrderSettings(source, [{ initial: 90, strength: 60, timing: '1:3-anti' }, {}], {
        mirror: true,
        opposed: true,
      }),
    )
    const selectedIndex = ref<number>()
    const controls = useVtgBuilderPortionProperties({
      pattern: computed(() => pattern.value),
      previews: computed(() => [pattern.value]),
      speedRatio: ref('1:3'),
      initialPropRotationOffsets: ref<VtgPatternSelection['propRotationOffsets']>(),
      selectedIndex,
      commit: (updated) => {
        pattern.value = updated
      },
    })

    selectedIndex.value = 0
    await nextTick()

    expect(controls.thirdOrderMirror.value).toBe(true)
    expect(controls.thirdOrderOpposed.value).toBe(true)
    const opposed = structuredClone(pattern.value)

    controls.updateThirdOrderMirror(false)

    expect(controls.thirdOrderMirror.value).toBe(false)
    expect(controls.thirdOrderOpposed.value).toBe(false)
    expect(controls.thirdOrderSettings.value[1]?.timing).toBe('1:3-pro')
    expect(pattern.value).toEqual(opposed)
  })

  it('clears Strength and Adjust when Ratio is cleared', () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!source) throw new Error('Expected a supported VTG animation')
    const pattern = shallowRef<RootDataFinal>(source)
    const controls = useVtgBuilderPortionProperties({
      pattern: computed(() => pattern.value),
      previews: computed(() => [pattern.value]),
      speedRatio: ref('1:3'),
      initialPropRotationOffsets: ref<VtgPatternSelection['propRotationOffsets']>(),
      selectedIndex: ref(0),
      commit: (updated) => {
        pattern.value = updated
      },
    })

    controls.updateThirdOrderTiming(0, '1:1-pro')
    expect(controls.thirdOrderSettings.value[0]?.timing).toBe('1:1-pro')
    controls.updateThirdOrderStrength(0, 55)
    controls.updateThirdOrderInitial(0, 90)
    expect(pattern.value.props[0]?.anim[0]?.strength).toBe(550)

    controls.updateThirdOrderTiming(0)

    expect(controls.thirdOrderSettings.value[0]).toEqual({})
    expect(pattern.value.props[0]?.anim.every((frame) => frame.warp === undefined)).toBe(true)
    expect(pattern.value.props[0]?.anim.every((frame) => frame.strength === undefined)).toBe(true)
  })
})
