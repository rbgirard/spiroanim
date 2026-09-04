import { describe, expect, it } from 'vitest'

import { findConceptForPath } from '@/features/concepts/conceptRoutes'

describe('findConceptForPath', () => {
  it.each([
    ['/play-vtg?r=one&v=6', { concept: 'vtg', qtrEnabled: false }],
    ['/8stp-time?r=two&v=6', { concept: '8stp', qtrEnabled: false }],
    ['/quarter-space-tech?r=three&v=6', { concept: 'qst', qtrEnabled: false }],
    ['/the-kinetic-alphabet?r=four&v=6', { concept: 'tka', qtrEnabled: false }],
    ['/edit-qtr?r=five&v=6', { concept: 'vtg', qtrEnabled: true }],
    ['/quarterspacing?r=six&v=6', { concept: 'vtg', qtrEnabled: true }],
  ] as const)('finds the Concepts child in %s', (path, expected) => {
    expect(findConceptForPath(path)).toEqual(expected)
  })

  it('does not infer a Concepts child from a generic or unrelated path', () => {
    expect(findConceptForPath('/play-cnc?r=one&v=6')).toBeUndefined()
    expect(findConceptForPath('/editor?r=one&v=6')).toBeUndefined()
    expect(findConceptForPath('/play-to?r=four&v=6')).toBeUndefined()
    expect(findConceptForPath('/third-order?r=four&v=6')).toBeUndefined()
  })
})
