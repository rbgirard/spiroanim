// Version 12 adds inherited Warp and Strength and changes Scale's internal unit from tenths to
// hundredths.
// The optional xN track stores Scale first, timing and depth second, Strength third, and Warp in
// its own final group. Warp deliberately matches Turns' range, precision, and bit width.

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

export const VDEF = {
  ...LEGACY_VDEF,
  scale: [SCALE_MIN, SCALE_MAX, 10],
  strength: [STRENGTH_MIN, STRENGTH_MAX, 10],
  warp: LEGACY_VDEF.turns,
} satisfies Record<AllVars, VDefEntry>

export function createExtendedAnimationConfig(): ConfigData<AllVars> {
  return [
    [
      'anim',
      9,
      [
        ['bits', 2, ['scale']],
        ['bits', 2, ['beats', 'depth']],
        ['bits', 2, ['strength']],
        ['bits', 3, ['warp']],
      ],
    ],
  ]
}
