import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { VDEF, useQSMainStore } from '@/stores/useQSMainStore'

describe('useQSMainStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('exposes the current query definition and versioned codec API', () => {
    const store = useQSMainStore()

    expect(VDEF.move).toEqual([-30, 30, 6])
    expect(store.encodeQS).toBeTypeOf('function')
    expect(store.decodeQS).toBeTypeOf('function')
    expect(store.decodeVer).toBeTypeOf('function')
    expect(store.qsHistory).toEqual([])
    expect(store.qsPause).toBe(false)
    expect(store.qsSkip).toBe(false)
  })
})
