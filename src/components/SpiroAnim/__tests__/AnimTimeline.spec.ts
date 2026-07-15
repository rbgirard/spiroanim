import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AnimTimeline from '@/components/SpiroAnim/AnimTimeline.vue'
import { usePlayerStore } from '@/stores/usePlayerStore'

interface WorkerRequest {
  id?: string
  type: string
  data: unknown
}

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = []
  terminate = vi.fn<() => void>()

  constructor() {
    super()
    FakeWorker.instances.push(this)
  }

  postMessage(message: WorkerRequest): void {
    if (message.id === undefined) return

    const data =
      message.type === 'warnStr' ? message.data : message.type === 'initialize' ? true : undefined
    queueMicrotask(() => {
      this.dispatchEvent(
        new MessageEvent('message', {
          data: { id: message.id, type: message.type, data },
        }),
      )
    })
  }
}

class FakeIntersectionObserver {
  disconnect = vi.fn<() => void>()
  observe = vi.fn<(target: Element) => void>()
  unobserve = vi.fn<(target: Element) => void>()
}

class FakeResizeObserver {
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
}

describe('AnimTimeline', () => {
  const scrollIntoView = vi.fn<() => void>()

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn<(id: number) => void>())
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
  })

  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: () => void }).scrollIntoView
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders unique animation times and selects a range on thumbnail double click', async () => {
    const store = usePlayerStore('timeline')
    const runtime = store.raw()
    runtime.ROOT.value = {
      ...runtime.ROOT.value,
      bpm: 60,
      props: [{ anim: [{ beats: 1 }, { beats: 1 }, { beats: 1 }] }],
    }
    await nextTick()

    const wrapper = mount(AnimTimeline, {
      props: {
        store: 'timeline',
        dim: { width: 600, height: 400, perc: 50 },
      },
    })
    await flushPromises()

    const thumbs = wrapper.findAll('img.thumb')
    expect(thumbs).toHaveLength(3)
    expect(wrapper.findAll('.circle')).toHaveLength(3)
    expect(wrapper.text()).toContain('2: 1')
    expect(thumbs[0]!.attributes()).toMatchObject({
      alt: 'Animation thumbnail 1',
      role: 'button',
      tabindex: '0',
    })

    await thumbs[0]!.trigger('keydown', { key: 'Enter' })
    expect(store.raw().CURRENT.value).toBe(0)

    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(200)
    await thumbs[1]!.trigger('click')
    await thumbs[1]!.trigger('click')

    expect(store.raw().CURRENT.value).toBe(1000)
    expect(store.SELECTION).toBe(true)
    expect(store.SELECTED).toEqual([1, 2])

    wrapper.unmount()
    await flushPromises()
    expect(FakeWorker.instances[0]!.terminate).toHaveBeenCalledOnce()
  })

  it('scrolls only its own container when the active thumbnail is outside the view', async () => {
    const store = usePlayerStore('timeline-scroll')
    const runtime = store.raw()
    runtime.ROOT.value = {
      ...runtime.ROOT.value,
      bpm: 60,
      props: [{ anim: [{ beats: 1 }, { beats: 1 }, { beats: 1 }] }],
    }
    await nextTick()

    const wrapper = mount(AnimTimeline, {
      props: {
        store: 'timeline-scroll',
        dim: { width: 600, height: 400, perc: 50 },
      },
    })
    await flushPromises()

    const scroll = wrapper.get('.scrollbar').element as HTMLElement
    const thumbs = wrapper.findAll<HTMLImageElement>('img.thumb')
    scroll.scrollTop = 20
    vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 50, 600, 100))
    vi.spyOn(thumbs[1]!.element, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 250, 300, 100),
    )
    scrollIntoView.mockClear()

    runtime.CURRENT.value = 1000
    await nextTick()
    await flushPromises()

    expect(scroll.scrollTop).toBe(220)
    expect(scrollIntoView).not.toHaveBeenCalled()

    wrapper.unmount()
    await flushPromises()
  })
})
