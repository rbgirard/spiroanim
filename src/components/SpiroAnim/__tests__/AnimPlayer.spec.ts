import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AnimPlayer from '@/components/SpiroAnim/AnimPlayer.vue'
import type { ComposerCell } from '@/features/kinetic-alphabet/composerBridge'

class FakeWorker extends EventTarget {
  postMessage(): void {}
  terminate(): void {}
}

const dim = { width: 640, height: 480, perc: 60 }
const composerCell: ComposerCell = {
  concept: 'vtg',
  reference: '1-1',
  speedRatio: '1:3',
  shape: 'diamond',
  isAnti: false,
  orientation: 0,
}

const mountPlayer = (props: Record<string, unknown>) =>
  mount(AnimPlayer, {
    props: { dim, ...props },
    global: {
      stubs: {
        Controls: { template: '<div data-role="player-controls" />' },
        PlayerMinimalControls: { template: '<div data-role="player-minimal-controls" />' },
      },
    },
  })

describe('AnimPlayer', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    }))
    Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', {
      configurable: true,
      value: () => ({}),
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('links a matched catalog cell to the Flow Arts Composer', () => {
    const wrapper = mountPlayer({ store: 'tka-chip-matched', composerCell })
    const chip = wrapper.get('[data-role="tka-chip"]')

    expect(chip.text()).toBe('TKA')
    expect(chip.attributes('href')).toBe(
      'https://tkaflowarts.com/from/spiroanim/vtg.1-1.1x3.diamond.base.o0',
    )
    expect(chip.attributes('target')).toBe('_blank')
    expect(chip.attributes('rel')).toBe('noopener')
    expect(chip.attributes('aria-label')).toBe('Open in Flow Arts Composer')

    wrapper.unmount()
  })

  it('hides the chip when no catalog cell is matched', () => {
    const wrapper = mountPlayer({ store: 'tka-chip-unmatched' })

    expect(wrapper.find('[data-role="tka-chip"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('keeps the chip out of minimal mode', () => {
    const wrapper = mountPlayer({ store: 'tka-chip-minimal', composerCell, minimal: true })

    expect(wrapper.find('[data-role="tka-chip"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
