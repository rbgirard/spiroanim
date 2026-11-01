import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AppTooltip from '@/components/AppTooltip.vue'
import QuickSlotsControl from '@/features/concepts/components/QuickSlotsControl.vue'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'

describe('QuickSlotsControl', () => {
  it('loads saved slots repeatedly without selecting or saving in apply-only mode', async () => {
    const store = useConceptsStore()
    store.quickSlotPaths[1] = '/play-8stp?r=stored&v=6'
    store.selectedQuickSlot = 1
    const wrapper = mount(QuickSlotsControl, { props: { applyOnly: true } })
    const button = wrapper.get('[data-role="quick-slot-2"] button')
    await button.trigger('click')
    await button.trigger('click')
    expect(store.selectedQuickSlot).toBe(1)
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(0)
    expect(wrapper.get('[data-role="quick-slot-1"] button').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('apply')).toEqual([
      ['/play-8stp?r=stored&v=6'],
      ['/play-8stp?r=stored&v=6'],
    ])
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(store.quickSlotPaths[1]).toBe('/play-8stp?r=stored&v=6')
    store.quickSlotPaths[0] = '/play-vtg?r=current&v=6'
    await nextTick()
    await wrapper.get('[data-role="quick-slot-1"] button').trigger('click')
    expect(store.selectedQuickSlot).toBeNull()
    await button.trigger('click')
    expect(store.selectedQuickSlot).toBeNull()
    wrapper.unmount()
  })
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    useConceptsStore().restoreQuickSlots()
  })
  afterEach(() => vi.restoreAllMocks())

  it('starts with four slots and grows or shrinks the radio group', async () => {
    const wrapper = mount(QuickSlotsControl)
    const store = useConceptsStore()

    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(4)
    expect(wrapper.get<HTMLInputElement>('input[value="1"]').element.checked).toBe(false)
    expect(wrapper.get('legend').text()).toBe('Quick Slots')
    expect(wrapper.get('[data-role="quick-slot-remove"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-role="quick-slot-add"]').trigger('click')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(5)
    expect(store.selectedQuickSlot).toBe(5)
    expect(wrapper.get<HTMLInputElement>('input[value="5"]').element.checked).toBe(true)

    await wrapper.get('[data-role="quick-slot-remove"]').trigger('click')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(4)
    expect(store.selectedQuickSlot).toBe(4)
    expect(wrapper.get<HTMLInputElement>('input[value="4"]').element.checked).toBe(true)

    await wrapper.get('[data-role="quick-slot-remove"]').trigger('click')
    await wrapper.get('[data-role="quick-slot-remove"]').trigger('click')
    await wrapper.get('[data-role="quick-slot-remove"]').trigger('click')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(1)
    await wrapper.get('[data-role="quick-slot-remove"]').trigger('click')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(0)
  })

  it('clears an already selected saved slot and leaves saving disabled', async () => {
    const store = useConceptsStore()
    store.selectedQuickSlot = 1
    store.quickSlotPaths[0] = '/play-vtg?r=stored&v=6'
    const wrapper = mount(QuickSlotsControl)

    await wrapper.get<HTMLInputElement>('input[value="1"]').trigger('click')

    expect(store.selectedQuickSlot).toBeNull()
    expect(
      wrapper
        .findAll<HTMLInputElement>('input[type="radio"]')
        .map((input) => input.element.checked),
    ).toEqual([false, false, false, false])

    store.saveCurrentQuickSlot('/play-vtg?r=ignored&v=6')
    expect(store.quickSlotPaths).toEqual(['/play-vtg?r=stored&v=6', null, null, null])
  })

  it('requests the current pattern when an empty Quick Slot is clicked', async () => {
    const store = useConceptsStore()
    const wrapper = mount(QuickSlotsControl)

    await wrapper.get<HTMLInputElement>('input[value="2"]').setValue()

    expect(store.selectedQuickSlot).toBe(2)
    expect(wrapper.emitted('save')).toEqual([[2]])
    expect(wrapper.emitted('apply')).toBeUndefined()

    store.selectedQuickSlot = 3
    await nextTick()
    await wrapper.get<HTMLInputElement>('input[value="3"]').trigger('click')

    expect(store.selectedQuickSlot).toBe(3)
    expect(wrapper.emitted('save')).toEqual([[2], [3]])
  })

  it('emits a stored path when a different Quick Slot is selected', async () => {
    const wrapper = mount(QuickSlotsControl)
    const store = useConceptsStore()
    store.quickSlotPaths[1] = '/play-8stp?r=stored&v=6'
    await nextTick()

    expect(wrapper.findAllComponents(AppTooltip).map((tooltip) => tooltip.props('text'))).toContain(
      'Select Quick Slot 2 (Saved - hold to clear)\nLoads: play-8stp',
    )

    await wrapper.get<HTMLInputElement>('input[value="2"]').setValue()

    expect(store.selectedQuickSlot).toBe(2)
    expect(wrapper.emitted('apply')).toEqual([['/play-8stp?r=stored&v=6']])
    expect(wrapper.findAll('[data-role="quick-slot-saved-indicator"]')).toHaveLength(1)
    expect(
      wrapper
        .get('[data-role="quick-slot-2"]')
        .find('[data-role="quick-slot-saved-indicator"]')
        .exists(),
    ).toBe(true)
    expect(wrapper.get('input[value="2"]').attributes('aria-label')).toBe(
      'Quick Slot 2, saved; press and hold to clear',
    )
    expect(wrapper.get('input[value="1"]').attributes('aria-label')).toBe('Quick Slot 1, empty')
  })

  it('does not clear on double-click and retains keyboard deletion', async () => {
    const store = useConceptsStore()
    store.quickSlotPaths[1] = '/play-vtg?r=stored&v=6'
    const wrapper = mount(QuickSlotsControl)
    const slot = wrapper.get('[data-role="quick-slot-2"]')

    await slot.trigger('dblclick')
    expect(store.quickSlotPaths[1]).toBe('/play-vtg?r=stored&v=6')

    await wrapper.get('input[value="2"]').trigger('keydown', { key: 'Delete' })
    expect(store.quickSlotPaths[1]).toBeNull()
  })

  it('clears a populated Quick Slot after a touch long-press without selecting it', async () => {
    vi.useFakeTimers()
    try {
      const store = useConceptsStore()
      store.quickSlotPaths[2] = '/play-vtg?r=stored&v=6'
      const wrapper = mount(QuickSlotsControl)
      const slot = wrapper.get('[data-role="quick-slot-3"]')
      const dispatchPointer = (type: string, clientX = 10, clientY = 10) => {
        const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY })
        Object.defineProperties(event, {
          isPrimary: { value: true },
          pointerId: { value: 3 },
          pointerType: { value: 'touch' },
        })
        slot.element.dispatchEvent(event)
      }

      dispatchPointer('pointerdown')
      dispatchPointer('pointermove', 25, 10)
      await vi.advanceTimersByTimeAsync(501)
      expect(store.quickSlotPaths[2]).toBe('/play-vtg?r=stored&v=6')
      dispatchPointer('pointerup', 25, 10)

      dispatchPointer('pointerdown')
      await vi.advanceTimersByTimeAsync(501)

      expect(store.quickSlotPaths[2]).toBeNull()

      dispatchPointer('pointerup')
      await vi.advanceTimersByTimeAsync(1)
      await slot.trigger('click')
      expect(store.selectedQuickSlot).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not refill a selected Quick Slot from a delayed click after a touch long-press', async () => {
    vi.useFakeTimers()
    try {
      const store = useConceptsStore()
      store.selectedQuickSlot = 3
      store.quickSlotPaths[2] = '/play-vtg?r=stored&v=6'
      const wrapper = mount(QuickSlotsControl)
      const slot = wrapper.get('[data-role="quick-slot-3"]')
      const dispatchPointer = (type: string) => {
        const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: 10, clientY: 10 })
        Object.defineProperties(event, {
          isPrimary: { value: true },
          pointerId: { value: 3 },
          pointerType: { value: 'touch' },
        })
        slot.element.dispatchEvent(event)
      }

      dispatchPointer('pointerdown')
      await vi.advanceTimersByTimeAsync(501)
      dispatchPointer('pointerup')
      await vi.advanceTimersByTimeAsync(1)
      await slot.trigger('click')

      expect(store.quickSlotPaths[2]).toBeNull()
      expect(store.selectedQuickSlot).toBe(3)
      expect(wrapper.emitted('save')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('provides desktop tooltips for every Quick Slot control', () => {
    const wrapper = mount(QuickSlotsControl)

    expect(wrapper.findAllComponents(AppTooltip).map((tooltip) => tooltip.props('text'))).toEqual([
      'Remove a Quick Slot',
      'Select Quick Slot 1 (Empty)',
      'Select Quick Slot 2 (Empty)',
      'Select Quick Slot 3 (Empty)',
      'Select Quick Slot 4 (Empty)',
      'Add a Quick Slot',
    ])
    expect(
      wrapper.findAllComponents(AppTooltip).every((tooltip) => !tooltip.props('disabled')),
    ).toBe(true)
  })

  it('balances many Quick Slots across rows like QST pagination', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.matches('button, .quick-slots__option') ? 32 : 0
    })
    useConceptsStore().quickSlotCount = 14

    const wrapper = mount(QuickSlotsControl)
    await nextTick()

    const rows = wrapper.findAll('[data-role="quick-slots-row"]')
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.findAll('input[name="quick-slot"]').length)).toEqual([5, 5, 4])
    expect(rows[0]?.find('[data-role="quick-slot-remove"]').exists()).toBe(true)
    expect(rows.at(-1)?.find('[data-role="quick-slot-add"]').exists()).toBe(true)
  })

  it('disables every Quick Slot tooltip on touch devices', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone)')

    const wrapper = mount(QuickSlotsControl)

    expect(
      wrapper.findAllComponents(AppTooltip).every((tooltip) => tooltip.props('disabled')),
    ).toBe(true)
  })
})
