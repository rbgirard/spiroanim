import type { PatternTimingCode } from '@/features/concepts/math/describePatternRelationships'
import type { VtgDirectionCode } from '@/features/vtg/types'

export type ElementName = 'Earth' | 'Water' | 'Air' | 'Fire'
export interface ElementalRelationship {
  timing: PatternTimingCode
  direction: VtgDirectionCode
}

/**
 * Earth, Water, Air, and Fire are folk-community labels applied to VTG timing-and-direction
 * categories; they are not original VTG terminology. Sun and Moon (quarter-time relationships)
 * were created by Austen Cloud for The Kinetic Alphabet (https://tkaflowarts.com), and the
 * element artwork SpiroAnim renders comes from TKA. See ATTRIBUTION.md.
 */
export const relationshipElement = (
  relationship: ElementalRelationship | undefined,
): ElementName | undefined => {
  if (!relationship || relationship.timing === 'Q' || relationship.timing === 'X') return
  if (relationship.timing === 'T') return relationship.direction === 'S' ? 'Earth' : 'Air'
  return relationship.direction === 'S' ? 'Water' : 'Fire'
}
