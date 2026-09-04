import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { createDefaultEightStepAnimation } from '@/features/eight-step/createEightStepAnimation'
import { createDefaultQstAnimation } from '@/features/quarter-space-tech/createQstAnimation'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CURRENT_SPIRO_ANIM_QS_VERSION, loadSpiroAnimQSVersion } from '@/services/query/versions'
import {
  matchEightStepPatternRequest,
  matchQstPatternRequest,
  matchVtgPatternRequest,
} from '@/workers/pattern-matching/handlePatternMatchingRequest'

describe('handlePatternMatchingRequest', () => {
  it('matches VTG and preserves a selection that produced the animation', async () => {
    const selection = {
      reference: '2-2',
      speedRatio: '1:3',
      beat: 3,
      transition: true,
    } as const
    const animation = createDefaultVtgAnimation(selection)
    if (!animation) throw new Error('Expected a supported VTG animation')

    await expect(
      matchVtgPatternRequest({
        animation,
        preferences: { swapProps: false, reversePlane: false, quarters: 1 },
      }),
    ).resolves.toMatchObject({
      status: 'matched',
      source: 'vtg',
      match: { reference: '2-2', beat: 3, swapProps: false, transition: true },
    })
    await expect(
      matchVtgPatternRequest({
        animation,
        preferences: { swapProps: false, reversePlane: false, quarters: 1 },
        lastSelection: selection,
      }),
    ).resolves.toEqual({ status: 'unchanged' })
  })

  it('falls back from VTG to merged QTR matching', async () => {
    const animation = createDefaultQtrAnimation({
      reference: '3-4',
      speedRatio: '1:5',
      quarters: 1,
      reversePlane: true,
    })
    if (!animation) throw new Error('Expected a supported QTR animation')

    await expect(
      matchVtgPatternRequest({
        animation,
        preferences: { swapProps: false, reversePlane: true, quarters: 1 },
      }),
    ).resolves.toMatchObject({
      status: 'matched',
      source: 'qtr',
      match: { reference: '3-4', speedRatio: '1:5', quarters: 1, reversePlane: true },
    })
  })

  it('canonicalizes the supplied 1:3 QTR geometry across equivalent orientations', async () => {
    const version = await loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)
    const codec = await useSpiroAnimQS(
      version.VDEF,
      useBaseQS(version.VDEF, { charset: version.CHARSET }),
      CURRENT_SPIRO_ANIM_QS_VERSION,
    )
    const animation = await codec.decodeVer(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.gU0_____s.5E0wm.......&m0=_1_mxqv__&p1=N__.g__tyw3_s.5L_s8w3.......&c=_i_bhq&v=6',
        ),
      ),
    )

    await expect(
      matchVtgPatternRequest({
        animation,
        preferences: { swapProps: false, reversePlane: false, quarters: 1 },
        rotationFilter: 'unrotated',
      }),
    ).resolves.toEqual({
      status: 'matched',
      source: 'qtr',
      exact: true,
      match: {
        reference: '2-6',
        speedRatio: '1:3',
        quarters: 1,
        isAnti: false,
        swapProps: false,
        reversePlane: false,
        beat: 1.5,
        propRotationOffsets: [90, 0],
        bpm: 40,
        scale: 0.8,
      },
    })

    await expect(
      matchVtgPatternRequest({
        animation,
        preferences: { swapProps: false, reversePlane: false, quarters: 1 },
        rotationFilter: 'rotated',
      }),
    ).resolves.toEqual({
      status: 'matched',
      source: 'qtr',
      exact: true,
      match: {
        reference: '4-6',
        speedRatio: '1:3',
        quarters: 1,
        isAnti: false,
        swapProps: false,
        reversePlane: false,
        orientation: -45,
        beat: 2,
        bpm: 40,
        scale: 0.8,
      },
    })
  })

  it('matches Eight Step and recognizes the last emitted selection', async () => {
    const selection = {
      concept: '8stp',
      reference: '6-AI',
      swapProps: true,
      reversePlane: true,
      shape: 'box',
    } as const
    const animation = createDefaultEightStepAnimation(selection)
    if (!animation) throw new Error('Expected a supported Eight Step animation')

    await expect(matchEightStepPatternRequest({ animation })).resolves.toMatchObject({
      status: 'matched',
      match: { reference: '6-AI', swapProps: true, reversePlane: true, shape: 'box' },
    })
    await expect(
      matchEightStepPatternRequest({ animation, lastSelection: selection }),
    ).resolves.toEqual({ status: 'unchanged' })
  })

  it('matches QST and recognizes the last emitted selection', async () => {
    const selection = {
      concept: 'qst',
      reference: 'beyond-100',
      swapProps: true,
      reversePlane: true,
    } as const
    const animation = createDefaultQstAnimation(selection)
    if (!animation) throw new Error('Expected a supported QST animation')

    await expect(
      matchQstPatternRequest({
        animation,
        preferences: { swapProps: true, reversePlane: true },
      }),
    ).resolves.toMatchObject({
      status: 'matched',
      match: { swapProps: true, reversePlane: true },
    })
    await expect(
      matchQstPatternRequest({
        animation,
        preferences: { swapProps: true, reversePlane: true },
        lastSelection: selection,
      }),
    ).resolves.toEqual({ status: 'unchanged' })
  })
})
