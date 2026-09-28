import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as previewRenderer from '@/features/concepts/composables/useConceptPreviewRenderer'
import { createThirdOrderPreviewAnimation } from '@/features/third-order/createThirdOrderAnimation'
import type { ThirdOrderCell } from '@/features/third-order/data/thirdOrderMatrix'
import type { ThirdOrderPatternSelection } from '@/features/third-order/types'
import { useThirdOrderCellPreviews } from '../useThirdOrderCellPreviews'

describe('Third Order duplicate previews', () => {
  afterEach(() => vi.restoreAllMocks())

  it('refreshes touched cells without rebuilding the board and resets unselected cells to D: 1', async () => {
    let options: Parameters<typeof previewRenderer.useConceptPreviewRenderer>[0] | undefined
    const requestPreviews = vi.fn<() => void>()
    const requestPartialPreviews = vi.fn<() => void>()
    vi.spyOn(previewRenderer, 'useConceptPreviewRenderer').mockImplementation((input) => {
      options = input
      return { previewUrls: ref<string[]>([]), requestPreviews, requestPartialPreviews }
    })
    const settings = ref<Omit<ThirdOrderPatternSelection, 'handRatio' | 'propRatio'>>({
      concept: 'to',
      handDirection: 'anti',
      propDirection: 'spin',
      version: 1,
    })
    const selected = ref<ThirdOrderCell & { duplicate: number }>()
    const wrapper = mount(
      defineComponent({
        setup() {
          useThirdOrderCellPreviews(settings, ref(900), selected)
          return () => null
        },
      }),
    )
    try {
      requestPreviews.mockClear()
      selected.value = { handRatio: '1:1', propRatio: '1:1', duplicate: 1 }
      await nextTick()
      expect(requestPartialPreviews).not.toHaveBeenCalled()
      selected.value = { ...selected.value, duplicate: 2 }
      await nextTick()
      expect(options!.partialIndexes).toEqual([0])
      expect(requestPartialPreviews).toHaveBeenCalledOnce()
      expect(options!.createAnimation('0')).toEqual(
        createThirdOrderPreviewAnimation({ ...settings.value, ...selected.value }),
      )
      // A newer request must retain all touched indices if the worker is still processing the old one.
      selected.value = { handRatio: '1:2', propRatio: '1:1', duplicate: 2 }
      await nextTick()
      expect(options!.partialIndexes).toEqual([0, 1])
      expect(options!.createAnimation('0')).toEqual(
        createThirdOrderPreviewAnimation({
          ...settings.value,
          handRatio: '1:1',
          propRatio: '1:1',
          duplicate: 1,
        }),
      )
      expect(options!.createAnimation('1')).toEqual(
        createThirdOrderPreviewAnimation({ ...settings.value, ...selected.value }),
      )
      selected.value = { ...selected.value, duplicate: 1 }
      await nextTick()
      expect(options!.partialIndexes).toEqual([0, 1])
      expect(requestPreviews).not.toHaveBeenCalled()
      settings.value = { ...settings.value, version: 2 }
      await nextTick()
      expect(requestPreviews).toHaveBeenCalledOnce()
      expect(options!.partialIndexes).toEqual([])
    } finally {
      wrapper.unmount()
    }
  })
})
