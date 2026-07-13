// src/math/animation/PlayerFunc.ts

import { TTYPE } from '@/domain/animation/AnimStruct'

import type { RootData, RootDataFinal, RootDataCompiled } from '@/types/AnimTypes'

// TODO: This should probably be moved somewhere else, or the definitions
// Default / Inheritence values that user doesn't set
export const rootFinal = (root: RootData): RootDataFinal => {
  return {
    speed: 1,
    type: TTYPE.SPHE,
    //flip: false,
    turns: 0,
    depth: 0,
    ...root,
  }
}

export const msToBeat = (ms: number, bpm: number): number => {
  return Math.round(ms / (60000 / bpm)) // Round solved BPM issues on timeline
}

// Millisecond start/end of animations for each prop
export const PROPTIMES = (propData: RootDataCompiled): number[][] => {
  const ms = Math.round(60000 / propData.bpm)
  const propTimes: number[][] = Array.from({ length: propData.props.length }, () => [])

  // Iterate through props once
  propData.props.forEach((prop, i) => {
    const times = Array.from({ length: prop.anim.length }, () => 0)
    let currentStart = 0

    // Iterate through each animation in the prop
    prop.anim.forEach((anim, j) => {
      const actualBeats = anim.beats ?? 1,
        actualDuration = Math.floor(actualBeats * ms)
      times[j] = currentStart
      currentStart += actualDuration
    })

    propTimes[i] = times
  })

  return propTimes
}

// Unique merger of PROPTIMES
export const UNQTIMES = (propTimes: number[][] | RootDataCompiled): number[] => {
  // Check if propTimes is of type RootDataFinal by verifying the existence of `props`
  if ('props' in propTimes)
    // Convert RootDataFinal to number[][] using PROPTIMES
    propTimes = PROPTIMES(propTimes)

  // Flatten, deduplicate, and sort the intervals
  const flattenedArray = propTimes.flat(),
    uniqueArray = [...new Set(flattenedArray)]

  return uniqueArray.sort((a, b) => a - b)
}
