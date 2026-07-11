export type QueryValueTransform = (value: number) => unknown

export type QueryVariableDefinition = readonly [
  minimum: number,
  maximum: number,
  bits: number,
  transform?: QueryValueTransform,
]

export type QueryEncodableValue = number | boolean | undefined

export interface BaseQueryCodec<Variable extends string> {
  readonly charset: string
  readonly radix: number
  readonly paddingCharacter: string
  encodeInteger(value: number): string
  decodeInteger(value: string): number
  normalize(variable: Variable, value: number | undefined, bits: number): number
  denormalize(variable: Variable, value: number | undefined, bits: number): number | undefined
  pack(
    variables: readonly Variable[],
    values: Partial<Record<Variable, QueryEncodableValue>>,
    paddingLength?: number,
  ): string
  unpack(variables: readonly Variable[], encoded: string): Partial<Record<Variable, unknown>>
}
