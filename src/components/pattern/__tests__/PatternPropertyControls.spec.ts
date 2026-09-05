import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import PatternPropertyControls from '@/components/pattern/PatternPropertyControls.vue'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'

describe('PatternPropertyControls', () => {
  it('identifies its host context and starts with every tab collapsed', () => {
    const wrapper = mount(PatternPropertyControls, { props: { context: 'vtg' } })
    const properties = wrapper.get<HTMLElement>('[data-role="vtg-properties"]')

    expect(properties.attributes('data-context')).toBe('vtg')
    expect(properties.element.tagName).toBe('SECTION')
    expect(wrapper.find('[data-role="vtg-properties-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-properties-collapse"]').exists()).toBe(false)
    expect(wrapper.find('[role="tabpanel"]:not([style*="display: none"])').exists()).toBe(false)
  })

  it('shows only the selected property controls and allows them to collapse', async () => {
    const wrapper = mount(PatternPropertyControls, { props: { context: 'vtg' } })
    const offset = wrapper.get('[data-role="vtg-property-offset-toggle"]')
    const axis = wrapper.get('[data-role="vtg-property-axis-toggle"]')
    const twist = wrapper.get('[data-role="vtg-property-twist-toggle"]')
    const thirdOrder = wrapper.get('[data-role="vtg-property-third-order-toggle"]')
    const turns = wrapper.find('[data-role="vtg-property-turns-toggle"]')

    expect([offset.text(), axis.text(), twist.text(), thirdOrder.text()]).toEqual([
      'Offset',
      'Rotate',
      'Twist',
      'Third Order',
    ])
    expect(wrapper.findAll('[role="tab"]').at(-1)?.text()).toBe('Third Order')
    expect(turns.exists()).toBe(false)
    expect(offset.attributes('aria-selected')).toBe('false')
    expect(axis.attributes('aria-expanded')).toBe('false')

    await offset.trigger('click')
    expect(wrapper.emitted('update:activeProperty')?.at(-1)).toEqual(['offset'])
    await wrapper.setProps({ activeProperty: 'offset' })
    expect(offset.attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-role="vtg-property-offset-controls"]').text()).toBe('LeftRight')
    const collapse = wrapper.get('[data-role="vtg-properties-collapse"]')
    expect(collapse.text()).toBe('-')

    await collapse.trigger('click')
    expect(wrapper.emitted('update:activeProperty')?.at(-1)).toEqual([null])
    await wrapper.setProps({ activeProperty: null })
    expect(wrapper.find('[data-role="vtg-properties-collapse"]').exists()).toBe(false)

    expect(offset.attributes('aria-selected')).toBe('false')

    await axis.trigger('click')
    expect(wrapper.emitted('update:activeProperty')?.at(-1)).toEqual(['axis'])
    await wrapper.setProps({ activeProperty: 'axis' })
    expect(axis.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-role="vtg-property-axis-controls"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-role="vtg-property-axis-controls"]').text()).toContain('BeatValue')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Mirror folds"]').element.checked).toBe(
      true,
    )

    await wrapper.get('[role="tablist"]').trigger('click')
    expect(wrapper.emitted('update:activeProperty')?.at(-1)).toEqual([null])
    await wrapper.setProps({ activeProperty: null })
    await axis.trigger('click')
    await wrapper.setProps({ activeProperty: 'axis' })

    await twist.trigger('click')
    expect(wrapper.emitted('update:activeProperty')?.at(-1)).toEqual(['twist'])
    await wrapper.setProps({ activeProperty: 'twist' })
    expect(axis.attributes('aria-expanded')).toBe('false')
    expect(twist.attributes('aria-expanded')).toBe('true')
    expect(
      wrapper.get<HTMLElement>('[data-role="vtg-property-axis-controls"]').element.style.display,
    ).toBe('none')
    expect(wrapper.get('[data-role="vtg-property-twist-controls"]').isVisible()).toBe(true)

    await twist.trigger('click')
    expect(wrapper.emitted('update:activeProperty')?.at(-1)).toEqual([null])
    await wrapper.setProps({ activeProperty: null })
    expect(twist.attributes('aria-expanded')).toBe('false')
    expect(
      wrapper.get<HTMLElement>('[data-role="vtg-property-twist-controls"]').element.style.display,
    ).toBe('none')
  })

  it('edits and clears independent prop offsets with constrained sliders and validated text', async () => {
    const wrapper = mount(PatternPropertyControls, {
      props: { context: 'vtg', activeProperty: 'offset', offsetValues: [90, 0] },
    })
    const leftSlider = wrapper.get<HTMLInputElement>('[data-role="vtg-offset-0"]')
    const rightSlider = wrapper.get<HTMLInputElement>('[data-role="vtg-offset-1"]')
    const leftInput = wrapper.get<HTMLInputElement>('[data-role="vtg-offset-0-input"]')
    const rightInput = wrapper.get<HTMLInputElement>('[data-role="vtg-offset-1-input"]')
    const leftDelete = wrapper.get<HTMLButtonElement>('button[aria-label="Clear Left offset"]')
    const rightDelete = wrapper.get<HTMLButtonElement>('button[aria-label="Clear Right offset"]')

    expect(
      wrapper
        .findAll('.pattern-property-controls__offset-heading')
        .map((heading) => heading.text()),
    ).toEqual(['Left', 'Right'])
    expect(wrapper.findAll('[data-role="vtg-property-offset-controls"] fieldset')).toHaveLength(0)
    expect(leftSlider.attributes()).toMatchObject({ min: '-90', max: '90', step: '90' })
    expect(leftSlider.attributes('aria-valuetext')).toBe('90°')
    expect(rightSlider.attributes('aria-valuetext')).toBe('0°')
    expect(leftInput.attributes()).toMatchObject({ type: 'text', inputmode: 'numeric' })
    expect(leftInput.element.value).toBe('90')
    expect(rightInput.element.value).toBe('0')
    expect(leftDelete.element.disabled).toBe(false)
    expect(rightDelete.element.disabled).toBe(true)
    expect(leftDelete.element.parentElement?.classList).toContain(
      'pattern-property-controls__offset-controls--set',
    )

    leftSlider.element.value = '-90'
    await leftSlider.trigger('input')
    rightSlider.element.value = '90'
    await rightSlider.trigger('input')
    expect(wrapper.emitted('offsetUpdate')?.slice(-2)).toEqual([
      [0, -90],
      [1, 90],
    ])
    leftSlider.element.value = '0'
    await leftSlider.trigger('input')
    expect(wrapper.emitted('offsetUpdate')?.at(-1)).toEqual([0, 0])
    await wrapper.setProps({ offsetValues: [0, 0] })
    expect(leftDelete.element.disabled).toBe(true)

    await leftInput.trigger('focus')
    await leftInput.setValue('45')
    expect(wrapper.emitted('offsetUpdate')?.at(-1)).toEqual([0, 45])
    await wrapper.setProps({ offsetValues: [45, 0] })

    const validUpdateCount = wrapper.emitted('offsetUpdate')?.length
    await leftInput.setValue('12.5')
    await leftInput.setValue('181')
    await leftInput.setValue('anything')
    expect(wrapper.emitted('offsetUpdate')).toHaveLength(validUpdateCount ?? 0)
    expect(leftInput.element.value).toBe('anything')
    await leftInput.trigger('blur')
    expect(leftInput.element.value).toBe('45')

    await leftDelete.trigger('click')
    expect(wrapper.emitted('offsetUpdate')?.at(-1)).toEqual([0])
  })

  it('adds descriptive tooltips to Folds and Twist', () => {
    const wrapper = mount(PatternPropertyControls, { props: { context: 'vtg' } })

    expect(
      wrapper.get('[data-role="vtg-property-axis-toggle"]').attributes('aria-describedby'),
    ).toBeTruthy()
    expect(
      wrapper.get('[data-role="vtg-property-twist-toggle"]').attributes('aria-describedby'),
    ).toBeTruthy()
  })

  it('shows prop compatibility notes at the top of Rotate and Twist', async () => {
    const wrapper = mount(PatternPropertyControls, {
      props: { context: 'vtg', activeProperty: 'axis' },
    })

    expect(wrapper.get('[data-role="vtg-property-axis-note"]').text()).toBe(
      'For Static Props, allowing off-axis turns',
    )
    await wrapper.setProps({ activeProperty: 'twist' })
    expect(wrapper.get('[data-role="vtg-property-twist-note"]').text()).toBe(
      'For Roll-Sensitive Props, like Fans and Triads',
    )
  })

  it('instantly reveals an opened Folds or Twist header above the scroll viewport', async () => {
    const scrollParent = document.createElement('div')
    scrollParent.style.overflowY = 'auto'
    scrollParent.scrollTop = 100
    document.body.appendChild(scrollParent)
    const scrollTo = vi.fn<(options: ScrollToOptions) => void>()
    function mockScrollTo(options?: ScrollToOptions): void
    function mockScrollTo(x: number, y: number): void
    function mockScrollTo(optionsOrX?: ScrollToOptions | number, _y?: number) {
      if (typeof optionsOrX === 'object') scrollTo(optionsOrX)
    }
    scrollParent.scrollTo = mockScrollTo
    scrollParent.getBoundingClientRect = () =>
      ({ top: 20, bottom: 220, left: 0, right: 200, width: 200, height: 200 }) as DOMRect

    const wrapper = mount(PatternPropertyControls, {
      attachTo: scrollParent,
      props: { context: 'vtg' },
    })
    const folds = wrapper.get<HTMLElement>('[data-role="vtg-property-axis-toggle"]')
    folds.element.getBoundingClientRect = () =>
      ({ top: -30, bottom: 0, left: 0, right: 200, width: 200, height: 30 }) as DOMRect

    await wrapper.setProps({ activeProperty: 'axis' })
    await nextTick()

    expect(scrollTo).toHaveBeenCalledWith({ top: 50, behavior: 'auto' })
    wrapper.unmount()
    scrollParent.remove()
  })

  it('supports the future Builder context without VTG-specific selectors', () => {
    const wrapper = mount(PatternPropertyControls, { props: { context: 'builder' } })

    expect(wrapper.find('[data-role="vtg-properties"]').exists()).toBe(false)
    expect(wrapper.get('[data-role="builder-properties"]').attributes('data-context')).toBe(
      'builder',
    )
    expect(
      wrapper
        .findAll('[role="tab"]')
        .map((tab) => tab.text())
        .slice(0, 3),
    ).toEqual(['Offset', 'Scale', 'Rotate'])
    expect(wrapper.get('[data-role="builder-property-axis-toggle"]').text()).toBe('Rotate')
    expect(wrapper.get('[data-role="builder-property-axis-note"]').text()).toBe(
      'For Static Props, allowing off-axis turns',
    )
    expect(wrapper.find('[data-role="builder-property-turns-toggle"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="tab"]').at(-1)?.text()).toBe('Third Order')
  })

  it('offers authored and inherited Third Order controls for Left and Right', async () => {
    const wrapper = mount(PatternPropertyControls, {
      props: {
        context: 'vtg',
        activeProperty: 'third-order',
        thirdOrderMirror: false,
        thirdOrderSettings: [
          { initial: 45, strength: 55, timing: '1:1-pro' },
          { initial: '1:3-anti' },
        ],
        thirdOrderDisplaySettings: {
          initial: [45, '1:3-anti'],
          strength: [55, 80],
          timing: ['1:1-pro', '1:3-anti'],
        },
      },
    })

    expect(wrapper.get('[data-role="vtg-property-third-order-note"]').text()).toBe(
      'Hand path manipulations',
    )
    expect(
      wrapper
        .findAll('.pattern-property-controls__third-order-column > h3')
        .map((heading) => heading.text()),
    ).toEqual(['Left', 'Right'])
    expect(
      wrapper
        .get('[aria-label="Left Third Order"]')
        .findAll('.pattern-property-controls__third-order-row > span')
        .map((label) => label.text()),
    ).toEqual(['Ratio', 'Strength', 'Adjust'])

    const leftTiming = wrapper.get<HTMLSelectElement>('[data-role="vtg-third-order-timing-0"]')
    expect(leftTiming.findAll('option').map((option) => option.text())).toEqual([
      'Undefined',
      '1:1 Anti',
      '1:1 Pro',
      '2:1 Anti',
      '2:1 Pro',
      '1:2 Anti',
      '1:2 Pro',
      '1:3 Anti',
      '1:3 Pro',
      '2:3 Anti',
      '2:3 Pro',
      '1:4 Anti',
      '1:4 Pro',
      '1:5 Anti',
      '1:5 Pro',
      '2:5 Anti',
      '2:5 Pro',
    ])
    expect(leftTiming.element.value).toBe('1:1-pro')
    await leftTiming.setValue('1:2-pro')
    expect(wrapper.emitted('thirdOrderTimingUpdate')?.at(-1)).toEqual([0, '1:2-pro'])

    const leftStrength = wrapper.get<HTMLInputElement>('[data-role="vtg-third-order-strength-0"]')
    expect(leftStrength.attributes()).toMatchObject({ min: '0', max: '100', step: '5' })
    expect(leftStrength.attributes('aria-valuetext')).toBe('55%')
    leftStrength.element.value = '0'
    await leftStrength.trigger('input')
    expect(wrapper.emitted('thirdOrderStrengthUpdate')?.at(-1)).toEqual([0, 0])

    const leftAdjust = wrapper.get<HTMLInputElement>('[data-role="vtg-third-order-initial-0"]')
    expect(leftAdjust.attributes()).toMatchObject({
      type: 'range',
      min: '0',
      max: '360',
      step: '5',
    })
    expect(leftAdjust.element.disabled).toBe(false)
    expect(leftAdjust.attributes('aria-valuetext')).toBe('45°')
    leftAdjust.element.value = '90'
    await leftAdjust.trigger('input')
    expect(wrapper.emitted('thirdOrderInitialUpdate')?.at(-1)).toEqual([0, 90])

    const rightAdjust = wrapper.get<HTMLInputElement>('[data-role="vtg-third-order-initial-1"]')
    expect(rightAdjust.element.disabled).toBe(true)
    expect(rightAdjust.attributes('aria-valuetext')).toBe('0°')

    const leftTimingClear = wrapper.get<HTMLButtonElement>(
      'button[aria-label="Clear Left Third Order Ratio"]',
    )
    const rightAdjustClear = wrapper.get<HTMLButtonElement>(
      'button[aria-label="Clear Right Third Order Adjust"]',
    )
    const rightStrengthClear = wrapper.get<HTMLButtonElement>(
      'button[aria-label="Clear Right Third Order Strength"]',
    )
    expect(leftTimingClear.element.disabled).toBe(false)
    expect(rightAdjustClear.element.disabled).toBe(false)
    expect(rightStrengthClear.element.disabled).toBe(true)
    await leftTimingClear.trigger('click')
    expect(wrapper.emitted('thirdOrderTimingUpdate')?.at(-1)).toEqual([0, undefined])
    await rightAdjustClear.trigger('click')
    expect(wrapper.emitted('thirdOrderInitialUpdate')?.at(-1)).toEqual([1, undefined])
  })

  it('defaults Third Order to mirrored and gates the Opposed option', async () => {
    const wrapper = mount(PatternPropertyControls, {
      props: { context: 'vtg', activeProperty: 'third-order' },
    })
    const mirror = wrapper.get<HTMLInputElement>('input[aria-label="Mirror Third Order"]')
    const opposed = wrapper.get<HTMLInputElement>('input[aria-label="Opposed Third Order"]')

    expect(mirror.element.checked).toBe(true)
    expect(opposed.element.checked).toBe(false)
    expect(opposed.element.disabled).toBe(false)
    expect(wrapper.get('[aria-label="Left Third Order"]').isVisible()).toBe(true)
    expect(wrapper.find('[aria-label="Right Third Order"]').exists()).toBe(false)

    await opposed.setValue(true)
    expect(wrapper.emitted('update:thirdOrderOpposed')?.at(-1)).toEqual([true])
    await wrapper.setProps({ thirdOrderOpposed: true })
    expect(opposed.element.checked).toBe(true)

    await mirror.setValue(false)
    expect(wrapper.emitted('update:thirdOrderMirror')?.at(-1)).toEqual([false])
    await wrapper.setProps({ thirdOrderMirror: false, thirdOrderOpposed: false })
    expect(opposed.element.disabled).toBe(true)
    expect(wrapper.get('[aria-label="Right Third Order"]').isVisible()).toBe(true)
  })

  it('hides Adjust for later Builder portions and includes Third Order in Eight Step properties', () => {
    const builder = mount(PatternPropertyControls, {
      props: { context: 'builder', activeProperty: 'third-order', firstEditableFrameIndex: 1 },
    })
    const eightStep = mount(PatternPropertyControls, { props: { context: 'eight-step' } })

    expect(builder.find('[data-role="builder-third-order-initial-0"]').exists()).toBe(false)
    expect(builder.find('[data-role="builder-third-order-strength-0"]').exists()).toBe(true)
    expect(builder.find('[data-role="builder-third-order-timing-0"]').exists()).toBe(true)
    expect(eightStep.find('[data-role="eight-step-property-third-order-toggle"]').exists()).toBe(
      true,
    )
  })

  it('offers independent Builder-only Scale values from 0 through 1.4', async () => {
    const builder = mount(PatternPropertyControls, {
      props: {
        context: 'builder',
        activeProperty: 'scale',
        scaleValues: [{}, { 0: 1.2 }],
        scaleDisplayValues: [{ 0: 0.8 }, { 0: 1.2 }],
      },
    })
    const vtg = mount(PatternPropertyControls, { props: { context: 'vtg' } })
    const left = builder.get<HTMLInputElement>('[data-role="builder-scale-0"]')
    const right = builder.get<HTMLInputElement>('[data-role="builder-scale-1"]')
    const leftDelete = builder.get<HTMLButtonElement>('button[aria-label="Clear Left Scale"]')
    const rightDelete = builder.get<HTMLButtonElement>('button[aria-label="Clear Right Scale"]')

    expect(vtg.find('[data-role="vtg-property-scale-toggle"]').exists()).toBe(false)
    expect(builder.get<HTMLInputElement>('input[value="simple"]').element.checked).toBe(true)
    expect(builder.get('[aria-label="Left Scale"] header').text()).toBe('BeatLeftValue')
    expect(builder.get('[aria-label="Left Scale"] .pattern-property-controls__beat').text()).toBe(
      '0',
    )
    expect(left.attributes()).toMatchObject({ min: '0', max: '1.4', step: '0.1' })
    expect(left.attributes('aria-valuetext')).toBe('0.8')
    expect(right.attributes('aria-valuetext')).toBe('1.2')
    expect(leftDelete.element.disabled).toBe(true)
    expect(rightDelete.element.disabled).toBe(false)

    left.element.value = '0'
    await left.trigger('input')
    expect(builder.emitted('scaleUpdate')?.at(-1)).toEqual([0, 0, 0])
    await rightDelete.trigger('click')
    expect(builder.emitted('scaleUpdate')?.at(-1)).toEqual([1, 0])
  })

  it('offers inherited per-frame Scale values in Advanced mode', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: {
        context: 'builder',
        animation,
        activeProperty: 'scale',
        scaleMode: 'advanced',
        scaleValues: [{ 0.5: 0.8 }, {}],
        scaleDisplayValues: [{ 0.5: 0.8, 1: 1.2 }, { 0.5: 1.1 }],
        firstEditableFrameIndex: 1,
      },
    })

    expect(wrapper.get<HTMLInputElement>('input[value="advanced"]').element.checked).toBe(true)
    expect(wrapper.find('[data-role="builder-scale-0-0"]').exists()).toBe(false)
    const leftFirst = wrapper.get<HTMLInputElement>('[data-role="builder-scale-0-1"]')
    const leftSecond = wrapper.get<HTMLInputElement>('[data-role="builder-scale-0-2"]')
    expect(leftFirst.attributes('aria-valuetext')).toBe('0.8')
    expect(leftSecond.attributes('aria-valuetext')).toBe('1.2')
    expect(leftFirst.element.closest('label')?.classList).toContain(
      'pattern-property-controls__value-set',
    )
    expect(leftSecond.element.closest('label')?.classList).not.toContain(
      'pattern-property-controls__value-set',
    )

    leftSecond.element.value = '1.4'
    await leftSecond.trigger('input')
    expect(wrapper.emitted('scaleUpdate')?.at(-1)).toEqual([0, 1, 1.4])
    await wrapper.get('button[aria-label="Clear Left Scale at beat 0.5"]').trigger('click')
    expect(wrapper.emitted('scaleUpdate')?.at(-1)).toEqual([0, 0.5])

    await wrapper.get<HTMLInputElement>('input[value="simple"]').trigger('change')
    expect(wrapper.emitted('update:scaleMode')?.at(-1)).toEqual(['simple'])
  })

  it('treats a later Builder portion first frame as context and allows explicit zero Twist', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:1' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: {
        context: 'builder',
        animation,
        showOffset: false,
        activeProperty: 'twist',
        twistMode: 'advanced',
        twistValues: [{}, {}],
        twistDisplayValues: [{ 0.5: 90 }, {}],
        firstEditableFrameIndex: 1,
        allowTwistZero: true,
      },
    })

    expect(wrapper.find('[data-role="builder-property-offset-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="builder-twist-0-0"]').exists()).toBe(false)
    const firstOwned = wrapper.get<HTMLInputElement>('[data-role="builder-twist-0-1"]')
    expect(firstOwned.attributes()).toMatchObject({ max: '16', 'aria-valuetext': '90°' })
    expect(firstOwned.element.closest('label')?.classList).not.toContain(
      'pattern-property-controls__value-set',
    )
    expect(wrapper.find('[data-role="builder-twist-0-8"]').exists()).toBe(true)

    await firstOwned.trigger('pointerdown')
    firstOwned.element.value = '8'
    await firstOwned.trigger('input')
    await firstOwned.trigger('pointerup')
    expect(wrapper.emitted('twistUpdate')?.at(-1)).toEqual([0, 0.5, 0])
    expect(wrapper.emitted('sliderStart')).toHaveLength(1)
    expect(wrapper.emitted('sliderEnd')).toHaveLength(1)
  })

  it.each(['vtg', 'builder'] as const)(
    'shows Turns in %s only when future 0:0 host logic explicitly enables it',
    (context) => {
      const wrapper = mount(PatternPropertyControls, {
        props: { context, showTurns: true },
      })

      expect(wrapper.get(`[data-role="${context}-property-turns-toggle"]`).text()).toBe('Turns')
    },
  )

  it('edits and clears per-beat Twist values independently for Left and Right', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:1' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: {
        context: 'vtg',
        animation,
        twistMode: 'advanced',
        twistValues: [{ 0: 45 }, {}],
      },
    })
    await wrapper.get('[data-role="vtg-property-twist-toggle"]').trigger('click')

    const leftFirst = wrapper.get<HTMLInputElement>('[data-role="vtg-twist-0-0"]')
    const rightFirst = wrapper.get<HTMLInputElement>('[data-role="vtg-twist-1-0"]')
    expect(leftFirst.attributes()).toMatchObject({ min: '0', max: '15', step: '1' })
    expect(leftFirst.attributes('aria-valuetext')).toBe('45°')
    expect(rightFirst.attributes('aria-valuetext')).toBe('0°')
    expect(leftFirst.element.closest('label')?.classList).toContain(
      'pattern-property-controls__value-set',
    )
    expect(rightFirst.element.closest('label')?.classList).not.toContain(
      'pattern-property-controls__value-set',
    )
    expect(rightFirst.element.closest('label')?.textContent).toContain('0°')
    expect(rightFirst.element.closest('label')?.textContent).not.toContain('Inherited')
    expect(wrapper.get('[aria-label="Left Twist"] header').text()).toBe('BeatLeftValue')
    expect(wrapper.get('[aria-label="Right Twist"] header').text()).toBe('BeatRightValue')

    rightFirst.element.value = '9'
    await rightFirst.trigger('input')
    expect(wrapper.emitted('twistUpdate')?.at(-1)).toEqual([1, 0, 90])

    const leftDelete = wrapper.get<HTMLButtonElement>(
      'button[aria-label="Clear Left Twist at beat 0"]',
    )
    const rightDelete = wrapper.get<HTMLButtonElement>(
      'button[aria-label="Clear Right Twist at beat 0"]',
    )
    expect(leftDelete.element.disabled).toBe(false)
    expect(rightDelete.element.disabled).toBe(true)
    await leftDelete.trigger('click')
    expect(wrapper.emitted('twistUpdate')?.at(-1)).toEqual([0, 0])
  })

  it('offers nonzero 45-degree Twist values while keeping Rotate at 90 degrees', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:1' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: { context: 'vtg', animation, twistMode: 'advanced', foldMode: 'advanced' },
    })

    const twist = wrapper.get<HTMLInputElement>('[data-role="vtg-twist-0-0"]')
    twist.element.value = '7'
    await twist.trigger('input')
    expect(wrapper.emitted('twistUpdate')?.at(-1)).toEqual([0, 0, -45])
    twist.element.value = '8'
    await twist.trigger('input')
    expect(wrapper.emitted('twistUpdate')?.at(-1)).toEqual([0, 0, 45])

    const direct = wrapper.get<HTMLInputElement>('input[aria-label="Left Direct at beat 0"]')
    expect(direct.attributes()).toMatchObject({ min: '0', max: '1', step: '1' })
    direct.element.value = '0'
    await direct.trigger('input')
    expect(wrapper.emitted('foldUpdate')?.at(-1)).toEqual([0, 0, 'yaw', -90])
    direct.element.value = '1'
    await direct.trigger('input')
    expect(wrapper.emitted('foldUpdate')?.at(-1)).toEqual([0, 0, 'yaw', 90])
  })

  it('defaults to Simple and renders only beat 0.5 without discarding controlled values', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '2:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: { context: 'vtg', animation, twistValues: [{ 0.5: 45, 2.5: 90 }, {}] },
    })

    expect(wrapper.get<HTMLInputElement>('input[value="simple"]').element.checked).toBe(true)
    expect(wrapper.findAll('[data-role^="vtg-twist-"]')).toHaveLength(2)
    expect(
      wrapper.get<HTMLInputElement>('[data-role="vtg-twist-0-1"]').attributes('aria-valuetext'),
    ).toBe('45°')
    expect(wrapper.get('[data-role="vtg-property-twist-controls"]').text()).not.toContain('2.5')

    await wrapper.get('input[value="advanced"]').trigger('change')
    expect(wrapper.emitted('update:twistMode')?.at(-1)).toEqual(['advanced'])
  })

  it('groups Direct and Rotate under one shared beat in each Folds column', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:1' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: {
        context: 'vtg',
        animation,
        foldValues: [{ 0: { yaw: 45, rotate: 90 } }, {}],
        foldMode: 'advanced',
      },
    })
    await wrapper.get('[data-role="vtg-property-axis-toggle"]').trigger('click')

    const firstFrame = wrapper.get(
      '[aria-label="Left Folds"] .pattern-property-controls__fold-frame',
    )
    expect(firstFrame.findAll('.pattern-property-controls__beat')).toHaveLength(1)
    expect(firstFrame.findAll('input[type="range"]')).toHaveLength(2)
    expect(firstFrame.findAll('.pattern-property-controls__value-set')).toHaveLength(2)
    expect(firstFrame.text()).toContain('Direct45°')
    expect(firstFrame.text()).toContain('Rotate90°')
  })

  it('shows 90 degrees as the unset Direct default', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:1' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: { context: 'vtg', animation, foldMode: 'advanced' },
    })

    expect(
      wrapper
        .get<HTMLInputElement>('input[aria-label="Left Direct at beat 0"]')
        .attributes('aria-valuetext'),
    ).toBe('90°')
    expect(
      wrapper.get('button[aria-label="Clear Left Direct at beat 0"]').attributes(),
    ).toHaveProperty('disabled')
  })

  it('shows the preceding Direct value when an Advanced beat is unset', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:1' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: {
        context: 'vtg',
        animation,
        foldMode: 'advanced',
        foldValues: [{ 0: { yaw: -90 } }, {}],
      },
    })

    expect(
      wrapper
        .get<HTMLInputElement>('input[aria-label="Left Direct at beat 0.5"]')
        .attributes('aria-valuetext'),
    ).toBe('-90°')
    expect(
      wrapper.get<HTMLButtonElement>('button[aria-label="Clear Left Direct at beat 0.5"]').element
        .disabled,
    ).toBe(true)
  })

  it('shows the authored Simple Rotate value for a materialized Quarter transition', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:1' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: {
        context: 'vtg',
        animation,
        foldBeat: [2, 2],
        foldValues: [{ 2: { rotate: 90 } }, {}],
        foldValuesMaterialized: true,
        foldSpan: 'quarter',
      },
    })

    expect(
      wrapper
        .get<HTMLInputElement>('input[aria-label="Left Rotate at beat 2"]')
        .attributes('aria-valuetext'),
    ).toBe('180°')
  })

  it('uses steppers for Offset, Twist, and Folds when Customize Sliders is disabled', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:1' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(PatternPropertyControls, {
      props: {
        context: 'vtg',
        animation,
        offsetValues: [90, -90],
        sliders: false,
        twistMode: 'advanced',
        foldMode: 'advanced',
      },
      global: { plugins: [pinia] },
    })

    expect(wrapper.findAll('input[type="range"]')).toHaveLength(2)
    wrapper.get('[data-role="vtg-third-order-strength-0"]')
    expect(
      wrapper.get<HTMLInputElement>('[data-role="vtg-third-order-initial-0"]').element.disabled,
    ).toBe(true)
    wrapper.get('[data-role="vtg-offset-0-stepper"]')
    wrapper.get('[data-role="vtg-offset-1-stepper"]')
    wrapper.get('[data-role="vtg-yaw-0-0-stepper"]')
    wrapper.get('[data-role="vtg-rotate-0-0-stepper"]')
    wrapper.get('[data-role="vtg-twist-0-0-stepper"]')

    await wrapper.get('[data-role="vtg-offset-0-stepper-decrease"]').trigger('click')
    expect(wrapper.emitted('offsetUpdate')?.at(-1)).toEqual([0, 0])
    await wrapper.get('[data-role="vtg-offset-1-stepper-increase"]').trigger('click')
    expect(wrapper.emitted('offsetUpdate')?.at(-1)).toEqual([1, 0])
    await wrapper.get('[data-role="vtg-yaw-0-0-stepper-decrease"]').trigger('click')
    expect(wrapper.emitted('foldUpdate')?.at(-1)).toEqual([0, 0, 'yaw', -90])
    await wrapper.get('[data-role="vtg-twist-0-0-stepper-decrease"]').trigger('click')
    expect(wrapper.emitted('twistUpdate')?.at(-1)).toEqual([0, 0, -45])
  })

  it('offers styled Simple fold repetition and span controls', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '2:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: { context: 'vtg', animation, foldMirror: false },
    })

    expect(
      wrapper.get<HTMLInputElement>('input[name$="-fold-mode"]:checked').element.nextElementSibling
        ?.textContent,
    ).toBe('Simple')
    expect(
      wrapper.get<HTMLInputElement>('input[name$="-fold-span"]:checked').element.nextElementSibling
        ?.textContent,
    ).toBe('Eighth')
    expect(
      wrapper.get<HTMLSelectElement>('select[aria-label="Left folds start"]').element.value,
    ).toBe('2')
    expect(
      wrapper.get<HTMLSelectElement>('select[aria-label="Right folds start"]').element.value,
    ).toBe('2')
    expect(
      wrapper.get<HTMLSelectElement>('select[aria-label="Left repeat folds every"]').element.value,
    ).toBe('2')
    expect(
      wrapper.get<HTMLSelectElement>('select[aria-label="Right repeat folds every"]').element.value,
    ).toBe('2')
    expect(wrapper.get('input[type="checkbox"] + span').classes()).not.toContain('native')
    expect(wrapper.findAll('input[aria-label^="Apply "]')).toHaveLength(0)
    expect(
      wrapper.findAll('[aria-label="Left Folds"] .pattern-property-controls__fold-frame'),
    ).toHaveLength(1)

    await wrapper.setProps({ foldSpan: 'quarter' })
    expect(
      wrapper
        .get<HTMLSelectElement>('select[aria-label="Left folds start"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toContain('0.5')
    expect(
      wrapper
        .get<HTMLSelectElement>('select[aria-label="Left repeat folds every"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toEqual(expect.arrayContaining(['1', '1.5']))
    expect(
      wrapper
        .get<HTMLSelectElement>('select[aria-label="Left repeat folds every"]')
        .findAll('option')
        .map((option) => option.text()),
    ).not.toContain('0.5')
  })

  it.each([0, 1])(
    'excludes beat 0 from Builder fold Start options at editable frame %s',
    (firstEditableFrameIndex) => {
      const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '2:3' })
      if (!animation) throw new Error('Expected a supported VTG animation')
      const wrapper = mount(PatternPropertyControls, {
        props: { context: 'builder', animation, firstEditableFrameIndex },
      })

      expect(
        wrapper
          .get<HTMLSelectElement>('select[aria-label="Left folds start"]')
          .findAll('option')
          .map((option) => option.text()),
      ).not.toContain('0')
      expect(
        wrapper.get<HTMLSelectElement>('select[aria-label="Left folds start"]').element.value,
      ).toBe('2')
    },
  )

  it('offers Mirror only in Simple and hides both side labels and the Right controls', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '2:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(PatternPropertyControls, {
      props: { context: 'vtg', animation, foldMirror: true },
    })

    expect(wrapper.get<HTMLInputElement>('input[aria-label="Mirror folds"]').element.checked).toBe(
      true,
    )
    expect(wrapper.find('[aria-label="Right Folds"]').exists()).toBe(false)
    expect(wrapper.get('[aria-label="Left Folds"] h3').text()).toBe('')

    await wrapper.setProps({ foldMode: 'advanced' })
    expect(wrapper.find('input[aria-label="Mirror folds"]').exists()).toBe(false)
    expect(wrapper.get('[aria-label="Left Folds"] h3').text()).toBe('Left')
    expect(wrapper.get('[aria-label="Right Folds"] h3').text()).toBe('Right')
  })
})
