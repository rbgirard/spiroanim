import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import ResampleAnimationFrames from '@/features/editor/components/properties/manage/ResampleAnimationFrames.vue'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { usePlayerStore } from '@/stores/usePlayerStore'
import type { RootData } from '@/types/AnimTypes'

const createRoot = () =>
  rootFinal({
    bpm: 100,
    prop: 0,
    color: 0,
    smooth: true,
    guides: false,
    paths: true,
    hands: true,
    arms: false,
    visible: true,
    nodes: false,
    anchors: false,
    props: [
      {
        anim: [
          {
            beats: 1,
            turns: 0,
            scale: 100,
            warp: 0,
            strength: 200,
            depth: 0,
            adjust: 0,
            arc: 0,
          },
          {
            turns: 90,
            scale: 200,
            warp: 0,
            strength: 600,
            depth: 10,
            adjust: 20,
            arc: 90,
            plane: 45,
          },
        ],
      },
    ],
    aspectx: 1,
    aspecty: 1,
    distance: 22,
    thick: 4,
  } satisfies RootData)

describe('ResampleAnimationFrames', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('doubles and then exactly halves the complete Animation frame tracks', async () => {
    const storeId = 'resample-animation-frames'
    const player = usePlayerStore(storeId)
    const { ROOT } = player.raw()
    ROOT.value = createRoot()
    player.PLAYING = false

    const wrapper = mount(ResampleAnimationFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    const double = wrapper.get('[data-role="double-animation-frames"]')
    const halve = wrapper.get('[data-role="halve-animation-frames"]')

    expect(double.attributes('aria-disabled')).toBe('false')
    expect(halve.attributes('aria-disabled')).toBe('true')

    await double.trigger('click')
    expect(ROOT.value.bpm).toBe(200)
    expect(ROOT.value.props[0]!.anim).toHaveLength(3)
    expect(ROOT.value.props[0]!.anim[1]).toMatchObject({
      turns: 45,
      scale: 212,
      warp: 0,
      strength: 400,
      depth: 5,
      adjust: 10,
      arc: 45,
      plane: 45,
    })
    expect(halve.attributes('aria-disabled')).toBe('false')

    await halve.trigger('click')
    expect(ROOT.value.bpm).toBe(100)
    expect(ROOT.value.props[0]!.anim).toHaveLength(2)
  })

  it('disables unsafe and non-invertible actions and both actions during playback', async () => {
    const storeId = 'disabled-resample-animation-frames'
    const player = usePlayerStore(storeId)
    const { ROOT } = player.raw()
    ROOT.value = createRoot()
    ROOT.value.props[0]!.anim[1]!.turns = 0.1
    player.PLAYING = false

    const wrapper = mount(ResampleAnimationFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    const double = wrapper.get('[data-role="double-animation-frames"]')
    const halve = wrapper.get('[data-role="halve-animation-frames"]')

    expect(double.attributes('aria-disabled')).toBe('true')

    ROOT.value = createRoot()
    ROOT.value.props[0]!.anim[1]!.warp = 5
    triggerRef(ROOT)
    await nextTick()
    expect(double.attributes('aria-disabled')).toBe('false')

    ROOT.value = createRoot()
    await double.trigger('click')
    ROOT.value.props[0]!.anim[1]!.scale = 160
    triggerRef(ROOT)
    await nextTick()
    expect(halve.attributes('aria-disabled')).toBe('true')

    player.PLAYING = true
    await nextTick()
    expect(double.attributes('aria-disabled')).toBe('true')
    expect(halve.attributes('aria-disabled')).toBe('true')
  })
})
