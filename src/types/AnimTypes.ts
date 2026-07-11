// src/types/AnimTypes.ts

import {
  INDPNT,
  MANCMD,
  PTYPE,
  TTYPE,
  TTEXT,
  COLORS,
  PROPSR,
  PTEXT,
  PPROP,
} from '@/math/animation/AnimStruct'

import { type IndicesOf } from '@/types/SpecialTypes'

export type PointInd = IndicesOf<typeof INDPNT> // Point Indices
export type PointStr = (typeof INDPNT)[PointInd] // Point Strings

export type ManCmdInd = IndicesOf<typeof MANCMD> // // Manipulation Command Indices
export type ManCmdStr = (typeof MANCMD)[ManCmdInd] // Manipulation Command Strings

export type PointTypes = (typeof PTYPE)[keyof typeof PTYPE] // Type of Points (used by worker / animator)

export type TypeInd = (typeof TTYPE)[keyof typeof TTYPE] // Transition Type Indices
export type TypeStr = (typeof TTEXT)[number] // Transition Type Strings

export type ColorInd = IndicesOf<typeof COLORS> // Color Indices
export type ColorStr = (typeof COLORS)[number] // Color Strings

export type PropInd = IndicesOf<typeof PROPSR> // Prop Indices
export type PropMod = (typeof PROPSR)[PropInd] // Prop Name (No spaces etc.)
export type PropStr = (typeof PTEXT)[PropInd] // Prop String

export type PPropKeys = keyof (typeof PPROP)[PointTypes] // Keys used in PPROP
export type qsTransform = BooleanConstructor | undefined // For typecasting certain values from query string

export type GrefItem = Record<PointInd, PointInd>

// Animation Data root.props[ { anim: [ ... ] } ]
export interface AnimData {
  turns?: number
  beats?: number
  scale?: number
  depth?: number
  type?: TypeInd
  adjust?: number
  arc?: number
  plane?: number
  axis?: number
  move?: [number, number, number]
}

// Prop Data root.props[ ... ]
export interface PropData {
  color?: ColorInd
  prop?: PropInd
  guides?: boolean
  paths?: boolean
  hands?: boolean
  visible?: boolean
  nodes?: boolean
  anchors?: boolean
  anim: AnimData[]
  thick?: number
}

// Root Data
export interface RootData {
  bpm: number
  prop: PropInd
  color: ColorInd
  smooth: boolean
  guides: boolean
  paths: boolean
  hands?: boolean
  visible?: boolean
  nodes: boolean
  anchors: boolean
  props: PropData[]
  aspectx: number
  aspecty: number
  distance: number
  thick: number
}

// Animation Data root.props[ { anim: [ ... ] } ]
export interface AnimReadable extends Omit<AnimData, 'point' | 'type' | 'direct' | 'path'> {
  type?: TypeStr
}

// Prop Data root.props[ ... ]
export interface PropReadable extends Omit<PropData, 'color' | 'prop' | 'anim'> {
  color?: ColorStr
  prop?: PropStr
  anim: AnimReadable[]
}

// Root Data with Strings instead of Indexes
export interface RootReadable extends Omit<RootData, 'prop' | 'color' | 'props'> {
  prop: PropStr
  color: ColorStr
  props: PropReadable[]
}

// Additional values for the final version
export interface PropDataFinal extends PropData {
  click?: number
  active?: boolean
}

// Additional values for the final version
export interface RootDataFinal extends Omit<RootData, 'props'> {
  speed: number
  type: TypeInd
  turns: number
  depth: number
  props: PropDataFinal[]
}

export interface AnimDataCompiled {
  turns: number
  beats: number
  scale: number
  depth: number
  type: TypeInd
  adjust: number
  arc: number
  plane: number
  axis: number
  pos: [number, number, number]
  adju: [number, number, number]
  rot: [number, number, number]
  posx: [number, number, number]
  rotx: [number, number, number]
  move: [number, number, number]
}

export interface PropDataCompiled extends Omit<PropDataFinal, 'anim'> {
  anim: AnimDataCompiled[]
}

export interface RootDataCompiled extends Omit<RootDataFinal, 'props'> {
  props: PropDataCompiled[]
}

// Additional property added to Models (for calculating Z Positioning / Depth)
import { type Group } from 'three'
export type ModelGroup = Group & { size: number }

export type AnimKeys = keyof AnimData // | 'point' | 'direct' | 'path'
export type PropKeys = keyof Omit<PropData, 'anim'>
export type RootKeys = keyof Omit<RootData, 'props'>

export type AnimCompKeys = keyof AnimDataCompiled

// TODO: Update the below to use the above 3 sets of keys

// Shared / Common keys
export type PropCommonKeys = Extract<keyof RootDataFinal, keyof PropDataFinal>
export type AnimCommonKeys = Extract<keyof PropDataFinal, keyof AnimData>
export type AllCommonKeys = Extract<PropCommonKeys, AnimCommonKeys>

// List of variables - Min / Max / Bits / Transform defined in AnimStruct.ts
export type AllVars = keyof Omit<RootData, 'props'> | keyof Omit<PropData, 'anim'> | keyof AnimData
export type VarTypes = number | [number, number, number] | boolean

export type ValRetType = [VarTypes | undefined, boolean, string, boolean]
export type DynamicVal = {
  name: string
  component?: string
  items?: readonly string[]

  label?: string
  float?: number

  min?: number
  max?: number
  step?: number
  mult?: number
  def?: number

  neg?: boolean
  posi?: boolean
} & Record<string, unknown>
export type SetterFunc = (key: string, val?: VarTypes) => void
export type GetterFunc = (key: string) => ValRetType

type Merge<M, N> = Omit<M, keyof N> & N

export type AllVarTypes = Merge<Merge<Omit<RootData, 'props'>, Omit<PropData, 'anim'>>, AnimData>
export type AllDataTypes = RootData | PropData | AnimData
export type AllFinalTypes = RootDataFinal | PropDataFinal | AnimData

//export type AllDataTypes = Merge<Merge<RootData, PropData>, AnimData>
//export type AllFinalTypes = Merge<Merge<RootDataFinal, PropDataFinal>, AnimData>
