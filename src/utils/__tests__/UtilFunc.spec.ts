import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  debounce,
  debounceImmediate,
  findKeyByValue,
  nextFrame,
  throttle,
  throttleTrailing,
  toColor,
} from '@/utils/UtilFunc'

describe('UtilFunc', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('debounces repeated calls with the latest arguments', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const wrapped = debounce(callback, 50)

    wrapped('first')
    wrapped('latest')
    vi.advanceTimersByTime(50)

    expect(callback).toHaveBeenCalledExactlyOnceWith('latest')
  })

  it('supports leading and trailing immediate debounce behavior', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const wrapped = debounceImmediate(callback, 50)

    wrapped('first')
    wrapped('latest')
    vi.advanceTimersByTime(50)

    expect(callback.mock.calls).toEqual([['first'], ['latest']])
  })

  it('supports leading and trailing throttle variants', () => {
    vi.useFakeTimers()
    vi.setSystemTime(100)
    const leading = vi.fn()
    const trailing = vi.fn()
    const leadingWrapped = throttle(leading, 50)
    const trailingWrapped = throttleTrailing(trailing, 50)

    leadingWrapped('first')
    leadingWrapped('latest')
    trailingWrapped('first')
    trailingWrapped('latest')
    vi.advanceTimersByTime(50)

    expect(leading.mock.calls).toEqual([['first'], ['latest']])
    expect(trailing).toHaveBeenCalledExactlyOnceWith('latest')
  })

  it('waits for the next animation frame', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })

    await expect(nextFrame()).resolves.toBe(0)
  })

  it('converts integer colors and finds record keys by value', () => {
    expect(toColor(0x123456)).toBe('rgb(18,52,86)')
    expect(findKeyByValue({ left: 1, right: 2 }, 2)).toBe('right')
    expect(findKeyByValue({ left: 1 }, 3)).toBeNull()
  })
})
