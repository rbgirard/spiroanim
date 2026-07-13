// src\definitions\tmpProp.ts

import { decodeReadable } from '@/services/animation/AnimReadableFunc'

// http://localhost:8080/propanim/edit?r=cwwr9&p0=R.TRty---u.S-xq.RvxM.S4.TL.S-.Rv.Sl.T-

export const tmpProp = decodeReadable({
  //"speed": 1,
  //"type": 0,
  //"turns": 0,
  //"depth": 0,
  smooth: true,
  bpm: 60,
  color: 'Green',
  prop: 'Staff',
  guides: false,
  anchors: false,
  nodes: true,
  paths: true,
  hands: true,
  visible: true,
  aspectx: 16,
  aspecty: 9,
  distance: 22,
  thick: 4,
  props: [
    {
      color: 'Blue',
      anim: [
        {
          arc: 90,
          plane: 0,
          turns: -540,
          move: [2, 0, 0],
        },
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
      ],
    },
    {
      color: 'Magenta',
      anim: [
        {
          arc: 90,
          plane: 180,
          turns: -540,
          move: [-2, 0, 0],
        },
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
      ],
    },
  ],
})
