import { describe, expect, it } from 'vitest'
import { Group, Scene, Vector3 } from 'three'
import { createSpiroAnimator } from '@/workers/animation/createSpiroAnimator'
import { rootCompile } from '@/math/animation/AnimFunc'
import { useSpiroAnimQS } from '@/composables/useSpiroAnimQS'
import { useBaseQS } from '@/services/query/createBaseQS'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'
import { applyVtgThirdOrderSettings } from '@/features/vtg/thirdOrder'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { describeVtgBuilderMotion } from '@/features/builder/describeVtgBuilderMotion'
import {
  createGeneratedThirdOrderAnimation,
  generateThirdOrderDefinitions,
  thirdOrderGeneratorReferences,
} from '../generateDefinitions'
import type { VtgCellReference } from '@/features/vtg/types'
import {
  canonicalizePlanarPattern,
  combineSignals,
  extractPlanarPattern,
  rotatePlanarTerm,
  scaleSignal,
  signalErrorBound,
} from '../planarPattern'
import type { PlanarPattern } from '../planarPattern'

const codec = async () => {
  const version = await loadSpiroAnimQSVersion(12)
  return useSpiroAnimQS(version.VDEF, useBaseQS(version.VDEF, { charset: version.CHARSET }), 12)
}
const fixtureParts = [
  'p0=Q__.mD_.5JE-_i...............&x0=PW&m0=_1_mxqv__&p1=N__.mD__98.5JE-Zb...............&x1=.____LQL_',
  'p0=Q__.mBE.5JE-_i...............&x0=PW&m0=_1_mxqv__&p1=N__.mBE.5JE-Zb...............&x1=.____LQL_',
  'p0=Q__.05E-ZU.5JE-_i...............&x0=PW&m0=_1_mxqv__&p1=N__.05E_98.5JE-Zb...............&x1=____Oif_.____LQL_',
  'p0=Q__.07__98.5JE-_i...............&x0=PW&p1=N__.07_.5JE-Zb...............&x1=____Oif_.____LQL_&m1=_1_mxqv__',
  'p0=Q__.05E_98.5JE-_i...............&x0=PW&p1=N__.05E-ZU.5JE-Zb...............&x1=____Oif_.____LQL_&m1=_1_mxqv__',
  'p0=Q__.mBE.5JE-_i...............&x0=PW&p1=N__.mBE.5JE-Zb...............&x1=.____LQL_&m1=_1_mxqv__',
]
const decode = async (part: string) =>
  (await codec()).decodeQS(
    Object.fromEntries(new URLSearchParams(`r=Ew496k11Y&${part}&c=_k_bhq&v=12&vs=m:80`)),
  )
const alignment = (pattern: PlanarPattern) =>
  signalErrorBound(combineSignals(pattern[0], scaleSignal(pattern[1], 0.5)), pattern[2])

describe('Third Order offline analysis', () => {
  it('restricts recipes to all nine odd cells without losing non-1:1 patterns', async () => {
    expect(new Set(thirdOrderGeneratorReferences)).toEqual(
      new Set(['1-1', '1-3', '1-5', '3-1', '3-3', '3-5', '5-1', '5-3', '5-5']),
    )
    const numbers = [1, 2, 3, 4, 5, 6] as const
    const references = numbers.flatMap((row) =>
      numbers.map((column): VtgCellReference => `${row}-${column}`),
    )
    const options = {
      handRatios: ['1:1', '1:2', '1:3', '2:5'] as const,
      propRatios: ['1:7'] as const,
    }
    const full = await generateThirdOrderDefinitions({ ...options, references })
    const restricted = await generateThirdOrderDefinitions(options)
    for (const [index, cell] of restricted.cells.entries()) {
      const keys = cell.versions.map((v) => v.representative.canonical.key)
      const original = full.cells[index]!.versions.map((v) => v.representative.canonical.key)
      expect(keys.length).toBeLessThanOrEqual(original.length)
      expect(cell.handRatio === '1:1' || JSON.stringify(keys) === JSON.stringify(original)).toBe(
        true,
      )
      for (const version of cell.versions) {
        for (const candidate of [version.representative, ...version.equivalentCandidates]) {
          expect(thirdOrderGeneratorReferences).toContain(candidate.recipe.selection.reference)
        }
      }
    }
    expect(restricted.stats.uniquePatterns).toBeLessThan(full.stats.uniquePatterns)
  })
  it('agrees with actual player motion between keyframes', async () => {
    const root = await decode(fixtureParts[0]!)
    const pattern = extractPlanarPattern(root)
    const compiled = rootCompile(root)
    for (const [index, prop] of compiled.props.entries()) {
      const scene = new Scene()
      const animator = createSpiroAnimator({
        scene,
        speed: 1,
        girth: 2,
        bpm: root.bpm,
        smooth: root.smooth,
        prop,
        completed: () => undefined,
        width: 400,
        height: 400,
        distance: 22,
        fov: 45,
        timeline: false,
      })
      let model: Group | undefined
      scene.traverse((child) => {
        if (child instanceof Group && child.children.some((item) => 'size' in item)) model = child
      })
      if (!model) throw new Error('Missing player model')
      const duration =
        prop.anim.slice(0, -1).reduce((sum, f) => sum + f.beats, 0) * Math.round(60000 / root.bpm)
      for (let sample = 0; sample < 97; sample++) {
        const phase = sample / 97
        animator.seek(duration * phase)
        const actualHand = model.position.clone().divideScalar(5)
        const actualDirection = new Vector3(0, 1, 0).applyQuaternion(model.quaternion)
        for (const [channel, actual] of [
          [0, actualHand],
          [1, actualDirection],
        ] as const) {
          const expected = pattern[index * 2 + channel]!.reduce((sum, term) => {
            const value = rotatePlanarTerm(term, term.frequency * phase * Math.PI * 2)
            return sum.add(new Vector3(value.x, value.y, 0))
          }, new Vector3())
          expect(actual.distanceTo(expected)).toBeLessThan(1e-7)
        }
      }
    }
  })
  it('reproduces the two groups in the six user-supplied examples', async () => {
    const keys = await Promise.all(
      fixtureParts.map(
        async (part) => canonicalizePlanarPattern(extractPlanarPattern(await decode(part))).key,
      ),
    )
    expect(new Set(keys).size).toBe(2)
    expect(keys[0]).toBe(keys[1])
    expect(keys[1]).toBe(keys[5])
    expect(keys[2]).toBe(keys[3])
    expect(keys[3]).toBe(keys[4])
    expect(keys[0]).not.toBe(keys[2])
  })
  it('identifies the aligned example and rejects its opposed Adjust', async () => {
    const root = await decode(fixtureParts[5]!)
    expect(alignment(extractPlanarPattern(root))).toBeLessThan(1e-7)
    expect(
      alignment(
        extractPlanarPattern(
          applyVtgThirdOrderSettings(root, [{}, { initial: 180, timing: '1:2-anti' }]),
        ),
      ),
    ).toBeGreaterThan(0.9)
  })
  it('finds 180 for the later Spin example', async () => {
    const root = await decode(
      'p0=Q__.05E-ZU.5JE_4W...............&x0=PW&m0=_1_mxqv__&p1=N__.05E_98.5JE_71...............&x1=.____NeL_',
    )
    expect(alignment(extractPlanarPattern(root))).toBeGreaterThan(0.9)
    expect(
      alignment(
        extractPlanarPattern(
          applyVtgThirdOrderSettings(root, [{}, { initial: 180, timing: '1:2-pro' }]),
        ),
      ),
    ).toBeLessThan(1e-7)
  })
  it('accepts continuous phase, rotation, track exchange, and turning over', async () => {
    const pattern = extractPlanarPattern(await decode(fixtureParts[0]!))
    const transformed = pattern.map((signal) =>
      signal.map((term) => {
        const rotated = rotatePlanarTerm(term, 0.731 + term.frequency * 0.12345)
        return { frequency: -rotated.frequency, x: rotated.x, y: -rotated.y }
      }),
    )
    const swapped: PlanarPattern = [
      transformed[2]!,
      transformed[3]!,
      transformed[0]!,
      transformed[1]!,
    ]
    expect(canonicalizePlanarPattern(swapped).key).toBe(canonicalizePlanarPattern(pattern).key)
  })
  it('does not merge an independently rotated prop', async () => {
    const pattern = extractPlanarPattern(await decode(fixtureParts[0]!))
    const changed: PlanarPattern = [
      pattern[0],
      pattern[1],
      pattern[2],
      pattern[3].map((term) => rotatePlanarTerm(term, Math.PI / 2)),
    ]
    expect(canonicalizePlanarPattern(changed).key).not.toBe(canonicalizePlanarPattern(pattern).key)
  })
  it('can recognize a 45-degree alignment, rather than only 0 and 180', async () => {
    const root = await decode(fixtureParts[5]!)
    root.props[0]!.anim[0]!.turns = 45
    const results = [0, 45, 90, 135, 180, 225, 270, 315].map((initial) => ({
      initial,
      error: alignment(
        extractPlanarPattern(
          applyVtgThirdOrderSettings(root, [{}, { initial, timing: '1:2-anti' }]),
        ),
      ),
    }))
    expect(results.filter((r) => r.error < 1e-7).map((r) => r.initial)).toEqual([45])
  })
  it('rejects unsupported changing controls instead of silently approximating them', () => {
    const root = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })!
    root.props[0]!.anim[2]!.scale = 77
    expect(() => extractPlanarPattern(root)).toThrow('Unsupported')
  })
  it('uses final tooltip order after Swap and retains both timing orders and roles', async () => {
    const output = await generateThirdOrderDefinitions({ handRatios: ['1:2'], propRatios: ['1:7'] })
    const queryCodec = await codec()
    expect(output.cells).toHaveLength(4)
    const orders = new Set<string>(),
      roles = new Set<number>(),
      adjusts = new Set<number>()
    let checkedSwap = false
    for (const cell of output.cells)
      for (const version of cell.versions) {
        const restored = queryCodec.decodeQS(Object.fromEntries(new URLSearchParams(version.query)))
        expect(canonicalizePlanarPattern(extractPlanarPattern(restored)).key).toBe(
          version.representative.canonical.key,
        )
        const all = [version.representative, ...version.equivalentCandidates]
        expect(
          !all.some((c) => !c.recipe.selection.swapProps) ||
            version.representative.recipe.selection.swapProps === false,
        ).toBe(true)
        for (const candidate of all) {
          const animation = createGeneratedThirdOrderAnimation(candidate.recipe)
          const label = describeVtgBuilderMotion(animation)
          expect(candidate.recipe.thirdOrder.timing).toBe(
            `${cell.handRatio}-${cell.hand === 'anti' ? 'anti' : 'pro'}`,
          )
          expect(label.slice(0, 2)).toBe(
            `${cell.hand === 'anti' ? 'A' : 'I'}${cell.prop === 'anti' ? 'A' : 'I'}`,
          )
          orders.add(candidate.recipe.timingOrder)
          roles.add(candidate.recipe.driverIndex)
          adjusts.add(candidate.recipe.thirdOrder.initial)
          const pattern = extractPlanarPattern(animation)
          const driver = candidate.recipe.driverIndex * 2,
            follower = candidate.recipe.followerIndex * 2
          expect(
            signalErrorBound(
              combineSignals(pattern[driver]!, scaleSignal(pattern[driver + 1]!, 0.5)),
              pattern[follower]!,
            ),
          ).toBeLessThan(1e-7)
          if (cell.hand !== cell.prop && candidate.recipe.selection.swapProps) checkedSwap = true
          expect(canonicalizePlanarPattern(pattern).key).toBe(candidate.canonical.key)
        }
      }
    expect(orders).toEqual(new Set(['direct', 'reversed']))
    expect(roles).toEqual(new Set([0, 1]))
    expect(checkedSwap).toBe(true)
    expect(adjusts.has(0)).toBe(true)
    expect(adjusts.has(180)).toBe(true)
    expect(
      await generateThirdOrderDefinitions({ handRatios: ['1:2'], propRatios: ['1:7'] }),
    ).toEqual(output)
  })
  it('keeps only the two Anti-warp versions for the reported 1:2 / 2:5 Anti / Spin cell', async () => {
    const output = await generateThirdOrderDefinitions({ handRatios: ['1:2'], propRatios: ['2:5'] })
    const cell = output.cells.find((cell) => cell.hand === 'anti' && cell.prop === 'spin')!
    expect(cell.versions).toHaveLength(2)
    for (const version of cell.versions) {
      for (const candidate of [version.representative, ...version.equivalentCandidates]) {
        expect(candidate.recipe.thirdOrder.timing).toBe('1:2-anti')
      }
    }
  })
})
