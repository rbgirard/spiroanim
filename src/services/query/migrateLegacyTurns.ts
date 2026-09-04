import { normalizeTimingAngle } from '@/domain/animation/timingAngle'
import type { RootDataFinal } from '@/types/AnimTypes'

/** Converts v1-v11 Turns values to the current range and half-degree precision. */
export const migrateLegacyTurns = (root: RootDataFinal): RootDataFinal => ({
  ...root,
  turns: normalizeTimingAngle(root.turns),
  props: root.props.map((prop) => ({
    ...prop,
    anim: prop.anim.map((frame) => ({
      ...frame,
      ...(frame.turns === undefined ? undefined : { turns: normalizeTimingAngle(frame.turns) }),
    })),
  })),
})
