// Version 12 adds inherited Warp and Strength and changes Scale's internal unit from tenths to
// hundredths.
// The optional xN track stores Scale first, timing and depth second, then Strength and Warp in one
// final group. Turns and Warp share the VTG-derived range and half-degree precision.

import {
  CHARSET,
  VDEF as LEGACY_VDEF,
  createCameraConfig,
  createMotionConfig,
  createPropConfig,
  createRootConfig,
  createRotationAnimationConfig,
  decodeMotionFrame,
  encodeMotionFrame,
  omitEmptyCameraCenter,
  omitStandaloneMotionPrefix,
} from '@/services/query/versions/SpiroAnimQSv11'
import { SCALE_MAX, SCALE_MIN } from '@/domain/animation/scale'
import { STRENGTH_MAX, STRENGTH_MIN } from '@/domain/animation/strength'
import {
  TIMING_ANGLE_FACTOR,
  TIMING_ANGLE_MAX,
  TIMING_ANGLE_MIN,
} from '@/domain/animation/timingAngle'
import type { QueryValueCodec } from '@/services/query/types/BaseQueryCodecTypes'
import type { VDefEntry } from '@/services/query/types/BaseQSTypes'
import type { ConfigData } from '@/services/query/types/SpiroAnimQSTypes'
import type { AllVars } from '@/types/AnimTypes'

export {
  CHARSET,
  createCameraConfig,
  createMotionConfig,
  createPropConfig,
  createRootConfig,
  createRotationAnimationConfig,
  decodeMotionFrame,
  encodeMotionFrame,
  omitEmptyCameraCenter,
  omitStandaloneMotionPrefix,
}

export const HALF_DEGREE_QUERY_CODEC: QueryValueCodec = {
  encode: (value) => Math.round(value * TIMING_ANGLE_FACTOR),
  decode: (value) => value / TIMING_ANGLE_FACTOR,
}

export const VDEF = {
  ...LEGACY_VDEF,
  scale: [SCALE_MIN, SCALE_MAX, 10],
  strength: [STRENGTH_MIN, STRENGTH_MAX, 10],
  turns: [TIMING_ANGLE_MIN, TIMING_ANGLE_MAX, 13, HALF_DEGREE_QUERY_CODEC],
  warp: [TIMING_ANGLE_MIN, TIMING_ANGLE_MAX, 13, HALF_DEGREE_QUERY_CODEC],
} satisfies Record<AllVars, VDefEntry>

export function createExtendedAnimationConfig(): ConfigData<AllVars> {
  return [
    [
      'anim',
      8,
      [
        ['bits', 2, ['scale']],
        ['bits', 2, ['beats', 'depth']],
        ['bits', 4, ['strength', 'warp']],
      ],
    ],
  ]
}
