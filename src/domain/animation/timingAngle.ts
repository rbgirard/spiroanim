export const TIMING_ANGLE_MIN = -2160
export const TIMING_ANGLE_MAX = 1440
export const TIMING_ANGLE_FACTOR = 2

/** Clamps Turns or Warp and rounds it to the current half-degree storage precision. */
export const normalizeTimingAngle = (value: number): number =>
  Math.min(
    TIMING_ANGLE_MAX,
    Math.max(TIMING_ANGLE_MIN, Math.round(value * TIMING_ANGLE_FACTOR) / TIMING_ANGLE_FACTOR),
  )
