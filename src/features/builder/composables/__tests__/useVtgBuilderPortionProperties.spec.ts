import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { useVtgBuilderPortionProperties } from '@/features/builder/composables/useVtgBuilderPortionProperties'
import {
  applyVtgPropRotationOffsets,
  createDefaultVtgAnimation,
} from '@/features/vtg/createVtgAnimation'
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
import { useBaseQS } from '@/services/query/createBaseQS'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'

describe('useVtgBuilderPortionProperties Third Order controls', () => {
  it('separates the resolved Ratio display from ownership of its frame value', () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!source) throw new Error('Expected a supported VTG animation')
    const pattern = shallowRef<RootDataFinal>(
      applyVtgThirdOrderSettings(source, [{ timing: '1:1-pro' }, {}]),
    )
    delete pattern.value.props[0]!.anim[1]!.warp
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

    expect(controls.thirdOrderDisplaySettings.value.timing[0]).toBe('1:1-pro')
    expect(controls.thirdOrderTimingSet.value[0]).toBe(false)
  })

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

  it('disables Mirror without changing the opposed relationship', async () => {
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
    expect(controls.thirdOrderOpposed.value).toBe(true)
    expect(controls.thirdOrderSettings.value[1]?.timing).toBe('1:3-pro')
    expect(pattern.value).toEqual(opposed)

    controls.updateThirdOrderMirror(true)
    expect(controls.thirdOrderMirror.value).toBe(true)
    expect(controls.thirdOrderOpposed.value).toBe(true)
    expect(pattern.value).toEqual(opposed)
  })

  it('clears each prop Ratio independently on the reported second portion', async () => {
    const params = new URLSearchParams(
      'r=Gw096k11Y&p0=QR__v.blE.5JE_6k..........5GQ_6k_WQ........___-ZU.....5JE_6k_U0.......5JE_6k.......&x0=Q4.____Luf_..............................____Luf_&m0=_1_mxqv__&p1=NR__v.blE.5L_-ZU..........5JE-ZU........___-ZU.....5GQ_6k.......5GQ-ZU.......&x1=Q4.____Luf_..........____Luf_&c=_f_bhq&v=12',
    )
    const version = await loadSpiroAnimQSVersion(12)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      12,
    )
    const prepared = prepareVtg45TransitionPattern(codec.decodeQS(Object.fromEntries(params)))
    if (!prepared.supported) throw new Error('Expected the supplied Builder pattern to load')
    const pattern = shallowRef<RootDataFinal>(prepared.pattern)
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

    expect(controls.thirdOrderTimingSet.value).toEqual([false, true])
    controls.updateThirdOrderMirror(false)
    controls.updateThirdOrderTiming(0)
    await nextTick()
    expect(controls.thirdOrderTimingSet.value).toEqual([false, true])

    controls.updateThirdOrderTiming(1)
    await nextTick()
    expect(controls.thirdOrderTimingSet.value).toEqual([false, false])
  })

  it('writes and then recompresses Right when Opposed changes an inherited relationship', async () => {
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const opposed = first
      ? applyVtgThirdOrderSettings(first, [{ timing: '1:3-anti' }, {}], {
          mirror: true,
          opposed: true,
        })
      : undefined
    const source = opposed
      ? appendVtgBuilderPattern(opposed, { reference: '1-1', speedRatio: '1:3' })
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

    expect(controls.thirdOrderOpposed.value).toBe(true)
    expect(controls.thirdOrderTimingSet.value).toEqual([false, false])

    controls.updateThirdOrderOpposed(false)
    await nextTick()
    expect(controls.thirdOrderTimingSet.value).toEqual([false, true])
    expect(controls.thirdOrderOpposed.value).toBe(false)

    controls.updateThirdOrderOpposed(true)
    await nextTick()
    expect(controls.thirdOrderOpposed.value).toBe(true)
    expect(controls.thirdOrderTimingSet.value).toEqual([false, false])
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

describe('useVtgBuilderPortionProperties Builder controls', () => {
  it('converts authored and inherited Scale values to display multipliers', () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!source) throw new Error('Expected a supported VTG animation')
    source.props[0]!.anim[0] = { ...source.props[0]!.anim[0], scale: 70 }
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

    expect(controls.scaleValues.value[0]?.['0']).toBe(0.7)
    expect(controls.scaleDisplayValues.value[0]?.['0']).toBe(0.7)
  })

  it('keeps Scale and Twist in Advanced while their edits update the preview', async () => {
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

    controls.updateScaleMode('advanced')
    await nextTick()
    expect(controls.scaleMode.value).toBe('advanced')
    controls.updateScale(0, 0, 0.7)
    await nextTick()
    expect(pattern.value.props[0]?.anim[0]?.scale).toBe(70)
    expect(controls.scaleValues.value[0]?.['0']).toBe(0.7)
    expect(controls.scaleMode.value).toBe('advanced')

    controls.updateTwistMode('advanced')
    await nextTick()
    expect(controls.twistMode.value).toBe('advanced')
    controls.updateTwist(0, 0, 45)
    await nextTick()
    expect(pattern.value.props[0]?.anim[0]?.twist).toBe(45)
    expect(controls.twistMode.value).toBe('advanced')
  })

  it('retains Offset slider state across consecutive preview updates', async () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!source) throw new Error('Expected a supported VTG animation')
    const pattern = shallowRef<RootDataFinal>(applyVtgPropRotationOffsets(source, [10, 0]))
    const selectedIndex = ref<number>()
    const controls = useVtgBuilderPortionProperties({
      pattern: computed(() => pattern.value),
      previews: computed(() => [pattern.value]),
      speedRatio: ref('1:3'),
      initialPropRotationOffsets: ref<VtgPatternSelection['propRotationOffsets']>([10, 0]),
      selectedIndex,
      commit: (updated) => {
        pattern.value = updated
      },
    })
    selectedIndex.value = 0
    await nextTick()
    expect(controls.offsetValues.value).toEqual([10, 0])

    controls.updateOffset(0, 45)
    await nextTick()
    expect(controls.offsetValues.value).toEqual([45, 0])

    controls.updateOffset(0, 90)
    await nextTick()
    expect(controls.offsetValues.value).toEqual([90, 0])
    expect(pattern.value).toEqual(applyVtgPropRotationOffsets(source, [90, 0]))
  })
})
