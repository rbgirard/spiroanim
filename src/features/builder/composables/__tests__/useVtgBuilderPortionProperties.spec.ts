import { describe, expect, it } from 'vitest'

import { useVtgBuilderPortionProperties } from '@/features/builder/composables/useVtgBuilderPortionProperties'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { applyVtgThirdOrderSettings } from '@/features/vtg/thirdOrder'
import type { VtgPatternSelection } from '@/features/vtg/types'
import { resizeVtgTransitionPatternPreview } from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import type { RootDataFinal } from '@/types/AnimTypes'

describe('useVtgBuilderPortionProperties Third Order controls', () => {
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
})
