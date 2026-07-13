import { describe, expect, it } from 'vitest'

import { useViewDimensions } from '@/composables/useViewDimensions'

describe('useViewDimensions', () => {
  it('follows the current pane dimensions and resets when no pane matches', async () => {
    const parents = ref<Record<string, string>>({ player: 'left' })
    const left = ref({ width: 640, height: 480, perc: 60 })
    const right = ref({ width: 360, height: 480, perc: 40 })
    const dimensions = useViewDimensions('player', parents, { left, right })

    expect(dimensions).toEqual({ width: 640, height: 480, perc: 60 })

    parents.value.player = 'right'
    await nextTick()
    expect(dimensions).toEqual({ width: 360, height: 480, perc: 40 })

    parents.value.player = 'hidden'
    await nextTick()
    expect(dimensions).toEqual({ width: 0, height: 0, perc: 0 })
  })
})
