import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { builderPatternPointerMoveEvent } from '@/features/builder/patternPointerDrag'
import type { BuilderPatternPointerDetail } from '@/features/builder/patternPointerDrag'
import {
  describeVtgBuilderMotion,
  getCompiledVtgBuilderMotion,
} from '@/features/builder/describeVtgBuilderMotion'
import { appendVtgBuilderPattern } from '@/features/builder/appendVtgBuilderPattern'
import { createVtgBuilderDropPreview } from '@/features/builder/createVtgBuilderDropPreview'
import { resolveVtgBuilderPatternMatchAnimation } from '@/features/builder/resolveVtgBuilderPatternMatchAnimation'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { describePatternRelationships } from '@/features/concepts/math/describePatternRelationships'
import VtgPane from '@/features/vtg/components/VtgPane.vue'
import {
  createDefaultQtrAnimation,
  createQtrAnimation,
} from '@/features/vtg/qtr/createQtrAnimation'
import { createDefaultVtgAnimation, createVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { extractVtgThirdOrderSettings } from '@/features/vtg/thirdOrder'
import { findVtgPatternMatches } from '@/features/vtg/matchVtgAnimation'
import {
  createVtgTransitionPreviewAnimations,
  createVtgTransitionQuickSlotAnimationCandidates,
} from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import {
  exactlyMatchesQtrSelection,
  findQtrPatternMatch,
  findQtrPatternMatches,
} from '@/features/vtg/qtr/matchQtrAnimation'
import type { QtrPatternSelection, VtgPatternSelection, VtgSpeedRatio } from '@/features/vtg/types'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CURRENT_SPIRO_ANIM_QS_VERSION, loadSpiroAnimQSVersion } from '@/services/query/versions'
import { PRODUCTION_PWA_HOSTNAME } from '@/sys/pwaManifest'
import { rootCompile } from '@/math/animation/AnimFunc'
import type { RootDataFinal } from '@/types/AnimTypes'
import type {
  PatternMatchingClient,
  VtgPatternMatchResult,
} from '@/workers/pattern-matching/PatternMatchingWorkerTypes'

const createDeferred = <Value>() => {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

const mountVtgPane = async (qtrEnabled = false) => {
  const wrapper = mount(VtgPane)
  if (qtrEnabled) {
    await wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').setValue(true)
  }
  return wrapper
}

const selectSpeedRatio = async (wrapper: VueWrapper, speedRatio: VtgSpeedRatio) => {
  await wrapper.get<HTMLInputElement>(`input[value="${speedRatio}"]`).setValue()
  await flushPromises()
  await nextTick()
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
      data = { 0: `blob:vtg-preview-${++FakeWorker.previewCount}` }
    }

    queueMicrotask(() => {
      if (message.type === 'reqimgs') FakeWorker.activePreviewRequests--
      const event = { data: { id: message.id, type: message.type, data } } as MessageEvent
      this.listeners.forEach((listener) => listener(event))
    })
  }

  terminate(): void {}
}

const reportAllBlankDimensions = (width: number, height: number) => {
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

const decodeCurrentQuery = async (query: string) => {
  const version = await loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)
  const codec = await useSpiroAnimQS(
    version.VDEF,
    useBaseQS(version.VDEF, { charset: version.CHARSET }),
    CURRENT_SPIRO_ANIM_QS_VERSION,
  )
  return codec.decodeQS(Object.fromEntries(new URLSearchParams(query)))
}

enableAutoUnmount(afterEach)

describe('VtgPane', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const conceptsStore = useConceptsStore()
    conceptsStore.vtgAdvanced = true
    conceptsStore.qtrEnabled = false
    conceptsStore.classicLayout = false
    conceptsStore.prop = 0
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

  it('recreates the matrix, rule cards, and blank intersection previews', () => {
    const wrapper = mount(VtgPane)

    expect(wrapper.findAll('[data-role="vtg-tile"]')).toHaveLength(36)
    expect(wrapper.findAll('[data-role="vtg-rule-card"]')).toHaveLength(12)
    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
    expect(wrapper.findAll('button')).toHaveLength(63)
    expect(wrapper.findAll('[data-role="vtg-divider"]')).toHaveLength(12)
    expect(wrapper.findAll('[data-role="vtg-prop"]')).toHaveLength(24)
    expect(wrapper.findAll('.vtg-rule-card__prop-handle--large')).toHaveLength(24)
    expect(wrapper.findAll('.vtg-rule-card__prop-handle--small')).toHaveLength(24)
    expect(wrapper.get('[data-role="vtg-matrix"]').text()).toContain('SO / TS')
    expect(wrapper.get('[data-role="vtg-matrix"]').text()).toContain('TO / TS')
    expect(wrapper.find('[data-role="qtr-development-note"]').exists()).toBe(false)
  })

  it('switches the matrix and headers when the integrated QTR checkbox is enabled', async () => {
    const wrapper = mount(VtgPane)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-classic"]').setValue(false)
    const qtr = wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]')
    const beat = wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]')
    const transition = wrapper.get('[data-role="vtg-transition"]')

    expect(qtr.element.type).toBe('checkbox')
    expect(qtr.element.checked).toBe(false)
    expect(
      qtr.element.compareDocumentPosition(beat.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      beat.element.compareDocumentPosition(transition.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await qtr.setValue(true)

    const matrixCells = wrapper.findAll('[data-role="vtg-tile"]')
    const headerLabels = wrapper.findAll('.vtg-rule-card__title')

    expect(matrixCells).toHaveLength(36)
    expect(matrixCells.every((cell) => /^Q[SO] \/ [TSQ][SO]$/.test(cell.text()))).toBe(true)
    expect(headerLabels).toHaveLength(12)
    expect(headerLabels.every((label) => label.text() === '')).toBe(true)
    expect(wrapper.find('[data-role="qtr-development-note"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-role="vtg-rule-card"][aria-describedby]')).toHaveLength(0)
    expect(wrapper.findAll('[data-role="vtg-divider"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-role="vtg-prop"]')).toHaveLength(12)
    expect(wrapper.findAll('[data-role="vtg-sidebar"] [data-role="vtg-prop"]')).toHaveLength(12)
    expect(wrapper.findAll('[data-role="vtg-column-headers"] [data-role="vtg-prop"]')).toHaveLength(
      0,
    )
    const sideHeaderSignatures = wrapper
      .get('[data-role="vtg-sidebar"]')
      .findAll('[data-role="vtg-rule-card"]')
      .map((header) =>
        header
          .findAll('[data-role="vtg-prop"]')
          .map((prop) => prop.html())
          .join('|'),
      )
    expect(new Set(sideHeaderSignatures)).toHaveLength(6)
    const firstSideProps = wrapper.findAll(
      '[data-role="vtg-sidebar"] [data-role="vtg-rule-card"]:first-child [data-role="vtg-prop"]',
    )
    expect(firstSideProps[0]?.classes()).toContain('vtg-rule-card__prop--vertical')
    expect(firstSideProps[1]?.classes()).toContain('vtg-rule-card__prop--horizontal')
    expect(firstSideProps[0]?.attributes('style')).toContain('inset-block-start: 4%')
    expect(firstSideProps[1]?.attributes('style')).toContain('inset-inline-start: 59%')
    expect(firstSideProps[0]?.attributes('style')).toContain(
      '--vtg-rule-prop-head-color: rgb(0,255,255)',
    )
    expect(firstSideProps[0]?.attributes('style')).toContain(
      '--vtg-rule-prop-handle-color: rgb(0,136,136)',
    )
    expect(firstSideProps[0]?.attributes('style')).toContain(
      '--vtg-rule-prop-tether-color: rgb(0,85,85)',
    )
    expect(firstSideProps[1]?.attributes('style')).toContain(
      '--vtg-rule-prop-head-color: rgb(0,255,0)',
    )
    expect(firstSideProps[1]?.attributes('style')).toContain(
      '--vtg-rule-prop-handle-color: rgb(0,136,0)',
    )
    expect(firstSideProps[1]?.attributes('style')).toContain(
      '--vtg-rule-prop-tether-color: rgb(0,85,0)',
    )

    expect(wrapper.get('[data-cell-reference="1-6"]').attributes('aria-label')).toContain('QO / QS')
    expect(
      wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 5"]').attributes('aria-label'),
    ).toBe('TOG SPLIT rule 5')

    await wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').setValue('90')
    expect(
      wrapper
        .get('[data-role="vtg-sidebar"] [aria-label$="rule 1"] .vtg-rule-card__diagram')
        .attributes('style'),
    ).toContain('rotate(90deg)')
    await wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').setValue('0')
    await wrapper.get<HTMLInputElement>('[data-role="vtg-classic"]').setValue(true)
    wrapper.unmount()
  })

  it('disables Qtr header tooltips and derives Quarter cell descriptions', async () => {
    vi.useFakeTimers()
    const wrapper = await mountVtgPane(true)
    const exampleCell = wrapper.get('[data-cell-reference="1-6"]')

    expect(wrapper.findAll('[data-role="vtg-rule-card"][aria-describedby]')).toHaveLength(0)
    expect(wrapper.findAll('[data-role="vtg-tile"][aria-describedby]')).toHaveLength(36)

    await exampleCell.trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Hands: Quarter / Opposite\nProps: Quarter / Same',
    )

    wrapper.unmount()
  })

  it('offers a typed Speed Ratio radio group above the board', async () => {
    const wrapper = mount(VtgPane)
    const group = wrapper.get('fieldset.vtg-speed-ratio')
    const options = group.findAll<HTMLInputElement>('input[type="radio"]')

    expect(group.get('legend').text()).toBe('Speed ratio')
    expect(group.get('legend').classes()).toContain('vtg-pane__visually-hidden')
    expect(options.map((option) => option.element.value)).toEqual([
      '1:1',
      '2:1',
      '1:2',
      '1:3',
      '2:3',
      '1:4',
      '1:5',
      '2:5',
    ])
    expect(group.findAll('.vtg-radio-row')).toHaveLength(1)
    expect(
      group
        .findAll('.vtg-radio-row')
        .map((row) =>
          row
            .findAll<HTMLInputElement>('input[type="radio"]')
            .map((option) => option.element.value),
        ),
    ).toEqual([['1:1', '2:1', '1:2', '1:3', '2:3', '1:4', '1:5', '2:5']])
    expect(options[3]?.element.checked).toBe(true)
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-speed-ratio')).toBe('1:3')
  })

  it('defaults to basic VTG3 controls and restores the saved layout in Advanced mode', async () => {
    const store = useConceptsStore()
    store.vtgAdvanced = false
    store.classicLayout = false
    const wrapper = mount(VtgPane)
    const advanced = wrapper.get<HTMLInputElement>('[data-role="vtg-advanced"]')
    const builder = wrapper.get<HTMLInputElement>('[data-role="vtg-pattern-builder"]')

    expect(advanced.element.checked).toBe(false)
    expect(builder.element.nextElementSibling?.textContent).toBe('Pattern Builder')
    expect(builder.element.parentElement?.nextElementSibling).toBe(advanced.element.parentElement)
    expect(
      wrapper
        .findAll<HTMLInputElement>('fieldset.vtg-speed-ratio input[type="radio"]')
        .map((option) => option.element.value),
    ).toEqual(['1:1', '1:3', '1:5'])
    expect(wrapper.find('[data-role="vtg-more"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-classic"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-swap"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-reverse"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-playback-controls"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-transition-controls"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-properties"]').exists()).toBe(false)
    expect(wrapper.get('[data-role="vtg-pane"]').classes()).toContain('vtg-pane--classic')
    expect(store.classicLayout).toBe(false)

    await wrapper.get<HTMLInputElement>('[data-role="vtg-more"]').setValue(true)
    expect(wrapper.find('select[aria-label="Left prop timing ratio"]').exists()).toBe(true)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-more"]').setValue(false)
    await advanced.setValue(true)

    expect(store.vtgAdvanced).toBe(true)
    expect(
      wrapper
        .findAll<HTMLInputElement>('fieldset.vtg-speed-ratio input[type="radio"]')
        .map((option) => option.element.value),
    ).toEqual(['1:1', '2:1', '1:2', '1:3', '2:3', '1:4', '1:5', '2:5'])
    expect(wrapper.find('[data-role="vtg-more"]').exists()).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-classic"]').element.checked).toBe(false)
    expect(wrapper.find('[data-role="vtg-swap"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-reverse"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-playback-controls"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-transition-controls"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-properties"]').exists()).toBe(true)
    expect(wrapper.get('[data-role="vtg-pane"]').classes()).not.toContain('vtg-pane--classic')
    expect(store.classicLayout).toBe(false)
  })

  it('opens More for hidden ratios and keeps it in Advanced only for hybrids', async () => {
    const store = useConceptsStore()
    store.speedRatio = '1:2'
    const wrapper = mount(VtgPane)
    const more = wrapper.get<HTMLInputElement>('[data-role="vtg-more"]')
    const advanced = wrapper.get<HTMLInputElement>('[data-role="vtg-advanced"]')

    expect(more.element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[value="1:2"]').element.checked).toBe(true)

    await advanced.setValue(false)

    expect(more.element.checked).toBe(true)
    expect(wrapper.find('input[value="1:2"]').exists()).toBe(false)
    expect(
      wrapper.get<HTMLSelectElement>('select[aria-label="Left prop timing ratio"]').element.value,
    ).toBe('1:2')

    await advanced.setValue(true)
    expect(more.element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[value="1:2"]').element.checked).toBe(true)

    await advanced.setValue(false)
    await wrapper
      .get<HTMLSelectElement>('select[aria-label="Right prop timing ratio"]')
      .setValue('1:5')
    await advanced.setValue(true)
    expect(more.element.checked).toBe(true)
    expect(
      wrapper.get<HTMLSelectElement>('select[aria-label="Right prop timing ratio"]').element.value,
    ).toBe('1:5')
  })

  it('uses More to assign an optional ratio to the second prop', async () => {
    const wrapper = mount(VtgPane)
    const more = wrapper.get<HTMLInputElement>('[data-role="vtg-more"]')

    expect(more.element.checked).toBe(false)
    expect(wrapper.findAll('fieldset.vtg-speed-ratio input[type="radio"]')).toHaveLength(8)

    await more.setValue(true)

    expect(wrapper.findAll('fieldset.vtg-speed-ratio input[type="radio"]')).toHaveLength(0)
    const first = wrapper.get<HTMLSelectElement>('select[aria-label="Left prop timing ratio"]')
    const second = wrapper.get<HTMLSelectElement>('select[aria-label="Right prop timing ratio"]')
    expect(wrapper.findAll('.vtg-ratio-select__label').map((label) => label.text())).toEqual([
      'Left:',
      'Right:',
    ])
    expect(first.attributes('aria-describedby')).toBeTruthy()
    expect(second.attributes('aria-describedby')).toBeTruthy()
    expect(first.element.value).toBe('1:3')
    expect(second.element.value).toBe('')

    await first.setValue('2:3')
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-speed-ratio')).toBe('2:3')

    await second.setValue('1:5')
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-speed-ratio')).toBe('2:3v1:5')

    await second.setValue('')
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-speed-ratio')).toBe('2:3')

    await more.setValue(false)
    expect(wrapper.findAll('fieldset.vtg-speed-ratio input[type="radio"]')).toHaveLength(8)
    expect(wrapper.get<HTMLInputElement>('input[value="2:3"]').element.checked).toBe(true)
  })

  it('transposes only the displayed table and moves its swapped top headers to the bottom', async () => {
    useConceptsStore().classicLayout = true
    const wrapper = mount(VtgPane)
    const classic = wrapper.get<HTMLInputElement>('[data-role="vtg-classic"]')
    const pane = wrapper.get('[data-role="vtg-pane"]')

    expect(classic.element.checked).toBe(true)
    expect(pane.classes()).toContain('vtg-pane--classic')

    await classic.setValue(false)

    expect(pane.classes()).not.toContain('vtg-pane--classic')
    expect(
      wrapper.get('[data-cell-reference="2-3"]').element.parentElement?.getAttribute('style'),
    ).toBe('')

    await wrapper.get('[data-cell-reference="5-6"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).not.toContain(
      'vtg-tile__spin-toggle--bottom',
    )
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).not.toContain(
      'vtg-tile__spin-toggle--left',
    )
    await wrapper.get('[data-cell-reference="5-5"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).not.toContain(
      'vtg-tile__spin-toggle--bottom',
    )
    await wrapper.get('[data-cell-reference="6-5"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
      'vtg-tile__spin-toggle--bottom',
    )
    await wrapper.get('[data-cell-reference="6-6"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
      'vtg-tile__spin-toggle--bottom',
    )

    await selectSpeedRatio(wrapper, '1:2')
    await wrapper.get('[data-cell-reference="6-5"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
      'vtg-tile__spin-toggle--bottom',
    )
    await wrapper.get('[data-cell-reference="6-6"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
      'vtg-tile__spin-toggle--bottom',
    )

    await selectSpeedRatio(wrapper, '1:3')
    await classic.setValue(true)

    expect(pane.classes()).toContain('vtg-pane--classic')
    const classicTile = wrapper.get('[data-cell-reference="2-3"]')
    expect(classicTile.element.parentElement?.getAttribute('style')).toContain('grid-column: 2')
    expect(classicTile.element.parentElement?.getAttribute('style')).toContain('grid-row: 4')
    expect(classicTile.attributes('data-board-column')).toBe('3')
    expect(classicTile.attributes('data-board-row')).toBe('4')
    const classicSideHeaders = wrapper
      .get('[data-role="vtg-sidebar"]')
      .findAll('[data-role="vtg-rule-card"]')
    expect(classicSideHeaders[0]?.attributes('aria-label')).toContain('rule 6')
    expect(classicSideHeaders[5]?.attributes('aria-label')).toContain('rule 1')
    expect(
      classicSideHeaders.every((header) => header.classes().includes('vtg-rule-card--vertical')),
    ).toBe(true)
    expect(
      wrapper
        .get('[data-role="vtg-column-headers"]')
        .findAll('[data-role="vtg-rule-card"]')
        .every((header) => header.classes().includes('vtg-rule-card--horizontal')),
    ).toBe(true)

    await classicTile.trigger('click')

    expect(wrapper.emitted<VtgPatternSelection[]>('patternSelect')?.at(-1)?.[0]?.reference).toBe(
      '2-3',
    )
    expect(
      wrapper
        .get('[data-role="vtg-column-headers"]')
        .findAll('[data-role="vtg-rule-card"]')[1]
        ?.classes(),
    ).toContain('vtg-rule-card--accent')
    expect(
      wrapper.get('[data-role="vtg-sidebar"]').findAll('[data-role="vtg-rule-card"]')[3]?.classes(),
    ).toContain('vtg-rule-card--accent')

    await wrapper.get('[data-cell-reference="5-5"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
      'vtg-tile__spin-toggle--bottom',
    )
    await wrapper.get('[data-cell-reference="5-6"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
      'vtg-tile__spin-toggle--top',
    )

    await selectSpeedRatio(wrapper, '1:2')
    expect(wrapper.get('[data-cell-reference="2-1"]').classes()).toContain(
      'vtg-tile--paired-bottom',
    )
    expect(wrapper.get('[data-cell-reference="2-2"]').classes()).toContain('vtg-tile--paired-top')

    await wrapper.get('[data-cell-reference="5-5"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
      'vtg-tile__spin-toggle--bottom',
    )
    await wrapper.get('[data-cell-reference="5-6"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
      'vtg-tile__spin-toggle--top',
    )

    await selectSpeedRatio(wrapper, '2:1')
    for (const reference of ['5-6', '6-6', '5-5', '6-5'] as const) {
      await wrapper.get(`[data-cell-reference="${reference}"]`).trigger('click')
      const classes = wrapper.get('[data-role="vtg-spin-toggle"]').classes()
      expect(classes).not.toContain('vtg-tile__spin-toggle--left')
      expect(classes).not.toContain('vtg-tile__spin-toggle--right')
    }
  })

  it.each(['1:2', '1:4'] as const)(
    'hides top-header labels, diagrams, and dividers at %s while retaining left-header details',
    async (speedRatio) => {
      const wrapper = mount(VtgPane)
      await selectSpeedRatio(wrapper, speedRatio)

      const columnHeaders = wrapper.get('[data-role="vtg-column-headers"]')
      const sideHeaders = wrapper.get('[data-role="vtg-sidebar"]')
      expect(columnHeaders.findAll('[data-role="vtg-rule-card"]')).toHaveLength(6)
      expect(
        columnHeaders.findAll('.vtg-rule-card__title').every((title) => title.text() === ''),
      ).toBe(true)
      expect(columnHeaders.findAll('[data-role="vtg-rule-card"][aria-describedby]')).toHaveLength(0)
      expect(columnHeaders.findAll('[data-role="vtg-prop"]')).toHaveLength(0)
      expect(columnHeaders.findAll('[data-role="vtg-divider"]')).toHaveLength(0)
      expect(
        sideHeaders.findAll('.vtg-rule-card__title').every((title) => title.text() !== ''),
      ).toBe(true)
      expect(sideHeaders.findAll('[data-role="vtg-prop"]')).toHaveLength(12)
      expect(sideHeaders.findAll('[data-role="vtg-divider"]')).toHaveLength(6)
    },
  )

  it.each([
    ['1:1', 'TOG OUT rule 1'],
    ['1:3', 'TOG OUT rule 1'],
    ['1:5', 'TOG OUT rule 1'],
  ] as const)(
    'maps the %s top headers by physical column',
    async (speedRatio, firstHeaderLabel) => {
      const wrapper = mount(VtgPane)
      await selectSpeedRatio(wrapper, speedRatio)

      const headers = wrapper.findAll(
        '[data-role="vtg-column-headers"] [data-role="vtg-rule-card"]',
      )
      expect(headers.map((header) => header.get('.vtg-rule-card__number').text())).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
      ])
      expect(headers[0]?.attributes('aria-label')).toBe(firstHeaderLabel)

      await wrapper.get('[data-cell-reference="6-6"]').trigger('click')
      await headers[0]?.trigger('click')
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('6-1')
      expect(headers[0]?.attributes('aria-pressed')).toBe('true')
    },
  )

  it('maps the extracted header descriptions to both sets of rule buttons', async () => {
    vi.useFakeTimers()
    const wrapper = mount(VtgPane)
    const sideRule = wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 5"]')
    const columnRule = wrapper.get('[data-role="vtg-column-headers"] [aria-label$="rule 5"]')

    expect(wrapper.findAll('[data-role="vtg-rule-card"][aria-describedby]')).toHaveLength(12)
    expect(sideRule.attributes('aria-describedby')).toBeTruthy()
    expect(columnRule.attributes('aria-describedby')).toBeTruthy()

    await sideRule.trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Tog Split - Hands are together but the props are facing 180 degrees apart.',
    )

    wrapper.unmount()
  })

  it('derives Hands and Props tooltips for all matrix buttons', async () => {
    vi.useFakeTimers()
    const wrapper = mount(VtgPane)
    const exampleCell = wrapper.get('[data-cell-reference="1-6"]')

    expect(wrapper.findAll('[data-role="vtg-tile"][aria-describedby]')).toHaveLength(36)

    await exampleCell.trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Hands: Split / Opposite\nProps: Together / Same',
    )

    wrapper.unmount()
  })

  it('shows two Four Elements icons and elemental tooltip wording when enabled', async () => {
    vi.useFakeTimers()
    const wrapper = mount(VtgPane)
    const elemental = wrapper.get<HTMLInputElement>('[data-role="vtg-elemental"]')
    expect(elemental.element.checked).toBe(false)

    await elemental.setValue(true)
    const exampleCell = wrapper.get('[data-cell-reference="1-6"]')
    expect(exampleCell.findAll('.vtg-tile__elements .base-icon')).toHaveLength(2)
    expect(exampleCell.get('.elemental-relationship-icons').classes()).toContain(
      'elemental-relationship-icons--responsive',
    )
    expect(
      exampleCell
        .findAll('.elemental-relationship-icons__icon')
        .map((icon) => icon.attributes('data-element')),
    ).toEqual(['Fire', 'Earth'])
    expect(exampleCell.attributes('aria-label')).toContain('Fire / Earth')

    await exampleCell.trigger('mouseenter')
    vi.advanceTimersByTime(0)
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Hands: Split / Opposite\nProps: Together / Same',
    )

    wrapper.unmount()
  })

  it('uses top-then-left references and highlights a selected matrix cross', async () => {
    const wrapper = mount(VtgPane)
    const pane = wrapper.get('[data-role="vtg-pane"]')
    const exampleCell = wrapper.get('[data-cell-reference="5-1"]')

    expect(pane.attributes('data-selected-cell')).toBeUndefined()
    expect(exampleCell.element.tagName).toBe('BUTTON')
    expect(exampleCell.attributes('data-board-column')).toBe('2')
    expect(exampleCell.attributes('data-board-row')).toBe('5')
    expect(wrapper.findAll('.vtg-tile--highlighted')).toHaveLength(0)
    expect(
      wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 5"]').attributes('aria-pressed'),
    ).toBe('false')
    expect(
      wrapper
        .get('[data-role="vtg-column-headers"] [aria-label$="rule 6"]')
        .attributes('aria-pressed'),
    ).toBe('false')

    await exampleCell.trigger('click')

    expect(pane.attributes('data-selected-cell')).toBe('5-1')
    expect(exampleCell.attributes('aria-pressed')).toBe('true')
    expect(exampleCell.classes()).toContain('vtg-tile--selected')
    expect(wrapper.findAll('.vtg-tile--selected')).toHaveLength(1)
    expect(wrapper.findAll('.vtg-tile--highlighted')).toHaveLength(11)
    expect(
      wrapper
        .get('[data-role="vtg-column-headers"] [aria-label$="rule 1"]')
        .attributes('aria-pressed'),
    ).toBe('true')
    expect(wrapper.emitted('patternSelect')).toEqual([[{ reference: '5-1', speedRatio: '1:3' }]])
  })

  it('aligns header selections with the opposing selected header', async () => {
    const wrapper = mount(VtgPane)

    await wrapper.get('[data-cell-reference="5-1"]').trigger('click')
    await wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 4"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('4-1')

    await wrapper.get('[data-role="vtg-column-headers"] [aria-label$="rule 2"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('4-2')
  })

  it('selects a random cell along a clicked header when no cell is selected', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const wrapper = await mountVtgPane(true)

    await wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 4"]').trigger('click')
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('4-4')
  })

  it('includes the selected speed ratio in each pattern request', async () => {
    const wrapper = mount(VtgPane)

    await selectSpeedRatio(wrapper, '1:5')
    await wrapper.get('[data-cell-reference="1-6"]').trigger('click')

    expect(wrapper.emitted('patternSelect')).toEqual([[{ reference: '1-6', speedRatio: '1:5' }]])
  })

  it('applies a newly selected speed ratio to the current pattern', async () => {
    const wrapper = mount(VtgPane)

    await wrapper.get('[data-cell-reference="3-4"]').trigger('click')
    await selectSpeedRatio(wrapper, '1:5')
    await vi.waitFor(() => expect(wrapper.emitted('patternSelect')).toHaveLength(2))

    expect(wrapper.emitted('patternSelect')).toEqual([
      [{ reference: '3-4', speedRatio: '1:3' }],
      [{ reference: '3-4', speedRatio: '1:5' }],
    ])
  })

  it('offers Swap and 180-degree checkboxes that reapply the current pattern', async () => {
    const wrapper = mount(VtgPane)
    const swap = wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]')
    const reverse = wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]')

    expect(swap.element.checked).toBe(false)
    expect(reverse.element.checked).toBe(false)
    expect(swap.element.nextElementSibling?.textContent).toBe('Swap')
    expect(reverse.attributes('aria-label')).toBe('Rotate floor plane by 180 degrees')
    expect(reverse.element.nextElementSibling?.textContent).toBe('180°')
    expect(
      wrapper
        .findAll('.vtg-top-options .concept-pattern-options label span')
        .map((option) => option.text()),
    ).toEqual(['More', 'Classic', 'Elemental', 'Swap', '180°'])

    await wrapper.get('[data-cell-reference="2-6"]').trigger('click')
    await swap.setValue(true)
    await reverse.setValue(true)

    expect(wrapper.emitted('patternSelect')).toEqual([
      [{ reference: '2-6', speedRatio: '1:3' }],
      [{ reference: '2-6', speedRatio: '1:3', swapProps: true }],
      [{ reference: '2-6', speedRatio: '1:3', swapProps: true, reversePlane: true }],
    ])
  })

  it('provides tooltips for pattern, playback, and rendering controls', () => {
    const wrapper = mount(VtgPane)

    expect(wrapper.get('input[value="1:3"]').attributes('aria-label')).toBe(
      'Use the 1:3 speed ratio',
    )
    expect(wrapper.get('[data-role="vtg-swap"]').attributes('aria-label')).toBe(
      'Exchange the completed left and right animation tracks',
    )
    expect(wrapper.get('[data-role="vtg-reset"]').attributes('aria-describedby')).toBeTruthy()
    expect(wrapper.get('[data-role="vtg-reset"]').attributes('title')).toBeUndefined()
    expect(wrapper.get('[data-role="vtg-qtr"]').attributes('aria-label')).toBe(
      'Use Quarter Spacing relationships',
    )
    expect(wrapper.get('[data-role="vtg-beat"]').attributes('aria-label')).toBe('Starting beat')
    expect(wrapper.get('[data-role="vtg-paths"]').attributes('aria-label')).toBe(
      'Show the complete prop motion paths',
    )
    expect(wrapper.get('[data-role="vtg-left"]').attributes('aria-label')).toBe(
      'Show the left prop',
    )
    expect(wrapper.get('[data-role="vtg-shuffle"]').attributes('aria-describedby')).toBeTruthy()
    expect(wrapper.get('[data-role="vtg-shuffle"]').attributes('title')).toBeUndefined()
  })

  it.each(['1:2', '1:4'] as const)(
    'defaults rotation to -90 degrees at %s and emits its unique selector options',
    async (speedRatio) => {
      const wrapper = mount(VtgPane)
      await wrapper.get('[data-cell-reference="5-1"]').trigger('click')
      await selectSpeedRatio(wrapper, speedRatio)
      await vi.waitFor(() => expect(wrapper.emitted('patternSelect')).toHaveLength(2))

      const rotate = wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]')
      expect(rotate.attributes('aria-label')).toBe('Rotate wall plane by the selected angle')
      expect(rotate.element.value).toBe('-90')
      expect(rotate.findAll('option').map((option) => option.text())).toContain('-90°')
      expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
        { reference: '5-1', speedRatio, orientation: -90 },
      ])
      expect(wrapper.emitted('patternSelect')).toHaveLength(2)

      await rotate.setValue('0')
      expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([{ reference: '5-1', speedRatio }])

      await wrapper.get('[data-cell-reference="6-6"]').trigger('click')
      const selectedOrientation = speedRatio === '1:2' ? 180 : 90
      const expectedOptions = ['-90°', '-45°', '0°', '45°', '90°', '180°']
      await vi.waitFor(() =>
        expect(rotate.findAll('option').map((option) => option.text())).toEqual(expectedOptions),
      )
      await rotate.setValue(String(selectedOrientation))
      expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
        { reference: '6-6', speedRatio, isAnti: false, orientation: selectedOrientation },
      ])
    },
  )

  it('remembers Rotate while switching between supported ratios', async () => {
    const wrapper = mount(VtgPane)
    await wrapper.get('[data-cell-reference="5-1"]').trigger('click')
    await selectSpeedRatio(wrapper, '1:2')

    const rotate = wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]')
    await rotate.setValue('0')
    await selectSpeedRatio(wrapper, '1:4')
    await vi.waitFor(() =>
      expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
        { reference: '5-1', speedRatio: '1:4' },
      ]),
    )

    expect(rotate.element.value).toBe('0')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { reference: '5-1', speedRatio: '1:4' },
    ])
  })

  it('keeps relationship labels stable while the wall plane rotates', async () => {
    const wrapper = mount(VtgPane)
    await selectSpeedRatio(wrapper, '1:2')

    const rotate = wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]')
    const firstRowSecondColumn = () =>
      wrapper.get('[data-cell-reference="2-1"] .vtg-tile__label').text()
    const secondRowFirstColumn = () =>
      wrapper.get('[data-cell-reference="1-2"] .vtg-tile__label').text()

    expect(rotate.element.value).toBe('-90')
    expect(firstRowSecondColumn()).toBe('SO / SO')
    expect(secondRowFirstColumn()).toBe('TO / TO')

    await rotate.setValue('0')
    expect(firstRowSecondColumn()).toBe('TO / TO')
    expect(secondRowFirstColumn()).toBe('SO / SO')

    await rotate.setValue('90')
    expect(firstRowSecondColumn()).toBe('SO / SO')
    expect(secondRowFirstColumn()).toBe('TO / TO')

    await rotate.setValue('180')
    expect(firstRowSecondColumn()).toBe('TO / TO')
    expect(secondRowFirstColumn()).toBe('SO / SO')
  })

  it('controls left and right prop visibility after Arms', async () => {
    for (const qtrEnabled of [false, true]) {
      const wrapper = await mountVtgPane(qtrEnabled)
      const left = wrapper.get<HTMLInputElement>('[data-role="vtg-left"]')
      const right = wrapper.get<HTMLInputElement>('[data-role="vtg-right"]')
      const options = left.element.closest('fieldset')

      expect(left.element.checked).toBe(true)
      expect(right.element.checked).toBe(true)
      expect(
        Array.from(options?.querySelectorAll('label span') ?? []).map(
          (option) => option.textContent,
        ),
      ).toEqual(['Paths', 'Hands', 'Arms', 'Left', 'Right'])

      await wrapper.get('[data-cell-reference="5-1"]').trigger('click')
      await left.setValue(false)
      expect(left.element.checked).toBe(false)

      await right.setValue(false)
      expect(left.element.checked).toBe(true)
      expect(right.element.checked).toBe(false)
      expect(wrapper.emitted('customize')?.at(-1)?.[0]).not.toHaveProperty('left')
      expect(wrapper.emitted('customize')?.at(-1)?.[0]).toHaveProperty('right', false)

      await left.setValue(false)
      expect(left.element.checked).toBe(false)
      expect(right.element.checked).toBe(true)
      expect(wrapper.emitted('customize')?.at(-1)?.[0]).toHaveProperty('left', false)
      expect(wrapper.emitted('customize')?.at(-1)?.[0]).not.toHaveProperty('right')

      await left.setValue(true)
      expect(left.element.checked).toBe(true)
      expect(right.element.checked).toBe(true)
      expect(wrapper.emitted('customize')?.at(-1)?.[0]).not.toHaveProperty('left')
      wrapper.unmount()
    }
  })

  it('offers starting-beat and reciprocal transition controls', async () => {
    const concept = 'vtg'
    for (const qtrEnabled of [false, true]) {
      const quarters = qtrEnabled ? 1 : undefined
      const wrapper = await mountVtgPane(qtrEnabled)
      const beat = wrapper.get<HTMLInputElement>(`[data-role="${concept}-beat"]`)
      const transition = wrapper.get<HTMLInputElement>(`[data-role="${concept}-transition"]`)
      const transition45 = wrapper.get<HTMLInputElement>(`[data-role="${concept}-transition-45"]`)

      expect(beat.element.type).toBe('range')
      expect(beat.attributes()).toMatchObject({ min: '1', max: '4.5', step: '0.5' })
      expect(beat.element.value).toBe('1')
      expect(beat.element.nextElementSibling?.textContent).toBe('1')
      expect(transition.element.type).toBe('radio')
      expect(transition.element.nextElementSibling?.textContent).toBe("Trans'")
      expect(transition45.element.nextElementSibling?.textContent).toBe('45°')
      expect(
        transition.element.compareDocumentPosition(transition45.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(transition.element.checked).toBe(false)
      expect(transition45.element.checked).toBe(false)

      await wrapper.get('[data-cell-reference="5-1"]').trigger('click')
      const initialLabels = wrapper.findAll('[data-role="vtg-tile"]').map((tile) => tile.text())
      await beat.setValue(3)
      expect(wrapper.findAll('[data-role="vtg-tile"]').map((tile) => tile.text())).toEqual(
        initialLabels,
      )
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-bpm"]').element.value).toBe('40')
      await transition.trigger('click')
      expect(transition.element.checked).toBe(true)
      expect(wrapper.emitted('patternSelect')).toEqual([
        [
          {
            reference: '5-1',
            speedRatio: '1:3',
            ...(quarters === undefined ? {} : { quarters }),
          },
        ],
        [
          {
            reference: '5-1',
            speedRatio: '1:3',
            beat: 3,
            ...(quarters === undefined ? {} : { quarters }),
          },
        ],
        [
          {
            reference: '5-1',
            speedRatio: '1:3',
            beat: 3,
            transition: true,
            transitionAfterBeat: true,
            ...(quarters === undefined ? {} : { quarters }),
          },
        ],
      ])

      await transition.trigger('click')
      expect(transition.element.checked).toBe(false)
      expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
        {
          reference: '5-1',
          speedRatio: '1:3',
          beat: 3,
          ...(quarters === undefined ? {} : { quarters }),
        },
      ])

      await transition45.trigger('click')
      expect(transition45.element.checked).toBe(true)
      expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
        {
          reference: '5-1',
          speedRatio: '1:3',
          beat: 3,
          transition: true,
          ...(quarters === undefined ? {} : { quarters }),
        },
      ])
      await transition45.trigger('click')
      expect(transition45.element.checked).toBe(false)
      wrapper.unmount()
    }
  })

  it('rebuilds the selected pattern at the absolute Start beat', async () => {
    const animation = createDefaultVtgAnimation({
      reference: '1-2',
      speedRatio: '1:3',
    })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(VtgPane, { props: { animation } })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-2')
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').element.value).toBe('1')
    })
    await wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').setValue(3.5)

    expect(wrapper.emitted('animationUpdate')).toBeUndefined()
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      {
        reference: '1-2',
        speedRatio: '1:3',
        beat: 3.5,
      },
    ])
  })

  it('keeps a matched prop offset across cells while every cell follows Start', async () => {
    const version = await loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      CURRENT_SPIRO_ANIM_QS_VERSION,
    )
    const animation = await codec.decodeVer(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.myQR3s.5JEQpg.......&x0=_r_&m0=_1_mxqv__&p1=N__.biQ.5L_Qpg.......&x1=_r_&c=_g_bhq&v=11',
        ),
      ),
    )
    const wrapper = mount(VtgPane, { props: { animation } })
    const label = (reference: string) =>
      wrapper.get(`[data-cell-reference="${reference}"] .vtg-tile__label`).text()

    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-2')
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').element.value).toBe('1')
    })
    expect(label('1-2')).toBe('QO / TO')
    expect(label('1-1')).toBe('QS / SS')

    await wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').setValue(2)

    expect(label('1-2')).toBe('QO / TO')
    expect(label('1-1')).toBe('QS / SS')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '1-2',
      speedRatio: '1:3',
      beat: 2,
      quarters: 1,
      propRotationOffsets: [90, 0],
    })

    await wrapper.get('[data-cell-reference="1-1"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toEqual({
      reference: '1-1',
      speedRatio: '1:3',
      beat: 2,
      quarters: 1,
      reversePlane: true,
      propRotationOffsets: [90, 0],
      scale: 0.7,
    })
  })

  it('keeps a supplied match prop rotation offset across ratios and clears it when resetting', async () => {
    const version = await loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      CURRENT_SPIRO_ANIM_QS_VERSION,
    )
    const animation = await codec.decodeVer(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.mBEQDk.5JE.......&x0=_s_&m0=_1_mxqv__&p1=N__.blERhw.5JEQpg.......&x1=_s_&c=_i_bhq&v=11',
        ),
      ),
    )
    const wrapper = mount(VtgPane, { props: { animation } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('5-5')
    })
    const leftRatio = wrapper.get<HTMLSelectElement>('[aria-label="Left prop timing ratio"]')
    const rightRatio = wrapper.get<HTMLSelectElement>('[aria-label="Right prop timing ratio"]')
    await wrapper.get('[data-role="vtg-property-offset-toggle"]').trigger('click')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-offset-0-input"]').element.value).toBe(
      '-90',
    )
    expect(
      wrapper.get<HTMLButtonElement>('button[aria-label="Clear Left offset"]').element.disabled,
    ).toBe(false)
    expect(
      wrapper.get<HTMLButtonElement>('button[aria-label="Clear Right offset"]').element.disabled,
    ).toBe(true)

    await wrapper.get('[data-cell-reference="5-5"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '5-5',
      speedRatio: '1:1v3',
      quarters: 1,
      propRotationOffsets: [-90, 0],
    })

    await rightRatio.setValue('')
    await flushPromises()
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '5-5',
      speedRatio: '1:1',
      quarters: 1,
      propRotationOffsets: [-90, 0],
    })

    await leftRatio.setValue('1:3')
    await flushPromises()
    await wrapper.get('[data-cell-reference="5-5"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '5-5',
      speedRatio: '1:3',
      quarters: 1,
      propRotationOffsets: [-90, 0],
    })

    await leftRatio.setValue('1:1')
    await flushPromises()
    await wrapper.get('[data-cell-reference="1-1"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      propRotationOffsets: [-90, 0],
    })
    await leftRatio.setValue('1:3')
    await flushPromises()
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      propRotationOffsets: [-90, 0],
    })

    wrapper.unmount()
    const resetWrapper = mount(VtgPane, { props: { animation: structuredClone(animation) } })
    await vi.waitFor(() => {
      expect(resetWrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe(
        '5-5',
      )
    })

    await resetWrapper.get('[data-role="vtg-reset"]').trigger('click')
    await nextTick()
    const confirmReset = resetWrapper.find('.pattern-reset-dialog__confirm')
    if (confirmReset.exists()) await confirmReset.trigger('click')
    await vi.waitFor(() => expect(resetWrapper.emitted('patternSelect')).toBeDefined())
    expect(resetWrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '5-5',
      speedRatio: '1:3',
    })
    expect(resetWrapper.emitted('patternSelect')?.at(-1)?.[0]).not.toHaveProperty(
      'propRotationOffsets',
    )
  })

  it('does not accumulate a 180-degree prop phase when Start wraps from 4.5 to 1', async () => {
    const version = await loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      CURRENT_SPIRO_ANIM_QS_VERSION,
    )
    const animation = await codec.decodeVer(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.g__QDk.5L_R3s.......&x0=_s_&m0=_1_mxqv__&p1=N__.5E0R3s_WQ.___Qpg_U0.......&x1=_s_&c=_i_bhq&v=11',
        ),
      ),
    )
    useConceptsStore().qtrEnabled = true
    const wrapper = mount(VtgPane, { props: { animation } })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-6')
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').element.value).toBe('4.5')
    })
    await wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').setValue(1)

    expect(wrapper.emitted('animationUpdate')).toBeUndefined()
    const selection = wrapper.emitted<QtrPatternSelection[]>('patternSelect')?.at(-1)?.[0]
    expect(selection).toEqual({ reference: '1-6', speedRatio: '1:3', quarters: 1 })

    const regenerated = selection ? createQtrAnimation(animation, selection) : undefined
    expect(regenerated).toBeDefined()
    expect(exactlyMatchesQtrSelection(regenerated!, selection!)).toBe(true)
    expect(
      findQtrPatternMatch(regenerated!, {
        swapProps: false,
        reversePlane: false,
        quarters: 1,
        orientation: 0,
      }),
    ).toMatchObject({
      reference: '1-6',
      speedRatio: '1:3',
      quarters: 1,
    })
    expect(
      findQtrPatternMatches(regenerated!).some(
        (match) =>
          match.reference === '1-6' &&
          match.speedRatio === '1:3' &&
          match.quarters === 1 &&
          (match.beat ?? 1) === 1,
      ),
    ).toBe(true)
  })

  it('renders the detected mixed spin directions in the selected thumbnail', async () => {
    const version = await loadSpiroAnimQSVersion(11)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      11,
    )
    const animation = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.gU0QYq_WQ.5E0Qwi_WQ.......&x0=_q_&m0=_1_mxqv__&p1=N__.gU0QKm_WQ.5L_QYq_U0.......&x1=_q_&c=_f_bhq&v=11',
        ),
      ),
    )
    const wrapper = mount(VtgPane, { props: { animation } })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('6-3')
    })
    reportAllBlankDimensions(80, 80)
    await settlePreviewRendering()

    const compiledPreviews = FakeWorker.instances[0]!.messages.filter(
      (message) => message.type === 'loadFinalData',
    )
      .map((message) => rootCompile(message.data as RootDataFinal))
      .slice(-18)
    expect(compiledPreviews).toHaveLength(18)
    expect(getCompiledVtgBuilderMotion(compiledPreviews[16]!, 1).spins).toEqual(['A', 'I'])
  })

  it('renders Hands and Third Order timing in VTG thumbnails', async () => {
    const store = useConceptsStore()
    store.hands = true
    const wrapper = mount(VtgPane)
    await settlePreviewRendering()
    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()

    store.setVtgThirdOrderTiming(0, '2:3-anti')
    await nextTick()
    await nextTick()
    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()

    const previews =
      FakeWorker.instances[0]?.messages
        .filter(({ type }) => type === 'loadFinalData')
        .map(({ data }) => rootCompile(data as RootDataFinal)) ?? []
    const handsPreview = previews.find((preview) => preview.hands === true)
    const thirdOrderPreview = [...previews]
      .reverse()
      .find((preview) => preview.props[0]?.anim.length === 17)
    expect(handsPreview).toMatchObject({ hands: true })
    expect(handsPreview?.props.every((prop) => prop.hands === true)).toBe(true)
    expect(thirdOrderPreview?.props[0]?.anim).toHaveLength(17)
    expect(thirdOrderPreview?.props[0]?.anim.slice(1).every((frame) => frame.warp !== 0)).toBe(true)

    wrapper.unmount()
  })

  it('retains the distinct QTR 1-2 pattern and its rotation after refresh', async () => {
    const version = await loadSpiroAnimQSVersion(11)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      11,
    )
    const animation = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.gU0QDk_WQ.5E0Qpg_WQ.......&x0=_s_&m0=_1_mxqv__&p1=N__.gU0QDk_WQ.5L_Qpg_U0.......&x1=_s_&c=_i_bhq&v=11',
        ),
      ),
    )
    useConceptsStore().qtrEnabled = true
    const wrapper = mount(VtgPane, { props: { animation } })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-2')
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').element.checked).toBe(true)
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').element.value).toBe('1.5')
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-orientation"]').element.value).toBe('0')
    })
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
    expect(wrapper.emitted('animationUpdate')).toBeUndefined()
  })

  it('does not infer prop rotation for an exact regular beat match during hydration', async () => {
    const version = await loadSpiroAnimQSVersion(11)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      11,
    )
    const animation = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.5E0R3s_WQ._U0Qpg_WQ.......&x0=_s_&m0=_1_mxqv__&p1=N__.gU0QDk_WQ.5L_Qpg_U0.......&x1=_s_&c=_i_bhq&v=11',
        ),
      ),
    )
    useConceptsStore().qtrEnabled = false
    const wrapper = mount(VtgPane, { props: { animation } })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-2')
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').element.checked).toBe(false)
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').element.value).toBe('1.5')
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-orientation"]').element.value).toBe('0')
    })
    expect(wrapper.emitted('patternSelect')).toBeUndefined()

    await wrapper.get('[data-cell-reference="2-1"]').trigger('click')
    await wrapper.get('[data-cell-reference="1-2"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '1-2',
      speedRatio: '1:3',
      beat: 1.5,
    })
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).not.toHaveProperty('propRotationOffsets')
  })

  it('extends the starting-beat range for two-cycle timings', async () => {
    const wrapper = await mountVtgPane(false)
    const beat = wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]')

    expect(beat.attributes('max')).toBe('4.5')

    await selectSpeedRatio(wrapper, '2:1')
    expect(beat.attributes('max')).toBe('8.5')
    await beat.setValue(8.5)
    await wrapper.get('[data-cell-reference="5-1"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      speedRatio: '2:1',
      beat: 8.5,
    })

    await wrapper.get<HTMLInputElement>('[data-role="vtg-more"]').setValue(true)
    await wrapper.get<HTMLSelectElement>('[aria-label="Right prop timing ratio"]').setValue('1:1')
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-speed-ratio')).toBe('2:1v1:1')
    expect(beat.attributes('max')).toBe('8.5')

    await wrapper.get<HTMLInputElement>('[data-role="vtg-more"]').setValue(false)
    await selectSpeedRatio(wrapper, '1:3')
    expect(beat.attributes('max')).toBe('4.5')
    expect(beat.element.value).toBe('4.5')

    wrapper.unmount()
  })

  it.each(['1:1', '1:2'] as const)(
    'enables the reciprocal transition controls at %s',
    async (speedRatio) => {
      const concept = 'vtg'
      for (const qtrEnabled of [false, true]) {
        const wrapper = await mountVtgPane(qtrEnabled)
        await wrapper.get('[data-cell-reference="5-1"]').trigger('click')

        await selectSpeedRatio(wrapper, speedRatio)
        const ratio = wrapper.get<HTMLInputElement>(`input[value="${speedRatio}"]`)

        expect(ratio.element.checked).toBe(true)
        expect(
          wrapper.get<HTMLButtonElement>(`[data-role="${concept}-transition"]`).element.disabled,
        ).toBe(false)
        expect(
          wrapper.get<HTMLSelectElement>('[data-role="vtg-transition-beats"]').element.disabled,
        ).toBe(true)
        expect(
          wrapper.get<HTMLInputElement>('[data-role="vtg-transition-quad"]').element.disabled,
        ).toBe(true)
        expect(
          wrapper.get<HTMLInputElement>('[data-role="vtg-transition-second"]').element.disabled,
        ).toBe(true)
        expect(wrapper.find(`[data-role="${concept}-double"]`).exists()).toBe(false)

        await wrapper.get<HTMLButtonElement>(`[data-role="${concept}-transition"]`).trigger('click')
        expect(
          wrapper.get<HTMLSelectElement>('[data-role="vtg-transition-beats"]').element.disabled,
        ).toBe(false)
        expect(
          wrapper.get<HTMLInputElement>('[data-role="vtg-transition-quad"]').element.disabled,
        ).toBe(false)

        await selectSpeedRatio(wrapper, '1:5')
        expect(wrapper.find(`[data-role="${concept}-double"]`).exists()).toBe(false)
        expect(
          wrapper.get<HTMLButtonElement>(`[data-role="${concept}-transition"]`).element.disabled,
        ).toBe(false)

        wrapper.unmount()
      }
    },
  )

  it('shows reciprocal transitions at every production ratio and warns only for active 1:1 transitions', async () => {
    vi.stubGlobal('location', new URL(`https://${PRODUCTION_PWA_HOSTNAME}`))
    const wrapper = mount(VtgPane)

    for (const speedRatio of ['1:1', '1:2', '1:3', '1:4', '1:5'] as const) {
      await selectSpeedRatio(wrapper, speedRatio)
      expect(wrapper.find('[data-role="vtg-transition-controls"]').exists()).toBe(true)
      expect(wrapper.get<HTMLButtonElement>('[data-role="vtg-transition"]').element.disabled).toBe(
        false,
      )
    }

    await wrapper.get('[data-role="vtg-transition"]').trigger('click')

    await selectSpeedRatio(wrapper, '1:1')
    expect(wrapper.get('[data-role="vtg-transition-static-note"]').text()).toBe(
      'Some or all of these 45° Transitions may only work with Static Props in the current ratio selection.',
    )

    for (const speedRatio of ['1:2', '1:3', '1:4', '1:5'] as const) {
      await selectSpeedRatio(wrapper, speedRatio)
      expect(wrapper.find('[data-role="vtg-transition-static-note"]').exists()).toBe(false)
    }
  })

  it('enables transition timing, Quad, and Second controls as their prerequisites activate', async () => {
    const wrapper = mount(VtgPane)
    await wrapper.get('[data-cell-reference="5-1"]').trigger('click')

    const qSlots = wrapper.get<HTMLButtonElement>('[data-role="vtg-transition-qslots"]')
    expect(qSlots.element.disabled).toBe(true)
    expect(qSlots.text()).toBe('QSlots')
    expect(qSlots.attributes('aria-label')).toBe('Use the detected transition with Quick Slots')

    expect(
      wrapper.get<HTMLSelectElement>('[data-role="vtg-transition-beats"]').element.disabled,
    ).toBe(true)
    expect(
      wrapper.get<HTMLInputElement>('[data-role="vtg-transition-quad"]').element.disabled,
    ).toBe(true)
    expect(
      wrapper.get<HTMLInputElement>('[data-role="vtg-transition-second"]').element.disabled,
    ).toBe(true)
    await wrapper.get('[data-role="vtg-transition"]').trigger('click')

    const transition = wrapper.get<HTMLInputElement>('[data-role="vtg-transition"]')
    const selector = wrapper.get<HTMLSelectElement>('[data-role="vtg-transition-beats"]')
    const quad = wrapper.get<HTMLInputElement>('[data-role="vtg-transition-quad"]')
    const right = wrapper.get<HTMLInputElement>('[data-role="vtg-right"]')
    expect(selector.element.value).toBe('4')
    expect(selector.attributes('aria-label')).toBe('Choose the beat interval between transitions')
    expect(selector.element.closest('label')?.getAttribute('aria-describedby')).toBeTruthy()
    expect(selector.findAll('option').map((option) => option.text())).toEqual([
      '6',
      '5',
      '4',
      '3',
      '2',
    ])
    expect(quad.element.type).toBe('checkbox')
    expect(selector.element.disabled).toBe(false)
    expect(quad.element.disabled).toBe(false)
    expect(qSlots.element.disabled).toBe(false)
    expect(qSlots.classes()).not.toContain('pattern-transition-controls__button--available')
    expect(quad.element.checked).toBe(false)
    expect(quad.element.nextElementSibling?.textContent).toBe('Quad')
    const disabledSecond = wrapper.get<HTMLInputElement>('[data-role="vtg-transition-second"]')
    expect(disabledSecond.element.disabled).toBe(true)
    expect(
      transition.element.compareDocumentPosition(selector.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      quad.element.compareDocumentPosition(right.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(selector.element.closest('fieldset')).toBe(quad.element.closest('fieldset'))

    await quad.setValue(true)
    const second = wrapper.get<HTMLInputElement>('[data-role="vtg-transition-second"]')
    expect(second.element.disabled).toBe(false)
    expect(second.element.checked).toBe(false)
    expect(second.element.nextElementSibling?.textContent).toBe('Second')
    const secondTooltipId = second.element.closest('label')?.getAttribute('aria-describedby')
    expect(secondTooltipId).toBeTruthy()
    expect(second.attributes('aria-label')).toBe('Start the Quad transition with the second prop')
    expect(
      quad.element.compareDocumentPosition(second.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await second.setValue(true)
    await selector.setValue('3')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      {
        reference: '5-1',
        speedRatio: '1:3',
        transition: true,
        transitionAfterBeat: true,
        transitionBeats: 3,
        transitionQuad: true,
        transitionSecond: true,
      },
    ])

    await wrapper.get('[data-role="vtg-transition"]').trigger('click')
    expect(selector.element.disabled).toBe(true)
    expect(quad.element.disabled).toBe(true)
    expect(second.element.disabled).toBe(true)
    expect(qSlots.element.disabled).toBe(true)
  })

  it('creates five transition QSlots and warns only before replacing populated slots', async () => {
    const store = useConceptsStore()
    const animation = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:3',
      transition: true,
      transitionBeats: 5,
      transitionQuad: true,
    })
    if (!animation) throw new Error('Expected a supported VTG transition')
    const savedPaths = Array.from(
      { length: 5 },
      (_unused, index) => `/play-vtg?r=transition-${index + 1}&v=6`,
    )
    const wrapper = mount(VtgPane, {
      props: {
        animation,
        onQuickSlotsCreate: (animations: readonly RootDataFinal[]) => {
          expect(animations).toHaveLength(5)
          store.replaceQuickSlots(savedPaths)
        },
      },
    })
    await vi.waitFor(() => {
      expect(
        wrapper.get<HTMLButtonElement>('[data-role="vtg-transition-qslots"]').element.disabled,
      ).toBe(false)
    })

    const qSlots = wrapper.get('[data-role="vtg-transition-qslots"]')
    await qSlots.trigger('click')

    const warning = wrapper.get<HTMLDialogElement>('.qslots-warning')
    expect(warning.element.open).toBe(false)
    await vi.waitFor(() => expect(store.quickSlotCount).toBe(5))
    expect(store.quickSlotPaths).toEqual(savedPaths)
    expect(store.selectedQuickSlot).toBeNull()
    expect(wrapper.emitted('quickSlotsCreate')).toHaveLength(1)

    await qSlots.trigger('click')
    expect(warning.element.open).toBe(true)
    expect(warning.text()).toContain('Are you sure?')
    expect(warning.text()).toContain('Do not show again')

    await wrapper.get('.qslots-warning__cancel').trigger('click')
    expect(warning.element.open).toBe(false)
    expect(store.quickSlotPaths).toEqual(savedPaths)
    expect(store.selectedQuickSlot).toBeNull()

    await qSlots.trigger('click')
    await wrapper.get<HTMLInputElement>('.qslots-warning__choice input').setValue(true)
    await wrapper.get('.qslots-warning__proceed').trigger('click')
    await nextTick()
    expect(warning.element.open).toBe(false)
    expect(store.quickSlotCount).toBe(5)
    expect(store.quickSlotPaths).toEqual(savedPaths)
    expect(store.selectedQuickSlot).toBeNull()

    await qSlots.trigger('click')
    expect(warning.element.open).toBe(false)
    expect(store.quickSlotPaths).toEqual(savedPaths)
  })

  it('accepts a directly extracted QSlot match without phase shifting', async () => {
    const animation = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:3',
      transition: true,
      transitionBeats: 5,
      transitionQuad: true,
    })
    if (!animation) throw new Error('Expected a supported VTG transition')

    const candidates = createVtgTransitionQuickSlotAnimationCandidates(animation)
    const expectedThirdSlot = candidates?.[2]
    if (!expectedThirdSlot) throw new Error('Expected a candidate for the third Quick Slot')
    const directMatches = [
      ...findVtgPatternMatches(expectedThirdSlot),
      ...findQtrPatternMatches(expectedThirdSlot),
    ]
    expect(directMatches).not.toHaveLength(0)

    let createdSlots: readonly RootDataFinal[] | undefined
    const wrapper = mount(VtgPane, {
      props: {
        animation,
        onQuickSlotsCreate: (animations: readonly RootDataFinal[]) => {
          createdSlots = animations
        },
      },
    })
    await vi.waitFor(() => {
      expect(
        wrapper.get<HTMLButtonElement>('[data-role="vtg-transition-qslots"]').element.disabled,
      ).toBe(false)
    })

    await wrapper.get('[data-role="vtg-transition-qslots"]').trigger('click')
    await vi.waitFor(() => expect(createdSlots).toHaveLength(5))

    expect(createdSlots?.[2]).toEqual(expectedThirdSlot)
  })

  it('creates every Quick Slot without displaying a persistent partial-match warning', async () => {
    const store = useConceptsStore()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const animation = createDefaultVtgAnimation({
      reference: '5-1',
      speedRatio: '1:3',
      transition: true,
      transitionBeats: 3,
      transitionQuad: true,
      transitionSecond: true,
    })
    if (!animation) throw new Error('Expected a supported VTG transition')
    const sourceMatch = findVtgPatternMatches(animation)[0]
    if (!sourceMatch) throw new Error('Expected the source transition to match')
    const patternMatcher: PatternMatchingClient = {
      matchVtg: vi
        .fn<PatternMatchingClient['matchVtg']>()
        .mockResolvedValueOnce({ status: 'matched', source: 'vtg', match: sourceMatch })
        .mockResolvedValue({ status: 'unmatched' }),
      matchEightStep: vi
        .fn<PatternMatchingClient['matchEightStep']>()
        .mockResolvedValue({ status: 'unmatched' }),
      matchQst: vi
        .fn<PatternMatchingClient['matchQst']>()
        .mockResolvedValue({ status: 'unmatched' }),
    }
    let createdSlots: readonly RootDataFinal[] | undefined
    const wrapper = mount(VtgPane, {
      props: {
        animation,
        patternMatcher,
        onQuickSlotsCreate: (animations: readonly RootDataFinal[]) => {
          createdSlots = animations
        },
      },
    })

    await vi.waitFor(() => {
      expect(
        wrapper.get<HTMLButtonElement>('[data-role="vtg-transition-qslots"]').element.disabled,
      ).toBe(false)
    })
    await wrapper.get('[data-role="vtg-transition-qslots"]').trigger('click')
    await vi.waitFor(() => expect(createdSlots).toHaveLength(5))

    expect(store.quickSlotCount).toBe(0)
    expect(createdSlots).toHaveLength(5)
    expect(wrapper.emitted('quickSlotsCreate')).toHaveLength(1)
    expect(wrapper.find('[data-role="vtg-transition-qslots-error"]').exists()).toBe(false)
    expect(warning).toHaveBeenCalledWith(
      'VTG Quick Slots 2, 3, 4, 5 did not resolve to a known pattern; the generated extractions were used.',
    )
    warning.mockRestore()
  })

  it('hydrates a detected experimental transition timing', async () => {
    const animation = createDefaultVtgAnimation({
      reference: '5-1',
      speedRatio: '1:3',
      transition: true,
      transitionBeats: 2,
      transitionQuad: true,
      transitionSecond: true,
    })
    if (!animation) throw new Error('Expected a supported VTG animation')

    const wrapper = mount(VtgPane, { props: { animation } })
    await vi.waitFor(() => {
      expect(
        wrapper.get<HTMLSelectElement>('[data-role="vtg-transition-beats"]').element.value,
      ).toBe('2')
      expect(
        wrapper.get<HTMLInputElement>('[data-role="vtg-transition-quad"]').element.checked,
      ).toBe(true)
      expect(
        wrapper.get<HTMLInputElement>('[data-role="vtg-transition-second"]').element.checked,
      ).toBe(true)
      expect(
        wrapper.get<HTMLButtonElement>('[data-role="vtg-transition-qslots"]').element.disabled,
      ).toBe(false)
    })
  })

  it('uses Flip to select the alternate QTR orientation without quarter radios', async () => {
    const wrapper = await mountVtgPane(true)
    const reverse = wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]')

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-concept')).toBe('vtg')
    expect(wrapper.find('[data-role="vtg-quarters"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-quarters-2"]').exists()).toBe(false)
    expect(wrapper.findAll('.vtg-top-options .vtg-pattern-options label')).toHaveLength(5)
    expect(reverse.attributes('aria-label')).toBe('Flip QTR orientation and direction')
    expect(reverse.element.nextElementSibling?.textContent).toBe('Flip')

    await wrapper.get('[data-cell-reference="2-6"]').trigger('click')
    await reverse.setValue(true)

    expect(wrapper.emitted('patternSelect')).toEqual([
      [{ reference: '2-6', speedRatio: '1:3', quarters: 1 }],
      [{ reference: '2-6', speedRatio: '1:3', reversePlane: true, quarters: 1 }],
    ])
  })

  it('hydrates an exact selected QTR cell without replacing it with a regular alias', async () => {
    const store = useConceptsStore()
    store.spacing = 9
    const animation = createDefaultQtrAnimation({
      reference: '3-4',
      speedRatio: '1:5',
      quarters: 1,
      spacing: 2,
    })
    if (!animation) throw new Error('Expected a supported VTG animation')

    const wrapper = mount(VtgPane, { props: { animation } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('3-4')
    })

    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('input[value="1:5"]').element.checked).toBe(true)
    expect(wrapper.find('[data-role="vtg-quarters"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-spacing"]').element.value).toBe('9')
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })

  it('does not emit a stale selection when hydration switches from QTR to VTG', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const decode = (query: string) => codec.decodeQS(Object.fromEntries(new URLSearchParams(query)))
    const qtrAnimation = decode(
      'r=Ew08Yk11Y&p0=Q__.g_______s.5E0wm.......&m0=_1_mxqv__&p1=N__.5L______s.___wm.......&c=_i_bhq&v=6',
    )
    const vtgAnimation = decode(
      'r=Ew08Yk11Y&p0=Q__.blE_____s.5JEs8.......&m0=_1_mxqv__&p1=N__.blE_____s.5L_s8.......&c=_i_bhq&v=6',
    )
    const wrapper = mount(VtgPane, { props: { animation: qtrAnimation } })

    await wrapper.setProps({ animation: vtgAnimation })
    await vi.waitFor(() => {
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').element.checked).toBe(false)
    })
    await nextTick()

    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })

  it('resets VTG controls while keeping and reapplying the selected pattern', async () => {
    const wrapper = mount(VtgPane)
    await wrapper.get('[data-cell-reference="5-6"]').trigger('click')
    await wrapper.get('[data-role="vtg-spin-toggle"]').trigger('click')
    await selectSpeedRatio(wrapper, '1:5')
    await wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').setValue(true)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').setValue(true)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-scale"]').setValue(0.7)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-thick"]').setValue(12)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-spacing"]').setValue(12)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-bpm"]').setValue(90)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-paths"]').setValue(false)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-hands"]').setValue(true)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-arms"]').setValue(false)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').setValue(true)
    const emissionCount = wrapper.emitted('patternSelect')?.length ?? 0

    await wrapper.get('[data-role="vtg-reset"]').trigger('click')
    await nextTick()

    expect(wrapper.get('.pattern-reset-dialog').attributes()).toHaveProperty('open')
    expect(wrapper.get('.pattern-reset-dialog__message').text()).toBe(
      'Are you sure? This restores the current pattern and its controls to their defaults.',
    )
    expect(wrapper.get<HTMLInputElement>('input[value="1:5"]').element.checked).toBe(true)
    expect(wrapper.emitted('patternSelect')).toHaveLength(emissionCount)

    await wrapper.get('.pattern-reset-dialog__actions button').trigger('click')
    expect(wrapper.find('.pattern-reset-dialog').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[value="1:5"]').element.checked).toBe(true)
    expect(wrapper.emitted('patternSelect')).toHaveLength(emissionCount)

    await wrapper.get('[data-role="vtg-reset"]').trigger('click')
    await nextTick()
    await wrapper.get('.pattern-reset-dialog__confirm').trigger('click')
    await nextTick()

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('5-6')
    expect(wrapper.get<HTMLInputElement>('input[value="1:3"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-scale"]').element.value).toBe('0.8')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-thick"]').element.value).toBe('5')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-spacing"]').element.value).toBe('1')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-bpm"]').element.value).toBe('40')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-paths"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-hands"]').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-arms"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').element.checked).toBe(false)
    expect(wrapper.find('[data-role="vtg-quarters"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-quarters-2"]').exists()).toBe(false)
    expect(wrapper.emitted('patternSelect')).toHaveLength(emissionCount + 1)
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { reference: '5-6', speedRatio: '1:3', isAnti: false },
    ])
  })

  it('offers Scale, Thick, Spacing, and BPM sliders that reapply the current pattern', async () => {
    const wrapper = mount(VtgPane)
    const bpm = wrapper.get<HTMLInputElement>('[data-role="vtg-bpm"]')
    const scale = wrapper.get<HTMLInputElement>('[data-role="vtg-scale"]')
    const thick = wrapper.get<HTMLInputElement>('[data-role="vtg-thick"]')
    const spacing = wrapper.get<HTMLInputElement>('[data-role="vtg-spacing"]')
    const outputs = wrapper.findAll('fieldset.vtg-slider-controls output')

    expect(
      wrapper
        .get('.vtg-pattern-options')
        .element.compareDocumentPosition(wrapper.get('.vtg-slider-controls').element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    expect(bpm.attributes()).toMatchObject({ min: '20', max: '140', step: '1' })
    expect(scale.attributes()).toMatchObject({ min: '0.5', max: '1.4', step: '0.1' })
    expect(thick.attributes()).toMatchObject({ min: '1', max: '15', step: '1' })
    expect(spacing.attributes()).toMatchObject({ min: '0', max: '20', step: '1' })
    expect(bpm.element.value).toBe('40')
    expect(scale.element.value).toBe('0.8')
    expect(thick.element.value).toBe('5')
    expect(spacing.element.value).toBe('1')
    expect(outputs.map((output) => output.text())).toEqual(['0.8', '5', '1', '40'])

    await wrapper.get('[data-cell-reference="1-6"]').trigger('click')
    await bpm.setValue(41)
    await scale.setValue(1.4)
    await thick.setValue(15)
    await spacing.setValue(20)

    expect(wrapper.emitted('customize')).toHaveLength(4)
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({
      reference: '1-6',
      speedRatio: '1:3',
      bpm: 41,
      scale: 1.4,
      thick: 15,
      spacing: 20,
    })
    expect(outputs.map((output) => output.text())).toEqual(['1.4', '15', '20', '41'])
  })

  it('places rendering controls and sliders inside Customize for VTG and Qtr', async () => {
    const concept = 'vtg'
    for (const qtrEnabled of [false, true]) {
      const wrapper = await mountVtgPane(qtrEnabled)
      const paths = wrapper.get<HTMLInputElement>('[data-role="vtg-paths"]')
      const hands = wrapper.get<HTMLInputElement>('[data-role="vtg-hands"]')
      const arms = wrapper.get<HTMLInputElement>('[data-role="vtg-arms"]')
      const options = wrapper.get('.vtg-render-options')

      expect(paths.element.checked).toBe(true)
      expect(hands.element.checked).toBe(false)
      expect(arms.element.checked).toBe(true)
      expect(paths.element.nextElementSibling?.textContent).toBe('Paths')
      expect(hands.element.nextElementSibling?.textContent).toBe('Hands')
      expect(arms.element.nextElementSibling?.textContent).toBe('Arms')
      expect(options.classes()).toContain('vtg-pattern-options')
      const playbackControls = wrapper.get(`[data-role="${concept}-playback-controls"]`).element
      const transitionControls = wrapper.get('[data-role="vtg-transition-controls"]').element
      const buttonRows = wrapper.get('.concept-button-rows').element
      const customize = wrapper.get<HTMLDetailsElement>('[data-role="vtg-customize"]').element
      const sliders = wrapper.get('.vtg-slider-controls').element
      const colors = wrapper.get('.concept-color-controls').element
      const qtr = wrapper.get<HTMLInputElement>(`[data-role="${concept}-qtr"]`).element
      const beat = wrapper.get<HTMLInputElement>(`[data-role="${concept}-beat"]`).element
      expect(qtr.compareDocumentPosition(beat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(
        playbackControls.compareDocumentPosition(transitionControls) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(
        transitionControls.compareDocumentPosition(options.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(playbackControls.parentElement).toBe(buttonRows)
      expect(transitionControls.parentElement).toBe(buttonRows)
      expect(customize.open).toBe(false)
      expect(customize.contains(options.element)).toBe(true)
      expect(customize.contains(sliders)).toBe(true)
      expect(customize.contains(colors)).toBe(true)
      expect(
        options.element.compareDocumentPosition(sliders) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(
        sliders.compareDocumentPosition(colors) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()

      wrapper.unmount()
    }
  })

  it('shows development-only Turns in Properties and omits Properties from Builder', async () => {
    vi.stubGlobal('location', new URL('http://localhost:8080'))
    const wrapper = mount(VtgPane)
    await nextTick()
    const properties = wrapper.get('[data-role="vtg-properties"]').element
    const customize = wrapper.get('[data-role="vtg-customize"]').element
    expect(wrapper.find('[data-role="vtg-property-turns-toggle"]').exists()).toBe(true)

    expect(
      properties.compareDocumentPosition(customize) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    wrapper.unmount()

    const builderWrapper = mount(VtgPane, {
      props: { builderActive: true, builderFullCatalog: true },
    })
    expect(builderWrapper.find('[data-role="vtg-properties"]').exists()).toBe(false)

    builderWrapper.unmount()
    vi.stubGlobal('location', new URL(`https://${PRODUCTION_PWA_HOSTNAME}`))

    const productionWrapper = mount(VtgPane)
    await nextTick()
    expect(productionWrapper.find('[data-role="vtg-properties"]').exists()).toBe(true)
    expect(productionWrapper.find('[data-role="vtg-property-turns-toggle"]').exists()).toBe(false)
  })

  it('replaces every Concepts slider with the compact step controls when Sliders is off', async () => {
    const store = useConceptsStore()
    store.sliders = false
    const wrapper = mount(VtgPane)

    expect(wrapper.find('[data-role="vtg-scale"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-thick"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-spacing"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-bpm"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-beat"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-sliders"]').element.checked).toBe(false)
    expect(wrapper.get('.pattern-playback-controls__beat-slider').classes()).toContain(
      'pattern-playback-controls__beat-slider--stepper',
    )

    await wrapper.get('[data-role="vtg-scale-stepper-increase"]').trigger('click')
    await wrapper.get('[data-role="vtg-thick-stepper-increase"]').trigger('click')
    await wrapper.get('[data-role="vtg-spacing-stepper-increase"]').trigger('click')
    await wrapper.get('[data-role="vtg-bpm-stepper-increase"]').trigger('click')
    await wrapper.get('[data-role="vtg-beat-stepper-increase"]').trigger('click')

    expect({
      scale: store.scale,
      thick: store.thick,
      spacing: store.spacing,
      bpm: store.bpm,
      beat: wrapper.get('[data-role="vtg-beat-stepper"]').text(),
    }).toEqual({ scale: 0.9, thick: 6, spacing: 2, bpm: 50, beat: '1.5' })

    await wrapper.get<HTMLInputElement>('[data-role="vtg-sliders"]').setValue(true)
    expect(wrapper.find('[data-role="vtg-scale"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-beat"]').exists()).toBe(true)
    expect(wrapper.get('.pattern-playback-controls__beat-slider').classes()).not.toContain(
      'pattern-playback-controls__beat-slider--stepper',
    )
  })

  it('reapplies the selected pattern when rendering checkboxes change', async () => {
    const wrapper = mount(VtgPane)
    const paths = wrapper.get<HTMLInputElement>('[data-role="vtg-paths"]')
    const hands = wrapper.get<HTMLInputElement>('[data-role="vtg-hands"]')
    const arms = wrapper.get<HTMLInputElement>('[data-role="vtg-arms"]')

    await wrapper.get('[data-cell-reference="1-6"]').trigger('click')
    await paths.setValue(false)
    await hands.setValue(true)
    await arms.setValue(false)

    expect(wrapper.emitted('customize')).toHaveLength(3)
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({
      reference: '1-6',
      speedRatio: '1:3',
      paths: false,
      hands: true,
      arms: false,
    })
  })

  it('restores a slider for touch input on a desktop-class hybrid device', async () => {
    const wrapper = mount(VtgPane)
    const scale = wrapper.get<HTMLInputElement>('[data-role="vtg-scale"]')

    expect(wrapper.get('.concept-slider-controls').classes()).toContain(
      'concept-slider-controls--touch',
    )

    await wrapper.get('[data-cell-reference="1-6"]').trigger('click')
    await scale.trigger('pointerdown', { pointerId: 7, pointerType: 'touch' })
    await scale.setValue(1.2)
    await scale.trigger('pointercancel', { pointerId: 7, pointerType: 'touch' })

    expect(scale.element.value).toBe('0.8')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { reference: '1-6', speedRatio: '1:3' },
    ])
  })

  it('hydrates every VTG control from a supported animation without selecting it again', async () => {
    const wrapper = mount(VtgPane)
    const animation = createDefaultVtgAnimation({
      reference: '5-6',
      speedRatio: '1:3',
      isAnti: true,
      swapProps: true,
      reversePlane: true,
      bpm: 87,
      scale: 0.6,
      thick: 12,
      paths: false,
      hands: true,
      arms: false,
    })
    if (!animation) throw new Error('Expected a supported VTG animation')

    await wrapper.setProps({ animation })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('5-6')
    })

    expect(wrapper.get<HTMLInputElement>('input[value="1:3"]').element.checked).toBe(true)
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').text()).toBe('Anti')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-bpm"]').element.value).toBe('87')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-scale"]').element.value).toBe('0.6')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-thick"]').element.value).toBe('12')
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-paths"]').element.checked).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-hands"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('[data-role="vtg-arms"]').element.checked).toBe(false)
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })

  it('rehydrates when Editor publishes an in-place shared animation change', async () => {
    const initial = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const updated = createDefaultVtgAnimation({ reference: '5-6', speedRatio: '1:3' })
    if (!initial || !updated) throw new Error('Expected supported VTG animations')

    const animation = initial
    const wrapper = mount(VtgPane, { props: { animation, animationRevision: 0 } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-1')
    })

    animation.props.splice(0, animation.props.length, ...structuredClone(updated.props))
    await wrapper.setProps({ animation: { ...animation } })
    await flushPromises()
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-1')

    await wrapper.setProps({ animationRevision: 1 })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('5-6')
    })
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })

  it('canonicalizes an external revision after this pane emitted a previous cell', async () => {
    const initial = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const updated = createDefaultVtgAnimation({ reference: '5-6', speedRatio: '1:3' })
    if (!initial || !updated) throw new Error('Expected supported VTG animations')

    const requests: Parameters<PatternMatchingClient['matchVtg']>[0][] = []
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async (request) => {
        requests.push(request)
        if (requests.length === 1) {
          return {
            status: 'matched',
            source: 'vtg',
            match: {
              reference: '1-1',
              speedRatio: '1:3',
              isAnti: false,
              swapProps: false,
              reversePlane: false,
              bpm: 40,
              scale: 0.8,
            },
          }
        }
        if (request.lastSelection) return { status: 'unchanged' }
        return {
          status: 'matched',
          source: 'vtg',
          match: {
            reference: '5-6',
            speedRatio: '1:3',
            isAnti: false,
            swapProps: false,
            reversePlane: false,
            bpm: 40,
            scale: 0.8,
          },
        }
      },
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, {
      props: { animation: initial, animationRevision: 0, patternMatcher },
    })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-1')
    })

    await wrapper.get('[data-cell-reference="1-1"]').trigger('click')
    await wrapper.setProps({ animation: updated, animationRevision: 1 })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('5-6')
    })
    expect(requests.at(-1)?.lastSelection).toBeUndefined()
  })

  it('hydrates the exact Q2 phase with its reproducible rotation value', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const animation = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.mBE_____q.5JEsR.......&m0=_1_mxqv__&p1=N__.mBE_____q.5JEsR.......&c=_f_bhq&v=6',
        ),
      ),
    )
    const wrapper = mount(VtgPane, { props: { animation } })

    await vi.waitFor(
      () => {
        expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-3')
      },
      { timeout: 3_000 },
    )

    const rotate = wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]')
    expect(rotate.element.value).toBe('-90')
    expect(rotate.element.disabled).toBe(false)
    expect(rotate.findAll('option').map((option) => option.text())).toContain('-90°')
  })

  it('hydrates the canonical exact orientation for the supplied oddball pattern', async () => {
    const version = await loadSpiroAnimQSVersion(6)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      6,
    )
    const animation = codec.decodeQS(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.5E0vF___q._U0sR.......&m0=_1_mxqv__&p1=N__.g__uf___q.5E0vF.......&c=_f_bhq&v=6',
        ),
      ),
    )
    const wrapper = mount(VtgPane, { props: { animation } })

    await vi.waitFor(() => {
      expect(wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').element.value).toBe(
        '0',
      )
    })
  })

  it('adds a detected nonstandard rotation to the selector', async () => {
    const animation = createDefaultVtgAnimation({ reference: '3-5', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({
        status: 'matched',
        source: 'vtg',
        match: {
          reference: '3-5',
          speedRatio: '1:3',
          isAnti: false,
          swapProps: false,
          reversePlane: false,
          orientation: 23,
          bpm: 40,
          scale: 0.8,
        },
      }),
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, { props: { animation, patternMatcher } })

    await vi.waitFor(() => {
      expect(wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').element.value).toBe(
        '23',
      )
    })
    expect(
      wrapper
        .get<HTMLSelectElement>('[data-role="vtg-orientation"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toContain('23°')
  })

  it('opens More when pattern matching detects a speed ratio outside the radio options', async () => {
    const store = useConceptsStore()
    store.speedRatio = '1:1v1:3'
    const animation = createDefaultVtgAnimation({ reference: '3-5', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({
        status: 'matched',
        source: 'vtg',
        match: {
          reference: '3-5',
          speedRatio: '1:1v1:3',
          isAnti: false,
          swapProps: false,
          reversePlane: false,
          bpm: 40,
          scale: 0.8,
        },
      }),
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, { props: { animation, patternMatcher } })

    await vi.waitFor(() => {
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-more"]').element.checked).toBe(true)
    })
    expect(
      wrapper.get<HTMLSelectElement>('[aria-label="Left prop timing ratio"]').element.value,
    ).toBe('1:1')
    expect(
      wrapper.get<HTMLSelectElement>('[aria-label="Right prop timing ratio"]').element.value,
    ).toBe('1:3')
  })

  it.each(['1:1', '1:3', '1:5'] as const)(
    'hydrates the row-first lower-table cells after query serialization at %s',
    async (speedRatio) => {
      const version = await loadSpiroAnimQSVersion(6)
      const codec = await useSpiroAnimQS(
        version.VDEF,
        useBaseQS(version.VDEF, { charset: version.CHARSET }),
        6,
      )
      for (const reference of ['3-5', '3-6', '4-5', '4-6'] as const) {
        const source = createDefaultVtgAnimation({ reference, speedRatio })
        if (!source) throw new Error(`Expected a supported VTG animation for ${reference}`)
        const animation = await codec.decodeVer(codec.encodeQS(source, false))
        const wrapper = mount(VtgPane, { props: { animation } })
        await vi.waitFor(() => {
          expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe(
            reference,
          )
        })
        wrapper.unmount()
      }
    },
  )

  it('carries detected prop phase alignment into subsequently selected cells', async () => {
    const animation = createDefaultVtgAnimation({ reference: '3-5', speedRatio: '1:3', beat: 4 })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({
        status: 'matched',
        source: 'vtg',
        match: {
          reference: '5-3',
          speedRatio: '1:3',
          isAnti: false,
          swapProps: false,
          reversePlane: false,
          beat: 2,
          propRotationOffsets: [180, 0],
          bpm: 40,
          scale: 0.8,
        },
      }),
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, { props: { animation, patternMatcher } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('5-3')
    })

    await wrapper.get('[data-cell-reference="5-3"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      {
        reference: '5-3',
        speedRatio: '1:3',
        beat: 2,
        propRotationOffsets: [180, 0],
      },
    ])

    await wrapper.get('[data-cell-reference="5-4"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      {
        reference: '5-4',
        speedRatio: '1:3',
        beat: 2,
        propRotationOffsets: [180, 0],
      },
    ])
  })

  it('applies and clears each prop offset through pattern selections', async () => {
    const animation = createDefaultVtgAnimation({ reference: '3-5', speedRatio: '1:3', beat: 4 })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({
        status: 'matched',
        source: 'vtg',
        match: {
          reference: '5-3',
          speedRatio: '1:3',
          isAnti: false,
          swapProps: false,
          reversePlane: false,
          beat: 2,
          propRotationOffsets: [90, 0],
          bpm: 40,
          scale: 0.8,
        },
      }),
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, { props: { animation, patternMatcher } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('5-3')
    })

    await wrapper.get('[data-role="vtg-property-offset-toggle"]').trigger('click')
    const leftInput = wrapper.get<HTMLInputElement>('[data-role="vtg-offset-0-input"]')
    const rightInput = wrapper.get<HTMLInputElement>('[data-role="vtg-offset-1-input"]')
    expect([leftInput.element.value, rightInput.element.value]).toEqual(['90', '0'])

    await rightInput.setValue('37')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      propRotationOffsets: [90, 37],
    })

    await wrapper.get('button[aria-label="Clear Left offset"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      propRotationOffsets: [0, 37],
    })

    await wrapper.get('button[aria-label="Clear Right offset"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).not.toHaveProperty('propRotationOffsets')

    const leftSlider = wrapper.get<HTMLInputElement>('[data-role="vtg-offset-0"]')
    leftSlider.element.value = '-90'
    await leftSlider.trigger('input')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      propRotationOffsets: [-90, 0],
    })

    leftSlider.element.value = '0'
    await leftSlider.trigger('input')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).not.toHaveProperty('propRotationOffsets')
  })

  it('rehydrates and carries arbitrary QTR prop rotations between cells', async () => {
    const version = await loadSpiroAnimQSVersion(11)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      11,
    )
    const decode = (query: string) => codec.decodeQS(Object.fromEntries(new URLSearchParams(query)))
    const positiveAnimation = decode(
      'r=Ew08Yk11Y&p0=Q__.mBEQYq.5JEQpg.......&x0=_s_&m0=_1_mxqv__&p1=N__.bn_.5L_Qpg.......&x1=_s_&c=_i_bhq&v=11',
    )
    const negativeAnimation = decode(
      'r=Ew08Yk11Y&p0=Q__.mBEQKm.5JEQpg.......&x0=_s_&m0=_1_mxqv__&p1=N__.bn_.5L_Qpg.......&x1=_s_&c=_i_bhq&v=11',
    )
    const wrapper = mount(VtgPane, {
      props: { animation: positiveAnimation, animationRevision: 0 },
    })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('2-2')
    })

    await wrapper.get('[data-cell-reference="2-2"]').trigger('click')

    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '2-2',
      speedRatio: '1:3',
      quarters: 1,
      propRotationOffsets: [45, 0],
    })
    await wrapper.get('[data-cell-reference="2-3"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '2-3',
      propRotationOffsets: [45, 0],
    })

    await wrapper.setProps({ animation: negativeAnimation, animationRevision: 1 })
    await flushPromises()
    await wrapper.get('[data-cell-reference="2-2"]').trigger('click')

    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '2-2',
      speedRatio: '1:3',
      quarters: 1,
      propRotationOffsets: [-45, 0],
    })
    await wrapper.get('[data-cell-reference="2-3"]').trigger('click')
    expect(wrapper.emitted('patternSelect')?.at(-1)?.[0]).toMatchObject({
      reference: '2-3',
      propRotationOffsets: [-45, 0],
    })
  })

  it('preserves direction while marking beat-varying hybrid timing indeterminate', async () => {
    const initialSelection = {
      reference: '1-1',
      speedRatio: '1:1v1:3',
      beat: 1,
    } as const
    const animation = createDefaultVtgAnimation(initialSelection)
    if (!animation) throw new Error('Expected a supported VTG animation')
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({
        status: 'matched',
        source: 'vtg',
        match: {
          ...initialSelection,
          isAnti: false,
          swapProps: false,
          reversePlane: false,
          bpm: 40,
          scale: 0.8,
        },
      }),
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, { props: { animation, patternMatcher } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-1')
    })
    const target = () => wrapper.get('[data-cell-reference="1-1"]')
    expect(target().text()).toContain('TS / XO')

    await wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').setValue('1.5')
    expect(target().text()).toContain('TS / XO')

    await target().trigger('click')
    expect(target().text()).toContain('TS / XO')

    await wrapper.get<HTMLInputElement>('[data-role="vtg-elemental"]').setValue(true)
    expect(
      target()
        .findAll('.elemental-relationship-icons__icon')
        .map((icon) => icon.attributes('data-element')),
    ).toEqual(['Earth', 'Indeterminate'])
    expect(target().attributes('aria-label')).toContain('Earth / Indeterminate')

    await wrapper.get<HTMLInputElement>('[data-role="vtg-elemental"]').setValue(false)
    await wrapper.setProps({
      builderActive: true,
      builderFullCatalog: true,
      builderInsertionIndex: 1,
    })
    expect(target().text()).toContain('TS / XO')
  })

  it('ignores a stale match after a newer animation has been hydrated', async () => {
    const firstAnimation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const secondAnimation = createDefaultVtgAnimation({ reference: '3-4', speedRatio: '1:5' })
    if (!firstAnimation || !secondAnimation) throw new Error('Expected supported VTG animations')

    const first = createDeferred<VtgPatternMatchResult>()
    const second = createDeferred<VtgPatternMatchResult>()
    const matchVtg = vi
      .fn<PatternMatchingClient['matchVtg']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const patternMatcher: PatternMatchingClient = {
      matchVtg,
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, {
      props: { animation: firstAnimation, patternMatcher },
    })
    await vi.waitFor(() => expect(matchVtg).toHaveBeenCalledOnce())

    await wrapper.setProps({ animation: secondAnimation })
    await vi.waitFor(() => expect(matchVtg).toHaveBeenCalledTimes(2))

    second.resolve({
      status: 'matched',
      source: 'vtg',
      match: {
        reference: '3-4',
        speedRatio: '1:5',
        isAnti: false,
        swapProps: false,
        reversePlane: false,
        bpm: 60,
        scale: 0.8,
      },
    })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('3-4')
    })

    first.resolve({
      status: 'matched',
      source: 'vtg',
      match: {
        reference: '1-1',
        speedRatio: '1:3',
        isAnti: false,
        swapProps: false,
        reversePlane: false,
        bpm: 60,
        scale: 0.8,
      },
    })
    await flushPromises()

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('3-4')
  })

  it('prefers exact regeneration when hydrating equivalent 2-2 Trans patterns', async () => {
    const store = useConceptsStore()

    for (const example of [
      { authoredBeat: 3, detectedBeat: 3, authoredSwap: false, detectedSwap: false },
      { authoredBeat: 4, detectedBeat: 2, authoredSwap: true, detectedSwap: false },
    ] as const) {
      store.swapProps = example.authoredSwap
      store.reversePlane = false
      const animation = createDefaultVtgAnimation({
        reference: '2-2',
        speedRatio: '1:3',
        beat: example.authoredBeat,
        swapProps: example.authoredSwap,
        transition: true,
        transitionBeats: 5,
      })
      if (!animation) throw new Error('Expected a supported VTG animation')

      const wrapper = mount(VtgPane, { props: { animation } })
      await vi.waitFor(() => {
        expect(wrapper.get<HTMLInputElement>('[data-role="vtg-beat"]').element.value).toBe(
          String(example.detectedBeat),
        )
        expect(wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').element.checked).toBe(
          example.detectedSwap,
        )
      })

      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').element.checked).toBe(false)
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').element.checked).toBe(
        example.detectedSwap,
      )
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').element.checked).toBe(false)
      expect(wrapper.get<HTMLInputElement>('[data-role="vtg-transition-45"]').element.checked).toBe(
        true,
      )
      wrapper.unmount()
    }
  })

  it('hydrates the canonical match for a legacy 45 Trans animation', async () => {
    const animation = createDefaultVtgAnimation({
      reference: '6-3',
      speedRatio: '1:2',
      beat: 2,
      reversePlane: true,
      orientation: -90,
      initialTurnsOffset: -45,
    })
    if (!animation) throw new Error('Expected a transition-derived VTG animation')

    const wrapper = mount(VtgPane, { props: { animation } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-6')
    })
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })

  it('selects a random 1:3 pattern when the loaded animation is empty', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const populatedAnimation = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:3',
    })
    if (!populatedAnimation) throw new Error('Expected a supported VTG animation')

    const wrapper = mount(VtgPane, {
      props: {
        animation: {
          ...populatedAnimation,
          props: [],
        },
      },
    })
    await nextTick()

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-1')
    expect(wrapper.get<HTMLInputElement>('input[value="1:3"]').element.checked).toBe(true)
    expect(wrapper.emitted('patternSelect')).toEqual([[{ reference: '1-1', speedRatio: '1:3' }]])
  })

  it('keeps option updates enabled when the initial selection immediately feeds back', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const populatedAnimation = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:3',
    })
    if (!populatedAnimation) throw new Error('Expected a supported VTG animation')

    const animation = ref<RootDataFinal>({ ...populatedAnimation, props: [] })
    const applyPattern = vi.fn<(selection: VtgPatternSelection | QtrPatternSelection) => void>(
      (selection) => {
        const nextAnimation = createDefaultVtgAnimation(selection)
        if (nextAnimation) animation.value = nextAnimation
      },
    )
    const Host = defineComponent({
      components: { VtgPane },
      setup: () => ({ animation, applyPattern }),
      template: '<VtgPane :animation="animation" @pattern-select="applyPattern" />',
    })
    const wrapper = mount(Host)

    await vi.waitFor(() => expect(applyPattern).toHaveBeenCalledOnce())
    await wrapper.get<HTMLInputElement>('[data-role="vtg-qtr"]').setValue(true)

    expect(applyPattern).toHaveBeenCalledTimes(2)
    expect(applyPattern.mock.calls[1]?.[0]).toMatchObject({
      reference: '1-1',
      quarters: 1,
    })
  })

  it('waits for shared animation data before deciding whether to select a random pattern', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const loadedAnimation = createDefaultVtgAnimation({
      reference: '3-4',
      speedRatio: '1:5',
    })
    if (!loadedAnimation) throw new Error('Expected a supported VTG animation')

    const wrapper = mount(VtgPane, {
      props: {
        animation: {
          ...loadedAnimation,
          props: [],
        },
        animationReady: false,
      },
    })
    await nextTick()

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBeUndefined()
    expect(wrapper.emitted('patternSelect')).toBeUndefined()

    await wrapper.setProps({ animation: loadedAnimation })
    await wrapper.setProps({ animationReady: true })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('3-4')
    })

    expect(wrapper.get<HTMLInputElement>('input[value="1:5"]').element.checked).toBe(true)
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })

  it('does not select another random pattern when animation data is cleared after load', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const loadedAnimation = createDefaultVtgAnimation({
      reference: '3-4',
      speedRatio: '1:5',
    })
    if (!loadedAnimation) throw new Error('Expected a supported VTG animation')

    const wrapper = mount(VtgPane, { props: { animation: loadedAnimation } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('3-4')
    })

    await wrapper.setProps({
      animation: {
        ...loadedAnimation,
        props: [],
      },
    })
    await nextTick()

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('3-4')
    expect(wrapper.emitted('patternSelect')).toBeUndefined()
  })

  it('preserves a locally selected no-op transform when the player applies it', async () => {
    const initialAnimation = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:1',
    })
    if (!initialAnimation) throw new Error('Expected a supported VTG animation')

    const wrapper = mount(VtgPane, { props: { animation: initialAnimation } })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-1')
    })

    const swap = wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]')
    await swap.setValue(true)

    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { reference: '1-1', speedRatio: '1:1', swapProps: true },
    ])
    const appliedAnimation = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:1',
      swapProps: true,
    })
    if (!appliedAnimation) throw new Error('Expected the emitted VTG animation')

    await wrapper.setProps({ animation: appliedAnimation })
    await nextTick()

    expect(swap.element.checked).toBe(true)
  })

  it('shares the Spin and Anti choice across the four special cells', async () => {
    const wrapper = mount(VtgPane)
    const firstSpecialCell = wrapper.get('[data-cell-reference="5-6"]')

    expect(wrapper.find('[data-role="vtg-spin-toggle"]').exists()).toBe(false)

    await firstSpecialCell.trigger('click')

    const toggle = wrapper.get('[data-role="vtg-spin-toggle"]')
    expect(toggle.text()).toBe('Spin')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(toggle.classes()).not.toContain('vtg-tile__spin-toggle--bottom')
    expect(wrapper.emitted('patternSelect')).toEqual([
      [{ reference: '5-6', speedRatio: '1:3', isAnti: false }],
    ])

    await toggle.trigger('click')

    expect(wrapper.get('[data-role="vtg-spin-toggle"]').text()).toBe('Anti')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { reference: '5-6', speedRatio: '1:3', isAnti: true },
    ])

    await wrapper.get('[data-cell-reference="6-5"]').trigger('click')

    expect(wrapper.get('[data-role="vtg-spin-toggle"]').text()).toBe('Anti')
    expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
      'vtg-tile__spin-toggle--bottom',
    )
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { reference: '6-5', speedRatio: '1:3', isAnti: true },
    ])

    await wrapper.get('[data-cell-reference="6-5"]').trigger('click')

    expect(wrapper.get('[data-role="vtg-spin-toggle"]').text()).toBe('Spin')
    expect(wrapper.emitted('patternSelect')?.at(-1)).toEqual([
      { reference: '6-5', speedRatio: '1:3', isAnti: false },
    ])
  })

  it('does not preview row or column selections on hover', async () => {
    const wrapper = mount(VtgPane)
    const hoveredCell = wrapper.get('[data-cell-reference="6-6"]')

    await hoveredCell.trigger('mouseenter')

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBeUndefined()
    expect(wrapper.findAll('.vtg-tile--highlighted')).toHaveLength(0)
  })

  it('selects a random matrix cell from the top-left button', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = mount(VtgPane)

    await wrapper.get('.vtg-shuffle').trigger('click')

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-1')
    expect(wrapper.get('[data-cell-reference="1-1"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.emitted('patternSelect')).toEqual([[{ reference: '1-1', speedRatio: '1:3' }]])
  })

  it('aligns a second header click with the cell selected by the first header', async () => {
    const wrapper = mount(VtgPane)
    const pane = wrapper.get('[data-role="vtg-pane"]')

    await wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 6"]').trigger('click')
    await wrapper.get('[data-role="vtg-column-headers"] [aria-label$="rule 1"]').trigger('click')

    expect(pane.attributes('data-selected-cell')).toBe('6-1')
  })

  it('clusters TOG SPLIT props before its moved divider', () => {
    const wrapper = mount(VtgPane)
    const propElements = wrapper
      .findAll<HTMLElement>('[data-role="vtg-prop"]')
      .map(({ element }) => element)

    expect(
      propElements.every((element) => {
        const length = element.style.blockSize || element.style.inlineSize
        return length === '37%'
      }),
    ).toBe(true)

    const columnSplitRule = wrapper.get('[data-role="vtg-column-headers"] [aria-label$="rule 5"]')
    const columnSplitProps = columnSplitRule.findAll<HTMLElement>('[data-role="vtg-prop"]')

    expect(columnSplitProps.map(({ element }) => element.style.insetBlockStart)).toEqual([
      '4%',
      '48%',
    ])
    expect(
      columnSplitRule.get<HTMLElement>('[data-role="vtg-divider"]').element.style.insetBlockStart,
    ).toBe('97%')

    const sideSplitRule = wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 5"]')
    const sideSplitProps = sideSplitRule.findAll<HTMLElement>('[data-role="vtg-prop"]')

    expect(sideSplitProps.map(({ element }) => element.style.insetInlineStart)).toEqual([
      '4%',
      '48%',
    ])
    expect(
      sideSplitRule.get<HTMLElement>('[data-role="vtg-divider"]').element.style.insetInlineStart,
    ).toBe('97%')
    expect(sideSplitRule.findAll('.vtg-rule-card__prop-handle')).toHaveLength(4)
  })

  it('swaps the top and left header layouts while Rotate is enabled', async () => {
    const wrapper = mount(VtgPane)
    const columnRule = () => wrapper.get('[data-role="vtg-column-headers"] [aria-label$="rule 5"]')
    const sideRule = () => wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 5"]')

    expect(columnRule().classes()).toContain('vtg-rule-card--vertical')
    expect(sideRule().classes()).toContain('vtg-rule-card--horizontal')

    await selectSpeedRatio(wrapper, '1:2')

    expect(columnRule().classes()).toContain('vtg-rule-card--horizontal')
    expect(sideRule().classes()).toContain('vtg-rule-card--vertical')

    await wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').setValue('0')

    expect(columnRule().classes()).toContain('vtg-rule-card--vertical')
    expect(sideRule().classes()).toContain('vtg-rule-card--horizontal')

    await wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').setValue('180')

    expect(columnRule().classes()).toContain('vtg-rule-card--vertical')
    expect(sideRule().classes()).toContain('vtg-rule-card--horizontal')
  })

  it.each(['1:2', '1:4'] as const)(
    'adds the %s rotation 180-degree left-header flip to the top 180-degree control',
    async (speedRatio) => {
      const wrapper = mount(VtgPane)
      await selectSpeedRatio(wrapper, speedRatio)
      await wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').setValue('180')

      const sideRule = wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 5"]')
      expect(sideRule.classes()).toContain('vtg-rule-card--horizontal')
      expect(sideRule.classes()).toContain('vtg-rule-card--reversed')

      await wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').setValue(true)

      expect(sideRule.classes()).not.toContain('vtg-rule-card--reversed')
    },
  )

  it('uses the -90-degree option to flip rotated left header elements vertically', async () => {
    const wrapper = mount(VtgPane)
    await selectSpeedRatio(wrapper, '1:2')

    const sideSplitRule = wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 5"]')
    const sideSplitProps = sideSplitRule.findAll<HTMLElement>('[data-role="vtg-prop"]')
    expect(sideSplitRule.classes()).toContain('vtg-rule-card--vertical')
    expect(sideSplitRule.classes()).toContain('vtg-rule-card--reversed')
    expect(
      sideSplitRule.get<HTMLElement>('[data-role="vtg-divider"]').element.style.insetBlockStart,
    ).toBe('3%')
    expect(sideSplitProps.map(({ element }) => element.style.insetBlockStart)).toEqual([
      '59%',
      '15%',
    ])

    const columnSplitRule = wrapper.get('[data-role="vtg-column-headers"] [aria-label$="rule 5"]')
    const columnSplitProps = columnSplitRule.findAll<HTMLElement>('[data-role="vtg-prop"]')
    expect(columnSplitRule.classes()).toContain('vtg-rule-card--horizontal')
    expect(columnSplitRule.classes()).not.toContain('vtg-rule-card--reversed')
    expect(columnSplitRule.find('[data-role="vtg-divider"]').exists()).toBe(false)
    expect(columnSplitProps).toHaveLength(0)
  })

  it.each([
    { speedRatio: '1:1', columnDividerPosition: '97%', columnPropPositions: ['4%', '48%'] },
    { speedRatio: '1:2', columnDividerPosition: undefined, columnPropPositions: [] },
    { speedRatio: '1:3', columnDividerPosition: '97%', columnPropPositions: ['4%', '48%'] },
    { speedRatio: '1:4', columnDividerPosition: undefined, columnPropPositions: [] },
    { speedRatio: '1:5', columnDividerPosition: '97%', columnPropPositions: ['4%', '48%'] },
  ] as const)(
    'uses 180 degrees to flip horizontal left headers at $speedRatio when rotation is zero',
    async ({ speedRatio, columnDividerPosition, columnPropPositions }) => {
      const wrapper = mount(VtgPane)
      await selectSpeedRatio(wrapper, speedRatio)
      if (speedRatio === '1:2' || speedRatio === '1:4') {
        await wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').setValue('0')
      }

      await wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').setValue(true)

      const sideSplitRule = wrapper.get('[data-role="vtg-sidebar"] [aria-label$="rule 5"]')
      const sideSplitProps = sideSplitRule.findAll<HTMLElement>('[data-role="vtg-prop"]')
      expect(sideSplitRule.classes()).toContain('vtg-rule-card--horizontal')
      expect(sideSplitRule.classes()).toContain('vtg-rule-card--reversed')
      expect(
        sideSplitRule.get<HTMLElement>('[data-role="vtg-divider"]').element.style.insetInlineStart,
      ).toBe('3%')
      expect(sideSplitProps.map(({ element }) => element.style.insetInlineStart)).toEqual([
        '59%',
        '15%',
      ])
      expect(sideSplitProps[0]?.find('[data-role="vtg-prop-end"]').classes()).toContain(
        'vtg-rule-card__prop-handle--large',
      )
      expect(sideSplitProps[1]?.find('[data-role="vtg-prop-start"]').classes()).toContain(
        'vtg-rule-card__prop-handle--large',
      )

      const columnSplitRule = wrapper.get('[data-role="vtg-column-headers"] [aria-label$="rule 5"]')
      const columnSplitProps = columnSplitRule.findAll<HTMLElement>('[data-role="vtg-prop"]')
      const columnDivider = columnSplitRule.find<HTMLElement>('[data-role="vtg-divider"]')
      expect(columnSplitRule.classes()).not.toContain('vtg-rule-card--reversed')
      expect(columnDivider.exists()).toBe(columnDividerPosition !== undefined)
      expect(columnDivider.exists() ? columnDivider.element.style.insetBlockStart : undefined).toBe(
        columnDividerPosition,
      )
      expect(columnSplitProps.map(({ element }) => element.style.insetBlockStart)).toEqual(
        columnPropPositions,
      )
    },
  )

  it('does not mirror frame-derived QTR props a second time when 180° is enabled', async () => {
    const wrapper = await mountVtgPane(true)

    await wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').setValue(true)

    const firstSideRule = wrapper.get(
      '[data-role="vtg-sidebar"] [data-role="vtg-rule-card"]:first-child',
    )
    const firstSideProps = firstSideRule.findAll<HTMLElement>('[data-role="vtg-prop"]')
    expect(firstSideRule.classes()).toContain('vtg-rule-card--reversed')
    expect(firstSideProps[0]?.classes()).toContain('vtg-rule-card__prop--vertical')
    expect(firstSideProps[0]?.attributes('style')).toContain('inset-block-start: 4%')
    expect(firstSideProps[1]?.classes()).toContain('vtg-rule-card__prop--horizontal')
    expect(firstSideProps[1]?.attributes('style')).toContain('inset-inline-start: 4%')
  })

  it('places the top TOG IN props after the divider', () => {
    const wrapper = mount(VtgPane)
    const togInRule = wrapper.get('[data-role="vtg-column-headers"] [aria-label$="rule 3"]')
    const props = togInRule.findAll<HTMLElement>('[data-role="vtg-prop"]')

    expect(props.map(({ element }) => element.style.insetBlockStart)).toEqual(['59%', '59%'])
    expect(props.map(({ element }) => element.style.blockSize)).toEqual(['37%', '37%'])
  })

  it('tracks the live width and height of each blank preview', async () => {
    const wrapper = mount(VtgPane)
    const firstBlank = wrapper.get('[data-blank-index="0"]').element
    const entry = {
      target: firstBlank,
      contentRect: { width: 71.25, height: 68.5 },
    } as ResizeObserverEntry

    FakeResizeObserver.callback?.([entry], new FakeResizeObserver(() => {}))
    await nextTick()

    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-blank-width')).toBe('71.25')
    expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-blank-height')).toBe('68.5')
    expect(wrapper.get('[data-blank-index="0"]').attributes('data-width')).toBe('71.25')
    expect(wrapper.get('[data-blank-index="0"]').attributes('data-height')).toBe('68.5')
  })

  it('disables All Head Paths in VTG thumbnail workers', async () => {
    mount(VtgPane)
    await settlePreviewRendering()

    expect(
      FakeWorker.instances[0]?.messages.find(({ type }) => type === 'initialize')?.data,
    ).toEqual({ girth: 2, timeline: false, thumbnail: true })
  })

  it('renders the top-left cell for each intersection through one sequential worker queue', async () => {
    const wrapper = mount(VtgPane)
    await settlePreviewRendering()

    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()

    expect(
      wrapper
        .findAll('[data-role="vtg-preview"]')
        .map((preview) => preview.attributes('data-preview-reference')),
    ).toEqual(['1-1', '1-3', '1-5', '3-1', '3-3', '3-5', '5-1', '5-3', '5-5'])
    expect(wrapper.findAll('[data-role="vtg-preview"]')).toHaveLength(9)
    expect(countWorkerMessages('data')).toBe(9)
    expect(countWorkerMessages('reqimgs')).toBe(9)
    expect(FakeWorker.maxActivePreviewRequests).toBe(1)
    expect(
      FakeWorker.instances[0]?.messages.find(({ type }) => type === 'initialize')?.data,
    ).toEqual({ girth: 2, timeline: false, thumbnail: true })

    const renderMessages = FakeWorker.instances[0]?.messages
      .filter(({ type }) => type === 'loadFinalData' || type === 'reqimgs')
      .map(({ type }) => type)
    expect(renderMessages).toEqual(
      Array.from({ length: 9 }, () => ['loadFinalData', 'reqimgs']).flat(),
    )
  })

  it.each(['1:1', '1:3', '1:5'] as const)(
    'positions %s labels consistently around the nine shared thumbnails',
    async (speedRatio) => {
      const wrapper = mount(VtgPane)
      await selectSpeedRatio(wrapper, speedRatio)
      await wrapper.get<HTMLInputElement>('[data-role="vtg-classic"]').setValue(true)

      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
      expect(wrapper.get('[data-cell-reference="1-1"]').classes()).toContain(
        'vtg-tile--shared-preview-bottom',
      )
      expect(wrapper.get('[data-cell-reference="1-2"]').classes()).toContain(
        'vtg-tile--shared-preview-top',
      )

      await wrapper.get<HTMLInputElement>('[data-role="vtg-classic"]').setValue(false)

      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
      expect(wrapper.get('[data-cell-reference="1-1"]').classes()).toContain(
        'vtg-tile--shared-preview-top',
      )
      expect(wrapper.get('[data-cell-reference="2-1"]').classes()).toContain(
        'vtg-tile--shared-preview-bottom',
      )
    },
  )

  it.each(['2:1', '2:3', '2:5'] as const)(
    'uses the shared VTG layout for unmodified %s candidates',
    async (speedRatio) => {
      const wrapper = mount(VtgPane)
      await selectSpeedRatio(wrapper, speedRatio)
      await nextTick()

      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
      expect(wrapper.get('[data-cell-reference="1-1"]').classes()).toContain(
        'vtg-tile--shared-preview-top',
      )
      expect(wrapper.get('[data-cell-reference="2-1"]').classes()).toContain(
        'vtg-tile--shared-preview-bottom',
      )
      expect(wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').element.value).toBe(
        '-90',
      )
    },
  )

  it('uses the paired 1:3 layout when Third Order makes shared thumbnail paths diverge', async () => {
    const store = useConceptsStore()
    store.vtgThirdOrderSettings = [{ initial: '1:3-pro', strength: 1, timing: '1:3-pro' }, {}]
    store.vtgThirdOrderMirror = true
    const wrapper = mount(VtgPane)
    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(18)
    })

    expect(wrapper.findAll('.vtg-tile')[0]?.classes()).toContain('vtg-tile--paired-left')
    expect(wrapper.findAll('.vtg-tile')[1]?.classes()).toContain('vtg-tile--paired-right')
  })

  it('retains the current layout until the newest worker comparison resolves', async () => {
    const store = useConceptsStore()
    store.vtgThirdOrderSettings = [{ initial: '1:3-pro', strength: 1, timing: '1:3-pro' }, {}]
    const comparisons: ReturnType<typeof createDeferred<boolean>>[] = []
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({ status: 'unmatched' }),
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
      compareVtgCandidateLayout: () => {
        const comparison = createDeferred<boolean>()
        comparisons.push(comparison)
        return comparison.promise
      },
    }
    const wrapper = mount(VtgPane, { props: { patternMatcher } })

    await vi.waitFor(() => expect(comparisons).toHaveLength(1))
    comparisons[0]!.resolve(true)
    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(18)
    })

    store.setVtgThirdOrderStrength(0, 2)
    await nextTick()
    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(18)
    await vi.waitFor(() => expect(comparisons).toHaveLength(2))

    store.setVtgThirdOrderStrength(0, 3)
    await nextTick()
    await vi.waitFor(() => expect(comparisons).toHaveLength(3))
    comparisons[1]!.resolve(true)
    await flushPromises()
    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(18)

    comparisons[2]!.resolve(false)
    await flushPromises()
    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
  })

  it('returns to shared Full Grid thumbnails when the Builder Drop target is selected', async () => {
    const store = useConceptsStore()
    store.vtgThirdOrderSettings = [{ initial: '1:3-pro', strength: 1, timing: '1:3-pro' }, {}]
    store.vtgThirdOrderMirror = true
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const animationWithProperties = store.applyVtgPropertyControls(animation)
    const wrapper = mount(VtgPane, {
      props: {
        animation: animationWithProperties,
        builderActive: true,
        builderFullCatalog: true,
        builderInsertionIndex: 0,
        builderMatchAnimation: animationWithProperties,
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(18)
    })

    await wrapper.setProps({ builderInsertionIndex: 1, builderMatchAnimation: undefined })

    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
    expect(wrapper.findAll('.vtg-tile')[0]?.classes()).toContain('vtg-tile--shared-preview-top')
    expect(wrapper.findAll('.vtg-tile')[6]?.classes()).toContain('vtg-tile--shared-preview-bottom')
  })

  it('pairs the first but shares the second portion of the reported three-portion pattern', async () => {
    const animation = await decodeCurrentQuery(
      'r=Gw48Yk11Y&p0=Q__.blE-ZU.5JE_6k........5JE-ZU_ZE........___-ZU.......&x0=Qo____Yw.____L7L_........____NBf_........____NXL_&m0=_1_mxqv__&p1=N__.blE_98.5L__6k........5JE_6k........___-ZU.......&x1=Qo____Yw.____L7L_........____Luf_........____NXL_&c=_i_bhq&v=12',
    )
    const previews = createVtgTransitionPreviewAnimations(animation)
    const first = resolveVtgBuilderPatternMatchAnimation(previews, 0)
    const second = resolveVtgBuilderPatternMatchAnimation(previews, 1)
    if (!first || !second)
      throw new Error('Expected the reported pattern to have first and second Builder portions')
    const wrapper = mount(VtgPane, {
      props: {
        animation,
        animationReady: true,
        builderActive: true,
        builderFullCatalog: true,
        builderInsertionIndex: 0,
        builderMatchAnimation: first,
      },
    })

    await settlePreviewRendering()
    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(18)
    })

    await wrapper.setProps({ builderInsertionIndex: 1, builderMatchAnimation: second })
    await settlePreviewRendering()
    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
    })
  })

  it('shares the reported third portion in Builder while pairing its standalone equivalent', async () => {
    const pattern = await decodeCurrentQuery(
      'r=Gw48Yk11Y&p0=Q__.blE-ZU.5JE_6k........5JE-ZU_ZE........5GQ-__................___-ZU.......&x0=Qo____Yw.____L7L_........____NBf_........____NXL_&m0=_1_mxqv__&p1=N__.blE_98.5L__6k........5JE_6k........5GQ_4d_WQ................___-ZU.......&x1=Qo____Yw.____L7L_........____Luf_........____NXL_&c=_i_bhq&v=12',
    )
    const previews = createVtgTransitionPreviewAnimations(pattern)
    const third = resolveVtgBuilderPatternMatchAnimation(previews, 2)
    if (!third) throw new Error('Expected the reported pattern to have a third Builder portion')
    const wrapper = mount(VtgPane, {
      props: {
        animation: pattern,
        animationReady: true,
        builderActive: true,
        builderFullCatalog: true,
        builderInsertionIndex: 2,
        builderMatchAnimation: third,
      },
    })

    await settlePreviewRendering()
    await vi.waitFor(() => {
      expect(wrapper.get<HTMLInputElement>('input[value="2:3"]').element.checked).toBe(true)
    })
    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)

    const standalone = await decodeCurrentQuery(
      'r=Gw48Yk11Y&p0=Q__.bg0____WQ.5L_-___U0...............&x0=Qo____Yw.____NXL_&m0=_1_mxqv__&p1=N__.bg0____WQ.5E0_4d_WQ...............&x1=Qo____Yw.____NXL_&c=_i_bhq&v=12',
    )
    await wrapper.setProps({
      animation: standalone,
      builderActive: false,
      builderInsertionIndex: undefined,
      builderMatchAnimation: undefined,
    })
    await settlePreviewRendering()
    await vi.waitFor(() => {
      expect(wrapper.get<HTMLInputElement>('input[value="2:3"]').element.checked).toBe(true)
    })
    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(18)
    })
  })

  it('shares the reported second portion after a three-beat first Builder portion', async () => {
    const pattern = await decodeCurrentQuery(
      'r=Gw48Yk11Y&p0=Q__.blE-ZU.5JE_6k......5JE-ZU_ZE.....5GQ-__................___-ZU.......&x0=Qo____Yw.____L7L_......____NBf_.....____NXL_&m0=_1_mxqv__&p1=N__.blE_98.5L__6k......5JE_6k.....5GQ_4d_WQ................___-ZU.......&x1=Qo____Yw.____L7L_......____Luf_.....____NXL_&c=_i_bhq&v=12',
    )
    const previews = createVtgTransitionPreviewAnimations(pattern)
    const second = resolveVtgBuilderPatternMatchAnimation(previews, 1)
    if (!second) throw new Error('Expected the reported pattern to have a second Builder portion')
    const wrapper = mount(VtgPane, {
      props: {
        animation: pattern,
        animationReady: true,
        builderActive: true,
        builderFullCatalog: true,
        builderFullGrid: true,
        builderInsertionIndex: previews?.length,
      },
    })

    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
    await wrapper.setProps({ builderInsertionIndex: 1 })
    await nextTick()
    await wrapper.setProps({ builderMatchAnimation: second })
    await vi.waitFor(() => {
      expect(wrapper.get<HTMLInputElement>('input[value="1:3"]').element.checked).toBe(true)
    })
    await vi.waitFor(() => {
      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
    })
  })

  it('shares equivalent generated thumbnails for the reported standalone pattern', async () => {
    const animation = await decodeCurrentQuery(
      'r=Gw48Yk11Y&p0=Q__.bg0____WQ.5L_-ZU_U0.......&x0=Qo____Yw.____NBf_&m0=_1_mxqv__&p1=N__.bg0____WQ.5E0_6k_WQ.......&x1=Qo____Yw.____Luf_&c=_i_bhq&v=12',
    )
    const wrapper = mount(VtgPane, { props: { animation, animationReady: true } })

    await settlePreviewRendering()

    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)

    const store = useConceptsStore()
    const detectedThirdOrder = store.vtgThirdOrderSettings.map((settings) => ({ ...settings }))
    expect(detectedThirdOrder).not.toEqual([{}, {}])
    await wrapper.get('[data-cell-reference="2-2"]').trigger('click')
    const selection = wrapper.emitted<VtgPatternSelection[]>('patternSelect')?.at(-1)?.[0]
    if (!selection) throw new Error('Expected the selected cell to emit a VTG pattern')
    const generated = createVtgAnimation(animation, selection, {
      minimumCycleCount: store.getVtgPropertyCycleCount(),
    })
    if (!generated) throw new Error('Expected the selected VTG pattern to generate')
    const applied = store.applyVtgPropertyControls(generated)
    expect(extractVtgThirdOrderSettings(applied)).toEqual(detectedThirdOrder)
  })

  it('keeps detected properties when selecting another cell in the reported tilted pattern', async () => {
    const animation = await decodeCurrentQuery(
      'r=Gw48Yk11Y&p0=Q__.bg0____WQ.5L_-ZU_U0.......&x0=Qo____Yw.____NXL_&m0=_1_mxqv__&p1=N__.bg0____WQ.5E0-ZU_WQ.......&x1=Qo____Yw.____NXL_&c=_i_bhq&v=12',
    )
    const wrapper = mount(VtgPane, { props: { animation, animationReady: true } })
    await settlePreviewRendering()

    const store = useConceptsStore()
    const detectedThirdOrder = store.vtgThirdOrderSettings.map((settings) => ({ ...settings }))
    expect(detectedThirdOrder).not.toEqual([{}, {}])
    await wrapper.get('[data-cell-reference="2-2"]').trigger('click')
    const selection = wrapper.emitted<VtgPatternSelection[]>('patternSelect')?.at(-1)?.[0]
    if (!selection) throw new Error('Expected the selected cell to emit a VTG pattern')
    const generated = createVtgAnimation(animation, selection, {
      minimumCycleCount: store.getVtgPropertyCycleCount(),
    })
    if (!generated) throw new Error('Expected the selected VTG pattern to generate')
    expect(extractVtgThirdOrderSettings(store.applyVtgPropertyControls(generated))).toEqual(
      detectedThirdOrder,
    )
  })

  it.each(['1:2', '1:4'] as const)(
    'uses one bottom thumbnail per horizontal cell pair at %s',
    async (speedRatio) => {
      const wrapper = mount(VtgPane)
      await wrapper.get<HTMLInputElement>('[data-role="vtg-classic"]').setValue(false)
      await settlePreviewRendering()
      reportAllBlankDimensions(72, 68)
      await settlePreviewRendering()

      const before = countWorkerMessages('data')
      await selectSpeedRatio(wrapper, speedRatio)
      await nextTick()
      reportAllBlankDimensions(72, 68)
      await settlePreviewRendering()

      const blanks = wrapper.findAll('[data-role="vtg-blank"]')
      expect(blanks).toHaveLength(18)
      expect(wrapper.findAll('[data-role="vtg-preview"]')).toHaveLength(18)
      expect(countWorkerMessages('data')).toBe(before + 18)
      expect(blanks[0]?.attributes('style')).toContain('grid-column: 1 / span 2')
      expect(blanks[0]?.attributes('style')).toContain('grid-row: 1')
      expect(blanks[17]?.attributes('style')).toContain('grid-column: 5 / span 2')
      expect(blanks[17]?.attributes('style')).toContain('grid-row: 6')
      expect(wrapper.get('[data-cell-reference="1-1"]').classes()).toContain(
        'vtg-tile--paired-left',
      )
      expect(wrapper.get('[data-cell-reference="1-2"]').classes()).toContain(
        'vtg-tile--paired-right',
      )
      expect(wrapper.get('[data-cell-reference="1-1"] .vtg-tile__label').text()).toBe('TS / TS')
      expect(wrapper.get('[data-cell-reference="2-1"] .vtg-tile__label').text()).toBe('SO / SO')
      expect(wrapper.get('[data-cell-reference="1-2"] .vtg-tile__label').text()).toBe('TO / TO')

      await wrapper.get('[data-cell-reference="5-5"]').trigger('click')
      expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
        'vtg-tile__spin-toggle--left',
      )
      await wrapper.get('[data-cell-reference="5-6"]').trigger('click')
      expect(wrapper.get('[data-role="vtg-spin-toggle"]').classes()).toContain(
        'vtg-tile__spin-toggle--right',
      )
    },
  )

  it('applies Rotate directly without changing the paired layout', async () => {
    const wrapper = mount(VtgPane)
    await settlePreviewRendering()
    await selectSpeedRatio(wrapper, '1:2')
    await nextTick()
    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()

    const previewAnimations = () =>
      FakeWorker.instances[0]?.messages
        .filter(({ type }) => type === 'loadFinalData')
        .map(({ data }) => data as RootDataFinal) ?? []

    expect(
      previewAnimations()
        .at(-18)
        ?.props.map((prop) => prop.anim[0]?.arc),
    ).toEqual([180, 180])

    await wrapper.get<HTMLSelectElement>('[data-role="vtg-orientation"]').setValue('0')
    await nextTick()
    await nextTick()
    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()

    expect(
      previewAnimations()
        .at(-18)
        ?.props.map((prop) => prop.anim[0]?.arc),
    ).toEqual([90, 90])
  })

  it('refreshes previews for resize and non-BPM form changes', async () => {
    const wrapper = mount(VtgPane)
    await settlePreviewRendering()
    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()

    const expectNineMorePreviews = async (change: () => Promise<unknown> | void) => {
      const before = countWorkerMessages('data')
      await change()
      await settlePreviewRendering()
      expect(countWorkerMessages('data')).toBe(before + 9)
    }

    const beforeBpm = countWorkerMessages('data')
    await wrapper.get<HTMLInputElement>('[data-role="vtg-bpm"]').setValue(90)
    await settlePreviewRendering()
    expect(countWorkerMessages('data')).toBe(beforeBpm)

    await expectNineMorePreviews(() => selectSpeedRatio(wrapper, '1:1'))
    const beforeSpinChange = countWorkerMessages('data')
    await wrapper.get('[data-cell-reference="5-6"]').trigger('click')
    await wrapper.get('[data-role="vtg-spin-toggle"]').trigger('click')
    await settlePreviewRendering()
    expect(countWorkerMessages('data')).toBe(beforeSpinChange + 1)
    await expectNineMorePreviews(() =>
      wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').setValue(true),
    )
    await expectNineMorePreviews(() =>
      wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]').setValue(true),
    )
    await expectNineMorePreviews(() =>
      wrapper.get<HTMLInputElement>('[data-role="vtg-scale"]').setValue(1.1),
    )
    await wrapper.get('[data-role="vtg-property-offset-toggle"]').trigger('click')
    await expectNineMorePreviews(() =>
      wrapper.get<HTMLInputElement>('[data-role="vtg-offset-0-input"]').setValue(45),
    )

    const beforeRenderingControls = countWorkerMessages('data')
    await wrapper.get<HTMLInputElement>('[data-role="vtg-paths"]').setValue(false)
    await settlePreviewRendering()
    expect(countWorkerMessages('data')).toBe(beforeRenderingControls)

    await wrapper.get<HTMLInputElement>('[data-role="vtg-hands"]').setValue(true)
    await settlePreviewRendering()
    expect(countWorkerMessages('data')).toBe(beforeRenderingControls + 9)

    await wrapper.get<HTMLInputElement>('[data-role="vtg-arms"]').setValue(false)
    await settlePreviewRendering()
    expect(countWorkerMessages('data')).toBe(beforeRenderingControls + 9)

    await expectNineMorePreviews(() => reportAllBlankDimensions(80, 76))
  })

  it('observes and refreshes every paired-ratio thumbnail after exiting Builder', async () => {
    useConceptsStore().speedRatio = '1:2'
    const wrapper = mount(VtgPane, { props: { builderActive: true } })
    await settlePreviewRendering()
    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()

    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(4)
    expect(countWorkerMessages('data')).toBe(4)

    await wrapper.setProps({ builderActive: false })
    await nextTick()
    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(18)

    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()

    expect(countWorkerMessages('data')).toBe(22)
  })

  it('keeps Builder table controls non-mutating while exposing cells as drag sources', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(VtgPane, { props: { animation } })
    await vi.waitFor(() => {
      expect(wrapper.find('.vtg-tile--selected').attributes('data-cell-reference')).toBe('1-1')
    })
    await selectSpeedRatio(wrapper, '1:2')
    await wrapper.get<HTMLInputElement>('[data-role="vtg-swap"]').setValue(true)
    await wrapper.get('[data-role="vtg-transition"]').trigger('click')
    const patternSelectionsBeforeBuilder = wrapper.emitted('patternSelect')?.length ?? 0
    const standardLabel = wrapper.get('[data-cell-reference="1-1"] .vtg-tile__label-text').text()
    await wrapper.setProps({ builderActive: true })
    await nextTick()
    const tile = wrapper.get<HTMLButtonElement>('[data-cell-reference="1-1"]')
    const builderLabel = tile.get('.vtg-tile__label-text').text()
    expect(builderLabel).toMatch(/^[AI]{2} \/ [SO]{2}$/)
    expect(builderLabel).not.toBe(standardLabel)
    expect(tile.attributes('draggable')).toBe('true')
    expect(wrapper.find('.vtg-tile--selected').exists()).toBe(false)
    expect(wrapper.findAll('[data-role="vtg-tile"]')).toHaveLength(8)
    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(4)
    expect(wrapper.get('[data-role="vtg-column-headers"]').text()).not.toBe('')
    expect(wrapper.get('[data-role="vtg-sidebar"]').text()).not.toBe('')
    expect(wrapper.find('[data-role="vtg-shuffle"]').exists()).toBe(true)
    expect(wrapper.findAll('.vtg-tile--highlighted')).toHaveLength(0)
    expect(wrapper.find('[data-role="vtg-swap"]').exists()).toBe(false)
    const reverse = wrapper.get<HTMLInputElement>('[data-role="vtg-reverse"]')
    expect(reverse.attributes('aria-label')).toBe('Rotate floor plane by 180 degrees')
    expect(wrapper.find('[data-role="vtg-reset"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-playback-controls"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-transition-controls"]').exists()).toBe(false)

    const previewsBeforeReverse = wrapper.emitted('patternPreview')?.length ?? 0
    await reverse.setValue(true)
    expect(wrapper.emitted('patternPreview')?.length ?? 0).toBe(previewsBeforeReverse)
    await tile.trigger('click')
    expect(tile.attributes('aria-pressed')).toBe('true')
    expect(wrapper.emitted('patternSelect')?.length ?? 0).toBe(patternSelectionsBeforeBuilder)
    expect(wrapper.emitted('patternPreview')?.at(-1)?.[0]).toMatchObject({
      reference: '1-1',
      speedRatio: '1:2',
      swapProps: true,
      reversePlane: true,
    })
    expect(wrapper.emitted('patternPreview')?.at(-1)?.[0]).not.toHaveProperty('transition')
    expect(wrapper.get('.vtg-tile--selected').attributes('data-cell-reference')).toBe('1-1')

    await wrapper.get('[data-cell-reference="1-2"]').trigger('click')
    expect(wrapper.get('.vtg-tile--selected').attributes('data-cell-reference')).toBe('1-2')
    expect(wrapper.findAll('.vtg-tile--highlighted')).toHaveLength(5)
    expect(wrapper.emitted('patternPreview')?.at(-1)?.[0]).toMatchObject({
      reference: '1-2',
      speedRatio: '1:2',
      swapProps: true,
    })
    await reverse.setValue(false)
    expect(wrapper.emitted('patternPreview')?.at(-1)?.[0]).toMatchObject({
      reference: '1-2',
      speedRatio: '1:2',
      swapProps: true,
    })
    expect(wrapper.emitted('patternPreview')?.at(-1)?.[0]).not.toHaveProperty('reversePlane')

    const dragData = new Map<string, string>()
    await tile.trigger('dragstart', {
      dataTransfer: {
        effectAllowed: 'none',
        setData: (type: string, value: string) => dragData.set(type, value),
      },
    })
    expect(dragData.get('application/x-spiroanim-pattern')).toContain('"reference":"1-1"')
    expect(JSON.parse(dragData.get('application/x-spiroanim-pattern') ?? '{}')).not.toHaveProperty(
      'transition',
    )

    const pairedDragData = new Map<string, string>()
    await wrapper.get('[data-cell-reference="1-2"]').trigger('dragstart', {
      dataTransfer: {
        effectAllowed: 'none',
        setData: (type: string, value: string) => pairedDragData.set(type, value),
      },
    })
    expect(JSON.parse(pairedDragData.get('application/x-spiroanim-pattern') ?? '{}')).toMatchObject(
      {
        reference: '1-2',
        speedRatio: '1:2',
        swapProps: true,
      },
    )

    const previewsBeforeCustomize = wrapper.emitted('patternPreview')?.length ?? 0
    await wrapper.get<HTMLInputElement>('[data-role="vtg-thick"]').setValue(9)
    expect(wrapper.emitted('patternSelect')?.length ?? 0).toBe(patternSelectionsBeforeBuilder)
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).toMatchObject({
      reference: '1-2',
      speedRatio: '1:2',
      thick: 9,
    })
    expect(wrapper.emitted('patternPreview')).toHaveLength(previewsBeforeCustomize)

    const customizationsBeforeReset = wrapper.emitted('customize')?.length ?? 0
    const previewsBeforeReset = wrapper.emitted('patternPreview')?.length ?? 0
    await wrapper.get('[data-role="vtg-reset"]').trigger('click')
    await nextTick()
    await wrapper.get('.pattern-reset-dialog__confirm').trigger('click')
    await nextTick()
    expect(wrapper.emitted('customize')).toHaveLength(customizationsBeforeReset + 1)
    expect(wrapper.emitted('customize')?.at(-1)?.[0]).not.toHaveProperty('thick')
    expect(wrapper.emitted('patternPreview')).toHaveLength(previewsBeforeReset + 1)
  })

  it('matches the selected Builder portion without emitting a playback preview', async () => {
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const second = createDefaultVtgAnimation({ reference: '3-3', speedRatio: '1:3' })
    if (!first || !second) throw new Error('Expected supported VTG animations')
    const conceptsStore = useConceptsStore()
    conceptsStore.elementalLayout = false
    conceptsStore.bpm = 20

    const matches = ['1-1', '3-3'] as const
    let matchIndex = 0
    const matchVtg = vi.fn<PatternMatchingClient['matchVtg']>(async () => {
      const reference = matches[matchIndex++]
      if (!reference) return { status: 'unmatched' }
      return {
        status: 'matched',
        source: 'vtg',
        match: {
          reference,
          speedRatio: '1:3',
          isAnti: false,
          swapProps: false,
          reversePlane: false,
          bpm: 40,
          scale: 0.8,
        },
      }
    })
    const patternMatcher: PatternMatchingClient = {
      matchVtg,
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, {
      props: {
        animation: first,
        builderActive: true,
        builderMatchAnimation: first,
        patternMatcher,
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBe('1-1')
    })
    expect(conceptsStore.bpm).toBe(20)
    expect(wrapper.emitted('patternPreview')).toBeUndefined()
    expect(matchVtg.mock.calls[0]?.[0].lastSelection).toBeUndefined()

    await wrapper.setProps({ builderMatchAnimation: second })
    await vi.waitFor(() => {
      expect(wrapper.get('.vtg-tile--selected .vtg-tile__label-text').text()).toBe(
        describeVtgBuilderMotion(second),
      )
    })
    expect(conceptsStore.bpm).toBe(20)
    expect(wrapper.emitted('patternPreview')).toBeUndefined()

    await wrapper.setProps({ builderMatchAnimation: undefined })
    await vi.waitFor(() => {
      expect(wrapper.get('[data-role="vtg-pane"]').attributes('data-selected-cell')).toBeUndefined()
    })
    expect(wrapper.emitted('patternPreview')).toBeUndefined()
  })

  it('requests Builder once when a loaded unmatched VTG pattern has multiple portions', async () => {
    const first = createDefaultVtgAnimation({ reference: '5-6', speedRatio: '1:3' })
    const animation = first
      ? appendVtgBuilderPattern(first, { reference: '2-3', speedRatio: '1:3' })
      : undefined
    if (!animation) throw new Error('Expected a two-portion Builder pattern')
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({ status: 'unmatched' }),
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, {
      props: { animation, animationRevision: 0, patternMatcher },
    })

    await vi.waitFor(() => expect(wrapper.emitted('builderOpen')).toHaveLength(1))

    await wrapper.setProps({ builderActive: true })
    await wrapper.setProps({ builderActive: false })
    await flushPromises()

    expect(wrapper.emitted('builderOpen')).toHaveLength(1)
  })

  it('does not request Builder for an unmatched single-portion VTG pattern', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const patternMatcher: PatternMatchingClient = {
      matchVtg: async () => ({ status: 'unmatched' }),
      matchEightStep: async () => ({ status: 'unmatched' }),
      matchQst: async () => ({ status: 'unmatched' }),
    }
    const wrapper = mount(VtgPane, {
      props: { animation, animationRevision: 0, patternMatcher },
    })

    await flushPromises()

    expect(wrapper.emitted('builderOpen')).toBeUndefined()
  })

  it('updates Builder Elemental labels for the selected insertion target', async () => {
    const first = createDefaultVtgAnimation({ reference: '5-6', speedRatio: '1:3' })
    const animation = first
      ? appendVtgBuilderPattern(first, { reference: '2-3', speedRatio: '1:3' })
      : undefined
    if (!animation) throw new Error('Expected a two-portion Builder pattern')
    const wrapper = mount(VtgPane, {
      props: {
        animation,
        builderActive: true,
        builderInsertionIndex: 0,
      },
    })
    await settlePreviewRendering()
    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()
    const previewAnimations = () =>
      FakeWorker.instances[0]?.messages
        .filter(({ type }) => type === 'loadFinalData')
        .map(({ data }) => data as RootDataFinal) ?? []
    await wrapper.get<HTMLInputElement>('[data-role="vtg-elemental"]').setValue(true)
    const firstTileElements = () =>
      wrapper
        .get('[data-cell-reference="1-1"]')
        .findAll('.elemental-relationship-icons__icon')
        .map((icon) => icon.attributes('data-element'))

    expect(firstTileElements()).toEqual(['Earth', 'Earth'])
    expect(describePatternRelationships(previewAnimations().at(-4)!).label).toBe('TS / TS')
    const previewsBeforeContextChange = previewAnimations().length
    await wrapper.setProps({ builderInsertionIndex: 1 })
    await settlePreviewRendering()
    expect(firstTileElements()).toEqual(['Earth', 'Water'])
    expect(previewAnimations()).toHaveLength(previewsBeforeContextChange + 4)
    expect(describePatternRelationships(previewAnimations().at(-4)!).label).toBe('TS / SS')
    await wrapper.setProps({ builderInsertionIndex: 2 })
    await settlePreviewRendering()
    expect(firstTileElements()).toEqual(['Earth', 'Water'])
  })

  it('updates Quarter Builder thumbnails for the selected insertion target', async () => {
    const first = createDefaultVtgAnimation({ reference: '5-6', speedRatio: '1:3' })
    const animation = first
      ? appendVtgBuilderPattern(first, { reference: '2-3', speedRatio: '1:3' })
      : undefined
    if (!animation) throw new Error('Expected a two-portion Builder pattern')
    const selection = {
      reference: '1-1',
      speedRatio: '1:3',
      quarters: 1,
    } as const satisfies QtrPatternSelection
    const wrapper = mount(VtgPane, {
      props: {
        animation,
        builderActive: true,
        builderInsertionIndex: 0,
      },
    })
    useConceptsStore().qtrEnabled = true
    await nextTick()
    await settlePreviewRendering()
    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()
    const previewAnimations = () =>
      FakeWorker.instances[0]?.messages
        .filter(({ type }) => type === 'loadFinalData')
        .map(({ data }) => data as RootDataFinal) ?? []
    const expectedFirst = createVtgBuilderDropPreview(animation, selection, 0)
    const expectedSecond = createVtgBuilderDropPreview(animation, selection, 1)
    if (!expectedFirst || !expectedSecond) throw new Error('Expected contextual Quarter previews')

    expect(describePatternRelationships(previewAnimations().at(-4)!).label).toBe(
      describePatternRelationships(expectedFirst).label,
    )
    const previewsBeforeContextChange = previewAnimations().length
    await wrapper.setProps({ builderInsertionIndex: 1 })
    await settlePreviewRendering()

    expect(previewAnimations()).toHaveLength(previewsBeforeContextChange + 4)
    expect(describePatternRelationships(previewAnimations().at(-4)!).label).toBe(
      describePatternRelationships(expectedSecond).label,
    )
  })

  it('updates every Full Grid label without collapsing duplicate candidate cells', async () => {
    const first = createDefaultVtgAnimation({ reference: '5-6', speedRatio: '1:3' })
    const animation = first
      ? appendVtgBuilderPattern(first, { reference: '2-3', speedRatio: '1:3' })
      : undefined
    if (!animation) throw new Error('Expected a two-portion Builder pattern')
    const wrapper = mount(VtgPane, {
      props: {
        animation,
        builderActive: true,
        builderFullCatalog: true,
        builderInsertionIndex: 0,
      },
    })

    expect(wrapper.findAll('[data-role="vtg-tile"]')).toHaveLength(36)
    expect(wrapper.get('[data-cell-reference="1-1"] .vtg-tile__label-text').text()).toBe('TS / TS')

    await wrapper.setProps({ builderInsertionIndex: 1 })

    expect(wrapper.findAll('[data-role="vtg-tile"]')).toHaveLength(36)
    expect(wrapper.get('[data-cell-reference="1-1"] .vtg-tile__label-text').text()).toBe('TS / SS')
    expect(wrapper.get('[data-cell-reference="1-3"] .vtg-tile__label-text').text()).toBe('TS / SS')
  })

  it('uses a full-size copy of the VTG cell as the desktop Builder drag image', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(VtgPane, { props: { animation, builderActive: true } })
    await flushPromises()
    const tile = wrapper.get<HTMLButtonElement>('[data-cell-reference="1-1"]')
    vi.spyOn(tile.element, 'getBoundingClientRect').mockReturnValue({
      width: 120,
      height: 80,
      x: 0,
      y: 0,
      top: 0,
      right: 120,
      bottom: 80,
      left: 0,
      toJSON: () => ({}),
    })
    const setDragImage = vi.fn<(image: Element, x: number, y: number) => void>()

    await tile.trigger('dragstart', {
      dataTransfer: {
        effectAllowed: 'none',
        setData: vi.fn<(format: string, data: string) => void>(),
        setDragImage,
      },
    })

    expect(setDragImage).toHaveBeenCalledWith(expect.any(HTMLElement), 60, 40)
    const desktopDragImage = setDragImage.mock.calls[0]?.[0] as HTMLElement
    expect(desktopDragImage.classList.contains('vtg-tile')).toBe(true)
    expect(desktopDragImage.style.width).toBe('120px')
    expect(desktopDragImage.style.height).toBe('80px')
    expect(desktopDragImage.textContent).toContain(tile.text())
  })

  it('starts Builder pointer dragging from touch input on a hybrid device', async () => {
    const wrapper = mount(VtgPane, { props: { builderActive: true } })
    const tile = wrapper.get<HTMLElement>('[data-cell-reference="1-1"]')
    const handlePointerMove = vi.fn<(event: Event) => void>()
    document.addEventListener(builderPatternPointerMoveEvent, handlePointerMove)

    try {
      const pointerDown = new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      })
      Object.defineProperties(pointerDown, {
        isPrimary: { value: true },
        pointerId: { value: 7 },
        pointerType: { value: 'touch' },
      })
      tile.element.dispatchEvent(pointerDown)

      const pointerMove = new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 30,
        clientY: 10,
      })
      Object.defineProperties(pointerMove, {
        pointerId: { value: 7 },
        pointerType: { value: 'touch' },
      })
      tile.element.dispatchEvent(pointerMove)

      expect(handlePointerMove).toHaveBeenCalledOnce()
    } finally {
      document.removeEventListener(builderPatternPointerMoveEvent, handlePointerMove)
      wrapper.unmount()
    }
  })

  it('uses the shared Full Grid thumbnail and Elemental icons in touch drag previews', async () => {
    useConceptsStore().elementalLayout = true
    const wrapper = mount(VtgPane, {
      props: { builderActive: true, builderFullCatalog: true },
    })
    await settlePreviewRendering()
    reportAllBlankDimensions(72, 68)
    await settlePreviewRendering()

    const tile = wrapper.get<HTMLElement>('[data-cell-reference="2-2"]')
    const sharedPreview = wrapper.get<HTMLImageElement>('[data-preview-reference="1-1"]')
    const handlePointerMove = vi.fn<(event: Event) => void>()
    document.addEventListener(builderPatternPointerMoveEvent, handlePointerMove)

    try {
      const pointerDown = new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      })
      Object.defineProperties(pointerDown, {
        isPrimary: { value: true },
        pointerId: { value: 8 },
        pointerType: { value: 'touch' },
      })
      tile.element.dispatchEvent(pointerDown)

      const pointerMove = new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 30,
        clientY: 10,
      })
      Object.defineProperties(pointerMove, {
        pointerId: { value: 8 },
        pointerType: { value: 'touch' },
      })
      tile.element.dispatchEvent(pointerMove)

      const pointerEvent = handlePointerMove.mock.calls[0]?.[0]
      expect(pointerEvent).toBeInstanceOf(CustomEvent)
      if (!(pointerEvent instanceof CustomEvent)) throw new Error('Expected pointer drag event')
      const detail = pointerEvent.detail as BuilderPatternPointerDetail
      expect(detail.preview.imageUrl).toBe(sharedPreview.element.src)
      expect(detail.preview.elemental).toMatchObject({
        hands: expect.any(Object),
        props: expect.any(Object),
      })
      expect(tile.findAll('.elemental-relationship-icons__icon')).toHaveLength(2)
    } finally {
      document.removeEventListener(builderPatternPointerMoveEvent, handlePointerMove)
      wrapper.unmount()
    }
  })

  it('shows the full VTG grid and source controls for an empty Builder', () => {
    const wrapper = mount(VtgPane, {
      props: {
        builderActive: true,
        builderFullCatalog: true,
        builderFullCatalogForced: true,
      },
    })

    expect(wrapper.findAll('[data-role="vtg-tile"]')).toHaveLength(36)
    expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(9)
    expect(
      wrapper.findAll('.vtg-tile-tooltip').every((tile) => tile.attributes('style') === undefined),
    ).toBe(true)
    expect(wrapper.find('[data-role="vtg-playback-controls"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-qtr"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-orientation"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-beat"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-transition-controls"]').exists()).toBe(false)
    expect(wrapper.get('[data-role="vtg-tile"]').attributes('draggable')).toBe('true')
    expect(wrapper.find('[data-role="vtg-classic"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-builder-full-grid"]').exists()).toBe(false)
  })

  it('shows Swap in the forced full Builder grid', () => {
    const wrapper = mount(VtgPane, {
      props: {
        builderActive: true,
        builderFullCatalog: true,
        builderFullCatalogForced: true,
      },
    })

    expect(wrapper.find('[data-role="vtg-swap"]').exists()).toBe(true)
  })

  it('offers an opt-in Full Grid control for the compact Builder catalog', async () => {
    const wrapper = mount(VtgPane, { props: { builderActive: true } })
    const fullGrid = wrapper.get<HTMLInputElement>('[data-role="vtg-builder-full-grid"]')

    expect(fullGrid.element.checked).toBe(false)
    expect(wrapper.findAll('[data-role="vtg-tile"]')).toHaveLength(8)
    expect(wrapper.find('[data-role="vtg-swap"]').exists()).toBe(false)

    await fullGrid.setValue(true)
    expect(wrapper.emitted('update:builderFullGrid')).toEqual([[true]])

    await wrapper.setProps({ builderFullGrid: true, builderFullCatalog: true })
    expect(wrapper.findAll('[data-role="vtg-tile"]')).toHaveLength(36)
    expect(wrapper.find('[data-role="vtg-swap"]').exists()).toBe(true)
    expect(
      wrapper.get<HTMLInputElement>('[data-role="vtg-builder-full-grid"]').element.checked,
    ).toBe(true)
  })

  it('shows Full Grid playback controls only for the first Builder portion', async () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const wrapper = mount(VtgPane, {
      props: {
        animation,
        builderActive: true,
        builderFullCatalog: true,
        builderFullGrid: true,
        builderInsertionIndex: 1,
      },
    })

    expect(wrapper.find('[data-role="vtg-playback-controls"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-qtr"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-orientation"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-beat"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-builder-full-grid"]').exists()).toBe(true)

    await wrapper.setProps({ builderFullCatalogForced: true, builderInsertionIndex: 0 })

    expect(wrapper.find('[data-role="vtg-playback-controls"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-qtr"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-orientation"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-beat"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="vtg-builder-full-grid"]').exists()).toBe(false)
  })

  it('limits Builder to the eight final relationship sources at every ratio', async () => {
    const wrapper = mount(VtgPane, { props: { builderActive: true } })
    const references = () =>
      wrapper
        .findAll('[data-role="vtg-tile"]')
        .map((tile) => tile.attributes('data-cell-reference'))

    expect(references()).toEqual(['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4'])
    for (const ratio of ['1:1', '1:2', '1:3', '1:4', '1:5'] as const) {
      await selectSpeedRatio(wrapper, ratio)
      expect(references()).toEqual(['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4'])
      expect(wrapper.findAll('[data-role="vtg-blank"]')).toHaveLength(4)
    }
  })

  it('uses the non-Classic compact Builder table and supports Elemental relationship icons', async () => {
    const wrapper = mount(VtgPane, { props: { builderActive: true } })
    const first = wrapper.get('[data-cell-reference="1-1"]')
    const last = wrapper.get('[data-cell-reference="2-4"]')

    expect(wrapper.find('[data-role="vtg-classic"]').exists()).toBe(false)
    expect(wrapper.find('[data-role="vtg-elemental"]').exists()).toBe(true)
    expect(wrapper.get('[data-role="vtg-pane"]').classes()).not.toContain('vtg-pane--classic')
    expect(first.element.parentElement?.getAttribute('style')).toContain('grid-column: 1')
    expect(first.element.parentElement?.getAttribute('style')).toContain('grid-row: 1')
    expect(last.element.parentElement?.getAttribute('style')).toContain('grid-column: 4')
    expect(last.element.parentElement?.getAttribute('style')).toContain('grid-row: 2')
    expect(
      wrapper.get('[data-role="vtg-sidebar"]').findAll('[data-role="vtg-rule-card"]'),
    ).toHaveLength(2)

    await wrapper.get<HTMLInputElement>('[data-role="vtg-elemental"]').setValue(true)
    expect(first.get('.vtg-tile__label-text').text()).toContain('AA /')
    expect(first.findAll('.vtg-tile__elements .base-icon')).toHaveLength(2)
    expect(
      wrapper.get('[data-role="vtg-column-headers"]').findAll('[data-role="vtg-rule-card"]'),
    ).toHaveLength(4)
  })

  it('keeps Elemental available in Builder while QTR is enabled', async () => {
    useConceptsStore().qtrEnabled = true
    const wrapper = mount(VtgPane, { props: { builderActive: true } })

    expect(wrapper.find('[data-role="vtg-elemental"]').exists()).toBe(true)
    await wrapper.get<HTMLInputElement>('[data-role="vtg-elemental"]').setValue(true)
    expect(
      wrapper.findAll('[data-cell-reference="1-1"] .vtg-tile__label-text .base-icon'),
    ).toHaveLength(2)
  })

  it('keeps Elemental available in the QTR generator', async () => {
    useConceptsStore().qtrEnabled = true
    const wrapper = mount(VtgPane)

    const elemental = wrapper.get<HTMLInputElement>('[data-role="vtg-elemental"]')
    expect(elemental.element.checked).toBe(false)
    await elemental.setValue(true)
    expect(
      wrapper.findAll('[data-cell-reference="1-1"] .vtg-tile__label-text .base-icon'),
    ).toHaveLength(2)
  })

  it('preserves each compact Builder header rule and its ratio-specific behavior', async () => {
    const wrapper = mount(VtgPane, { props: { builderActive: true } })
    const columns = () => wrapper.get('[data-role="vtg-column-headers"]')
    const sides = () => wrapper.get('[data-role="vtg-sidebar"]')

    await selectSpeedRatio(wrapper, '1:1')
    expect(columns().findAll('[data-role="vtg-rule-card"]')).toHaveLength(4)
    expect(
      columns()
        .findAll('.vtg-rule-card__title')
        .every((title) => title.text() === ''),
    ).toBe(true)
    expect(columns().findAll('[data-role="vtg-prop"]')).toHaveLength(0)
    expect(sides().findAll('[data-role="vtg-rule-card"]')).toHaveLength(2)
    expect(
      sides()
        .findAll('.vtg-rule-card__title')
        .every((title) => title.text() === ''),
    ).toBe(true)
    expect(sides().findAll('[data-role="vtg-prop"]')).toHaveLength(0)

    await selectSpeedRatio(wrapper, '1:2')
    expect(columns().findAll('[data-role="vtg-prop"]')).toHaveLength(0)
    expect(sides().findAll('[data-role="vtg-prop"]')).toHaveLength(0)

    await sides().get('[aria-label$="rule 2"]').trigger('click')
    expect(wrapper.get('.vtg-tile--selected').attributes('data-cell-reference')).toMatch(
      /^2-[1-4]$/,
    )
  })
})
