import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ShiftFrames from '@/features/editor/components/properties/manage/ShiftFrames.vue'
import { usePropertiesStore } from '@/features/editor/stores/usePropertiesStore'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useQSMainStore } from '@/stores/useQSMainStore'
import type { AnimData, RootData } from '@/types/AnimTypes'

const closedFrames = (): AnimData[] => [
  { arc: 0, beats: 2, scale: 8 },
  { arc: 90, beats: 3, scale: 8 },
  { arc: 90, plane: 180, beats: 4, scale: 8 },
]

const openFrames = (): AnimData[] => [{ arc: 0 }, { arc: 45 }, { arc: 45 }]

const rangedFrames = (): AnimData[] => [
  { arc: 0, beats: 5, scale: 15, depth: -2, adjust: 5, move: [1, 0, 0] },
  { arc: 0, beats: 2, scale: 8, depth: 1, adjust: 10, move: [1, 0, 0] },
  { arc: 90, beats: 3, scale: 9, depth: 2, adjust: 20, move: [2, 0, 0] },
  {
    arc: 90,
    plane: 180,
    beats: 7,
    scale: 12,
    depth: 4,
    adjust: 30,
    move: [3, 0, 0],
  },
  { arc: 45, beats: 11, scale: 14, depth: 6, adjust: 40, move: [4, 0, 0] },
]

const createRoot = (props: AnimData[][]) =>
  rootFinal({
    bpm: 120,
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
    props: props.map((anim) => ({ anim })),
    aspectx: 1,
    aspecty: 1,
    distance: 22,
    thick: 4,
  } satisfies RootData)

const expectVectorClose = (actual: readonly number[], expected: readonly number[]) => {
  actual.forEach((coordinate, axis) => expect(coordinate).toBeCloseTo(expected[axis]!, 9))
}

const openShiftForm = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.get('a').trigger('click')
}

const applyShift = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.get('.action-button').trigger('click')
}

describe('ShiftFrames', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('shifts every selected closed prop and leaves unselected props unchanged', async () => {
    const storeId = 'shift-selected'
    const player = usePlayerStore(storeId)
    const { ROOT, COMPILED } = player.raw()
    ROOT.value = createRoot([closedFrames(), closedFrames(), openFrames()])
    player.PLAYING = false

    const properties = usePropertiesStore(storeId)
    properties.pSELECTED = { 0: true, 1: true, 2: false }
    const unselected = structuredClone(ROOT.value.props[2]!.anim)
    await nextTick()

    const wrapper = mount(ShiftFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    await openShiftForm(wrapper)
    await applyShift(wrapper)

    expect(ROOT.value.props[0]!.anim[0]).toMatchObject({ arc: 90, beats: 3, scale: 8 })
    expect(ROOT.value.props[1]!.anim[0]).toMatchObject({ arc: 90, beats: 3, scale: 8 })
    expect(COMPILED.value.props[0]!.anim.at(-1)).toMatchObject({
      beats: 4,
      scale: 8,
    })
    expect(COMPILED.value.props[1]!.anim.at(-1)).toMatchObject({
      beats: 4,
      scale: 8,
    })
    expect(ROOT.value.props[2]!.anim).toEqual(unselected)
  })

  it('warns before shifting unmatched endpoints and can suppress the warning until remount', async () => {
    const storeId = 'shift-unmatched'
    const player = usePlayerStore(storeId)
    const { ROOT } = player.raw()
    ROOT.value = createRoot([openFrames()])
    player.PLAYING = false

    const properties = usePropertiesStore(storeId)
    properties.pSELECTED = { 0: true }
    await nextTick()

    let wrapper = mount(ShiftFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    const link = wrapper.get('a')
    expect(link.attributes('aria-disabled')).toBe('false')
    expect(link.classes()).toContain('shift-link--warning')

    const original = structuredClone(ROOT.value.props[0]!.anim)
    await link.trigger('click')
    await applyShift(wrapper)
    expect(ROOT.value.props[0]!.anim).toEqual(original)
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(true)

    await wrapper.get('.shift-warning__cancel').trigger('click')
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(false)
    expect(ROOT.value.props[0]!.anim).toEqual(original)

    await applyShift(wrapper)
    await wrapper.get('.shift-warning__choice input').setValue(true)
    await wrapper.get('.shift-warning__proceed').trigger('click')
    await nextTick()

    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(false)
    expect(ROOT.value.props[0]!.anim).not.toEqual(original)

    ROOT.value = createRoot([openFrames()])
    await nextTick()
    const resetOpenFrames = structuredClone(ROOT.value.props[0]!.anim)
    await applyShift(wrapper)
    await nextTick()
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(false)
    expect(ROOT.value.props[0]!.anim).not.toEqual(resetOpenFrames)

    wrapper.unmount()
    ROOT.value = createRoot([openFrames()])
    await nextTick()
    wrapper = mount(ShiftFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    await openShiftForm(wrapper)
    await applyShift(wrapper)
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(true)
  })

  it('shifts only a closed timeline selection and preserves its outgoing boundary', async () => {
    const storeId = 'shift-range'
    const player = usePlayerStore(storeId)
    const { ROOT, COMPILED } = player.raw()
    ROOT.value = createRoot([rangedFrames()])
    player.PLAYING = false

    const properties = usePropertiesStore(storeId)
    properties.pSELECTED = { 0: true }
    await nextTick()

    const originalFrames = structuredClone(ROOT.value.props[0]!.anim)
    const originalCompiled = structuredClone(COMPILED.value.props[0]!.anim)
    const originalTimes = [...player.PTIMES[0]!]
    player.SELECTION = true
    player.SELECTED = [1, 3]
    await nextTick()

    const wrapper = mount(ShiftFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    const link = wrapper.get('a')
    expect(link.attributes('aria-disabled')).toBe('false')
    await link.trigger('click')
    await applyShift(wrapper)
    await nextTick()

    const result = COMPILED.value.props[0]!.anim
    expect(ROOT.value.props[0]!.anim[0]).toEqual(originalFrames[0])
    expect(ROOT.value.props[0]!.anim[4]).toEqual(originalFrames[4])
    expectVectorClose(result[1]!.pos, originalCompiled[2]!.pos)
    expectVectorClose(result[2]!.pos, originalCompiled[3]!.pos)
    expectVectorClose(result[3]!.pos, originalCompiled[2]!.pos)
    expect(result[3]).toMatchObject({
      beats: originalCompiled[3]!.beats,
      scale: originalCompiled[3]!.scale,
      depth: originalCompiled[3]!.depth,
      adjust: originalCompiled[3]!.adjust,
    })
    expect(player.PTIMES[0]![3]).toBe(originalTimes[3])
    expect(player.PTIMES[0]![4]).toBe(originalTimes[4])
    expect(player.SELECTED).toEqual([1, 3])
  })

  it('preserves a partial range Warp seam and materializes following inheritance', async () => {
    const storeId = 'shift-range-warp'
    const player = usePlayerStore(storeId)
    const { ROOT, COMPILED } = player.raw()
    const frames = rangedFrames()
    frames[1]!.warp = 0
    frames[2]!.warp = 180
    frames[3]!.warp = -180
    ROOT.value = createRoot([frames])
    player.PLAYING = false

    const properties = usePropertiesStore(storeId)
    properties.pSELECTED = { 0: true }
    await nextTick()

    const original = structuredClone(COMPILED.value.props[0]!.anim)
    expect(ROOT.value.props[0]!.anim[4]!.warp).toBeUndefined()
    player.SELECTION = true
    player.SELECTED = [1, 3]
    await nextTick()

    const wrapper = mount(ShiftFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    await openShiftForm(wrapper)
    await applyShift(wrapper)
    await nextTick()

    const result = COMPILED.value.props[0]!.anim
    expectVectorClose(result[1]!.warpPos, original[2]!.warpPos)
    expectVectorClose(result[3]!.warpPos, original[2]!.warpPos)
    expect(result[3]!.warp).toBe(180)
    expect(ROOT.value.props[0]!.anim[4]!.warp).toBe(-180)
    expect(result[4]!.warp).toBe(original[4]!.warp)
  })

  it('shifts an entirely selected pattern and retains its final frame properties', async () => {
    const storeId = 'shift-entire-selection'
    const player = usePlayerStore(storeId)
    const { ROOT, COMPILED } = player.raw()
    ROOT.value = createRoot([closedFrames()])
    player.PLAYING = false

    const properties = usePropertiesStore(storeId)
    properties.pSELECTED = { 0: true }
    await nextTick()

    const originalFinal = structuredClone(COMPILED.value.props[0]!.anim.at(-1)!)
    const originalFinalTime = player.PTIMES[0]!.at(-1)
    player.SELECTION = true
    player.SELECTED = [0, 2]
    await nextTick()

    const wrapper = mount(ShiftFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    const link = wrapper.get('a')
    expect(link.attributes('aria-disabled')).toBe('false')
    await link.trigger('click')
    await applyShift(wrapper)
    await nextTick()

    expect(COMPILED.value.props[0]!.anim.at(-1)).toMatchObject({
      beats: originalFinal.beats,
      scale: originalFinal.scale,
      depth: originalFinal.depth,
      adjust: originalFinal.adjust,
    })
    expect(player.PTIMES[0]!.at(-1)).toBe(originalFinalTime)
    expect(player.SELECTED).toEqual([0, 2])
  })

  it('shifts the requested number of times up to the available frame count minus one', async () => {
    const storeId = 'shift-count'
    const player = usePlayerStore(storeId)
    const { ROOT, COMPILED } = player.raw()
    ROOT.value = createRoot([closedFrames()])
    player.PLAYING = false

    const properties = usePropertiesStore(storeId)
    properties.pSELECTED = { 0: true }
    Reflect.deleteProperty(properties.$state, 'pSHIFT')
    await nextTick()

    const originalCompiled = structuredClone(COMPILED.value.props[0]!.anim)
    const history = useQSMainStore()
    const beginHistoryGroup = vi.spyOn(history, 'beginHistoryGroup')
    const endHistoryGroup = vi.spyOn(history, 'endHistoryGroup')
    let wrapper = mount(ShiftFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    await openShiftForm(wrapper)

    const slider = wrapper.get<HTMLInputElement>('input[type="range"]')
    expect(wrapper.get('.shift-count').text()).toContain('Times: 1')
    expect(slider.attributes('min')).toBe('1')
    expect(slider.attributes('max')).toBe('2')
    await slider.setValue(2)
    expect(wrapper.get('.shift-count').text()).toContain('Times: 2')

    wrapper.unmount()
    wrapper = mount(ShiftFrames, {
      global: { provide: { store: ref(storeId) } },
    })
    expect(wrapper.get<HTMLInputElement>('input[type="range"]').element.value).toBe('2')

    await applyShift(wrapper)

    expect(beginHistoryGroup).toHaveBeenCalledTimes(1)
    expect(endHistoryGroup).toHaveBeenCalledTimes(1)
    expectVectorClose(COMPILED.value.props[0]!.anim[0]!.pos, originalCompiled[2]!.pos)
    expectVectorClose(COMPILED.value.props[0]!.anim[0]!.rot, originalCompiled[2]!.rot)
  })
})
