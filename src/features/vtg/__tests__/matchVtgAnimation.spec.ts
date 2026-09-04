import { describe, expect, it } from 'vitest'

import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { halveAnimationFrames } from '@/features/editor/manage/resampleAnimationFrames'
import { findVtgPatternMatch, findVtgPatternMatches } from '@/features/vtg/matchVtgAnimation'
import type {
  VtgCellReference,
  VtgPatternMatch,
  VtgPatternSelection,
  VtgRuleNumber,
} from '@/features/vtg/types'
import { getVtgPatternOrientations, vtgSpeedRatios, vtgTransitionBeats } from '@/features/vtg/types'
import { rootCompile } from '@/math/animation/AnimFunc'
import { useBaseQS } from '@/services/query/createBaseQS'
import { CURRENT_SPIRO_ANIM_QS_VERSION, loadSpiroAnimQSVersion } from '@/services/query/versions'
import type { RootDataFinal } from '@/types/AnimTypes'

const ruleNumbers = [1, 2, 3, 4, 5, 6] as const satisfies readonly VtgRuleNumber[]
const booleanOptions = [false, true] as const
const spinToggleCells: ReadonlySet<VtgCellReference> = new Set(['5-6', '6-6', '5-5', '6-5'])

const createCellReference = (column: VtgRuleNumber, row: VtgRuleNumber): VtgCellReference =>
  `${row}-${column}`

const createAnimation = (selection: VtgPatternSelection) => {
  const animation = createDefaultVtgAnimation(selection)
  if (!animation) throw new Error(`Expected a VTG animation for ${selection.reference}`)
  return animation
}

const createCurrentCodec = async () => {
  const version = await loadSpiroAnimQSVersion(CURRENT_SPIRO_ANIM_QS_VERSION)
  return useSpiroAnimQS(
    version.VDEF,
    useBaseQS(version.VDEF, { charset: version.CHARSET }),
    CURRENT_SPIRO_ANIM_QS_VERSION,
  )
}

const normalizeSignatureNumber = (value: number) => {
  const normalized = Math.round(value * 1e9) / 1e9
  return Object.is(normalized, -0) ? 0 : normalized
}
const normalizeOrientation = (value: number) => {
  const normalized = ((((value + 180) % 360) + 360) % 360) - 180
  return normalized === -180 ? 180 : normalized
}
const compiledTrackKey = (animation: RootDataFinal) =>
  JSON.stringify(
    rootCompile(animation).props.map((prop) =>
      prop.anim.map((frame) => [
        normalizeSignatureNumber(frame.turns),
        normalizeSignatureNumber(frame.beats),
        normalizeSignatureNumber(frame.depth),
        normalizeSignatureNumber(frame.type),
        normalizeSignatureNumber(frame.adjust),
        normalizeOrientation(frame.arc),
        normalizeOrientation(frame.plane),
        normalizeOrientation(frame.axis),
        ...frame.pos.map(normalizeSignatureNumber),
        ...frame.rot.map(normalizeSignatureNumber),
      ]),
    ),
  )
const compiledSelectionTrackKeys = new Map<string, string>()
const compiledSelectionTrackKey = (match: VtgPatternMatch) => {
  const selectionKey = JSON.stringify(match)
  const cached = compiledSelectionTrackKeys.get(selectionKey)
  if (cached) return cached
  const compiled = compiledTrackKey(createAnimation(match))
  compiledSelectionTrackKeys.set(selectionKey, compiled)
  return compiled
}

const preferredPatternOptionMatches = (
  animation: RootDataFinal,
  matches: readonly VtgPatternMatch[],
) => {
  const sourceTrackKey = compiledTrackKey(animation)
  const exactMatches = matches.filter(
    (match) => compiledSelectionTrackKey(match) === sourceTrackKey,
  )
  const exactTier = exactMatches.length > 0 ? exactMatches : matches
  const offsetFree = exactTier.filter((match) => match.propRotationOffsets === undefined)
  const preferredOffsetTier = offsetFree.length > 0 ? offsetFree : exactTier
  const lowestTransformCount = Math.min(
    ...preferredOffsetTier.map((match) => Number(match.swapProps) + Number(match.reversePlane)),
  )
  const transformTier = preferredOffsetTier.filter(
    (match) => Number(match.swapProps) + Number(match.reversePlane) === lowestTransformCount,
  )
  const unrotated = transformTier.filter((match) => (match.orientation ?? 0) === 0)
  return unrotated.length > 0 ? unrotated : transformTier
}

describe('VTG animation matching', () => {
  it('matches a VTG pattern throughout serialized Shift rotations', async () => {
    const codec = await createCurrentCodec()
    const shiftedQueries = [
      'r=Ew68Yk11Y&p0=QN__v.___Rhw.5L_Qpg.......&x0=_s_&r0=BG7f_...._-7f_...MX___.BG7f_&m0=_1_mxqv__&p1=NN__v.mD_Qpg.5E0.......&x1=_s_&r1=_YJf_....BG7f_...MX___._YJf_&c=_i_bhq&v=11',
      'r=Ew68Yk11Y&p0=QN__v.5L_____U0.___Qpg_U0.......&x0=_s_&r0=_-7f_.BH___.._-7f_...MX___.BG7f_&m0=_1_mxqv__&p1=NN__v.g______U0.5E0Qpg_WQ.......&x1=_s_&r1=BG7f_.MX___..BG7f_...MX___._YJf_&c=_i_bhq&v=11',
      'r=Ew68Yk11Y&p0=QN__v.bn_.5L_Qpg.......&x0=_s_&r0=BG7f_.._-7f_...MX___.BG7f_&m0=_1_mxqv__&p1=NN__v.bn_.5E0Qpg.......&x1=_s_&r1=BG7f_.MX___.BG7f_...MX___._YJf_&c=_i_bhq&v=11',
      'r=Ew68Yk11Y&p0=QN__v.g______U0.5L_Qpg._______U0......&x0=_s_&r0=_-7f_.BG7f_...MX___.BG7f_&m0=_1_mxqv__&p1=NN__v.5L_____U0._U0Qpg._______U0......&x1=_s_&r1=_-7f_.BG7f_...MX___._YJf_&c=_i_bhq&v=11',
      'r=Ew68Yk11Y&p0=QN__v.mD_Qpg.5L_.......&x0=_s_&r0=.BH___..MX___.BG7f_...._-7f_&m0=_1_mxqv__&p1=NN__v.___Rhw_U0.5E0Qpg_WQ.......&x1=_s_&r1=.BH___..MX___._YJf_....BG7f_&c=_i_bhq&v=11',
      'r=Ew68Yk11Y&p0=QN__v.mD_Qpg.5L_.......___R3s_U0&x0=_s_&r0=.BH___..MX___.BG7f_...._-7f_&m0=_1_mxqv__&p1=NN__v.___Rhw_U0.5E0Qpg_WQ.......___R3s_U0&x1=_s_&r1=.BH___..MX___._YJf_....BG7f_&c=_i_bhq&v=11',
      'r=Ew68Yk11Y&p0=QN__v.gU0.5E0Qpg......___R3s_U0.___Qpg_U0&x0=_s_&r0=BH___..MX___.BG7f_...._-7f_&m0=_1_mxqv__&p1=NN__v.5E0.___Qpg......___R3s_U0.___Qpg_U0&x1=_s_&r1=BH___..MX___._YJf_....BG7f_&c=_i_bhq&v=11',
      'r=Ew68Yk11Y&p0=QN__v.bg0____WQ.5E0Qpg_WQ.....___R3s_U0.___Qpg_U0.&x0=_s_&r0=BH___.MX___.BG7f_...._-7f_&m0=_1_mxqv__&p1=NN__v.bg0____WQ.5L_Qpg_U0.....___R3s_U0.___Qpg_U0.&x1=_s_&r1=BH___.MX___._YJf_....BG7f_&c=_i_bhq&v=11',
    ]

    for (const [index, query] of shiftedQueries.entries()) {
      const animation = await codec.decodeVer(Object.fromEntries(new URLSearchParams(query)))
      expect(findVtgPatternMatch(animation), `shift ${index}`).toBeDefined()
    }
  })

  it('uses hidden prop offsets only after offset-free two-cycle interpretations', async () => {
    const codec = await createCurrentCodec()
    const examples = [
      {
        query:
          'r=Ew08Yk11Y&p0=Q__.mBE_______q_.5JEQzP...............&m0=_1_mxqv__&p1=N__.mBE_______q_.5JEQzP...............&c=_f_bhq&v=9',
        expected: { reference: '1-1', speedRatio: '2:3', orientation: -90 },
      },
      {
        query:
          'r=Ew08Yk11Y&p0=Q__.myQ_______q_.5JEQzP...............&m0=_1_mxqv__&p1=N__.myQ_______q_.5JEQzP...............&c=_f_bhq&v=9',
        expected: {
          reference: '1-1',
          speedRatio: '2:3',
          reversePlane: true,
          orientation: -90,
        },
      },
      {
        query:
          'r=Ew08Yk11Y&p0=Q__.biQQYq_WQ_q_.5E0QzP......_______WQ.........&m0=_1_mxqv__&p1=N__.biQQYq_WQ_q_.5E0QzP......_______WQ.........&c=_f_bhq&v=9',
        expected: {
          reference: '3-3',
          speedRatio: '2:3',
          beat: 2,
          reversePlane: true,
          orientation: -90,
        },
      },
    ] as const

    for (const { query, expected } of examples) {
      const animation = await codec.decodeVer(Object.fromEntries(new URLSearchParams(query)))
      expect(findVtgPatternMatches(animation)).toContainEqual(expect.objectContaining(expected))
      const match = findVtgPatternMatch(animation)
      expect(match).toBeDefined()
      expect(match?.propRotationOffsets).toBeUndefined()
    }
  })

  it('retains matching when the supplied 2:3 transition changes to 3 beats', async () => {
    const codec = await createCurrentCodec()
    const supplied = await codec.decodeVer(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew68Yk11Y&p0=Q__.mBE_______q_.5JEQzP...............&m0=_1_mxqv__&p1=N__.mBE_______q_.5L_QzP...............&c=_f_bhq&v=9',
        ),
      ),
    )
    const suppliedMatch = findVtgPatternMatch(supplied)
    expect(suppliedMatch).toBeDefined()
    if (!suppliedMatch) return

    const threeBeat = createAnimation({
      ...suppliedMatch,
      transition: true,
      transitionBeats: 3,
    })

    expect(findVtgPatternMatch(threeBeat)).toMatchObject({
      ...suppliedMatch,
      transition: true,
      transitionBeats: 3,
    })

    const quad = createAnimation({
      ...suppliedMatch,
      transition: true,
      transitionQuad: true,
    })
    expect(findVtgPatternMatch(quad)).toMatchObject({
      ...suppliedMatch,
      transition: true,
      transitionQuad: true,
    })
  })

  it('matches the highest starting beat of a two-cycle timing ratio', () => {
    const source = createAnimation({ reference: '1-1', speedRatio: '2:1', beat: 8.5 })

    expect(findVtgPatternMatches(source)).toContainEqual(
      expect.objectContaining({ reference: '1-1', speedRatio: '2:1', beat: 8.5 }),
    )
  })

  it('regenerates serialized reversed orientation at 1:2 without changing compiled motion', async () => {
    const codec = await createCurrentCodec()
    const source = createAnimation({
      reference: '1-1',
      speedRatio: '1:2',
      beat: 1.5,
      orientation: 90,
      reversePlane: true,
    })
    const decoded = await codec.decodeVer(codec.encodeQS(source, false))
    const match = findVtgPatternMatch(decoded)

    if (!match) throw new Error('Expected the reversed 1:2 animation to match')
    const normalizeCoordinate = (value: number) => {
      const normalized = Math.round(value * 1e9) / 1e9
      return Object.is(normalized, -0) ? 0 : normalized
    }
    const comparableTracks = (animation: RootDataFinal) =>
      rootCompile(animation).props.map((prop) =>
        prop.anim.map((frame) => ({
          turns: frame.turns,
          beats: frame.beats,
          arc: ((frame.arc % 360) + 360) % 360,
          plane: ((frame.plane % 360) + 360) % 360,
          axis: ((frame.axis % 360) + 360) % 360,
          pos: frame.pos.map(normalizeCoordinate),
          rot: frame.rot.map(normalizeCoordinate),
        })),
      )
    expect(comparableTracks(createAnimation(match))).toEqual(comparableTracks(source))
  })

  it('reproduces the supplied oddball prop headings in the detected thumbnail selection', async () => {
    const codec = await createCurrentCodec()
    const source = await codec.decodeVer(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.5E0vF___q._U0sR.......&m0=_1_mxqv__&p1=N__.g__uf___q.5E0vF.......&c=_f_bhq&v=6',
        ),
      ),
    )
    const match = findVtgPatternMatch(source)
    if (!match) throw new Error('Expected the supplied oddball animation to match')
    const regenerated = createAnimation(match)

    expect(rootCompile(regenerated).props.map((prop) => prop.anim)).toEqual(
      rootCompile(source).props.map((prop) => prop.anim),
    )
  })

  it('prefers the exact phase while retaining an aligned alternate for the supplied query', async () => {
    const codec = await createCurrentCodec()
    const animation = await codec.decodeVer(
      Object.fromEntries(
        new URLSearchParams(
          'r=Ew08Yk11Y&p0=Q__.mD______s.5L_wm.......&m0=_1_mxqv__&p1=N__.mD_s8___s.5L_.......&c=_i_bhq&v=6',
        ),
      ),
    )

    expect(findVtgPatternMatch(animation)).toEqual({
      reference: '3-5',
      speedRatio: '1:3',
      isAnti: false,
      swapProps: false,
      reversePlane: false,
      beat: 4,
      bpm: 40,
      scale: 0.8,
    })

    const alternate = findVtgPatternMatches(animation).find(
      (match) => match.reference === '5-3' && match.beat === 2,
    )
    expect(alternate?.propRotationOffsets).toEqual([180, 0])
    if (!alternate) throw new Error('Expected the supplied query to retain its alternate match')

    const aligned = createAnimation(alternate)
    expect(rootCompile(aligned).props.map((prop) => prop.anim.map((frame) => frame.rot))).toEqual(
      rootCompile(animation).props.map((prop) => prop.anim.map((frame) => frame.rot)),
    )
  })

  it.each([-90, -45])(
    'retains the compiled tracks at %s degrees when orientation is applied before a half-beat shift',
    (orientation) => {
      const source = createAnimation({
        reference: '1-1',
        speedRatio: '1:1',
        beat: 1.5,
        orientation,
      })
      const match = findVtgPatternMatch(source)
      if (!match) throw new Error('Expected the shifted animation to match')
      const regenerated = createAnimation(match)

      expect(compiledTrackKey(regenerated)).toBe(compiledTrackKey(source))
    },
  )

  it.each(['1:1', '1:3', '1:5'] as const)(
    'retains the row-first lower-table cells at %s',
    (speedRatio) => {
      for (const reference of ['3-5', '3-6', '4-5', '4-6'] as const) {
        expect(findVtgPatternMatch(createAnimation({ reference, speedRatio }))).toMatchObject({
          reference,
          speedRatio,
        })
      }
    },
  )

  it.each(['1:2', '1:4'] as const)(
    'matches every serialized %s cell at the default -90-degree orientation',
    async (speedRatio) => {
      const codec = await createCurrentCodec()
      const missing: VtgCellReference[] = []
      for (const row of ruleNumbers) {
        for (const column of ruleNumbers) {
          const reference = `${row}-${column}` as VtgCellReference
          const source = createAnimation({ reference, speedRatio, orientation: -90 })
          const decoded = await codec.decodeVer(codec.encodeQS(source, false))
          if (!findVtgPatternMatch(decoded)) missing.push(reference)
        }
      }
      expect(missing).toEqual([])
    },
  )

  it.each(['1:1', '1:3', '1:5'] as const)(
    'retains the row-first lower-table cells after query serialization at %s',
    async (speedRatio) => {
      const codec = await createCurrentCodec()
      for (const reference of ['3-5', '3-6', '4-5', '4-6'] as const) {
        const decoded = await codec.decodeVer(
          codec.encodeQS(createAnimation({ reference, speedRatio }), false),
        )
        expect(findVtgPatternMatch(decoded)).toMatchObject({ reference, speedRatio })
      }
    },
  )

  it.each(['1:2', '1:4'] as const)(
    'recognizes every nonzero initial arc rotation after a beat shift at %s',
    (speedRatio) => {
      for (const orientation of getVtgPatternOrientations(speedRatio).filter(
        (option) => option !== 0,
      )) {
        const selection = {
          reference: '5-1',
          speedRatio,
          orientation,
          beat: 3,
        } as const satisfies VtgPatternSelection

        expect(findVtgPatternMatches(createAnimation(selection))).toContainEqual({
          ...selection,
          isAnti: false,
          swapProps: false,
          reversePlane: false,
          bpm: 40,
          scale: 0.8,
        })
      }
    },
  )

  it.each(['1:1', '1:3', '1:5'] as const)(
    'recognizes animations using every added rotation at %s',
    (speedRatio) => {
      for (const orientation of getVtgPatternOrientations(speedRatio).filter(
        (option) => option !== 0,
      )) {
        const animation = createAnimation({
          reference: '5-1',
          speedRatio,
          orientation,
          beat: 3,
        })

        expect(findVtgPatternMatch(animation)).toMatchObject({ speedRatio })
      }
    },
  )

  it.each(vtgTransitionBeats)('detects the %s-beat reciprocal transition', (transitionBeats) => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      transition: true,
      transitionBeats,
    } as const satisfies VtgPatternSelection

    expect(findVtgPatternMatch(createAnimation(selection))).toMatchObject({
      ...selection,
    })
  })

  it('detects when the reciprocal transition starts with the second prop after Swap', () => {
    const selection = {
      reference: '5-1',
      speedRatio: '1:3',
      swapProps: true,
      transition: true,
      transitionQuad: true,
      transitionSecond: true,
    } as const satisfies VtgPatternSelection

    expect(findVtgPatternMatch(createAnimation(selection))).toMatchObject({
      ...selection,
    })
  })

  it('recognizes every generated transform among its supported matches', () => {
    for (const column of ruleNumbers) {
      for (const row of ruleNumbers) {
        const reference = createCellReference(column, row)
        const antiOptions = spinToggleCells.has(reference) ? booleanOptions : ([false] as const)

        for (const speedRatio of vtgSpeedRatios) {
          for (const isAnti of antiOptions) {
            for (const swapProps of booleanOptions) {
              for (const reversePlane of booleanOptions) {
                const selection = {
                  reference,
                  speedRatio,
                  isAnti,
                  swapProps,
                  reversePlane,
                  bpm: 93,
                  scale: 1.2,
                } satisfies VtgPatternSelection
                const matches = findVtgPatternMatches(createAnimation(selection))

                expect(matches).toContainEqual(selection)
              }
            }
          }
        }
      }
    }
  }, 10_000)

  it('returns an observable Swap, 180-degree, ratio, Anti, BPM, and Scale combination', () => {
    const selection = {
      reference: '5-6',
      speedRatio: '1:3',
      isAnti: true,
      swapProps: true,
      reversePlane: true,
      bpm: 87,
      scale: 0.6,
    } as const satisfies VtgPatternSelection

    expect(findVtgPatternMatch(createAnimation(selection))).toEqual(selection)
  })

  it('recovers the QTR transition by matching its shared doubled base cycle', () => {
    const selection = {
      reference: '1-1',
      speedRatio: '1:3',
      beat: 2,
      transition: true,
      bpm: 83,
    } as const satisfies VtgPatternSelection

    expect(
      findVtgPatternMatches(createAnimation({ ...selection, transitionBeats: 5 })),
    ).toContainEqual({
      ...selection,
      transitionBeats: 5,
      isAnti: false,
      swapProps: false,
      reversePlane: false,
      bpm: 83,
      scale: 0.8,
    })
  })

  it('selects the lowest equivalent beat before considering rotated duplicates', () => {
    const mismatches: string[] = []

    for (const column of ruleNumbers) {
      for (const row of ruleNumbers) {
        for (const speedRatio of vtgSpeedRatios) {
          for (const beat of [1, 2, 3, 4] as const) {
            const reference = createCellReference(column, row)
            const animation = createAnimation({ reference, speedRatio, beat })
            const matches = preferredPatternOptionMatches(
              animation,
              findVtgPatternMatches(animation),
            )
            const lowestBeat = Math.min(...matches.map((candidate) => candidate.beat ?? 1))
            const match = findVtgPatternMatch(animation)

            if (match === undefined || (match.beat ?? 1) !== lowestBeat) {
              mismatches.push(
                `${reference}/${speedRatio}/${beat}/${lowestBeat} -> ${match?.reference}/${match?.speedRatio}/${match?.beat ?? 1}`,
              )
            }
          }
        }
      }
    }

    expect(mismatches).toEqual([])
  }, 60_000)

  it('tries every 2-2 Trans beat before changing the current transforms', () => {
    for (const swapProps of booleanOptions) {
      for (const reversePlane of booleanOptions) {
        for (const beat of [3, 4] as const) {
          const selection = {
            reference: '2-2',
            speedRatio: '1:3',
            beat,
            swapProps,
            reversePlane,
            transition: true,
          } as const satisfies VtgPatternSelection
          const animation = createAnimation({ ...selection, transitionBeats: 5 })
          const matches = preferredPatternOptionMatches(animation, findVtgPatternMatches(animation))
          const preferenceDifference = (match: VtgPatternMatch) =>
            Number(match.swapProps !== swapProps) + Number(match.reversePlane !== reversePlane)
          const lowestPreferenceDifference = Math.min(...matches.map(preferenceDifference))
          const preferredMatches = matches.filter(
            (match) => preferenceDifference(match) === lowestPreferenceDifference,
          )
          const lowestPreferredBeat = Math.min(...preferredMatches.map((match) => match.beat ?? 1))
          const match = findVtgPatternMatch(animation, {
            swapProps,
            reversePlane,
          })

          expect(match ? preferenceDifference(match) : undefined).toBe(lowestPreferenceDifference)
          expect(match?.beat ?? 1).toBeLessThanOrEqual(lowestPreferredBeat)
        }
      }
    }
  })

  it('selects the lowest equivalent beat before rotated duplicates after serialization', async () => {
    const codec = await createCurrentCodec()
    const mismatches: string[] = []

    for (const column of ruleNumbers) {
      for (const row of ruleNumbers) {
        for (const beat of [1, 2, 3, 4] as const) {
          const reference = createCellReference(column, row)
          const query = codec.encodeQS(
            createAnimation({ reference, speedRatio: '1:3', beat }),
            false,
          )
          const animation = await codec.decodeVer(query)
          const matches = preferredPatternOptionMatches(animation, findVtgPatternMatches(animation))
          const lowestBeat = Math.min(...matches.map((candidate) => candidate.beat ?? 1))
          const match = findVtgPatternMatch(animation)

          if (match === undefined || (match.beat ?? 1) !== lowestBeat) {
            mismatches.push(
              `${reference}/${beat}/${lowestBeat} -> ${match?.reference}/${match?.beat ?? 1}`,
            )
          }
        }
      }
    }

    expect(mismatches).toEqual([])
  })

  it('recognizes a pattern regardless of supported non-pattern animation settings', () => {
    const animation = createAnimation({
      reference: '3-4',
      speedRatio: '1:5',
    })

    animation.bpm = 240
    animation.speed = 2
    animation.turns = 45
    animation.depth = 3
    animation.prop = 1
    animation.color = 0
    animation.smooth = false
    animation.guides = true
    animation.paths = false
    animation.hands = true
    animation.visible = false
    animation.nodes = true
    animation.anchors = true
    animation.aspectx = 16
    animation.aspecty = 9
    animation.camera = [{ center: { distance: 3 }, orbit: { distance: 40 } }]
    animation.thick = 12

    for (const prop of animation.props) {
      prop.prop = 1
      prop.color = 0
      prop.guides = true
      prop.paths = false
      prop.hands = true
      prop.visible = false
      prop.nodes = true
      prop.anchors = true
      prop.thick = 12

      for (const frame of prop.anim) {
        frame.beats = 2
        frame.depth = 3
        frame.move = [1, 2, 3]
      }
    }

    animation.props[0]!.anim[0]!.scale = 250
    animation.props[1]!.anim[0]!.scale = 70
    animation.props[0]!.anim[0]!.warp = 35
    animation.props[1]!.anim[0]!.warp = -20

    expect(findVtgPatternMatch(animation)).toMatchObject({
      reference: '3-4',
      speedRatio: '1:5',
      bpm: 120,
      scale: 2.5,
    })
  })

  it.each([
    [
      'root Type',
      (animation: ReturnType<typeof createAnimation>): void => {
        animation.type = 1
      },
    ],
    [
      'frame Type',
      (animation: ReturnType<typeof createAnimation>): void => {
        animation.props[0]!.anim[0]!.type = 1
      },
    ],
    [
      'frame Adjust',
      (animation: ReturnType<typeof createAnimation>): void => {
        animation.props[0]!.anim[0]!.adjust = 15
      },
    ],
  ] as const)('rejects a pattern when %s is authored', (_label, edit) => {
    const animation = createAnimation({ reference: '3-4', speedRatio: '1:5' })
    edit(animation)

    expect(findVtgPatternMatch(animation)).toBeUndefined()
  })

  it('recognizes query-normalized data and equivalent -180 degree planes', () => {
    const animation = createAnimation({
      reference: '6-1',
      speedRatio: '1:1',
      scale: 0.8,
    })
    animation.camera[0]!.orbit!.distance = Math.trunc(animation.camera[0]!.orbit!.distance ?? 0)
    animation.props[0]!.anim[0]!.plane = -180
    animation.props[1]!.anim[0]!.plane = -180

    const match = findVtgPatternMatch(animation)
    expect(match).toMatchObject({
      speedRatio: '1:1',
      bpm: 40,
      scale: 0.8,
    })
    expect(match && compiledSelectionTrackKey(match)).toBe(compiledTrackKey(animation))
  })

  it('prefers unchecked controls when a transform has no observable effect', () => {
    const animation = createAnimation({
      reference: '1-1',
      speedRatio: '1:1',
      swapProps: true,
    })

    expect(findVtgPatternMatch(animation)).toMatchObject({
      reference: '1-1',
      speedRatio: '1:1',
      swapProps: false,
      reversePlane: false,
    })
  })

  it('rejects an edited animation that is no longer a supported VTG pattern', () => {
    const animation = createAnimation({
      reference: '3-4',
      speedRatio: '1:5',
    })
    animation.props[0]!.anim[1]!.arc = 46

    expect(findVtgPatternMatch(animation)).toBeUndefined()
  }, 10_000)

  it('rejects an authored rotation-axis edit', () => {
    const animation = createAnimation({ reference: '3-2', speedRatio: '1:3', beat: 3 })
    animation.props[0]!.anim[0]!.axis = 45

    expect(findVtgPatternMatch(animation)).toBeUndefined()
  })

  it('recognizes the generated QSlot through the established 180 transform', async () => {
    const codec = await createCurrentCodec()
    const query = Object.fromEntries(
      new URLSearchParams(
        'r=Ew08Yk11Y&p0=Q__.5E0wmHj_s._____w3.......&m0=_1_mxqv__&p1=N__.g_______s.5E0wm.......&c=_i_bhq&v=6',
      ),
    )
    const animation = await codec.decodeVer(query)
    expect(findVtgPatternMatch(animation)).toMatchObject({
      reference: '6-6',
      speedRatio: '1:3',
      swapProps: false,
      reversePlane: true,
      beat: 2,
    })
    expect(codec.encodeQS(animation, false).v).toBe('12')
  })

  it('recognizes an omitted zero plane in the supplied Frame 1 reverse example', async () => {
    const codec = await createCurrentCodec()
    const query = Object.fromEntries(
      new URLSearchParams(
        'r=Ew08kk11Y&p0=N__.5L_xM___s.blE...&m0=_1_mxqv__&p1=Q__.gZE_____s.bn_xM...&c=_i_bhq&v=6',
      ),
    )
    const supplied = await codec.decodeVer(query)
    expect(codec.encodeQS(supplied, false).v).toBe('12')
    expect(findVtgPatternMatch(supplied)).toMatchObject({
      reference: '6-6',
      speedRatio: '1:3',
      swapProps: true,
      reversePlane: true,
    })
  })

  it('recognizes a VTG pattern after its compatible frame grid is halved', () => {
    const original = createAnimation({ reference: '5-1', speedRatio: '1:3', beat: 3 })
    const halved = halveAnimationFrames(original)
    if (!halved) throw new Error('Expected the VTG pattern to halve')

    expect(findVtgPatternMatch(halved)).toMatchObject({
      reference: '5-1',
      speedRatio: '1:3',
      beat: 3,
    })
  })
})
