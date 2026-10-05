// src/types/AnimTypes.ts

import {
  INDPNT,
  MANCMD,
  PTYPE,
  TTYPE,
  TTEXT,
  MOTION_SHAPES,
  MOTION_SHAPE,
  COLORS,
  PROPSR,
  PTEXT,
  PPROP,
} from '@/domain/animation/AnimStruct'

import { type IndicesOf } from '@/types/SpecialTypes'

export type PointInd = IndicesOf<typeof INDPNT> // Point Indices
export type PointStr = (typeof INDPNT)[PointInd] // Point Strings

export type ManCmdInd = IndicesOf<typeof MANCMD> // // Manipulation Command Indices
export type ManCmdStr = (typeof MANCMD)[ManCmdInd] // Manipulation Command Strings

export type PointTypes = (typeof PTYPE)[keyof typeof PTYPE] // Type of Points (used by worker / animator)

export type TypeInd = (typeof TTYPE)[keyof typeof TTYPE] // Transition Type Indices
export type TypeStr = (typeof TTEXT)[number] // Transition Type Strings

export type MotionShapeInd = (typeof MOTION_SHAPE)[keyof typeof MOTION_SHAPE]
export type MotionShapeStr = (typeof MOTION_SHAPES)[MotionShapeInd]

export type ColorInd = IndicesOf<typeof COLORS> // Color Indices
export type ColorStr = (typeof COLORS)[number] // Color Strings

export type PropInd = IndicesOf<typeof PROPSR> // Prop Indices
export type PropMod = (typeof PROPSR)[PropInd] // Prop Name (No spaces etc.)
export type PropStr = (typeof PTEXT)[PropInd] // Prop String

export type PPropKeys = keyof (typeof PPROP)[PointTypes] // Keys used in PPROP
/** @deprecated Query transforms are owned by the query codec types. */
export type qsTransform = BooleanConstructor | undefined

export type GrefItem = Record<PointInd, PointInd>
export type FrameSet = 'animation' | 'motion' | 'camera'

// Animation Data root.props[ { anim: [ ... ] } ]
export interface AnimData {
  turns?: number
  /** Signed local-axis roll added during this frame interval and inherited by following frames. */
  twist?: number
  /** Secondary rotation-axis angle inherited by following frames. Defaults initially to 90. */
  yaw?: number
  /** Signed secondary rotation performed during this frame. */
  rotate?: number
  beats?: number
  scale?: number
  /** Relative rotation of the auxiliary hand-path vector during this frame interval. */
  warp?: number
  /** Tenths-of-a-percent contribution from Warp to the rendered hand path. */
  strength?: number
  depth?: number
  type?: TypeInd
  adjust?: number
  arc?: number
  plane?: number
  axis?: number
  /** @deprecated MOVE is read only while upgrading QS v1-v3 data. */
  move?: [number, number, number]
}

export interface MotionData {
  beats?: number
  precision?: boolean
  arc?: number
  plane?: number
  distance?: number
  shape?: MotionShapeInd
  axis?: number
  amount?: number
}

export type MotionPathData = Omit<MotionData, 'beats'>

/** One camera timeline frame. Orbit owns the frame duration. */
export interface CameraData {
  orbit?: MotionData
  center?: MotionPathData
}

export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
}

// Prop Data root.props[ ... ]
export interface PropData {
  color?: ColorInd
  prop?: PropInd
  guides?: boolean
  paths?: boolean
  travel?: boolean
  hands?: boolean
  arms?: boolean
  visible?: boolean
  nodes?: boolean
  anchors?: boolean
  anim: AnimData[]
  motion?: MotionData[]
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
  travel?: boolean
  hands?: boolean
  arms: boolean
  visible?: boolean
  nodes: boolean
  anchors: boolean
  props: PropData[]
  aspectx: number
  aspecty: number
  /** Camera was introduced in QS v5 and is normalized to at least one frame at runtime. */
  camera?: CameraData[]
  /** @deprecated Read only while upgrading QS v1-v4 data. */
  distance?: number
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
export interface PropDataFinal extends Omit<PropData, 'motion'> {
  motion: MotionData[]
  click?: number
  active?: boolean
}

// Additional values for the final version
export interface RootDataFinal extends Omit<RootData, 'props' | 'travel' | 'camera' | 'distance'> {
  speed: number
  type: TypeInd
  turns: number
  depth: number
  travel: boolean
  camera: CameraData[]
  props: PropDataFinal[]
}

export interface AnimDataCompiled {
  turns: number
  /** Effective local-axis roll added during this frame interval. */
  twist: number
  /** Total local-axis roll accumulated through this frame. */
  twistRoll: number
  yaw: number
  rotate: number
  /** Begin this interval from the completed Rotate orientation as the new primary basis. */
  rebasePrimaryOrientation: boolean
  beats: number
  scale: number
  warp: number
  strength: number
  depth: number
  type: TypeInd
  adjust: number
  arc: number
  plane: number
  axis: number
  pos: [number, number, number]
  /** Complete accumulated auxiliary hand-path vector. */
  warpPos: [number, number, number]
  adju: [number, number, number]
  rot: [number, number, number]
  posx: [number, number, number]
  /** Axis used by the auxiliary hand-path vector during this frame interval. */
  warpx: [number, number, number]
  rotx: [number, number, number]
  yawx: [number, number, number]
  adjustx: [number, number, number]
  /** Complete accumulated primary rendering orientation. */
  primaryOrient: [number, number, number, number]
  /** Complete accumulated secondary Yaw/Rotate orientation. */
  secondaryOrient: [number, number, number, number]
  /** Complete compiled model orientation after primary and secondary rotation. */
  orient: [number, number, number, number]
}

export interface MotionDataCompiled {
  beats: number
  precision: boolean
  arc: number
  plane: number
  distance: number
  shape: MotionShapeInd
  axis: number
  amount: number
  active: boolean
  move: [number, number, number]
  direction: [number, number, number]
  curve: [number, number, number]
  delta: [number, number, number]
  offset: [number, number, number]
}

export type MotionPathDataCompiled = Omit<MotionDataCompiled, 'beats'>

export interface CameraDataCompiled {
  orbit: MotionDataCompiled
  center: MotionPathDataCompiled
}

export interface PropDataCompiled extends Omit<PropDataFinal, 'anim' | 'motion'> {
  anim: AnimDataCompiled[]
  motion: MotionDataCompiled[]
}

export interface RootDataCompiled extends Omit<RootDataFinal, 'props' | 'camera'> {
  camera: CameraDataCompiled[]
  props: PropDataCompiled[]
}

// Additional property added to Models (for calculating Z Positioning / Depth)
import { type Group } from 'three'
export type ModelGroup = Group & {
  size: number
  /** Additional head positions expressed as size-normalized coordinates in the prop's local space. */
  additionalPathHeadPositions?: readonly (readonly [number, number, number])[]
}

export type AnimKeys = keyof AnimData // | 'point' | 'direct' | 'path'
export type MotionKeys = keyof MotionData
export type MotionPathKeys = keyof MotionPathData
export type CameraKeys = keyof CameraData
export type PropKeys = keyof Omit<PropData, 'anim' | 'motion'>
export type RootKeys = keyof Omit<RootDataFinal, 'props' | 'camera'>

export type AnimCompKeys = keyof AnimDataCompiled
export type MotionCompKeys = keyof MotionDataCompiled
export type MotionPathCompKeys = keyof MotionPathDataCompiled

// TODO: Update the below to use the above 3 sets of keys

// Shared / Common keys
export type PropCommonKeys = Extract<keyof RootDataFinal, keyof PropDataFinal>
export type AnimCommonKeys = Extract<keyof PropDataFinal, keyof AnimData>
export type AllCommonKeys = Extract<PropCommonKeys, AnimCommonKeys>

// List of variables - Min / Max / Bits / Transform defined in AnimStruct.ts
export type AllVars =
  | keyof Omit<RootData, 'props' | 'camera'>
  | keyof Omit<PropData, 'anim' | 'motion'>
  | keyof AnimData
  | keyof MotionData
export type VarTypes =
  | number
  | [number, number, number]
  | [number, number, number, number]
  | boolean

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
  displayDivisor?: number
  displayMinimumFractionDigits?: number
  displayMaximumFractionDigits?: number

  neg?: boolean
  posi?: boolean
} & Record<string, unknown>
export type SetterFunc = (key: string, val?: VarTypes) => void
export type GetterFunc = (key: string) => ValRetType

type Merge<M, N> = Omit<M, keyof N> & N

export type AllVarTypes = Merge<
  Merge<Omit<RootData, 'props'>, Omit<PropData, 'anim' | 'motion'>>,
  AnimData
>
export type AllDataTypes = RootData | PropData | AnimData | MotionData | CameraData
export type AllFinalTypes = RootDataFinal | PropDataFinal | AnimData | MotionData | CameraData

//export type AllDataTypes = Merge<Merge<RootData, PropData>, AnimData>
//export type AllFinalTypes = Merge<Merge<RootDataFinal, PropDataFinal>, AnimData>
