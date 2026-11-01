import { vtgPlayerSettings } from '@/features/vtg/data/vtgPlayerSettings'
import type { RootDataFinal } from '@/types/AnimTypes'

export interface ConceptPreviewAnimationOptions {
  hands?: boolean
}

/** Applies the common lightweight presentation settings used by concept thumbnails. */
export const toConceptPreviewAnimation = (
  animation: RootDataFinal,
  options: ConceptPreviewAnimationOptions = {},
): RootDataFinal => ({
  ...animation,
  paths: vtgPlayerSettings.paths,
  hands: options.hands ?? false,
  arms: false,
  thick: 15,
  visible: false,
  props: animation.props.map((prop) => ({
    ...prop,
    hands: options.hands ?? false,
    arms: false,
    paths: vtgPlayerSettings.paths,
    thick: 15,
    visible: false,
  })),
})
