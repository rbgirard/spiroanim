import { SCALE_FACTOR } from '@/domain/animation/scale'
import type { RootDataFinal } from '@/types/AnimTypes'

const LEGACY_SCALE_FACTOR = 10
const scaleMigrationFactor = SCALE_FACTOR / LEGACY_SCALE_FACTOR

/** Converts the v1-v11 tenths-based Scale contract to the current hundredths-based contract. */
export const migrateLegacyScale = (root: RootDataFinal): RootDataFinal => ({
  ...root,
  props: root.props.map((prop) => ({
    ...prop,
    anim: prop.anim.map((frame) => ({
      ...frame,
      ...(frame.scale === undefined ? undefined : { scale: frame.scale * scaleMigrationFactor }),
    })),
  })),
})
