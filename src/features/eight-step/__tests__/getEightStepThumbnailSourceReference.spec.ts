import { describe, expect, it } from 'vitest'

import { getEightStepThumbnailSourceReference } from '@/features/eight-step/getEightStepThumbnailSourceReference'
import type { EightStepCellReference } from '@/features/eight-step/types'

describe('getEightStepThumbnailSourceReference', () => {
  it.each([
    ['AA', [1, 1, 1, 1, 1, 1, 1, 1]],
    ['AE', [1, 1, 1, 1, 1, 1, 1, 1]],
    ['AI', [1, 2, 1, 2, 2, 2, 2, 2]],
    ['EA', [1, 1, 1, 1, 5, 5, 5, 5]],
    ['EE', [1, 1, 1, 1, 5, 5, 5, 5]],
    ['EI', [1, 2, 1, 2, 5, 5, 5, 5]],
    ['IA', [1, 2, 2, 1, 1, 1, 2, 2]],
    ['IE', [1, 2, 2, 1, 1, 1, 2, 2]],
    ['II', [1, 2, 3, 4, 5, 6, 7, 8]],
  ] as const)('maps the halved %s row to its observed visual groups', (row, sources) => {
    expect(
      sources.map((_, index) =>
        getEightStepThumbnailSourceReference(`${index + 1}-${row}` as EightStepCellReference, true),
      ),
    ).toEqual(sources.map((column) => `${column}-${row}`))
  })

  it('uses the first column thumbnail for every column when Halve is off', () => {
    expect(getEightStepThumbnailSourceReference('8-II', false)).toBe('1-II')
  })
})
