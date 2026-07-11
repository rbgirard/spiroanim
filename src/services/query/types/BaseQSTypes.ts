// src/services/query/types/BaseQSTypes.ts

import type { qsTransform } from '@/types/AnimTypes'

export type EncodeBase64Fn = (number: number) => string

export type DecodeBase64Fn = (str: string) => number

export type NormalizeFn<AllVars extends string> = (
  prop: AllVars,
  num: number | undefined,
  bits: number,
) => number

export type DenormalizeFn<AllVars extends string> = (
  prop: AllVars,
  num: number | undefined,
  bits: number,
) => number | undefined

export type PackBase64Fn<AllVars extends string> = (
  properties: AllVars[],
  values: Partial<Record<AllVars, number | boolean | undefined>>,
  pad?: number,
) => string

export type UnpackBase64Fn<AllVars extends string> = (
  properties: AllVars[],
  base64: string,
) => Partial<Record<AllVars, unknown>>

// Create an interface for the return value
export interface BaseQS<AllVars extends string> {
  charset: string
  baselen: number
  basemax: string
  encodeBase64: EncodeBase64Fn
  decodeBase64: DecodeBase64Fn
  normalize: NormalizeFn<AllVars>
  denormalize: DenormalizeFn<AllVars>
  packBase64: PackBase64Fn<AllVars>
  unpackBase64: UnpackBase64Fn<AllVars>
}

export type VDefEntry = [number, number, number, qsTransform?]
