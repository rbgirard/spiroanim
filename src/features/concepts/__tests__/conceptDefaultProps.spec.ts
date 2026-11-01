import { describe, expect, it } from 'vitest'

import { createDefaultEightStepAnimation } from '@/features/eight-step/createEightStepAnimation'
import { createDefaultQstAnimation } from '@/features/quarter-space-tech/createQstAnimation'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { createEightStepAnimation } from '@/features/eight-step/createEightStepAnimation'
import { createQstAnimation } from '@/features/quarter-space-tech/createQstAnimation'

describe('Concept prop selection', () => {
  it.each([
    ['VTG', () => createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })],
    ['Eight Step', () => createDefaultEightStepAnimation({ concept: '8stp', reference: '1-AA' })],
    ['QST', () => createDefaultQstAnimation({ concept: 'qst', reference: 'breaks-1' })],
  ])('keeps POI as the application default for %s', (_concept, createAnimation) => {
    expect(createAnimation()?.prop).toBe(0)
  })

  it.each([
    ['VTG', () => createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3', prop: 2 })],
    [
      'Eight Step',
      () => createDefaultEightStepAnimation({ concept: '8stp', reference: '1-AA', prop: 2 }),
    ],
    ['QST', () => createDefaultQstAnimation({ concept: 'qst', reference: 'breaks-1', prop: 2 })],
  ])('applies the Concepts Juggling Clubs override to %s', (_concept, createAnimation) => {
    expect(createAnimation()?.prop).toBe(2)
  })

  it.each([
    [
      'VTG',
      () => {
        const current = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3', prop: 2 })
        return current
          ? createVtgAnimation(current, { reference: '1-1', speedRatio: '1:3' })
          : undefined
      },
    ],
    [
      'Eight Step',
      () => {
        const current = createDefaultEightStepAnimation({
          concept: '8stp',
          reference: '1-AA',
          prop: 2,
        })
        return current
          ? createEightStepAnimation(current, { concept: '8stp', reference: '1-AA' })
          : undefined
      },
    ],
    [
      'QST',
      () => {
        const current = createDefaultQstAnimation({
          concept: 'qst',
          reference: 'breaks-1',
          prop: 2,
        })
        return current
          ? createQstAnimation(current, { concept: 'qst', reference: 'breaks-1' })
          : undefined
      },
    ],
  ])(
    'applies an omitted default POI selection over an existing prop for %s',
    (_concept, create) => {
      expect(create()?.prop).toBe(0)
    },
  )
})
