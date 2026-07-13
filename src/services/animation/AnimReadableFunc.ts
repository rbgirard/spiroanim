// For JSON Exports / Imports, human readable strings are Supplied / Replaced

import { PTEXT, COLORS, TTEXT } from '@/domain/animation/AnimStruct'
import { type RootData, type RootReadable } from '@/types/AnimTypes'

type ReadableTarget = Partial<Record<'prop' | 'color' | 'type', string | number>>
type ReadableType = [keyof ReadableTarget, ReadonlyArray<string | number>][]

const // Properties to convert between Indices or Strings
  rootReadable: ReadableType = [
    ['prop', PTEXT],
    ['color', COLORS],
  ],
  propReadable: ReadableType = [
    ['color', COLORS],
    ['prop', PTEXT],
  ],
  animReadable: ReadableType = [
    //['point',   INDPNT],
    ['type', TTEXT],
    //['direct', INDPNT],
    //['path',    INDPNT],
  ]

const transform = (obj: ReadableTarget, readable: ReadableType, toReadable: boolean) => {
  readable.forEach(([key, props]) => {
    const value = obj[key]
    if (toReadable) {
      const index = value as number | undefined
      if (index !== undefined && index < props.length) obj[key] = props[index]
    } else {
      const index = props.indexOf(value ?? '')
      if (index !== -1) obj[key] = index
    }
  })
}

export const encodeReadable = (data: RootData): RootReadable => {
    const copy = JSON.parse(JSON.stringify(data)) as RootReadable
    transform(copy, rootReadable, true)
    for (const prop of copy.props) {
      transform(prop, propReadable, true)
      for (const anim of prop.anim) transform(anim, animReadable, true)
    }
    return copy
  },
  decodeReadable = (data: RootReadable): RootData => {
    const copy = JSON.parse(JSON.stringify(data)) as RootData
    transform(copy, rootReadable, false)
    for (const prop of copy.props) {
      transform(prop, propReadable, false)
      for (const anim of prop.anim) transform(anim, animReadable, false)
    }
    return copy
  }
