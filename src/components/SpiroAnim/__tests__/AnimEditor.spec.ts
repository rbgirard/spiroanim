import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useEditorPaneStore } from '@/features/editor/stores/useEditorPaneStore'

class FakeResizeObserver {
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
}

describe('AnimEditor', () => {
  const originalWidth = Object.getOwnPropertyDescriptor(Screen.prototype, 'width')

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    Object.defineProperty(Screen.prototype, 'width', { configurable: true, value: 1400 })
  })

  afterEach(() => {
    if (originalWidth) Object.defineProperty(Screen.prototype, 'width', originalWidth)
    else delete (Screen.prototype as { width?: number }).width
    vi.unstubAllGlobals()
  })

  it('enables and swaps its two views when enough space is available', async () => {
    const { default: AnimEditor } = await import('@/components/SpiroAnim/AnimEditor.vue')
    const wrapper = mount(AnimEditor, {
      props: {
        dim: { width: 700, height: 400, perc: 60 },
        landscape: true,
        vtl: false,
      },
      global: {
        stubs: {
          Properties: { template: '<div data-type="properties" />' },
          Timeline: { template: '<div data-type="timeline" />' },
          PaneSplitter: { template: '<div data-role="editor-splitter" />' },
        },
      },
    })
    await nextTick()

    const paneStore = useEditorPaneStore()
    expect(paneStore.parents).toEqual({ properties: 'top', timeline: 'bottom' })

    await wrapper.get('button[aria-label="Swap editor views"]').trigger('click')
    expect(paneStore.parents).toEqual({ properties: 'bottom', timeline: 'top' })

    await wrapper.setProps({ vtl: true })
    expect(wrapper.find('button[aria-label="Swap editor views"]').exists()).toBe(false)
  })
})
