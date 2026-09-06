import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ConceptsPane from '@/features/concepts/components/ConceptsPane.vue'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { createDefaultEightStepAnimation } from '@/features/eight-step/createEightStepAnimation'
import { createDefaultQstAnimation } from '@/features/quarter-space-tech/createQstAnimation'
import { builderPatternPointerMoveEvent } from '@/features/builder/patternPointerDrag'
import { builderPatternDragType } from '@/features/builder/types'
import type { QtrPatternSelection, VtgPatternSelection } from '@/features/vtg/types'

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
const scrollIntoView = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>()

describe('ConceptsPane', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    useConceptsStore().vtgAdvanced = true
    scrollIntoView.mockClear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
  })

  it('preserves the selected Quick Slot when Concepts mounts', async () => {
    const store = useConceptsStore()
    store.restoreQuickSlots()
    store.selectedQuickSlot = 3

    const wrapper = mount(ConceptsPane)
    await nextTick()

    expect(store.selectedQuickSlot).toBe(3)
    expect(wrapper.get<HTMLInputElement>('input[value="3"]').element.checked).toBe(true)
  })

  it('keeps Docs outside the empty Quick Slots flow and places the identity on the left', () => {
    const wrapper = mount(ConceptsPane, { props: { pane: 'left' } })
    const pane = wrapper.get('[data-concepts-pane]')
    const identity = wrapper.get('[data-role="concepts-identity"]')
    const docsAnchor = wrapper.get('[data-role="concept-docs-anchor"]')

    expect(identity.text()).toBe('SpiroAnim.comConcepts')
    expect(pane.element.children[0]).toBe(docsAnchor.element)
    expect(pane.element.children[1]?.contains(identity.element)).toBe(true)
  })

  it('shows Docs only for VTG', async () => {
    const wrapper = mount(ConceptsPane)
    const selector = wrapper.get<HTMLSelectElement>('[data-role="concept-selector"]')

    expect(wrapper.find('[data-role="concept-docs-anchor"]').exists()).toBe(true)

    await selector.setValue('8stp')

    expect(wrapper.find('[data-role="concept-docs-anchor"]').exists()).toBe(false)

    await selector.setValue('vtg')

    expect(wrapper.find('[data-role="concept-docs-anchor"]').exists()).toBe(true)
  })

  it('keeps the concept selector enabled while Builder has hijacked the opposing pane', async () => {
    const wrapper = mount(ConceptsPane, { props: { builderActive: true } })
    const selector = wrapper.get<HTMLSelectElement>('[data-role="concept-selector"]')

    expect(selector.attributes('disabled')).toBeUndefined()

    await selector.setValue('8stp')

    expect(useConceptsStore().selectedConcept).toBe('8stp')
    expect(wrapper.find('[data-role="eight-step-pane"]').exists()).toBe(true)
  })

  it('drags the exact labeled cell from each half of a paired Builder thumbnail', async () => {
    useConceptsStore().speedRatio = '1:2'
    const wrapper = mount(ConceptsPane, {
      props: { builderActive: true, builderFullCatalog: true },
    })

    const dragSelection = async (reference: string) => {
      const setData = vi.fn<(format: string, data: string) => void>()
      await wrapper.get(`[data-cell-reference="${reference}"]`).trigger('dragstart', {
        dataTransfer: { effectAllowed: 'none', setData },
      })
      const payload = setData.mock.calls.find(([type]) => type === builderPatternDragType)?.[1]
      if (typeof payload !== 'string') throw new Error(`Missing drag payload for ${reference}`)
      return JSON.parse(payload) as VtgPatternSelection
    }

    await expect(dragSelection('1-1')).resolves.toMatchObject({ reference: '1-1' })
    await expect(dragSelection('1-2')).resolves.toMatchObject({ reference: '1-2' })
  })

  it('includes Quarter mode in Builder drag payloads', async () => {
    const wrapper = mount(ConceptsPane, { props: { builderActive: true } })
    const setData = vi.fn<(format: string, data: string) => void>()
    useConceptsStore().qtrEnabled = true
    await nextTick()

    await wrapper.get('[data-cell-reference="1-1"]').trigger('dragstart', {
      dataTransfer: { effectAllowed: 'none', setData },
    })
    const payload = setData.mock.calls.find(([type]) => type === builderPatternDragType)?.[1]
    if (typeof payload !== 'string') throw new Error('Missing Quarter Builder drag payload')

    expect(JSON.parse(payload) as QtrPatternSelection).toMatchObject({
      reference: '1-1',
      speedRatio: '1:3',
      quarters: 1,
    })
  })

  it('pointer-drags the exact labeled cell from each half of a paired Builder thumbnail', async () => {
    useConceptsStore().speedRatio = '1:2'
    const wrapper = mount(ConceptsPane, {
      props: { builderActive: true, builderFullCatalog: true },
    })
    const selections: VtgPatternSelection[] = []
    const captureSelection = (event: Event) => {
      const selection = (event as CustomEvent).detail.selection as VtgPatternSelection
      selections.push(selection)
    }
    document.addEventListener(builderPatternPointerMoveEvent, captureSelection)

    const dispatchPointerEvent = (
      element: Element,
      type: string,
      properties: Readonly<Record<string, unknown>>,
    ) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      for (const [property, value] of Object.entries(properties)) {
        Object.defineProperty(event, property, { value })
      }
      element.dispatchEvent(event)
    }

    try {
      for (const [index, reference] of ['1-1', '1-2'].entries()) {
        const pointerId = index + 1
        const tile = wrapper.get(`[data-cell-reference="${reference}"]`)
        dispatchPointerEvent(tile.element, 'pointerdown', {
          pointerId,
          pointerType: 'touch',
          button: 0,
          isPrimary: true,
          clientX: 0,
          clientY: 0,
        })
        dispatchPointerEvent(tile.element, 'pointermove', {
          pointerId,
          clientX: 20,
          clientY: 0,
        })
        dispatchPointerEvent(tile.element, 'pointercancel', { pointerId })
      }
    } finally {
      document.removeEventListener(builderPatternPointerMoveEvent, captureSelection)
    }

    expect(selections.map(({ reference }) => reference)).toEqual(['1-1', '1-2'])
  })

  it('requests the current pattern when an empty Quick Slot is selected', async () => {
    const store = useConceptsStore()
    store.restoreQuickSlots()
    const wrapper = mount(ConceptsPane)

    await wrapper.get<HTMLInputElement>('input[value="2"]').setValue()

    expect(wrapper.emitted('quickSlotSave')).toEqual([[2]])
  })

  it('creates four Quick Slots beside the selector from the empty state', async () => {
    const wrapper = mount(ConceptsPane)
    const store = useConceptsStore()

    expect(wrapper.find('[data-role="quick-slots"]').exists()).toBe(false)
    expect(wrapper.get('[data-role="concepts-identity"]').text()).toBe('SpiroAnim.comConcepts')
    const createButton = wrapper.get('[data-role="quick-slots-create"]')
    expect(createButton.attributes('aria-label')).toBe('Create four Quick Slots')

    await createButton.trigger('click')

    expect(store.quickSlotCount).toBe(4)
    expect(store.selectedQuickSlot).toBe(1)
    expect(wrapper.findAll('input[name="quick-slot"]')).toHaveLength(4)
    expect(wrapper.get<HTMLInputElement>('input[value="1"]').element.checked).toBe(true)
    expect(wrapper.find('[data-role="quick-slots-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="concepts-identity"]').exists()).toBe(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      })
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    }
  })

  it('integrates QTR into VTG while preserving shared controls across concepts', async () => {
    useConceptsStore().restoreQuickSlots()
    const wrapper = mount(ConceptsPane)
    const pane = wrapper.get('[data-concepts-pane]')
    const selector = wrapper.get<HTMLSelectElement>('[data-role="concept-selector"]')

    expect(pane.classes()).toContain('scrollbar')
    expect(selector.element.value).toBe('vtg')
    expect(selector.attributes('aria-label')).toBe('Concept')
    expect(selector.findAll('option').map((option) => option.text())).toEqual([
      'Vulcan Tech Gospel 4',
      'Eight Step',
      'Quarter Space Tech',
      'The Kinetic Alphabet',
    ])
    expect(wrapper.findAll('[data-role^="quick-slot-"]')).toHaveLength(6)
    expect(wrapper.findAll('input[name="quick-slot"]')).toHaveLength(4)
    expect(pane.element.children[0]?.getAttribute('data-role')).toBe('concept-docs-anchor')
    expect(pane.element.children[1]?.getAttribute('data-role')).toBe('quick-slots')
    expect(pane.element.children[2]?.querySelector('[data-role="concept-selector"]')).not.toBeNull()
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-concept')).toBe('vtg')
    const vtgCustomize = wrapper.get<HTMLDetailsElement>('[data-role="vtg-customize"]')
    expect(vtgCustomize.element.open).toBe(false)

    await wrapper.get('[data-role="vtg-customize-toggle"]').trigger('click')
    expect(vtgCustomize.element.open).toBe(true)

    await wrapper.get('[data-cell-reference="1-1"]').trigger('click')

    expect(wrapper.emitted('patternSelect')).toEqual([
      [
        {
          reference: '1-1',
          speedRatio: '1:3',
          prop: 2,
        },
      ],
    ])

    await wrapper.get<HTMLInputElement>('input[value="1:5"]').setValue()
    await wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').setValue(true)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').setValue(true)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-bpm"]').setValue(84)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-scale"]').setValue(1.2)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-thick"]').setValue(11)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-paths"]').setValue(false)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-hands"]').setValue(true)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-arms"]').setValue(false)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').setValue(true)

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-concept')).toBe('vtg')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('input[value="1:5"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').element.checked).toBe(true)
    expect(wrapper.find('[data-role="vtg-quarters"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-bpm"]').element.value).toBe('84')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-scale"]').element.value).toBe('1.2')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-thick"]').element.value).toBe('11')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-paths"]').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-hands"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-arms"]').element.checked).toBe(false)

    await wrapper.get('[data-cell-reference="2-2"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      {
        reference: '2-2',
        speedRatio: '1:5',
        prop: 2,
        swapProps: true,
        reversePlane: true,
        bpm: 84,
        scale: 1.2,
        thick: 11,
        paths: false,
        hands: true,
        arms: false,
        quarters: 1,
      },
    ])

    await wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').setValue(false)

    expect(wrapper.get<HTMLInputElement>('input[value="1:5"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').element.checked).toBe(true)
    expect(wrapper.find('[data-role="vtg-quarters"]').exists()).toBe(false)

    await selector.setValue('8stp')

    expect(wrapper.get<HTMLDetailsElement>('[data-role="eight-step-customize"]').element.open).toBe(
      true,
    )

    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-swap"]').element.checked).toBe(
      true,
    )
    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-reverse"]').element.checked).toBe(
      true,
    )
    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-bpm"]').element.value).toBe('84')
    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-scale"]').element.value).toBe(
      '1.2',
    )
    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-thick"]').element.value).toBe('11')

    await wrapper.get('[data-cell-reference="4-II"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      {
        concept: '8stp',
        reference: '4-II',
        prop: 2,
        swapProps: true,
        reversePlane: true,
        bpm: 84,
        scale: 1.2,
        thick: 11,
        paths: false,
        hands: true,
        arms: false,
      },
    ])
  })

  it('shows the Eight Step matrix without selecting an unfinished pattern', async () => {
    const wrapper = mount(ConceptsPane)
    const selector = wrapper.get<HTMLSelectElement>('[data-role="concept-selector"]')

    await selector.setValue('8stp')

    expect(wrapper.find('[data-role="vtg-pane"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="qtr-pane"]').exists()).toBe(false)
    expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-role')).toBe(
      'eight-step-pane',
    )
    expect(wrapper.findAll('[data-role="eight-step-cell"]')).toHaveLength(72)
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })

  it('emits prop type and Left and Right colors from Customize', async () => {
    const wrapper = mount(ConceptsPane)

    await wrapper.get('[data-role="vtg-customize-toggle"]').trigger('click')
    const propSelect = wrapper.get<HTMLSelectElement>('[data-role="vtg-prop-type"]')
    expect(propSelect.element.value).toBe('2')
    expect(Array.from(propSelect.element.options, ({ text }) => text.trim())).toEqual([
      'POI',
      'Staff',
      'Juggling Clubs',
      'Fans',
      'Triads',
    ])
    await propSelect.setValue('0')
    await wrapper.get<HTMLSelectElement>('[data-role="vtg-left-color"]').setValue('Blue')
    await wrapper.get<HTMLSelectElement>('[data-role="vtg-right-color"]').setValue('Magenta')
    await wrapper.get('[data-cell-reference="1-1"]').trigger('click')

    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      {
        reference: '1-1',
        speedRatio: '1:3',
        propColors: ['Blue', 'Magenta'],
      },
    ])
  })

  it('shows The Kinetic Alphabet placeholder last without selecting a pattern', async () => {
    const wrapper = mount(ConceptsPane)
    const selector = wrapper.get<HTMLSelectElement>('[data-role="concept-selector"]')

    await selector.setValue('tka')

    expect(selector.element.value).toBe('tka')
    expect(wrapper.find('[data-role="vtg-pane"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="eight-step-pane"]').exists()).toBe(false)
    expect(wrapper.get('[data-role="tka-pane"]').text()).toContain('The Kinetic Alphabet')
    expect(wrapper.get('[data-role="tka-pane"]').text()).toContain('Possibly coming soon')
    expect(wrapper.get('[data-role="tka-development-note"]').text()).toBe(
      'Austin might be working on something for us...',
    )
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })

  it('shows the Quarter Space Tech libraries before The Kinetic Alphabet', async () => {
    const wrapper = mount(ConceptsPane)
    const selector = wrapper.get<HTMLSelectElement>('[data-role="concept-selector"]')

    await selector.setValue('qst')

    expect(selector.element.value).toBe('qst')
    expect(wrapper.find('[data-role="vtg-pane"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="eight-step-pane"]').exists()).toBe(false)
    expect(wrapper.get('[data-role="qst-pane"]').text()).toContain('Quarter Space Tech')
    expect(wrapper.findAll('[data-role="qst-collection"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-role="qst-collection"]').map((item) => item.text())).toEqual([
      expect.stringContaining('Quarter "Time" Breaks'),
      expect.stringContaining('Quarter "Time" Advanced'),
      expect.stringContaining('Quarter Space Beyond'),
    ])
    expect(wrapper.find('[data-role="qst-reset"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="qst-paths"]').exists()).toBe(false)
    const labelGuide = wrapper.get('[data-role="qst-label-guide"]')
    expect(labelGuide.text()).toContain('TS means Together to Split')
    expect(labelGuide.text()).toContain('SQ means Split to Quarter')
    expect(labelGuide.text()).toContain('FBFollow Break')
    expect(labelGuide.text()).toContain('OBOpposite Break')
    expect(wrapper.get('[data-role="qst-history-note"]').text()).toContain(
      'Quarter Space Tech predates SpiroAnim',
    )
    const more = wrapper.get('[data-role="qst-more"]')
    expect(more.get('summary').text()).toBe('MORE...')
    expect(more.findAll('a').map((link) => link.attributes('href'))).toEqual([
      '/docs/qst/01_Quarter_Time_Breaks.pdf',
      '/docs/qst/02_Quarter_Time_Advanced.pdf',
      '/docs/qst/03_Quarter_Space_Beyond.pdf',
    ])
    expect(more.text()).toContain('original Quarter Space Tech documents')
    expect(more.text()).toContain('legacy purposes')
    expect(wrapper.find('[data-role="tka-pane"]').exists()).toBe(false)
    expect(wrapper.emitted('patternSelect')).toBeUndefined()

    await wrapper.get('[data-collection="breaks"]').trigger('click')
    expect(wrapper.find('[data-role="qst-label-guide"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="qst-history-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="qst-more"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="qst-reset"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="qst-paths"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-role="qst-pattern-card"]')).toHaveLength(8)
    expect(wrapper.get('[data-role="qst-catalog-page"]').attributes('style')).toContain(
      '--qst-page-card-beats: 4',
    )
    expect(wrapper.findAll('[data-role="qst-page"]')).toHaveLength(10)
    expect(wrapper.find('[data-role="qst-pagination-top"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="qst-pagination-bottom"]').exists()).toBe(true)
    expect(
      wrapper
        .get('[data-role="qst-library"]')
        .findAll(':scope > [data-role]')
        .map((element) => element.attributes('data-role')),
    ).toEqual([
      'qst-library-header',
      'qst-transform-controls',
      'qst-pagination-top',
      'qst-catalog-page',
      'qst-pagination-bottom',
    ])

    await wrapper.get('[data-role="qst-page"][data-page="3"]').trigger('click')
    await wrapper.get('[data-role="qst-back"]').trigger('click')
    await wrapper.get('[data-collection="advanced"]').trigger('click')
    expect(wrapper.findAll('[data-role="qst-page"]')).toHaveLength(8)
    await wrapper.get('[data-role="qst-page"][data-page="2"]').trigger('click')
    await wrapper.get('[data-role="qst-back"]').trigger('click')
    await wrapper.get('[data-collection="breaks"]').trigger('click')
    expect(wrapper.get('[data-role="qst-page"][aria-current="page"]').text()).toBe('3')
    await wrapper.get('[data-role="qst-back"]').trigger('click')
    await wrapper.get('[data-collection="advanced"]').trigger('click')
    expect(wrapper.get('[data-role="qst-page"][aria-current="page"]').text()).toBe('2')
    await wrapper.get('[data-role="qst-page"][data-page="1"]').trigger('click')
    expect(
      wrapper
        .findAll('[data-role="qst-pattern-card"]')
        .map((card) => card.attributes('data-pattern-reference')),
    ).toEqual([
      'advanced-1',
      'advanced-3',
      'advanced-5',
      'advanced-7',
      'advanced-9',
      'advanced-11',
      'advanced-13',
      'advanced-15',
    ])
    await wrapper.get('[data-pattern-reference="advanced-1"] button').trigger('click')
    await wrapper.get<HTMLInputElement>('[data-role="qst-swap"]').setValue(true)
    expect(
      wrapper
        .findAll('[data-role="qst-pattern-card"]')
        .map((card) => card.attributes('data-pattern-reference')),
    ).toEqual([
      'advanced-2',
      'advanced-4',
      'advanced-6',
      'advanced-8',
      'advanced-10',
      'advanced-12',
      'advanced-14',
      'advanced-16',
    ])
    expect(wrapper.get('[data-pattern-reference="advanced-2"]').classes()).toContain(
      'qst-pattern-card--selected',
    )
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { concept: 'qst', reference: 'advanced-1', prop: 2, swapProps: true },
    ])
    await wrapper.get<HTMLInputElement>('[data-role="qst-swap"]').setValue(false)
    await wrapper.get('[data-role="qst-back"]').trigger('click')
    await wrapper.get('[data-collection="breaks"]').trigger('click')
    await wrapper.get('[data-role="qst-page"][data-page="2"]').trigger('click')
    await wrapper.get('[data-pattern-reference="breaks-17"] button').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { concept: 'qst', reference: 'breaks-17', prop: 2 },
    ])
    await wrapper.get<HTMLInputElement>('[data-role="qst-swap"]').setValue(true)
    expect(wrapper.get('[data-pattern-reference="breaks-19"]').classes()).toContain(
      'qst-pattern-card--selected',
    )
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { concept: 'qst', reference: 'breaks-17', prop: 2, swapProps: true },
    ])
    await wrapper.get<HTMLInputElement>('[data-role="qst-swap"]').setValue(false)
    await wrapper.get('[data-role="qst-page"][data-page="4"]').trigger('click')
    await wrapper.get('[data-role="qst-back"]').trigger('click')
    await wrapper.get('[data-collection="breaks"]').trigger('click')
    expect(wrapper.get('[data-role="qst-page"][aria-current="page"]').text()).toBe('2')
  })

  it('opens the matching QST library page and highlights the loaded pattern', async () => {
    const store = useConceptsStore()
    store.selectedConcept = 'qst'
    const animation = createDefaultQstAnimation({
      concept: 'qst',
      reference: 'beyond-100',
      swapProps: true,
      reversePlane: true,
      bpm: 87,
      scale: 1.2,
      thick: 12,
      paths: false,
      hands: true,
      arms: false,
      right: false,
    })
    if (!animation) throw new Error('Expected a supported QST animation')

    const wrapper = mount(ConceptsPane, { props: { animation, animationReady: true } })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('[data-role="qst-library"]').exists()).toBe(true))

    expect(wrapper.get('[data-role="qst-library"]').text()).toContain('Quarter Space Beyond')
    expect(wrapper.get('[data-role="qst-page"][aria-current="page"]').text()).toBe('10')
    const selectedPattern = wrapper.get('[data-pattern-reference="beyond-100"]')
    expect(selectedPattern.classes()).toContain('qst-pattern-card--selected')
    expect(selectedPattern.get('button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get<HTMLInputElement>('[data-role="qst-swap"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="qst-reverse"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="qst-bpm"]').element.value).toBe('87')
    expect(wrapper.get<HTMLInputElement>('[data-role="qst-scale"]').element.value).toBe('1.2')
    expect(wrapper.get<HTMLInputElement>('[data-role="qst-thick"]').element.value).toBe('12')
    expect(wrapper.get<HTMLInputElement>('[data-role="qst-paths"]').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="qst-hands"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="qst-arms"]').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="qst-right"]').element.checked).toBe(false)
    expect(wrapper.emitted('patternSelect')).toBeUndefined()

    await wrapper.get('[data-role="qst-page"][data-page="8"]').trigger('click')
    await wrapper.get('[data-role="qst-back"]').trigger('click')
    await wrapper.get('[data-collection="beyond"]').trigger('click')
    expect(wrapper.get('[data-role="qst-page"][aria-current="page"]').text()).toBe('10')
  })

  it('instantly scrolls a hidden selected pattern into view when its library opens', async () => {
    const store = useConceptsStore()
    store.selectedConcept = 'qst'
    const animation = createDefaultQstAnimation({
      concept: 'qst',
      reference: 'beyond-100',
    })
    if (!animation) throw new Error('Expected a supported QST animation')

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this instanceof HTMLElement && this.matches('[data-concepts-pane]')) {
        return new DOMRect(0, 0, 320, 500)
      }
      if (this instanceof HTMLElement && this.dataset.patternReference === 'beyond-100') {
        return new DOMRect(0, 700, 300, 180)
      }
      return new DOMRect(0, 0, 0, 0)
    })

    const wrapper = mount(ConceptsPane, { props: { animation, animationReady: true } })
    await vi.waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'instant',
        block: 'nearest',
        inline: 'nearest',
      }),
    )
    const initialCallCount = scrollIntoView.mock.calls.length

    await wrapper.get('[data-role="qst-back"]').trigger('click')
    await wrapper.get('[data-collection="beyond"]').trigger('click')
    await vi.waitFor(() =>
      expect(scrollIntoView.mock.calls.length).toBeGreaterThan(initialCallCount),
    )
  })

  it('preserves shared controls when merged VTG receives an Eight Step animation', async () => {
    const store = useConceptsStore()
    store.selectedConcept = '8stp'
    const animation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '4-II',
      swapProps: true,
      reversePlane: true,
      bpm: 84,
      scale: 1.2,
      thick: 11,
      paths: false,
      hands: true,
      arms: false,
    })
    expect(animation).toBeDefined()

    const wrapper = mount(ConceptsPane, { props: { animation } })
    await flushPromises()
    const selector = wrapper.get<HTMLSelectElement>('[data-role="concept-selector"]')

    store.swapProps = true
    store.reversePlane = true
    store.bpm = 84
    store.scale = 1.2
    store.thick = 11
    store.paths = false
    store.hands = true
    store.arms = false
    await nextTick()

    const expectSharedControls = () => {
      expect(store.swapProps).toBe(true)
      expect(store.reversePlane).toBe(true)
      expect(store.bpm).toBe(84)
      expect(store.scale).toBe(1.2)
      expect(store.thick).toBe(11)
      expect(store.paths).toBe(false)
      expect(store.hands).toBe(true)
      expect(store.arms).toBe(false)
    }

    expectSharedControls()

    await selector.setValue('vtg')
    await flushPromises()
    expectSharedControls()
    expect(wrapper.find('[data-role="vtg-pane"]').exists()).toBe(true)
    expect(wrapper.findAll('.vtg-tile--selected')).toHaveLength(0)

    await wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').setValue(true)
    await flushPromises()
    expectSharedControls()
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').element.checked).toBe(true)
    expect(wrapper.findAll('.vtg-tile--selected')).toHaveLength(0)
  })

  it('reports the matched VTG cell for the Composer bridge', async () => {
    const wrapper = mount(ConceptsPane)

    expect(wrapper.emitted('composerCellChange')?.at(-1)).toEqual([null])

    await wrapper.get('[data-cell-reference="1-1"]').trigger('click')

    expect(wrapper.emitted('composerCellChange')?.at(-1)).toEqual([
      {
        concept: 'vtg',
        reference: '1-1',
        speedRatio: '1:3',
        shape: 'diamond',
        isAnti: false,
        orientation: 0,
      },
    ])

    await wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').setValue(true)

    expect(wrapper.emitted('composerCellChange')?.at(-1)).toEqual([
      {
        concept: 'qtr',
        reference: '1-1',
        speedRatio: '1:3',
        shape: 'diamond',
        isAnti: false,
        orientation: 0,
      },
    ])
  })

  it('reports the matched Eight Step cell for the Composer bridge', async () => {
    const wrapper = mount(ConceptsPane)

    await wrapper.get<HTMLSelectElement>('[data-role="concept-selector"]').setValue('8stp')
    await wrapper.get('[data-cell-reference="4-II"]').trigger('click')

    expect(wrapper.emitted('composerCellChange')?.at(-1)).toEqual([
      { concept: '8stp', reference: '4-II', shape: 'diamond' },
    ])
  })

  it('clears the reported Composer cell when an unmatched animation loads', async () => {
    const wrapper = mount(ConceptsPane)

    await wrapper.get('[data-cell-reference="1-1"]').trigger('click')
    expect(wrapper.emitted('composerCellChange')?.at(-1)).not.toEqual([null])

    const animation = createDefaultQstAnimation({ concept: 'qst', reference: 'beyond-100' })
    if (!animation) throw new Error('Expected a supported QST animation')

    await wrapper.setProps({ animation, animationRevision: 1, animationReady: true })
    await flushPromises()

    await vi.waitFor(() => expect(wrapper.emitted('composerCellChange')?.at(-1)).toEqual([null]))
  })
})
