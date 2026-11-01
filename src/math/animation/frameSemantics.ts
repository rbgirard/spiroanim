import { MOTION_SHAPE, TTEXT, TTYPE } from '@/domain/animation/AnimStruct'
import type {
  AnimData,
  AnimReadable,
  MotionData,
  MotionShapeInd,
  TypeInd,
  TypeStr,
} from '@/types/AnimTypes'
import { SCALE_DEFAULT } from '@/domain/animation/scale'
import { STRENGTH_DEFAULT } from '@/domain/animation/strength'

export const ANIMATION_INHERITED_KEYS = [
  'turns',
  'twist',
  'yaw',
  'beats',
  'scale',
  'warp',
  'strength',
  'depth',
  'type',
  'adjust',
  'arc',
] as const

export const ANIMATION_FRAME_KEYS = [
  ...ANIMATION_INHERITED_KEYS,
  'plane',
  'axis',
  'rotate',
] as const

export type AnimationInheritedKey = (typeof ANIMATION_INHERITED_KEYS)[number]
export type AnimationFrameKey = (typeof ANIMATION_FRAME_KEYS)[number]

type AnimationFrameLike<TType extends number | string> = Omit<AnimData, 'type'> & {
  type?: TType
}

export interface ResolvedAnimationFrame<TType extends number | string = TypeInd> {
  turns: number
  twist: number
  yaw: number
  rotate: number
  beats: number
  scale: number
  warp: number
  strength: number
  depth: number
  type: TType
  adjust: number
  arc: number
  plane: number
  axis: number
}

const createInitialAnimationFrame = <TType extends number | string>(
  type: TType,
): ResolvedAnimationFrame<TType> => ({
  turns: 0,
  twist: 0,
  yaw: 90,
  rotate: 0,
  beats: 1,
  scale: SCALE_DEFAULT,
  warp: 0,
  strength: STRENGTH_DEFAULT,
  depth: 0,
  type,
  adjust: 0,
  arc: 0,
  plane: 0,
  axis: 0,
})

export const INITIAL_ANIMATION_FRAME = createInitialAnimationFrame<TypeInd>(TTYPE.SPHE)

export const INITIAL_READABLE_ANIMATION_FRAME = createInitialAnimationFrame<TypeStr>(
  TTEXT[TTYPE.SPHE],
)

const resolveAnimationFrame = <TType extends number | string>(
  frame: AnimationFrameLike<TType>,
  previous: ResolvedAnimationFrame<TType>,
): ResolvedAnimationFrame<TType> => {
  const plane = frame.plane ?? 0
  return {
    turns: frame.turns ?? previous.turns,
    twist: frame.twist ?? previous.twist,
    yaw: frame.yaw ?? previous.yaw,
    rotate: frame.rotate ?? 0,
    beats: frame.beats ?? previous.beats,
    scale: frame.scale ?? previous.scale,
    warp: frame.warp ?? previous.warp,
    strength: frame.strength ?? previous.strength,
    depth: frame.depth ?? previous.depth,
    type: frame.type ?? previous.type,
    adjust: frame.adjust ?? previous.adjust,
    arc: frame.arc ?? previous.arc,
    plane,
    axis: frame.axis ?? plane,
  }
}

const resolveAnimationTrack = <TType extends number | string>(
  frames: readonly AnimationFrameLike<TType>[],
  preceding: ResolvedAnimationFrame<TType>,
): ResolvedAnimationFrame<TType>[] => {
  let previous = preceding
  return frames.map((frame) => {
    const resolved = resolveAnimationFrame(frame, previous)
    previous = resolved
    return resolved
  })
}

export const resolveAnimationFrames = (
  frames: readonly AnimData[],
  preceding: ResolvedAnimationFrame = INITIAL_ANIMATION_FRAME,
): ResolvedAnimationFrame[] => resolveAnimationTrack(frames, preceding)

export const resolveReadableAnimationFrames = (
  frames: readonly AnimReadable[],
  preceding: ResolvedAnimationFrame<TypeStr> = INITIAL_READABLE_ANIMATION_FRAME,
): ResolvedAnimationFrame<TypeStr>[] => resolveAnimationTrack(frames, preceding)

export const MOTION_INHERITED_KEYS = ['beats', 'precision', 'shape', 'amount'] as const
export const MOTION_DIRECTION_KEYS = ['arc', 'plane', 'distance'] as const
export const MOTION_FRAME_KEYS = [
  ...MOTION_INHERITED_KEYS,
  ...MOTION_DIRECTION_KEYS,
  'axis',
] as const

export type MotionFrameKey = (typeof MOTION_FRAME_KEYS)[number]

export const DEFAULT_MOTION_AMOUNT = 50

export interface ResolvedMotionFrame {
  beats: number
  precision: boolean
  arc: number
  plane: number
  distance: number
  shape: MotionShapeInd
  axis: number
  amount: number
  active: boolean
}

export interface ResolveMotionFramesOptions {
  /** Defaults conditionally applied to the first Camera Orbit when Distance is not authored. */
  firstFrameDefaults?: Readonly<MotionData>
}

export const INITIAL_MOTION_FRAME: ResolvedMotionFrame = {
  beats: 1,
  precision: false,
  arc: 0,
  plane: 0,
  distance: 0,
  shape: MOTION_SHAPE.LINE,
  axis: 0,
  amount: DEFAULT_MOTION_AMOUNT,
  active: false,
}

const prepareMotionFrame = (
  frame: Readonly<MotionData>,
  index: number,
  options: ResolveMotionFramesOptions,
): Readonly<MotionData> =>
  index === 0 && options.firstFrameDefaults !== undefined && frame.distance === undefined
    ? { ...options.firstFrameDefaults, ...frame }
    : frame

export const resolveMotionFrames = (
  frames: readonly MotionData[],
  options: ResolveMotionFramesOptions = {},
): ResolvedMotionFrame[] => {
  let previous = INITIAL_MOTION_FRAME
  return frames.map((source, index) => {
    const frame = prepareMotionFrame(source, index, options)
    const resolved: ResolvedMotionFrame = {
      beats: frame.beats ?? previous.beats,
      precision: frame.precision ?? previous.precision,
      arc: frame.arc ?? 0,
      plane: frame.plane ?? 0,
      distance: frame.distance ?? 0,
      shape: frame.shape ?? previous.shape,
      axis: frame.axis ?? 0,
      amount: frame.amount ?? previous.amount,
      active: frame.arc !== undefined || frame.plane !== undefined || frame.distance !== undefined,
    }
    previous = resolved
    return resolved
  })
}
