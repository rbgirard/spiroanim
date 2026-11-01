// src/services/query/versions/SpiroAnimQSv1.ts

import {
  COLORS,
  ROTATE_MAX,
  ROTATE_MIN,
  TTEXT,
  TWIST_MAX,
  TWIST_MIN,
  YAW_MAX,
  YAW_MIN,
} from '@/domain/animation/AnimStruct'

import type { ConfigData } from '@/services/query/types/SpiroAnimQSTypes'
import type { VDefEntry } from '@/services/query/types/BaseQSTypes'
import type { AllVars } from '@/types/AnimTypes'

// The serialized alphabet is part of this version's durable shared-URL contract.
export const CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-'

// Defines minimum, maximum, and how values get packed into and out of Query Strings
export const VDEF = {
  //export const VDEF: { [K in AllVars]: VDefEntry } = {
  /*Name,      Min,   Max,             Bits, Transform,             Max*/
  bpm: [20, 520, 9], // 510
  beats: [1, 63, 6], //
  // V1 supported only Poi and Staff. Keep this range immutable when new prop types are added.
  prop: [0, 1, 4], // 14
  color: [0, COLORS.length - 1, 4], // 14
  guides: [0, 1, 2, Boolean], // 1
  paths: [0, 1, 2, Boolean], // 1
  travel: [0, 1, 2, Boolean], // Reserved for QS v4 Motion rendering
  precision: [0, 1, 2, Boolean], // Reserved for QS v6 Motion rendering precision
  hands: [0, 1, 2, Boolean], // 1
  // Defined for shared property constraints, but intentionally absent from the immutable v1 layout.
  arms: [0, 1, 2, Boolean], // 1
  visible: [0, 1, 2, Boolean], // 1
  nodes: [0, 1, 2, Boolean], // 1
  anchors: [0, 1, 2, Boolean], // 1
  smooth: [0, 1, 2, Boolean], // 1
  type: [0, TTEXT.length - 1, 2], // 2
  scale: [-20, 40, 6], // 62
  // Reserved for QS v12's extended Animation track.
  warp: [-180, 180, 9],
  strength: [0, 1000, 10],
  depth: [-30, 30, 6], // 62
  turns: [-1980, 1980, 12], // 4094
  // Reserved for QS v10's extended Animation track.
  twist: [TWIST_MIN, TWIST_MAX, 10],
  // Reserved for QS v11's extended Animation track.
  yaw: [YAW_MIN, YAW_MAX, 9],
  rotate: [ROTATE_MIN, ROTATE_MAX, 10],
  adjust: [-180, 180, 9], //
  arc: [0, 360, 9], //
  plane: [-180, 180, 9], //
  axis: [-180, 180, 9], //
  move: [-30, 30, 6], // 62 - Offset is X/Y/Z values, so uses 18 bits
  shape: [0, 2, 2], // Reserved for QS v4 Motion paths
  amount: [0, 100, 7], // Reserved for QS v4 Motion paths
  aspectx: [0, 32, 6], //
  aspecty: [0, 32, 6], //
  distance: [4, 66, 6], //
  thick: [1, 15, 4], //
} satisfies Record<AllVars, VDefEntry>

export function createRootConfig(): ConfigData<AllVars> {
  return [
    [
      'bits',
      5, // 5 Characters, 29 bits (30 bits is MAX!)
      [
        //'smooth',  // 2 - TODO: No longer used?

        'bpm', // 9
        'color', // 4
        'prop', // 4
        'guides', // 2
        'anchors', // 2
        'nodes', // 2
        'paths', // 2
        'hands', // 2
        'visible', // 2
        // 1 bits remaining
      ],
    ],
    [
      'bits',
      4, // 3 Characters, 24 bits
      [
        'aspectx', // 6
        'aspecty', // 6
        'distance', // 6
        'thick', // 4
      ],
    ],
  ]
}

export function createPropConfig(): ConfigData<AllVars> {
  return [
    // Inheritance items that are less likely to be set:
    [
      'bits',
      3, // 18 bits
      [
        'guides', // 2
        'anchors', // 2
        'nodes', // 2
        'paths', // 2
        'hands', // 2
        'visible', // 2
        'color', // 4
        // 0 bits remaining
      ],
    ],

    // Inheritance items that are less likely to be set:
    [
      'bits',
      1, // 6 bits
      [
        'prop', // 5
        // 1 bit remaining
      ],
    ],

    // Animation data, must be specified at the end
    [
      'anim',
      15, // Total character length of each iteration (TODO: don't think this is used anymore)
      [
        [
          'bits',
          3, // 18 bits
          [
            'plane', // 9,
            'arc', // 9
            // 0 bits remaining
          ],
        ],
        [
          'bits',
          2, // 12 bits
          [
            'turns', // 12
            // 0 bits remaining
          ],
        ],
        [
          'bits',
          2, // 12 bits
          [
            'type', // 2
            'axis', // 9
            // 1 bit remaining
          ],
        ],
        [
          'bits',
          1, // 6 bits
          [
            'beats', // 6
            // 0 bits remaining
          ],
        ],
        [
          'bits',
          1, // 6 bits
          [
            'scale', // 6
            // 0 bits remaining
          ],
        ],
        [
          'bits',
          1, // 6 bits
          [
            'depth', // 6
            // 0 bits remaining
          ],
        ],
        [
          'bits',
          2, // 12 bits
          [
            'adjust', // 9
            // 3 bits remaining
          ],
        ],
        ['move', 3], // 3 characters / 18 bits
      ],
    ],
  ]
}
