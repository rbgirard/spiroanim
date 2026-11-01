import { createPinia, setActivePinia } from 'pinia'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThirdOrderPane from '@/features/third-order/components/ThirdOrderPane.vue'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { useViewportStore } from '@/stores/useViewportStore'
import { MOBILE_TOOLTIP_DISMISS_DELAY } from '@/components/ui/tooltip'
import { createThirdOrderAnimation } from '@/features/third-order/createThirdOrderAnimation'
import { applyPatternInitialArcRotation } from '@/features/concepts/applyPatternFinalTransforms'
import type { ThirdOrderPatternMatch } from '@/features/third-order/types'

describe('ThirdOrderPane', () => {
  it('hydrates matched controls and scrolls without emitting player updates', async () => {
    const match: ThirdOrderPatternMatch = {
      handRatio: '2:5',
      propRatio: '2:11',
      handDirection: 'spin',
      propDirection: 'anti',
      version: 2,
      duplicate: 3,
    }
    const animation = applyPatternInitialArcRotation(
      createThirdOrderAnimation(undefined, { concept: 'to', ...match })!,
      45,
    )
    animation.props[0]!.anim[0]!.scale = 83
    const before = structuredClone(animation)
    const viewport = document.createElement('div')
    viewport.dataset.conceptsPane = ''
    document.body.append(viewport)
    const scrollBy = vi.fn<HTMLElement['scrollBy']>()
    Object.defineProperty(viewport, 'scrollBy', { value: scrollBy, configurable: true })
    const bounds = (top: number, height: number) => ({
      top,
      bottom: top + height,
      left: 0,
      right: 500,
      width: 500,
      height,
      x: 0,
      y: top,
      toJSON: () => ({}),
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.role === 'to-cell' ? bounds(900, 50) : bounds(0, 400)
    })
    const wrapper = mount(ThirdOrderPane, {
      attachTo: viewport,
      props: {
        animation,
        patternMatcher: { matchThirdOrder: async () => ({ status: 'matched', match }) },
      },
    })
    await flushPromises()
    expect(
      wrapper.get('[data-role="to-cell"][aria-pressed="true"]').attributes('data-prop-ratio'),
    ).toBe('2:11')
    expect(
      wrapper.get<HTMLInputElement>('[data-role="to-hand"][value="spin"]').element.checked,
    ).toBe(true)
    expect(
      wrapper.get<HTMLInputElement>('[data-role="to-version"][value="2"]').element.checked,
    ).toBe(true)
    expect(wrapper.get<HTMLSelectElement>('[data-role="to-duplicate"]').element.value).toBe('3')
    expect(scrollBy).toHaveBeenCalledOnce()
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
    expect(wrapper.emitted('customize')).toBeUndefined()
    expect(animation).toEqual(before)
    // A presentation-only update that detects the same identity must not scroll again.
    await wrapper.setProps({ animation: { ...animation, thick: 8 } })
    await flushPromises()
    expect(scrollBy).toHaveBeenCalledOnce()
    wrapper.unmount()
    viewport.remove()
  })

  it('matches real rotated/scaled input and clears an unmatched selection without changing input', async () => {
    const animation = applyPatternInitialArcRotation(
      createThirdOrderAnimation(undefined, {
        concept: 'to',
        handRatio: '1:2',
        propRatio: '1:7',
        handDirection: 'anti',
        propDirection: 'spin',
        version: 2,
      })!,
      45,
    )
    animation.props[1]!.anim[0]!.scale = 140
    const wrapper = mount(ThirdOrderPane, { props: { animation, animationReady: false } })
    await flushPromises()
    expect(wrapper.find('[aria-pressed="true"]').exists()).toBe(false)
    await wrapper.setProps({ animationReady: true })
    await vi.dynamicImportSettled()
    await flushPromises()
    expect(
      wrapper.get('[data-role="to-cell"][aria-pressed="true"]').attributes('data-prop-ratio'),
    ).toBe('1:7')
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
    expect(wrapper.emitted('customize')).toBeUndefined()
    const unsupported = structuredClone(animation)
    unsupported.props[1]!.anim[2]!.warp = 19
    await wrapper.setProps({ animation: unsupported })
    await flushPromises()
    expect(wrapper.find('[aria-pressed="true"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-role="to-duplicate"] option')).toHaveLength(0)
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  enableAutoUnmount((unmount) => {
    afterEach(() => {
      unmount()
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })
  })

  it('labels radio groups accessibly and explains the abbreviations in tooltips', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ThirdOrderPane)
    for (const [group, abbreviation, description] of [
      ['Hand', 'H:', 'Hand: direction of the top-header pattern'],
      ['Prop', 'P:', 'Prop: direction of the left-header pattern'],
      ['Version', 'V:', 'Version: choose between the two pattern variations'],
    ]) {
      const radios = wrapper.get(`[role="radiogroup"][aria-label="${group}"]`)
      expect(radios.findAll('input[type="radio"]')).toHaveLength(2)
      const label = radios.get('span[tabindex="0"]')
      expect(label.text()).toBe(abbreviation)
      await label.trigger('focus')
      await vi.advanceTimersByTimeAsync(0)
      expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(description)
      await label.trigger('blur')
    }
    expect(wrapper.find('select[data-role="to-hand"]').exists()).toBe(false)
  })

  it('describes all six radio controls on hover and keyboard focus', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ThirdOrderPane)
    for (const [role, value, description] of [
      ['hand', 'anti', 'Hand: Anti (top-header pattern)'],
      ['hand', 'spin', 'Hand: Spin (top-header pattern)'],
      ['prop', 'anti', 'Prop: Anti (left-header pattern)'],
      ['prop', 'spin', 'Prop: Spin (left-header pattern)'],
      ['version', '1', 'Version 1: pattern variation 1'],
      ['version', '2', 'Version 2: pattern variation 2'],
    ]) {
      const radio = wrapper.get(`[data-role="to-${role}"][value="${value}"]`)
      expect(radio.attributes('aria-describedby')).toBeTruthy()
      await radio.trigger('focus')
      await vi.advanceTimersByTimeAsync(0)
      expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(description)
      await radio.trigger('blur')
      radio.element.closest('label')!.dispatchEvent(new MouseEvent('mouseenter'))
      await vi.advanceTimersByTimeAsync(0)
      expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(description)
      radio.element.closest('label')!.dispatchEvent(new MouseEvent('mouseleave'))
    }
  })

  it('describes headers and cells on hover/focus and updates with the radios', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ThirdOrderPane)
    const column = wrapper.get('[data-role="to-column-header"][data-ratio="1:2"]')
    const row = wrapper.get('[data-role="to-row-header"][data-ratio="2:5"]')
    const cell = wrapper.get('[data-role="to-cell"][data-hand-ratio="1:2"][data-prop-ratio="2:5"]')
    expect(
      wrapper
        .findAll(
          '[data-role="to-cell"], [data-role="to-column-header"], [data-role="to-row-header"]',
        )
        .every((button) => button.attributes('aria-describedby')),
    ).toBe(true)
    await column.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Hand: 1:2 Anti')
    await row.trigger('focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelectorAll('[role="tooltip"]')).toHaveLength(1)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Prop: 2:5 Anti')
    await row.trigger('blur')
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    await cell.trigger('focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Hand: 1:2 Anti\nProp: 2:5 Anti\nVersion: 1\nDuplicate: 1 / 6',
    )
    expect(document.body.querySelector('[role="tooltip"]')?.id).toBe(
      cell.attributes('aria-describedby'),
    )
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
    await wrapper.get('[data-role="to-hand"][value="spin"]').setValue(true)
    await wrapper.get('[data-role="to-prop"][value="spin"]').setValue(true)
    await wrapper.get('[data-role="to-version"][value="2"]').setValue(true)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Hand: 1:2 Spin\nProp: 2:5 Spin\nVersion: 2\nDuplicate: 1 / 6',
    )
    await column.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Hand: 1:2 Spin')
    await row.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Prop: 2:5 Spin')
    await row.trigger('mouseleave')
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('keeps pattern tooltips available on touch and preserves cell selection on every tap', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(hover: none), (pointer: coarse)',
        media: query,
      })),
    )
    const wrapper = mount(ThirdOrderPane)
    // Like VTG's cells/headers, these use BaseTooltip, not optional general-control help.
    useViewportStore().showTooltips = false
    const cell = wrapper.get('[data-role="to-cell"]')
    const tap = async () => {
      cell.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
      await nextTick()
    }
    await tap()
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
    expect(wrapper.emitted('patternSelect')).toHaveLength(1)
    await tap()
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    expect(wrapper.emitted('patternSelect')).toHaveLength(2)
    await tap()
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
    await vi.advanceTimersByTimeAsync(MOBILE_TOOLTIP_DISMISS_DELAY)
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    await wrapper.get('[data-role="to-column-header"]').trigger('focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull()
    wrapper.unmount()
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('provides 8 hand timings, 17 prop timings, and Customize below 136 selectable cells', async () => {
    const wrapper = mount(ThirdOrderPane)
    expect(
      wrapper.findAll('[data-role="to-column-header"]').map((header) => header.text()),
    ).toEqual(['1:1', '1:2', '2:1', '1:3', '2:3', '1:4', '1:5', '2:5'])
    expect(wrapper.findAll('[data-role="to-row-header"]').map((header) => header.text())).toEqual([
      '1:1',
      '1:2',
      '2:1',
      '1:3',
      '2:3',
      '1:4',
      '1:5',
      '2:5',
      '1:6',
      '1:7',
      '2:7',
      '1:8',
      '1:9',
      '2:9',
      '1:10',
      '1:11',
      '2:11',
    ])
    expect(wrapper.findAll('[data-role="to-cell"]')).toHaveLength(136)
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(0)
    await wrapper.get('[data-role="to-hand"][value="spin"]').setValue(true)
    expect(wrapper.get('[data-role="to-column-header"]').attributes('aria-label')).toBe(
      'Hand 1:1 Spin',
    )
    expect(wrapper.get('[data-role="to-row-header"]').attributes('aria-label')).toBe(
      'Prop 1:1 Anti',
    )
    await wrapper.get('[data-role="to-customize-toggle"]').trigger('click')
    await wrapper.get('[data-role="to-left-color"]').setValue('Red')
    await wrapper.get('[data-role="to-right-color"]').setValue('Blue')
    expect(useConceptsStore().leftPropColor).toBe('Red')
    expect(useConceptsStore().rightPropColor).toBe('Blue')
    expect(wrapper.element.lastElementChild?.getAttribute('data-role')).toBe('to-customize')
    wrapper.unmount()
  })

  it('preserves the opposite coordinate when selecting headers, and randomizes within bounds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const wrapper = mount(ThirdOrderPane)
    await wrapper.get('[data-role="to-column-header"][data-ratio="1:3"]').trigger('click')
    const selected = () => wrapper.get('[data-role="to-cell"][aria-pressed="true"]')
    expect(selected().attributes('data-prop-ratio')).toBe('2:11')
    await wrapper.get('[data-role="to-row-header"][data-ratio="1:7"]').trigger('click')
    expect(selected().attributes('data-hand-ratio')).toBe('1:3')
    expect(selected().attributes('data-prop-ratio')).toBe('1:7')
    await wrapper.get('[data-role="to-column-header"][data-ratio="2:1"]').trigger('click')
    expect(selected().attributes('data-prop-ratio')).toBe('1:7')
    await wrapper
      .get('[data-role="to-cell"][data-hand-ratio="1:1"][data-prop-ratio="1:1"]')
      .trigger('click')
    expect(selected().attributes('data-hand-ratio')).toBe('1:1')
    await wrapper.get('[data-role="to-shuffle"]').trigger('click')
    expect(selected().attributes('data-hand-ratio')).toBe('2:5')
    expect(selected().attributes('data-prop-ratio')).toBe('2:11')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      concept: 'to',
      handRatio: '2:5',
      propRatio: '2:11',
      version: 1,
      handDirection: 'anti',
      propDirection: 'anti',
    })
    expect(wrapper.emitted('animationUpdate')).toBeUndefined()
    wrapper.unmount()
  })

  it('reapplies versions, all direction combinations, and Customize changes', async () => {
    const wrapper = mount(ThirdOrderPane)
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    await wrapper.get('[data-role="to-version"][value="2"]').setValue(true)
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({ version: 2 })
    await wrapper.get('[data-role="to-customize-toggle"]').trigger('click')
    await wrapper.get('[data-role="to-left-color"]').setValue('Red')
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({
      propColors: ['Red', 'Green'],
    })
    expect(wrapper.find('[data-role="to-scale"]').exists()).toBe(false)
    await wrapper.get('[data-role="to-prop"][value="spin"]').setValue(true)
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    await wrapper.get('[data-role="to-version"][value="1"]').setValue(true)
    await wrapper.get('[data-role="to-left-color"]').setValue('Blue')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      handDirection: 'anti',
      propDirection: 'spin',
      version: 1,
    })
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({
      propColors: ['Blue', 'Green'],
    })
    await wrapper.get('[data-role="to-hand"][value="spin"]').setValue(true)
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      handDirection: 'spin',
      propDirection: 'spin',
    })
    expect(
      wrapper.findAll('[data-role="to-version"]').map((option) => option.attributes('value')),
    ).toEqual(['1', '2'])
    await wrapper.get('[data-role="to-prop"][value="anti"]').setValue(true)
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      version: 1,
      handDirection: 'spin',
      propDirection: 'anti',
      propColors: ['Blue', 'Green'],
    })
    wrapper.unmount()
  })

  it('cycles duplicates, wraps, resets on pattern changes, and preserves Customize selection', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ThirdOrderPane)
    const dropdown = wrapper.get<HTMLSelectElement>('[data-role="to-duplicate"]')
    expect(dropdown.element.disabled).toBe(true)
    expect(dropdown.findAll('option')).toHaveLength(0)
    const cell = wrapper.get('[data-role="to-cell"]')
    await cell.trigger('click')
    expect(dropdown.element.disabled).toBe(false)
    expect(dropdown.findAll('option').map((option) => option.text())).toEqual(['1', '2', '3', '4'])
    const last = () => wrapper.emitted('patternSelect')?.at(-1)?.[0]
    expect(last()).toMatchObject({ duplicate: 1 })
    for (let duplicate = 2; duplicate <= 4; duplicate++) {
      await cell.trigger('click')
      expect(dropdown.element.value).toBe(String(duplicate))
      expect(last()).toMatchObject({ duplicate })
    }
    await cell.trigger('click')
    expect(last()).toMatchObject({ duplicate: 1 })
    await dropdown.setValue('3')
    expect(last()).toMatchObject({ duplicate: 3 })
    await cell.trigger('focus')
    await vi.advanceTimersByTimeAsync(0)
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain(
      'Duplicate: 3 / 4',
    )
    const before = wrapper.emitted('patternSelect')!.length
    useConceptsStore().leftPropColor = 'Red'
    await nextTick()
    expect(wrapper.emitted('patternSelect')).toHaveLength(before)
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({ duplicate: 3 })
    await wrapper.get('[data-role="to-version"][value="2"]').setValue(true)
    expect(last()).toMatchObject({ version: 2, duplicate: 1 })
    expect(wrapper.emitted('patternSelect')).toHaveLength(before + 1)
    expect(dropdown.findAll('option')).toHaveLength(8)
    for (const target of [
      '[data-role="to-hand"][value="spin"]',
      '[data-role="to-prop"][value="spin"]',
      '[data-role="to-column-header"]',
      '[data-role="to-row-header"]',
      '[data-role="to-shuffle"]',
    ]) {
      await dropdown.setValue('2')
      const control = wrapper.get(target)
      if (control.element.tagName === 'INPUT') await control.setValue(true)
      else await control.trigger('click')
      expect(last()).toMatchObject({ duplicate: 1 })
    }
    await dropdown.setValue('2')
    await wrapper.findAll('[data-role="to-cell"]')[1]!.trigger('click')
    expect(last()).toMatchObject({ handRatio: '1:2', propRatio: '1:1', duplicate: 1 })
  })

  it('does not replace the player until its animation is ready', async () => {
    const wrapper = mount(ThirdOrderPane, { props: { animationReady: false } })
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
    await wrapper.setProps({ animationReady: true })
    await wrapper.get('[data-role="to-cell"]').trigger('click')
    expect(wrapper.emitted('patternSelect')).toHaveLength(1)
    wrapper.unmount()
  })
})
