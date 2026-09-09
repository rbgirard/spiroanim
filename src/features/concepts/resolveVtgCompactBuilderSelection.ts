import { createVtgBuilderDropPreview } from '@/features/builder/createVtgBuilderDropPreview'
import { getVtgPropertyCycleCount, type VtgPropertySettings } from '@/features/vtg/propertySettings'
import type { VtgCellReference, VtgPatternSelection } from '@/features/vtg/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import type { RootDataFinal } from '@/types/AnimTypes'

const signaturePrecision = 1e9

const preferredBooleanOptions = (preferred: boolean): readonly [boolean, boolean] => [
  preferred,
  !preferred,
]

const createVisualSignature = (animation: RootDataFinal): string =>
  JSON.stringify(rootCompile(animation).props, (_key, value: unknown) => {
    if (typeof value !== 'number') return value
    const rounded = Math.round(value * signaturePrecision) / signaturePrecision
    return Object.is(rounded, -0) ? 0 : rounded
  })

interface ResolveVtgCompactBuilderSelectionOptions {
  source: RootDataFinal
  target: RootDataFinal
  targetIndex: number
  references: readonly VtgCellReference[]
  baseSelection: VtgPatternSelection
  properties: VtgPropertySettings
  preferBaseTransforms?: boolean
}

/** Finds the compact Builder controls whose contextual preview exactly reproduces a portion. */
export const resolveVtgCompactBuilderSelection = ({
  source,
  target,
  targetIndex,
  references,
  baseSelection,
  properties,
  preferBaseTransforms = false,
}: ResolveVtgCompactBuilderSelectionOptions): VtgPatternSelection | undefined => {
  const targetSignature = createVisualSignature(target)
  const swapOptions = preferBaseTransforms
    ? preferredBooleanOptions(baseSelection.swapProps === true)
    : ([false, true] as const)
  const reverseOptions = preferBaseTransforms
    ? preferredBooleanOptions(baseSelection.reversePlane === true)
    : ([false, true] as const)
  for (const swapProps of swapOptions) {
    for (const reversePlane of reverseOptions) {
      for (const reference of references) {
        const selection = { ...baseSelection, reference, swapProps, reversePlane }
        const candidate = createVtgBuilderDropPreview(source, selection, targetIndex, {
          minimumCycleCount: getVtgPropertyCycleCount(properties),
          properties,
        })
        if (candidate && createVisualSignature(candidate) === targetSignature) return selection
      }
    }
  }
  return undefined
}
