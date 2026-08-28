import type { VtgDirectionCode, VtgTimingCode } from '@/features/vtg/types'

export type ElementName = 'Earth' | 'Water' | 'Air' | 'Fire'
export interface ElementalRelationship {
  timing: VtgTimingCode
  direction: VtgDirectionCode
}

/**
 * These classical-element labels adapt the TKA Platform elemental relationship model. The model
 * is a community overlay rather than VTG vocabulary; see THIRD_PARTY_NOTICES.md for provenance.
 */
export const relationshipElement = (
  relationship: ElementalRelationship | undefined,
): ElementName | undefined => {
  if (!relationship || relationship.timing === 'Q') return
  if (relationship.timing === 'T') return relationship.direction === 'S' ? 'Earth' : 'Air'
  return relationship.direction === 'S' ? 'Water' : 'Fire'
}
