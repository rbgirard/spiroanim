import type { ConceptKey } from '@/features/concepts/types'

export const fullPathByConcept = {
  vtg: 'vulcan-tech-gospel',
  '8stp': 'eight-step',
  qst: 'quarter-space-tech',
  tka: 'the-kinetic-alphabet',
} as const satisfies Record<ConceptKey, string>

export interface ConceptRouteSelection {
  concept: ConceptKey
  qtrEnabled: boolean
}

export const findConceptForPath = (path: string): ConceptRouteSelection | undefined => {
  const page = path.split('?', 1)[0]?.replace(/^\//, '')
  if (!page) return undefined

  if (page === 'quarterspacing') return { concept: 'vtg', qtrEnabled: true }

  const fullConcept = (Object.entries(fullPathByConcept) as Array<[ConceptKey, string]>).find(
    ([, fullPath]) => fullPath === page,
  )?.[0]
  if (fullConcept) return { concept: fullConcept, qtrEnabled: false }

  for (const part of page.split('-')) {
    if (part === 'qtr') return { concept: 'vtg', qtrEnabled: true }
    if (part === 'vtg' || part === '8stp' || part === 'qst' || part === 'tka') {
      return { concept: part, qtrEnabled: false }
    }
  }

  return undefined
}
