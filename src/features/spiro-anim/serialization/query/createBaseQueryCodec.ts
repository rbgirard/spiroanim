import type {
  BaseQueryCodec,
  QueryEncodableValue,
  QueryVariableDefinition,
} from '@/features/spiro-anim/serialization/query/types'

// This is a custom URL-safe radix-64 alphabet, not standard Base64. Its order is part of the
// persisted query-string format and must remain stable for existing shared URLs.
const DEFAULT_CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-'
const RESERVED_UNDEFINED_VALUES = 1

/**
 * Creates the low-level integer and bit-field codec used by versioned SpiroAnim query formats.
 * Variable order, bit widths, the alphabet, and padding behavior are serialized-data contracts.
 */
export function createBaseQueryCodec<Variable extends string>(
  definitions: Record<Variable, QueryVariableDefinition>,
  charset = DEFAULT_CHARSET,
): BaseQueryCodec<Variable> {
  if (import.meta.env.DEV) validateQueryDefinitions(definitions)

  if (charset.length < 2) {
    throw new RangeError('The query codec charset must contain at least two characters.')
  }

  const radix = charset.length
  const paddingCharacter = charset.at(-1) ?? ''

  const encodeInteger = (value: number): string => {
    let remaining = value
    let encoded = ''

    if (remaining === 0) return charset[0] ?? ''

    while (remaining > 0) {
      encoded = (charset[remaining % radix] ?? '') + encoded
      remaining = Math.floor(remaining / radix)
    }

    return encoded
  }

  const decodeInteger = (value: string): number =>
    value.split('').reduce((decoded, character) => {
      const index = charset.indexOf(character)
      // Preserve legacy tolerance: characters outside the alphabet contribute a zero digit.
      return decoded * radix + (index === -1 ? 0 : index)
    }, 0)

  // Normalized values are zero-based. The all-ones bit pattern is reserved for undefined.
  const normalize = (variable: Variable, value: number | undefined, bits: number): number => {
    const [minimum, maximum] = definitions[variable]
    if (value === undefined) return (1 << bits) - 1
    return Math.max(0, Math.min(value - minimum, maximum - minimum))
  }

  const denormalize = (
    variable: Variable,
    value: number | undefined,
    bits: number,
  ): number | undefined => {
    const [minimum, maximum] = definitions[variable]
    if (value === undefined || value === (1 << bits) - 1) return undefined

    return Math.max(minimum, Math.min(value + minimum, maximum))
  }

  const pack = (
    variables: readonly Variable[],
    values: Partial<Record<Variable, QueryEncodableValue>>,
    paddingLength = 5,
  ): string => {
    // JavaScript bitwise operators use signed 32-bit integers. Versioned segment definitions must
    // therefore stay within the legacy practical limit of 30 packed bits.
    let packed = 0
    let bitPosition = 0
    let bitsUsed = 0

    // Values are packed least-significant field first. Reordering variables changes the format.
    for (const variable of variables) {
      const bits = definitions[variable][2]
      const value = values[variable]
      bitsUsed += bits

      let normalized: number
      if (typeof value === 'number' || value === undefined) {
        normalized = normalize(variable, value, bits)
      } else if (typeof value === 'boolean') {
        normalized = value ? 1 : 0
      } else {
        normalized = 0
      }

      const mask = (1 << bits) - 1
      packed |= (normalized & mask) << bitPosition
      bitPosition += bits
    }

    if (paddingLength > 0) {
      // Query segments use six bits per radix-64 character. Fill unused bits with ones so higher
      // level encoders can recognize and strip trailing max-value segments without data loss.
      const paddingBits = paddingLength * 6 - bitsUsed
      for (let index = 0; index < paddingBits; index += 1) {
        packed |= 1 << (bitsUsed + index)
      }
    }

    let encoded = encodeInteger(packed)
    // Leading zero digits preserve the fixed segment length expected by version definitions.
    while (encoded.length < paddingLength) {
      encoded = (charset[0] ?? '') + encoded
    }

    return encoded
  }

  const unpack = (
    variables: readonly Variable[],
    encoded: string,
  ): Partial<Record<Variable, unknown>> => {
    const packed = decodeInteger(encoded)
    const values: Partial<Record<Variable, unknown>> = {}
    let bitPosition = 0

    for (const variable of variables) {
      const [minimum, maximum, bits, transform] = definitions[variable]
      const mask = (1 << bits) - 1
      const packedValue = (packed >> bitPosition) & mask
      const value = denormalize(variable, packedValue, bits)

      if (value !== undefined) {
        // Version definitions may restore booleans or other domain values after unpacking.
        values[variable] = transform
          ? transform(value)
          : Math.max(minimum, Math.min(value, maximum))
      }

      bitPosition += bits
    }

    return values
  }

  return {
    charset,
    radix,
    paddingCharacter,
    encodeInteger,
    decodeInteger,
    normalize,
    denormalize,
    pack,
    unpack,
  }
}

export function validateQueryDefinitions<Variable extends string>(
  definitions: Record<Variable, QueryVariableDefinition>,
): void {
  // One bit pattern per field is unavailable because all bits set represents undefined.
  for (const variable of Object.keys(definitions) as Variable[]) {
    const [minimum, maximum, bits] = definitions[variable]
    const largestEncodableRange = 2 ** bits - RESERVED_UNDEFINED_VALUES - 1
    const definedRange = maximum - minimum

    if (definedRange > largestEncodableRange) {
      console.error(
        `Query variable '${variable}' exceeds its bit range: ` +
          `defined ${definedRange}, allowed ${largestEncodableRange}.`,
      )
    }
  }
}
