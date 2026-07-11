import { describe, expect, it, vi } from 'vitest'

import {
  createBaseQueryCodec,
  validateQueryDefinitions,
} from '@/services/query/createBaseQueryCodec'

const definitions = {
  signed: [-2, 2, 3],
  enabled: [0, 1, 2, Boolean],
} as const

describe('createBaseQueryCodec', () => {
  const codec = createBaseQueryCodec(definitions)

  it('uses the legacy URL-safe radix-64 alphabet', () => {
    expect(codec.encodeInteger(0)).toBe('0')
    expect(codec.encodeInteger(63)).toBe('-')
    expect(codec.encodeInteger(64)).toBe('10')
    expect(codec.decodeInteger('10')).toBe(64)
  })

  it('preserves the legacy invalid-character fallback', () => {
    expect(codec.decodeInteger('!')).toBe(0)
  })

  it('normalizes values and reserves the all-ones value for undefined', () => {
    expect(codec.normalize('signed', -2, 3)).toBe(0)
    expect(codec.normalize('signed', 2, 3)).toBe(4)
    expect(codec.normalize('signed', undefined, 3)).toBe(7)
    expect(codec.denormalize('signed', 7, 3)).toBeUndefined()
  })

  it('round-trips packed values and applies definition transforms', () => {
    const encoded = codec.pack(['signed', 'enabled'], { signed: 1, enabled: true }, 1)

    expect(codec.unpack(['signed', 'enabled'], encoded)).toEqual({
      signed: 1,
      enabled: true,
    })
  })
})

describe('validateQueryDefinitions', () => {
  it('reports definitions that cannot fit while reserving undefined', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    validateQueryDefinitions({ oversized: [0, 3, 2] })

    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})
