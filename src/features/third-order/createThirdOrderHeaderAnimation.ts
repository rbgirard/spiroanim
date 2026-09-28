import { toInternalScale } from '@/domain/animation/scale'
import { applyPatternInitialArcRotation } from '@/features/concepts/applyPatternFinalTransforms'
import { toConceptPreviewAnimation } from '@/features/concepts/data/toConceptPreviewAnimation'
import type { PatternPropColor } from '@/features/concepts/patternPropColors'
import type { ThirdOrderDirection } from '@/features/third-order/data/thirdOrderMatrix'
import { vtgPlayerSettings } from '@/features/vtg/data/vtgPlayerSettings'
import { parseVtgIndividualSpeedRatio, type VtgIndividualSpeedRatio } from '@/features/vtg/types'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { decodeReadable } from '@/services/animation/AnimReadableFunc'
import type { PropInd, RootDataFinal } from '@/types/AnimTypes'

export interface ThirdOrderHeaderOptions {
  ratio: VtgIndividualSpeedRatio
  direction: ThirdOrderDirection
  scale: 0.5 | 1
  color: PatternPropColor
  prop: PropInd
}

/** Independent header paths only; these do not define the eventual Third Order cell patterns. */
export const createThirdOrderHeaderAnimation = ({
  ratio,
  direction,
  scale,
  color,
  prop,
}: ThirdOrderHeaderOptions): RootDataFinal => {
  const timing = parseVtgIndividualSpeedRatio(ratio)
  if (!timing) throw new RangeError(`Invalid Third Order header timing: ${ratio}`)

  // Turns is relative to the hand arc. Anti opposes it; Spin follows it.
  const rate = timing.denominator / timing.numerator
  const turns = 45 * (direction === 'anti' ? -rate - 1 : rate - 1)
  const animation = rootFinal(
    decodeReadable({
      ...vtgPlayerSettings,
      smooth: true,
      // Use a common camera so the two header scales are not automatically normalized away.
      distance: 25,
      props: [
        {
          color,
          anim: [
            { plane: 180, arc: 90, turns: 0, scale: toInternalScale(scale) },
            { arc: 45, turns },
            ...Array.from({ length: timing.numerator * 8 - 1 }, () => ({})),
          ],
        },
      ],
    }),
  )
  const rotated = applyPatternInitialArcRotation(animation, -90)
  return toConceptPreviewAnimation({ ...rotated, prop })
}
