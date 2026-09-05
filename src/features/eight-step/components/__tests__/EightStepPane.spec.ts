import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import EightStepPane from '@/features/eight-step/components/EightStepPane.vue'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { createDefaultEightStepAnimation } from '@/features/eight-step/createEightStepAnimation'
import { findEightStepPatternMatch } from '@/features/eight-step/matchEightStepAnimation'
import type {
  EightStepPatternMatchResult,
  PatternMatchingClient,
} from '@/workers/pattern-matching/PatternMatchingWorkerTypes'
import type { RootDataFinal } from '@/types/AnimTypes'
import AppTooltip from '@/components/AppTooltip.vue'

const createDeferred = <Value>() => {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

class FakeResizeObserver {
  static callback: ResizeObserverCallback | undefined
  static observed: Element[] = []

  constructor(callback: ResizeObserverCallback) {
    FakeResizeObserver.callback = callback
  }

  disconnect(): void {}

  observe(target: Element): void {
    FakeResizeObserver.observed.push(target)
  }

  unobserve(): void {}
}

interface FakeWorkerMessage {
  id?: string
  type: string
  data: unknown
}

class FakeWorker {
  static instances: FakeWorker[] = []
  static previewCount = 0
  static activePreviewRequests = 0
  static maxActivePreviewRequests = 0

  readonly messages: FakeWorkerMessage[] = []
  private readonly listeners = new Set<EventListener>()

  constructor() {
    FakeWorker.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener): void {
    if (type === 'message') this.listeners.add(listener)
  }

  postMessage(message: FakeWorkerMessage): void {
    this.messages.push(message)
    if (message.id === undefined) return

    let data: unknown
    if (message.type === 'warnStr') data = message.data
    else if (message.type === 'initialize') data = true
    else if (message.type === 'loadFinalData') data = 0
    else if (message.type === 'reqimgs') {
      FakeWorker.activePreviewRequests++
      FakeWorker.maxActivePreviewRequests = Math.max(
        FakeWorker.maxActivePreviewRequests,
        FakeWorker.activePreviewRequests,
      )
      data = { 0: `blob:eight-step-preview-${++FakeWorker.previewCount}` }
    }

    queueMicrotask(() => {
      if (message.type === 'reqimgs') FakeWorker.activePreviewRequests--
      const event = { data: { id: message.id, type: message.type, data } } as MessageEvent
      this.listeners.forEach((listener) => listener(event))
    })
  }

  terminate(): void {}
}

const reportAllPreviewDimensions = (width: number, height: number) => {
  const entries = FakeResizeObserver.observed.map(
    (target) =>
      ({
        target,
        contentRect: { width, height },
      }) as ResizeObserverEntry,
  )
  FakeResizeObserver.callback?.(entries, {} as ResizeObserver)
}

const settlePreviewRendering = async () => {
  for (let index = 0; index < 12; index++) await flushPromises()
  await nextTick()
}

const countWorkerMessages = (type: string) => {
  const workerType = type === 'data' ? 'loadFinalData' : type
  return (
    FakeWorker.instances[0]?.messages.filter((message) => message.type === workerType).length ?? 0
  )
}

describe('EightStepPane', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    FakeResizeObserver.callback = undefined
    FakeResizeObserver.observed = []
    FakeWorker.instances = []
    FakeWorker.previewCount = 0
    FakeWorker.activePreviewRequests = 0
    FakeWorker.maxActivePreviewRequests = 0
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.stubGlobal('Worker', FakeWorker)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('uses shared tooltips for row relationships and cell descriptions', async () => {
    vi.useFakeTimers()
    const wrapper = mount(EightStepPane)

    const rowHeaders = wrapper.findAll('[data-role="eight-step-row-header"]')
    const cells = wrapper.findAll('[data-role="eight-step-cell"]')
    expect(rowHeaders).toHaveLength(9)
    expect(cells).toHaveLength(72)
    expect(rowHeaders.every((header) => header.attributes('aria-describedby'))).toBe(true)
    expect(cells.every((cell) => cell.attributes('aria-describedby'))).toBe(true)

    await wrapper.get('[data-role="eight-step-row-header"][aria-label="AA"]').trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Anti vs Anti')

    await wrapper.get('[data-role="eight-step-row-header"][aria-label="AA"]').trigger('mouseleave')
    await nextTick()
    await wrapper.get('[data-cell-reference="1-AA"]').trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Opposite\nAnti vs Anti',
    )

    wrapper.unmount()
  })

  it('renders four paired column groups, nine coded rows, and 72 blank cells', () => {
    const wrapper = mount(EightStepPane)

    const columnHeaders = wrapper.findAll('[data-role="eight-step-column-header"]')
    expect(columnHeaders.map((header) => header.text())).toEqual([
      'Opposite',
      'Same',
      'Quarter Aligned',
      'Quarter Opposed',
    ])
    expect(columnHeaders.map((header) => header.attributes('aria-label'))).toEqual([
      'Opposite, columns 1 and 2',
      'Same, columns 3 and 4',
      'Quarter Aligned, columns 5 and 6',
      'Quarter Opposed, columns 7 and 8',
    ])
    expect(
      wrapper.findAll('[data-role="eight-step-row-header"]').map((header) => header.text()),
    ).toEqual(['AA', 'AE', 'AI', 'EA', 'EE', 'EI', 'IA', 'IE', 'II'])

    const cells = wrapper.findAll('[data-role="eight-step-cell"]')
    expect(cells).toHaveLength(72)
    expect(cells.every((cell) => cell.text() === '')).toBe(true)
    expect(cells[0]?.attributes('data-cell-reference')).toBe('1-AA')
    expect(cells.at(-1)?.attributes('data-cell-reference')).toBe('8-II')

    expect(
      wrapper
        .findAll('.eight-step-cell--marked')
        .map((cell) => cell.attributes('data-cell-reference'))
        .sort(),
    ).toEqual(
      [
        '1-AE',
        '1-AI',
        '2-AE',
        '2-AI',
        '3-EE',
        '3-EI',
        '3-IE',
        '3-II',
        '4-EE',
        '4-EI',
        '4-IE',
        '4-II',
        '5-EE',
        '5-EI',
        '5-IE',
        '5-II',
        '6-EE',
        '6-EI',
        '6-IE',
        '6-II',
        '7-AE',
        '7-AI',
        '8-AE',
        '8-AI',
      ].sort(),
    )
  })

  it('toggles the additional Eight Step document links', async () => {
    const wrapper = mount(EightStepPane)
    const disclosure = wrapper.get('[data-role="eight-step-more"]')
    const toggle = wrapper.get('[data-role="eight-step-more-toggle"]')

    expect(toggle.text()).toBe('MORE...')
    expect(disclosure.attributes('open')).toBeUndefined()

    await toggle.trigger('click')
    expect(disclosure.attributes('open')).toBeDefined()
    expect(wrapper.get('[data-role="eight-step-more-content"]').text()).toContain(
      '8-Step Concepts by Gage DeMello.',
    )
    expect(
      wrapper
        .findAll('[data-role="eight-step-more-content"] a')
        .map((link) => [link.text(), link.attributes('href')]),
    ).toEqual([
      ['Handpaths.pdf', '/docs/8-step/Handpaths_swapped.pdf'],
      ['TeachingSheets.pdf', '/docs/8-step/TeachingSheets_swapped.pdf'],
      ['HandpathsV2.pdf', '/docs/8-step/TeachingSheets.pdf'],
    ])
    expect(
      wrapper
        .findAll('[data-role="eight-step-more-content"] a')
        .every(
          (link) =>
            link.attributes('target') === '_blank' &&
            link.attributes('rel') === 'noopener noreferrer',
        ),
    ).toBe(true)
    expect(wrapper.get('.eight-step-more__print-note').text()).toBe(
      'Printing from Adobe Acrobat or Adobe Acrobat Reader is recommended. Printing from a web browser may distort some elements.',
    )

    await toggle.trigger('click')
    expect(disclosure.attributes('open')).toBeUndefined()
  })

  it('renders nine row previews and reuses each result across all eight columns', async () => {
    const wrapper = mount(EightStepPane)
    await settlePreviewRendering()

    expect(FakeResizeObserver.observed).toHaveLength(9)
    expect(
      FakeResizeObserver.observed.map((element) => (element as HTMLElement).dataset.cellReference),
    ).toEqual(['1-AA', '1-AE', '1-AI', '1-EA', '1-EE', '1-EI', '1-IA', '1-IE', '1-II'])

    reportAllPreviewDimensions(72, 68)
    await settlePreviewRendering()

    const previews = wrapper.findAll('[data-role="eight-step-preview"]')
    expect(previews).toHaveLength(72)
    expect(new Set(previews.map((preview) => preview.attributes('src')))).toHaveLength(9)

    for (const row of ['AA', 'AE', 'AI', 'EA', 'EE', 'EI', 'IA', 'IE', 'II']) {
      const rowPreviews = wrapper.findAll(
        `[data-board-row="${row}"] [data-role="eight-step-preview"]`,
      )
      expect(rowPreviews).toHaveLength(8)
      expect(new Set(rowPreviews.map((preview) => preview.attributes('src')))).toHaveLength(1)
      expect(
        new Set(rowPreviews.map((preview) => preview.attributes('data-preview-reference'))),
      ).toEqual(new Set([`1-${row}`]))
    }

    expect(countWorkerMessages('data')).toBe(9)
    expect(countWorkerMessages('reqimgs')).toBe(9)
    expect(FakeWorker.maxActivePreviewRequests).toBe(1)
    expect(
      FakeWorker.instances[0]?.messages.find(({ type }) => type === 'initialize')?.data,
    ).toEqual({ girth: 2, timeline: false, thumbnail: true })
  })

  it('renders and reuses the observed Halve thumbnail groups across the matrix', async () => {
    const wrapper = mount(EightStepPane)
    await settlePreviewRendering()
    reportAllPreviewDimensions(72, 68)
    await settlePreviewRendering()

    const before = countWorkerMessages('reqimgs')
    await wrapper.get<HTMLInputElement>('[data-role="eight-step-halve"]').setValue(true)
    await settlePreviewRendering()

    const expectedSources = {
      AA: [1, 1, 1, 1, 1, 1, 1, 1],
      AE: [1, 1, 1, 1, 1, 1, 1, 1],
      AI: [1, 2, 1, 2, 2, 2, 2, 2],
      EA: [1, 1, 1, 1, 5, 5, 5, 5],
      EE: [1, 1, 1, 1, 5, 5, 5, 5],
      EI: [1, 2, 1, 2, 5, 5, 5, 5],
      IA: [1, 2, 2, 1, 1, 1, 2, 2],
      IE: [1, 2, 2, 1, 1, 1, 2, 2],
      II: [1, 2, 3, 4, 5, 6, 7, 8],
    } as const

    for (const [row, sources] of Object.entries(expectedSources)) {
      const rowPreviews = wrapper.findAll(
        `[data-board-row="${row}"] [data-role="eight-step-preview"]`,
      )
      expect(rowPreviews.map((preview) => preview.attributes('data-preview-reference'))).toEqual(
        sources.map((column) => `${column}-${row}`),
      )
    }

    expect(countWorkerMessages('reqimgs')).toBe(before + 23)
  })

  it('refreshes row previews for resize, Swap, 180°, and Scale only', async () => {
    const wrapper = mount(EightStepPane)
    await settlePreviewRendering()
    reportAllPreviewDimensions(72, 68)
    await settlePreviewRendering()

    const expectNineMorePreviews = async (change: () => Promise<unknown> | void) => {
      const before = countWorkerMessages('data')
      await change()
      await settlePreviewRendering()
      expect(countWorkerMessages('data')).toBe(before + 9)
    }

    const beforeBpm = countWorkerMessages('data')
    await wrapper.get<HTMLInputElement>('[data-role="eight-step-bpm"]').setValue(90)
    await settlePreviewRendering()
    expect(countWorkerMessages('data')).toBe(beforeBpm)

    await expectNineMorePreviews(() =>
      wrapper.get<HTMLInputElement>('[data-role="eight-step-swap"]').setValue(true),
    )
    await expectNineMorePreviews(() =>
      wrapper.get<HTMLInputElement>('[data-role="eight-step-reverse"]').setValue(true),
    )
    await expectNineMorePreviews(() =>
      wrapper.get<HTMLInputElement>('[data-role="eight-step-scale"]').setValue(1.1),
    )
    await expectNineMorePreviews(() =>
      wrapper.get<HTMLInputElement>('[data-role="eight-step-tilted"]').setValue(true),
    )

    const beforeRenderingControls = countWorkerMessages('data')
    await wrapper.get<HTMLInputElement>('[data-role="eight-step-paths"]').setValue(false)
    await wrapper.get<HTMLInputElement>('[data-role="eight-step-hands"]').setValue(true)
    await wrapper.get<HTMLInputElement>('[data-role="eight-step-arms"]').setValue(false)
    await settlePreviewRendering()
    expect(countWorkerMessages('data')).toBe(beforeRenderingControls)

    await expectNineMorePreviews(() => reportAllPreviewDimensions(80, 76))
  })

  it('places Tilted and Halve after 180 and before Reset', async () => {
    const wrapper = mount(EightStepPane)
    const tilted = wrapper.get<HTMLInputElement>('[data-role="eight-step-tilted"]')
    const halve = wrapper.get<HTMLInputElement>('[data-role="eight-step-halve"]')

    expect(tilted.element.type).toBe('checkbox')
    expect(tilted.element.checked).toBe(false)
    expect(halve.element.type).toBe('checkbox')
    expect(halve.element.checked).toBe(false)
    expect(halve.attributes('aria-label')).toBe(
      'Halve Turns for double-ended props like Staff and Triads',
    )
    expect(
      wrapper
        .findAllComponents(AppTooltip)
        .some(
          (tooltip) =>
            tooltip.props('text') === 'Intended for double-ended props like Staff and Triads.',
        ),
    ).toBe(true)
    expect(
      wrapper
        .get('[data-role="eight-step-shape-controls"]')
        .findAll('label > span')
        .map((label) => label.text()),
    ).toEqual(['Tilted', 'Halve'])
    expect(wrapper.find('[data-role="eight-step-box-note"]').exists()).toBe(false)
    expect(wrapper.get('[data-role="eight-step-diamond-note"]').text()).toBe(
      'Patterns highlighted in yellow, or red when selected, may be difficult or impossible to perform in Wall-Plane without significant modification.',
    )
    const shapeControls = wrapper.get('[data-role="eight-step-shape-controls"]').element
    const topOptions = wrapper.get('.eight-step-top-options').element
    const reverse = wrapper.get<HTMLInputElement>('[data-role="eight-step-reverse"]').element
    const reset = wrapper.get<HTMLButtonElement>('[data-role="eight-step-reset"]').element
    expect(topOptions.contains(shapeControls)).toBe(true)
    expect(
      reverse.compareDocumentPosition(shapeControls) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      shapeControls.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await wrapper.get('[data-cell-reference="1-AI"]').trigger('click')
    await tilted.setValue(true)
    await halve.setValue(true)

    expect(wrapper.findAll('.eight-step-cell--marked')).toHaveLength(0)
    expect(wrapper.get('[data-role="eight-step-box-note"]').text()).toBe(
      'Tilted / Box mode is experimental, and its patterns have not been validated. Difficult / Impossible highlighting for patterns performed in Wall-Plane is disabled.',
    )
    expect(wrapper.find('[data-role="eight-step-diamond-note"]').exists()).toBe(false)
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      {
        concept: '8stp',
        reference: '1-AI',
        prop: 2,
        shape: 'box',
        halve: true,
      },
    ])

    await wrapper.get('[data-role="eight-step-reset"]').trigger('click')
    expect(tilted.element.checked).toBe(false)
    expect(halve.element.checked).toBe(false)
    expect(wrapper.find('[data-role="eight-step-box-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="eight-step-diamond-note"]').exists()).toBe(true)
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { concept: '8stp', reference: '1-AI', prop: 2 },
    ])
  })

  it('controls left and right prop visibility after Tilted and Arms', async () => {
    const wrapper = mount(EightStepPane)
    const left = wrapper.get<HTMLInputElement>('[data-role="eight-step-left"]')
    const right = wrapper.get<HTMLInputElement>('[data-role="eight-step-right"]')
    const options = left.element.closest('fieldset')

    expect(left.element.checked).toBe(true)
    expect(right.element.checked).toBe(true)
    expect(
      Array.from(options?.querySelectorAll('label span') ?? []).map((option) => option.textContent),
    ).toEqual(['Paths', 'Hands', 'Arms', 'Left', 'Right'])

    await wrapper.get('[data-cell-reference="1-AA"]').trigger('click')
    const patternSelectionCount = wrapper.emitted('patternSelect')?.length
    await right.setValue(false)
    expect(wrapper.emitted('patternSelect')).toHaveLength(patternSelectionCount ?? 0)
    expect(wrapper.emitted('customize')?.at(-1)).toEqual([
      { concept: '8stp', reference: '1-AA', prop: 2, right: false },
    ])

    await left.setValue(false)
    expect(left.element.checked).toBe(false)
    expect(right.element.checked).toBe(true)
    expect(wrapper.emitted('customize')?.at(-1)).toEqual([
      { concept: '8stp', reference: '1-AA', prop: 2, left: false },
    ])

    await right.setValue(false)
    expect(left.element.checked).toBe(true)
    expect(right.element.checked).toBe(false)
    expect(wrapper.emitted('customize')?.at(-1)).toEqual([
      { concept: '8stp', reference: '1-AA', prop: 2, right: false },
    ])
  })

  it('places the random control in the top-left and selects from all cells', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = mount(EightStepPane)
    const shuffle = wrapper.get('[data-role="eight-step-shuffle"]')

    expect(shuffle.attributes('aria-label')).toBe('Shuffle Eight Step patterns')
    await shuffle.trigger('click')

    expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-selected-cell')).toBe(
      '1-AA',
    )
    expect(wrapper.get('[data-cell-reference="1-AA"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.eight-step-cell--highlighted')).toHaveLength(16)
    expect(wrapper.findAll('.eight-step-header--accent')).toHaveLength(2)
    expect(wrapper.get('[aria-label="Opposite, columns 1 and 2"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(wrapper.get('[aria-label="AA"]').attributes('aria-pressed')).toBe('true')
  })

  it('highlights the selected headers without hiding marked cells in the row or column', async () => {
    const wrapper = mount(EightStepPane)

    expect(wrapper.get('[data-role="eight-step-board"]').attributes('style')).toContain(
      '--eight-step-first-head: rgb(0,255,0)',
    )
    expect(wrapper.get('[data-role="eight-step-board"]').attributes('style')).toContain(
      '--eight-step-first-tether: rgb(0,85,0)',
    )
    expect(wrapper.get('[data-role="eight-step-board"]').attributes('style')).toContain(
      '--eight-step-second-head: rgb(0,255,255)',
    )
    expect(wrapper.get('[data-role="eight-step-board"]').attributes('style')).toContain(
      '--eight-step-second-tether: rgb(0,85,85)',
    )

    await wrapper.get('[data-cell-reference="2-AE"]').trigger('click')

    expect(wrapper.get('[aria-label="Opposite, columns 1 and 2"]').classes()).toContain(
      'eight-step-header--accent',
    )
    expect(wrapper.get('[aria-label="AE"]').classes()).toContain('eight-step-header--accent')
    expect(wrapper.get('[aria-label="AA"]').classes()).not.toContain('eight-step-header--accent')
    expect(wrapper.findAll('.eight-step-cell--highlighted')).toHaveLength(16)

    await wrapper.get('[data-cell-reference="2-AE"]').trigger('click')
    expect(wrapper.get('[data-cell-reference="2-AE"]').classes()).toEqual(
      expect.arrayContaining(['eight-step-cell--marked', 'eight-step-cell--selected']),
    )
    expect(wrapper.get('[data-cell-reference="1-AE"]').classes()).toContain(
      'eight-step-cell--marked',
    )
  })

  it('aligns row headers and alternates paired top-header columns', async () => {
    const wrapper = mount(EightStepPane)

    await wrapper.get('[data-cell-reference="2-AE"]').trigger('click')
    await wrapper.get('[data-role="eight-step-row-header"][aria-label="II"]').trigger('click')
    expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-selected-cell')).toBe(
      '2-II',
    )

    const sameHeader = wrapper.get(
      '[data-role="eight-step-column-header"][aria-label="Same, columns 3 and 4"]',
    )
    await sameHeader.trigger('click')
    expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-selected-cell')).toBe(
      '3-II',
    )
    await sameHeader.trigger('click')
    expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-selected-cell')).toBe(
      '4-II',
    )
    await sameHeader.trigger('click')
    expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-selected-cell')).toBe(
      '3-II',
    )
  })

  it('uses the left paired column and a random row when a top header starts selection', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const wrapper = mount(EightStepPane)

    await wrapper
      .get('[data-role="eight-step-column-header"][aria-label="Quarter Aligned, columns 5 and 6"]')
      .trigger('click')

    expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-selected-cell')).toBe(
      '5-EE',
    )
  })

  it('restores both original prop color roles when Swap is enabled', async () => {
    const wrapper = mount(EightStepPane)

    await wrapper.get<HTMLInputElement>('[data-role="eight-step-swap"]').setValue(true)

    const boardStyle = wrapper.get('[data-role="eight-step-board"]').attributes('style')
    expect(boardStyle).toContain('--eight-step-first-head: rgb(0,255,255)')
    expect(boardStyle).toContain('--eight-step-first-tether: rgb(0,85,85)')
    expect(boardStyle).toContain('--eight-step-second-head: rgb(0,255,0)')
    expect(boardStyle).toContain('--eight-step-second-tether: rgb(0,85,0)')
  })

  it('uses and resets the shared concept controls', async () => {
    const store = useConceptsStore()
    store.swapProps = true
    store.reversePlane = true
    store.bpm = 84
    store.scale = 1.2
    store.thick = 11
    store.spacing = 13
    store.paths = false
    store.hands = true
    store.arms = false
    const wrapper = mount(EightStepPane)

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
    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-spacing"]').element.value).toBe(
      '13',
    )

    await wrapper.get('[data-role="eight-step-reset"]').trigger('click')

    expect(store.swapProps).toBe(false)
    expect(store.reversePlane).toBe(false)
    expect(store.bpm).toBe(40)
    expect(store.scale).toBe(0.8)
    expect(store.thick).toBe(5)
    expect(store.spacing).toBe(1)
    expect(store.paths).toBe(true)
    expect(store.hands).toBe(false)
    expect(store.arms).toBe(true)
  })

  it('emits a complete selection using the shared controls', async () => {
    const store = useConceptsStore()
    store.swapProps = true
    store.reversePlane = true
    store.bpm = 84
    store.scale = 1.2
    store.thick = 11
    store.spacing = 13
    store.paths = false
    store.hands = true
    store.arms = false
    const wrapper = mount(EightStepPane)

    await wrapper.get('[data-cell-reference="7-IE"]').trigger('click')

    expect(wrapper.emitted('patternSelect')).toEqual([
      [
        {
          concept: '8stp',
          reference: '7-IE',
          prop: 2,
          swapProps: true,
          reversePlane: true,
          bpm: 84,
          scale: 1.2,
          thick: 11,
          spacing: 13,
          paths: false,
          hands: true,
          arms: false,
        },
      ],
    ])
  })

  it('emits shared control changes separately from pattern selections', async () => {
    const wrapper = mount(EightStepPane)
    await wrapper.get('[data-cell-reference="7-IE"]').trigger('click')
    const patternSelections = wrapper.emitted('patternSelect')?.length

    await wrapper.get<HTMLInputElement>('[data-role="eight-step-scale"]').setValue(1.2)

    expect(wrapper.emitted('patternSelect')).toHaveLength(patternSelections ?? 0)
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({
      concept: '8stp',
      reference: '7-IE',
      scale: 1.2,
    })
  })

  it('hydrates the selected cell and controls from compiled Eight Step data', async () => {
    const animation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '6-AI',
      swapProps: true,
      reversePlane: true,
      bpm: 93,
      scale: 1.1,
      thick: 12,
      paths: false,
      hands: true,
      arms: false,
      shape: 'box',
      propRotationOffsets: [23, -37],
    })
    expect(animation).toBeDefined()

    const wrapper = mount(EightStepPane, { props: { animation } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-selected-cell')).toBe(
        '6-AI',
      )
    })

    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-swap"]').element.checked).toBe(
      true,
    )
    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-reverse"]').element.checked).toBe(
      true,
    )
    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-bpm"]').element.value).toBe('93')
    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-scale"]').element.value).toBe(
      '1.1',
    )
    expect(wrapper.get<HTMLInputElement>('[data-role="eight-step-tilted"]').element.checked).toBe(
      true,
    )
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
    expect(wrapper.emitted('patternMatched')).toHaveLength(1)

    await wrapper.get<HTMLInputElement>('[data-role="eight-step-scale"]').setValue(1.2)
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({
      reference: '6-AI',
      scale: 1.2,
      propRotationOffsets: [23, -37],
    })

    await wrapper.get('[data-role="eight-step-pattern-builder"]').trigger('click')
    expect(wrapper.emitted('builderOpen')).toHaveLength(1)
  })

  it('applies whole-pattern Offset, Rotate, Twist, and Third Order properties', async () => {
    const animation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '4-EI',
    })
    if (!animation) throw new Error('Expected a supported Eight Step animation')
    const wrapper = mount(EightStepPane, { props: { animation } })
    await vi.waitFor(() => expect(wrapper.attributes('data-selected-cell')).toBe('4-EI'))

    expect(wrapper.get('[data-role="eight-step-properties"]').text()).toContain('Offset')
    expect(wrapper.get('[data-role="eight-step-properties"]').text()).toContain('Rotate')
    expect(wrapper.get('[data-role="eight-step-properties"]').text()).toContain('Twist')
    expect(wrapper.get('[data-role="eight-step-properties"]').text()).toContain('Third Order')

    await wrapper.get('[data-role="eight-step-property-third-order-toggle"]').trigger('click')
    await wrapper
      .get<HTMLInputElement>('[data-role="eight-step-third-order-strength-0"]')
      .setValue('60')
    const thirdOrder = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as RootDataFinal | undefined
    expect(thirdOrder?.props[0]?.anim[0]?.strength).toBe(600)

    await wrapper.setProps({ animation: thirdOrder })
    await vi.waitFor(() => expect(wrapper.attributes('data-selected-cell')).toBe('4-EI'))

    await wrapper.get('[data-role="eight-step-property-twist-toggle"]').trigger('click')
    await wrapper.get<HTMLInputElement>('input[data-role^="eight-step-twist-0-"]').setValue('10')
    const twisted = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as RootDataFinal | undefined
    expect(twisted?.props[0]?.anim.some((frame) => frame.twist !== undefined)).toBe(true)
    expect(twisted && findEightStepPatternMatch(twisted)?.reference).toBe('4-EI')

    await wrapper.setProps({ animation: twisted })
    await vi.waitFor(() => expect(wrapper.attributes('data-selected-cell')).toBe('4-EI'))
    await wrapper.get('[data-role="eight-step-property-axis-toggle"]').trigger('click')
    await wrapper.get<HTMLInputElement>('input[aria-label^="Left Rotate at beat"]').setValue('4')
    const rotated = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as RootDataFinal | undefined
    expect(rotated?.props[0]?.anim.some((frame) => frame.rotate !== undefined)).toBe(true)
    expect(rotated && findEightStepPatternMatch(rotated)?.reference).toBe('4-EI')

    await wrapper.setProps({ animation: rotated })
    await wrapper.get('[data-role="eight-step-property-offset-toggle"]').trigger('click')
    await wrapper.get<HTMLInputElement>('[data-role="eight-step-offset-0-input"]').setValue('30')
    await wrapper.get('[data-role="eight-step-offset-0-input"]').trigger('change')
    const offset = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as RootDataFinal | undefined
    expect(findEightStepPatternMatch(offset!)?.propRotationOffsets?.[0]).toBe(30)
  })

  it('keeps Advanced Twist active through whole-pattern animation updates', async () => {
    const animation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '4-EI',
    })
    if (!animation) throw new Error('Expected a supported Eight Step animation')
    const wrapper = mount(EightStepPane, { props: { animation } })
    await vi.waitFor(() => expect(wrapper.attributes('data-selected-cell')).toBe('4-EI'))

    await wrapper.get('[data-role="eight-step-property-twist-toggle"]').trigger('click')
    await wrapper.get<HTMLInputElement>('input[name$="-twist-mode"][value="advanced"]').setValue()
    const modeAnimation = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as
      | RootDataFinal
      | undefined
    await wrapper.setProps({ animation: modeAnimation })
    await flushPromises()

    expect(
      wrapper.get<HTMLInputElement>('input[name$="-twist-mode"][value="advanced"]').element.checked,
    ).toBe(true)
    await wrapper.get<HTMLInputElement>('input[aria-label="Left Twist at beat 1"]').setValue('10')
    const updated = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as RootDataFinal | undefined
    await wrapper.setProps({ animation: updated })
    await flushPromises()

    expect(
      wrapper.get<HTMLInputElement>('input[name$="-twist-mode"][value="advanced"]').element.checked,
    ).toBe(true)
    expect(updated?.props[0]?.anim.some((frame) => frame.twist !== undefined)).toBe(true)
    expect(updated && findEightStepPatternMatch(updated)?.reference).toBe('4-EI')
  })

  it('keeps Advanced Rotate active through whole-pattern animation updates', async () => {
    const animation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '4-EI',
    })
    if (!animation) throw new Error('Expected a supported Eight Step animation')
    const wrapper = mount(EightStepPane, { props: { animation } })
    await vi.waitFor(() => expect(wrapper.attributes('data-selected-cell')).toBe('4-EI'))

    await wrapper.get('[data-role="eight-step-property-axis-toggle"]').trigger('click')
    const advancedRotate = wrapper.findAll<HTMLInputElement>('input[name$="-fold-mode"]')[1]
    if (!advancedRotate) throw new Error('Expected an Advanced Rotate mode control')
    await advancedRotate.setValue()
    const modeAnimation = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as
      | RootDataFinal
      | undefined
    await wrapper.setProps({ animation: modeAnimation })
    await flushPromises()

    expect(wrapper.findAll<HTMLInputElement>('input[name$="-fold-mode"]')[1]?.element.checked).toBe(
      true,
    )
    await wrapper.get<HTMLInputElement>('input[aria-label="Left Rotate at beat 1"]').setValue('4')
    const updated = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as RootDataFinal | undefined
    await wrapper.setProps({ animation: updated })
    await flushPromises()

    expect(wrapper.findAll<HTMLInputElement>('input[name$="-fold-mode"]')[1]?.element.checked).toBe(
      true,
    )
    expect(updated?.props[0]?.anim.some((frame) => frame.rotate !== undefined)).toBe(true)
    expect(updated && findEightStepPatternMatch(updated)?.reference).toBe('4-EI')

    await wrapper.get('[data-role="eight-step-property-offset-toggle"]').trigger('click')
    await wrapper.get<HTMLInputElement>('[data-role="eight-step-offset-0-input"]').setValue('30')
    await wrapper.get('[data-role="eight-step-offset-0-input"]').trigger('change')
    const offset = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as RootDataFinal | undefined
    await wrapper.setProps({ animation: offset })
    await flushPromises()
    await wrapper.get('[data-role="eight-step-property-axis-toggle"]').trigger('click')

    expect(wrapper.findAll<HTMLInputElement>('input[name$="-fold-mode"]')[1]?.element.checked).toBe(
      true,
    )
  })

  it('applies and keeps the selected Rotate mirror setting through animation updates', async () => {
    const animation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '4-EI',
    })
    if (!animation) throw new Error('Expected a supported Eight Step animation')
    const wrapper = mount(EightStepPane, { props: { animation } })
    await vi.waitFor(() => expect(wrapper.attributes('data-selected-cell')).toBe('4-EI'))

    await wrapper.get('[data-role="eight-step-property-axis-toggle"]').trigger('click')
    await wrapper.get<HTMLInputElement>('input[aria-label="Mirror folds"]').setValue(false)
    const unmirroredMode = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as
      | RootDataFinal
      | undefined
    await wrapper.setProps({ animation: unmirroredMode })
    await flushPromises()

    expect(wrapper.get<HTMLInputElement>('input[aria-label="Mirror folds"]').element.checked).toBe(
      false,
    )

    await wrapper.get('[data-role="eight-step-property-offset-toggle"]').trigger('click')
    await wrapper.get<HTMLInputElement>('[data-role="eight-step-offset-0-input"]').setValue('30')
    await wrapper.get('[data-role="eight-step-offset-0-input"]').trigger('change')
    const offset = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as RootDataFinal | undefined
    await wrapper.setProps({ animation: offset })
    await flushPromises()
    await wrapper.get('[data-role="eight-step-property-axis-toggle"]').trigger('click')

    expect(wrapper.get<HTMLInputElement>('input[aria-label="Mirror folds"]').element.checked).toBe(
      false,
    )
    await wrapper.get<HTMLInputElement>('input[aria-label^="Left Rotate at beat"]').setValue('4')
    const unmirroredFold = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as
      | RootDataFinal
      | undefined
    expect(unmirroredFold?.props[0]?.anim.some((frame) => frame.rotate !== undefined)).toBe(true)
    expect(unmirroredFold?.props[1]?.anim.some((frame) => frame.rotate !== undefined)).toBe(false)

    await wrapper.setProps({ animation: unmirroredFold })
    await flushPromises()
    await wrapper.get<HTMLInputElement>('input[aria-label="Mirror folds"]').setValue(true)
    const mirroredFold = wrapper.emitted('animationUpdate')?.at(-1)?.[0] as
      | RootDataFinal
      | undefined
    await wrapper.setProps({ animation: mirroredFold })
    await flushPromises()

    expect(wrapper.get<HTMLInputElement>('input[aria-label="Mirror folds"]').element.checked).toBe(
      true,
    )
    expect(mirroredFold?.props[1]?.anim.some((frame) => frame.rotate !== undefined)).toBe(true)
    expect(mirroredFold && findEightStepPatternMatch(mirroredFold)?.reference).toBe('4-EI')
  })

  it('keeps whole-pattern properties available while Pattern Viewer is open', async () => {
    const animation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '4-EI',
    })
    if (!animation) throw new Error('Expected a supported Eight Step animation')
    const wrapper = mount(EightStepPane, { props: { animation, builderActive: true } })

    await vi.waitFor(() => expect(wrapper.attributes('data-selected-cell')).toBe('4-EI'))
    expect(wrapper.get('[data-role="eight-step-properties"]').text()).toContain('Offset')
    expect(wrapper.get('[data-role="eight-step-properties"]').text()).toContain('Rotate')
    expect(wrapper.get('[data-role="eight-step-properties"]').text()).toContain('Twist')

    await wrapper.setProps({ builderActive: false })
    expect(wrapper.find('[data-role="eight-step-properties"]').exists()).toBe(true)
  })

  it('reports the first clicked match after an unmatched animation load', async () => {
    const initial = createDefaultEightStepAnimation({ concept: '8stp', reference: '1-AA' })
    const selected = createDefaultEightStepAnimation({ concept: '8stp', reference: '2-AA' })
    if (!initial || !selected) throw new Error('Expected supported Eight Step animations')

    const matchEightStep = vi
      .fn<PatternMatchingClient['matchEightStep']>()
      .mockResolvedValueOnce({ status: 'unmatched' })
      .mockResolvedValueOnce({ status: 'unchanged' })
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({ status: 'unmatched' }),
      matchEightStep,
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(EightStepPane, { props: { animation: initial, patternMatcher } })
    await vi.waitFor(() => expect(matchEightStep).toHaveBeenCalledOnce())
    expect(wrapper.emitted('patternMatched')).toBeUndefined()

    await wrapper.get('[data-cell-reference="2-AA"]').trigger('click')
    await wrapper.setProps({ animation: selected })

    await vi.waitFor(() => expect(wrapper.emitted('patternMatched')).toHaveLength(1))
  })

  it('ignores a stale match after a newer animation has been hydrated', async () => {
    const firstAnimation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '1-AA',
    })
    const secondAnimation = createDefaultEightStepAnimation({
      concept: '8stp',
      reference: '6-AI',
      shape: 'box',
    })
    if (!firstAnimation || !secondAnimation) {
      throw new Error('Expected supported Eight Step animations')
    }

    const first = createDeferred<EightStepPatternMatchResult>()
    const second = createDeferred<EightStepPatternMatchResult>()
    const matchEightStep = vi
      .fn<PatternMatchingClient['matchEightStep']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({ status: 'unmatched' }),
      matchEightStep,
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(EightStepPane, {
      props: { animation: firstAnimation, patternMatcher },
    })
    await vi.waitFor(() => expect(matchEightStep).toHaveBeenCalledOnce())

    await wrapper.setProps({ animation: secondAnimation })
    await vi.waitFor(() => expect(matchEightStep).toHaveBeenCalledTimes(2))

    second.resolve({
      status: 'matched',
      match: {
        reference: '6-AI',
        swapProps: false,
        reversePlane: false,
        shape: 'box',
        bpm: 60,
        scale: 0.8,
      },
    })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-selected-cell')).toBe(
        '6-AI',
      )
    })

    first.resolve({
      status: 'matched',
      match: {
        reference: '1-AA',
        swapProps: false,
        reversePlane: false,
        shape: 'diamond',
        bpm: 60,
        scale: 0.8,
      },
    })
    await flushPromises()

    expect(wrapper.get('[data-role="eight-step-pane"]').attributes('data-selected-cell')).toBe(
      '6-AI',
    )
  })
})
