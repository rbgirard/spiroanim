import { describe, expect, it } from 'vitest'

import { getAspectLabelData, useAspectRatio } from '@/composables/useAspectRatio'

describe('useAspectRatio', () => {
  it('recognizes an exact standard ratio and retains its reduced form', () => {
    expect(getAspectLabelData(1920, 1080)).toMatchObject({
      level: 0,
      match: '16:9',
      reduced: '16:9',
      ratio: 1920 / 1080,
    })
  })

  it('reacts when the dimensions change', () => {
    const width = ref(1600)
    const height = ref(900)
    const aspect = useAspectRatio(width, height)

    expect(aspect.data.value.match).toBe('16:9')
    expect(aspect.description.value).toContain('Widescreen HD')
    expect(aspect.color.value).toBe('var(--color-aspect-exact)')

    width.value = 1000
    height.value = 1000
    expect(aspect.data.value.match).toBe('1:1')
  })
})
