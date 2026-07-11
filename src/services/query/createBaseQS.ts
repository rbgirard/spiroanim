import { createBaseQueryCodec } from '@/services/query/createBaseQueryCodec'
import type { BaseQS, VDefEntry } from '@/services/query/types/BaseQSTypes'

/** Compatibility-shaped facade over the migrated base query codec. */
export function useBaseQS<AllVars extends string>(
  VDEF: Record<AllVars, VDefEntry>,
  options = {
    charset: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-',
  },
): BaseQS<AllVars> {
  const codec = createBaseQueryCodec(VDEF, options.charset)

  return {
    charset: codec.charset,
    baselen: codec.radix,
    basemax: codec.paddingCharacter,
    encodeBase64: codec.encodeInteger,
    decodeBase64: codec.decodeInteger,
    normalize: codec.normalize,
    denormalize: codec.denormalize,
    packBase64: codec.pack,
    unpackBase64: codec.unpack,
  }
}
