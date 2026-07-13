import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getInterpolatedValue, usePingPongValue } from '@/composables/usePingPongValue'

describe('usePingPongValue', () => {
  let callbacks: Map<number, FrameRequestCallback>
  let nextId: number

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    callbacks = new Map()
    nextId = 1
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('clamps interpolation progress to its bounds', () => {
    expect(getInterpolatedValue(10, 20, -1, (value) => value)).toBe(10)
    expect(getInterpolatedValue(10, 20, 0.5, (value) => value)).toBe(15)
    expect(getInterpolatedValue(10, 20, 2, (value) => value)).toBe(20)
  })

  it('animates between the configured values and cancels its frame on unmount', () => {
    let animation: ReturnType<typeof usePingPongValue> | undefined
    const TestComponent = defineComponent({
      setup() {
        animation = usePingPongValue(0, 10, 100, (value) => value)
        return () => h('div')
      },
    })
    const wrapper = mount(TestComponent)

    animation!.startAnimation()
    callbacks.get(1)!(0)
    callbacks.delete(1)
    callbacks.get(2)!(50)
    callbacks.delete(2)

    expect(animation!.value.value).toBe(5)
    expect(callbacks.size).toBe(1)

    wrapper.unmount()
    expect(callbacks.size).toBe(0)
  })
})
