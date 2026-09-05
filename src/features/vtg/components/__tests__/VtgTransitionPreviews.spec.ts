import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppTooltip from '@/components/AppTooltip.vue'
import VtgTransitionPreviews from '@/features/vtg/components/VtgTransitionPreviews.vue'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { useViewportStore } from '@/stores/useViewportStore'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { describePatternSelectionRelationships } from '@/features/concepts/math/describePatternSelectionRelationships'
import {
  builderPatternPointerDropEvent,
  builderPatternPointerEndEvent,
  builderPatternPointerMoveEvent,
  createBuilderPatternPointerEvent,
} from '@/features/builder/patternPointerDrag'

const device = vi.hoisted(() => ({ touch: false }))
vi.mock('@/utils/device', () => ({ isTouchDevice: () => device.touch }))

const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
if (!animation) throw new Error('Expected a supported VTG pattern')
const mixedSpinAnimation = createDefaultVtgAnimation({ reference: '5-1', speedRatio: '1:3' })
if (!mixedSpinAnimation) throw new Error('Expected a supported mixed-spin VTG pattern')
const relationship = describePatternSelectionRelationships({ reference: '1-1', speedRatio: '1:3' })

describe('VtgTransitionPreviews', () => {
  beforeEach(() => {
    device.touch = false
    setActivePinia(createPinia())
  })

  it('emits the exact thumbnail animation when its visual is clicked', async () => {
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [mixedSpinAnimation],
        relationships: [relationship],
        refreshKey: 'test',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
      },
    })

    await wrapper.get('button[aria-label="Preview pattern 1"]').trigger('click')

    expect(wrapper.emitted('patternPreview')).toEqual([[mixedSpinAnimation, 0]])
    expect(wrapper.emitted('selectionChange')).toEqual([[0]])
    expect(wrapper.get('.vtg-transition-previews__label').text()).toBe('TS / TS')
    expect(wrapper.get('.vtg-transition-previews__ratio').text()).toBe('1:3')
    expect(
      wrapper.get('button[aria-label="Preview pattern 1"]').attributes('aria-describedby'),
    ).toBeTruthy()
    expect(wrapper.get('button[aria-label="Preview pattern 1"]').attributes('draggable')).toBe(
      'false',
    )
    expect(wrapper.findAllComponents(AppTooltip).map((tooltip) => tooltip.props('text'))).toEqual([
      relationship.description,
      'Reverse',
      'Swap Props',
      'Delete',
    ])

    await wrapper.get('button[aria-label="Reverse direction of pattern 1"]').trigger('click')
    expect(wrapper.emitted('patternReverse')).toEqual([[0]])
    expect(wrapper.emitted('patternPreview')).toHaveLength(1)

    await wrapper.get('button[aria-label="Swap props in pattern 1"]').trigger('click')
    expect(wrapper.emitted('patternSwap')).toEqual([[0]])
    expect(wrapper.emitted('patternPreview')).toHaveLength(1)

    await wrapper.get('button[aria-label="Delete pattern 1"]').trigger('click')
    expect(wrapper.emitted('patternDelete')).toEqual([[0]])
    expect(wrapper.emitted('patternPreview')).toHaveLength(1)
  })

  it('disables structural editing and drop affordances for read-only Builder portions', () => {
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [mixedSpinAnimation],
        relationships: [relationship],
        refreshKey: 'read-only-structure',
        initialBeatCounts: [1],
        beatCounts: [1],
        structureEditingEnabled: false,
      },
    })

    expect(wrapper.find('[data-role="vtg-transition-preview-reverse"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-transition-preview-swap"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Delete pattern 1"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-transition-preview-drop-target"]').exists()).toBe(false)
    expect(
      wrapper.get<HTMLInputElement>('[data-role="vtg-transition-preview-beats"]').element.disabled,
    ).toBe(true)
  })

  it('uses elemental icons with the original description in the Builder mini grid', () => {
    useConceptsStore().elementalLayout = true
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation],
        relationships: [relationship],
        refreshKey: 'elemental',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
      },
    })

    expect(wrapper.findAll('.vtg-transition-previews__label .base-icon')).toHaveLength(2)
    expect(wrapper.getComponent(AppTooltip).props('text')).toBe(relationship.description)
  })

  it('places selected properties after the complete selected thumbnail row', () => {
    const animations = Array.from({ length: 6 }, () => animation)
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations,
        relationships: animations.map(() => relationship),
        refreshKey: 'properties-row',
        initialBeatCounts: animations.map(() => 1),
        beatCounts: animations.map(() => 1),
        scale: 1,
        columns: 4,
        selectedIndex: 1,
      },
      slots: { 'selected-properties': '<div data-test="selected-properties">Properties</div>' },
    })

    const gridChildren = wrapper.get('[data-role="vtg-transition-previews"]').element.children
    const properties = wrapper.get('[data-role="vtg-transition-preview-properties"]').element
    expect(properties.previousElementSibling?.getAttribute('data-preview-index')).toBe('3')
    expect([...gridChildren].indexOf(properties)).toBe(4)
    expect(wrapper.get('[data-test="selected-properties"]').text()).toBe('Properties')
  })

  it('hides selected portion properties when structure editing is disabled', () => {
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation],
        relationships: [relationship],
        refreshKey: 'read-only-properties',
        initialBeatCounts: [1],
        beatCounts: [1],
        selectedIndex: 0,
        structureEditingEnabled: false,
      },
      slots: { 'selected-properties': '<div data-test="selected-properties">Properties</div>' },
    })

    expect(wrapper.find('[data-role="vtg-transition-preview-properties"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="selected-properties"]').exists()).toBe(false)
  })

  it('places selected properties after the final preview while hiding the placeholder', () => {
    const animations = Array.from({ length: 5 }, () => animation)
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations,
        relationships: animations.map(() => relationship),
        refreshKey: 'properties-placeholder-row',
        initialBeatCounts: animations.map(() => 1),
        beatCounts: animations.map(() => 1),
        scale: 1,
        columns: 4,
        selectedIndex: 4,
      },
      slots: { 'selected-properties': '<div>Properties</div>' },
    })

    const properties = wrapper.get('[data-role="vtg-transition-preview-properties"]').element
    expect(properties.previousElementSibling?.getAttribute('data-preview-index')).toBe('4')
    expect(wrapper.find('[data-role="vtg-transition-preview-drop-target"]').exists()).toBe(false)
  })

  it('selects the empty drop slot without previewing an animation or showing properties', async () => {
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation],
        relationships: [relationship],
        refreshKey: 'select-empty-slot',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
      },
      slots: { 'selected-properties': '<div data-test="selected-properties">Properties</div>' },
    })
    const emptySlot = wrapper.get<HTMLButtonElement>(
      '[data-role="vtg-transition-preview-drop-target"]',
    )

    await emptySlot.trigger('click')
    expect(wrapper.emitted('selectionChange')).toEqual([[1]])
    expect(wrapper.emitted('patternPreview')).toBeUndefined()

    await wrapper.setProps({ selectedIndex: 1 })
    expect(emptySlot.classes()).toContain('vtg-transition-previews__item--selected')
    expect(emptySlot.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-role="vtg-transition-preview-properties"]').exists()).toBe(false)

    await emptySlot.trigger('click')
    expect(wrapper.emitted('selectionChange')).toEqual([[1], [undefined]])
  })

  it('shows Sun and Moon icons for Quarter relationships in Elemental Builder thumbnails', () => {
    useConceptsStore().elementalLayout = true
    const quarterRelationship = {
      ...relationship,
      label: 'QS / QO' as const,
      hands: { timing: 'Q' as const, direction: 'S' as const },
      props: { timing: 'Q' as const, direction: 'O' as const },
    }
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation],
        relationships: [quarterRelationship],
        refreshKey: 'elemental-quarter',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
      },
    })

    expect(wrapper.get('.elemental-relationship-icons').attributes('aria-label')).toBe('Sun / Moon')
    expect(wrapper.findAll('.vtg-transition-previews__label .base-icon')).toHaveLength(2)
    expect(wrapper.find('.elemental-relationship-icons__icon--sun').exists()).toBe(true)
    expect(wrapper.find('.elemental-relationship-icons__icon--moon').exists()).toBe(true)
  })

  it('shows a prohibited icon for an indeterminate Builder relationship side', () => {
    useConceptsStore().elementalLayout = true
    const indeterminateRelationship = {
      ...relationship,
      label: 'TS / XX' as const,
      props: undefined,
      propsIndeterminate: true,
    }
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation],
        relationships: [indeterminateRelationship],
        refreshKey: 'elemental-indeterminate',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
      },
    })

    expect(wrapper.get('.elemental-relationship-icons').attributes('aria-label')).toBe(
      'Earth / Indeterminate',
    )
    expect(wrapper.find('[data-element="Indeterminate"]').exists()).toBe(true)
    expect(wrapper.find('.elemental-relationship-icons__icon--indeterminate').exists()).toBe(true)
  })

  it('hides Swap for portions whose two props are both Anti or both In', () => {
    const inSpinAnimation = createDefaultVtgAnimation({ reference: '3-1', speedRatio: '1:3' })
    if (!inSpinAnimation) throw new Error('Expected a supported In/In VTG pattern')
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation, inSpinAnimation, mixedSpinAnimation],
        relationships: [relationship, relationship, relationship],
        refreshKey: 'spin-specific-actions',
        initialBeatCounts: [1, 1, 1],
        beatCounts: [1, 1, 1],
        scale: 1,
      },
    })

    expect(wrapper.findAll('[data-role="vtg-transition-preview-swap"]')).toHaveLength(1)
    expect(wrapper.get('[data-role="vtg-transition-preview-swap"]').attributes('aria-label')).toBe(
      'Swap props in pattern 3',
    )
  })

  it('shows the shared action tooltip when application tooltips are enabled', async () => {
    vi.useFakeTimers()
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation],
        relationships: [relationship],
        refreshKey: 'action-tooltip',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
        selectedIndex: 0,
      },
    })

    useViewportStore().showTooltips = true
    await nextTick()
    await wrapper.get('button[aria-label="Reverse direction of pattern 1"]').trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Reverse')
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('respects the global tooltip setting for thumbnail descriptions', async () => {
    vi.useFakeTimers()
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation],
        relationships: [relationship],
        refreshKey: 'thumbnail-tooltip',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
      },
    })
    const thumbnail = wrapper.get('button[aria-label="Preview pattern 1"]')
    const viewport = useViewportStore()

    viewport.showTooltips = false
    await thumbnail.trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()

    viewport.showTooltips = true
    await nextTick()
    await thumbnail.trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      relationship.description,
    )

    wrapper.unmount()
    vi.useRealTimers()
  })

  it.each([false, true])('selects exactly one thumbnail when touch is %s', async (touch) => {
    device.touch = touch
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation, animation],
        relationships: [relationship, relationship],
        refreshKey: 'touch-delete',
        initialBeatCounts: [1, 1],
        beatCounts: [1, 1],
        scale: 1,
      },
    })
    const previews = wrapper.findAll<HTMLButtonElement>('.vtg-transition-previews__visual')
    const items = wrapper.findAll('.vtg-transition-previews__item').slice(0, 2)

    await previews[0]!.trigger('click')
    await wrapper.setProps({ selectedIndex: 0 })
    expect(items[0]!.classes()).toContain('vtg-transition-previews__item--selected')
    expect(wrapper.classes()).toContain('vtg-transition-previews--has-selection')
    expect(wrapper.find('[data-role="vtg-transition-preview-drop-target"]').exists()).toBe(false)

    await previews[1]!.trigger('click')
    await wrapper.setProps({ selectedIndex: 1 })
    expect(items[0]!.classes()).not.toContain('vtg-transition-previews__item--selected')
    expect(items[1]!.classes()).toContain('vtg-transition-previews__item--selected')
    expect(wrapper.find('[data-role="vtg-transition-preview-drop-target"]').exists()).toBe(false)

    await previews[1]!.trigger('click')
    expect(wrapper.emitted('selectionChange')).toEqual([[0], [1], [undefined]])
  })

  it('blocks the first insertion target until its thumbnail is selected', async () => {
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation, animation],
        relationships: [relationship, relationship],
        refreshKey: 'drop-rules',
        initialBeatCounts: [1, 1],
        beatCounts: [1, 1],
        scale: 1,
      },
    })
    const items = wrapper.findAll('.vtg-transition-previews__item')
    const dataTransfer = {
      dropEffect: 'copy',
      getData: () => JSON.stringify({ reference: '1-1', speedRatio: '1:3' }),
    }

    await items[0]!.trigger('dragenter')
    expect(items[0]!.classes()).toContain('vtg-transition-previews__item--drop-blocked')
    await items[0]!.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('patternDrop')).toBeUndefined()

    await wrapper.setProps({ selectedIndex: 0 })
    await items[0]!.trigger('dragenter')
    expect(items[0]!.classes()).toContain('vtg-transition-previews__item--drag-over')
    expect(items[0]!.classes()).not.toContain('vtg-transition-previews__item--drop-blocked')
    await items[0]!.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('patternDrop')).toHaveLength(1)

    await items[1]!.trigger('dragenter')
    expect(items[1]!.classes()).toContain('vtg-transition-previews__item--drop-blocked')
    await items[1]!.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('patternDrop')).toHaveLength(1)

    await wrapper.setProps({ selectedIndex: 1 })
    expect(wrapper.find('[data-role="vtg-transition-preview-drop-target"]').exists()).toBe(false)
    await items[0]!.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('patternDrop')).toHaveLength(1)
    await items[1]!.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('patternDrop')).toHaveLength(2)
  })

  it('allows dropping on the first item while Full Grid is enabled', async () => {
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation, animation],
        relationships: [relationship, relationship],
        refreshKey: 'full-grid-drop-rules',
        initialBeatCounts: [1, 1],
        beatCounts: [1, 1],
        scale: 1,
        allowFirstDrop: true,
      },
    })
    const firstItem = wrapper.findAll('.vtg-transition-previews__item')[0]!
    const dataTransfer = {
      dropEffect: 'copy',
      getData: () => JSON.stringify({ reference: '1-1', speedRatio: '1:3' }),
    }

    await firstItem.trigger('dragenter')
    expect(firstItem.classes()).not.toContain('vtg-transition-previews__item--drop-blocked')
    await firstItem.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('patternDrop')).toEqual([
      [{ previewIndex: 0, selection: { reference: '1-1', speedRatio: '1:3' } }],
    ])

    await wrapper.setProps({ selectedIndex: 1 })
    await firstItem.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('patternDrop')).toHaveLength(1)
    await wrapper.findAll('.vtg-transition-previews__item')[1]!.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('patternDrop')).toHaveLength(2)
  })

  it('labels a half-beat thumbnail without changing the supplied animation', () => {
    const shortAnimation = {
      ...animation,
      props: animation.props.map((prop) => ({ ...prop, anim: prop.anim.slice(0, 2) })),
    }
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [shortAnimation],
        relationships: [relationship],
        refreshKey: 'short-label',
        initialBeatCounts: [0.5],
        beatCounts: [0.5],
        scale: 1,
      },
    })

    expect(wrapper.get('.vtg-transition-previews__label').text()).toMatch(
      /^[TSQ][SO] \/ [TSQ][SO]$/,
    )
    expect(shortAnimation.props.every((prop) => prop.anim.length === 2)).toBe(true)
  })

  it('uses the shared touch slider behavior for Builder beat controls', async () => {
    device.touch = true
    useConceptsStore().sliders = true
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation],
        relationships: [relationship],
        refreshKey: 'touch-slider',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
      },
    })
    const slider = wrapper.get<HTMLInputElement>('[data-role="vtg-transition-preview-beats"]')

    await slider.trigger('pointerdown', { pointerId: 7, pointerType: 'touch' })
    slider.element.value = '2'
    await slider.trigger('input')
    await slider.trigger('pointercancel', { pointerId: 7, pointerType: 'touch' })

    expect(wrapper.classes()).toContain('vtg-transition-previews--touch-sliders')
    expect(wrapper.emitted('beatChange')).toEqual([
      [0, 2],
      [0, 1],
    ])
    expect(wrapper.emitted('sliderStart')).toHaveLength(1)
    expect(wrapper.emitted('sliderEnd')).toHaveLength(1)
  })

  it('uses step controls for Builder beats when Sliders is off', async () => {
    useConceptsStore().sliders = false
    const wrapper = mount(VtgTransitionPreviews, {
      props: {
        animations: [animation],
        relationships: [relationship],
        refreshKey: 'beat-stepper',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
      },
    })

    expect(wrapper.find('[data-role="vtg-transition-preview-beats"]').exists()).toBe(false)
    await wrapper.get('[data-role="vtg-transition-preview-beats-0-increase"]').trigger('click')

    expect(wrapper.emitted('beatChange')).toEqual([[0, 1.5]])
    expect(wrapper.emitted('sliderStart')).toHaveLength(1)
    expect(wrapper.emitted('sliderEnd')).toHaveLength(1)
  })

  it('accepts a touch pointer drag without device-level touch detection', async () => {
    const wrapper = mount(VtgTransitionPreviews, {
      attachTo: document.body,
      props: {
        animations: [animation],
        relationships: [relationship],
        refreshKey: 'touch-drop',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
        selectedIndex: 0,
      },
    })
    const target = wrapper.get<HTMLElement>('[data-preview-index="0"]')
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn<() => Element>(() => target.element),
    })
    const selection = { reference: '1-1', speedRatio: '1:1' } as const

    document.dispatchEvent(
      createBuilderPatternPointerEvent(builderPatternPointerMoveEvent, {
        clientX: 10,
        clientY: 10,
        selection,
        preview: { width: 96, height: 72, label: 'TS / TS', imageUrl: 'preview.png' },
      }),
    )
    await nextTick()
    expect(target.classes()).toContain('vtg-transition-previews__item--drag-over')
    const pointerDrag = document.body.querySelector<HTMLElement>(
      '[data-role="vtg-pattern-pointer-drag"]',
    )
    expect(pointerDrag?.parentElement).toBe(document.body)
    expect(pointerDrag?.textContent?.trim()).toBe('TS / TS')
    expect(pointerDrag?.style.inlineSize).toBe('96px')
    expect(pointerDrag?.style.blockSize).toBe('72px')
    expect(pointerDrag?.querySelector('img')?.getAttribute('src')).toBe('preview.png')

    document.dispatchEvent(
      createBuilderPatternPointerEvent(builderPatternPointerDropEvent, {
        clientX: 10,
        clientY: 10,
        selection,
        preview: { width: 96, height: 72, label: 'TS / TS', imageUrl: 'preview.png' },
      }),
    )
    await nextTick()
    expect(wrapper.emitted('patternDrop')).toEqual([[{ previewIndex: 0, selection }]])
    expect(document.body.querySelector('[data-role="vtg-pattern-pointer-drag"]')).toBeNull()

    Reflect.deleteProperty(document, 'elementFromPoint')
    wrapper.unmount()
  })

  it('preserves Elemental icons in the viewport-level touch drag preview', async () => {
    const wrapper = mount(VtgTransitionPreviews, {
      attachTo: document.body,
      props: {
        animations: [animation],
        relationships: [relationship],
        refreshKey: 'elemental-touch-drag',
        initialBeatCounts: [1],
        beatCounts: [1],
        scale: 1,
      },
    })
    const selection = { reference: '1-1', speedRatio: '1:1' } as const
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn<() => Element | null>(() => null),
    })

    document.dispatchEvent(
      createBuilderPatternPointerEvent(builderPatternPointerMoveEvent, {
        clientX: 20,
        clientY: 30,
        selection,
        preview: {
          width: 96,
          height: 72,
          label: 'TS / TO',
          elemental: {
            hands: relationship.hands,
            props: relationship.props,
            handsIndeterminate: relationship.handsIndeterminate,
            propsIndeterminate: relationship.propsIndeterminate,
          },
        },
      }),
    )
    await nextTick()

    const pointerDrag = document.body.querySelector<HTMLElement>(
      '[data-role="vtg-pattern-pointer-drag"]',
    )
    expect(pointerDrag?.querySelectorAll('.elemental-relationship-icons__icon')).toHaveLength(2)
    expect(pointerDrag?.textContent).not.toContain('TS / TO')

    document.dispatchEvent(new Event(builderPatternPointerEndEvent))
    await nextTick()
    Reflect.deleteProperty(document, 'elementFromPoint')
    wrapper.unmount()
  })
})
