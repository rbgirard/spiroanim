import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useVtgScaleControls } from '@/features/vtg/composables/useVtgScaleControls'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { readPatternScaleValues } from '@/features/vtg/scaleSettings'
import type { RootDataFinal } from '@/types/AnimTypes'
import type { VtgSpeedRatio } from '@/features/vtg/types'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))
const setup = (
  source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:5', scale: 0.9 })!,
  enabledValue = true,
) => {
  const animation = shallowRef<RootDataFinal>(source)
  const base = ref(0.8)
  const ratio = ref<VtgSpeedRatio>('1:5')
  const enabled = ref(enabledValue)
  const revision = ref(0)
  const onAnimationUpdate = vi.fn<(next: RootDataFinal) => void>((next) => {
    animation.value = next
  })
  const scope = effectScope()
  scopes.push(scope)
  const controls = scope.run(() =>
    useVtgScaleControls({ animation, base, ratio, enabled, revision, onAnimationUpdate }),
  )!
  return { controls, animation, base, ratio, enabled, revision, onAnimationUpdate }
}

describe('useVtgScaleControls', () => {
  it('detects Auto and a nondefault base from frames without emitting a change', () => {
    const { controls, base, onAnimationUpdate } = setup()
    expect(controls.auto.value).toBe(true)
    expect(base.value).toBe(0.9)
    expect(onAnimationUpdate).not.toHaveBeenCalled()
  })

  it('retains local manual mode but re-detects equal scales after an external revision', async () => {
    const { controls, revision, animation, onAnimationUpdate } = setup()
    controls.updateAuto(false)
    await nextTick()
    expect(controls.auto.value).toBe(false)
    controls.updateMode('advanced')
    await nextTick()
    expect(controls.mode.value).toBe('advanced')
    const before = JSON.stringify(animation.value)
    onAnimationUpdate.mockClear()
    revision.value++
    await nextTick()
    expect(controls.auto.value).toBe(true)
    expect(controls.mode.value).toBe('simple')
    expect(JSON.stringify(animation.value)).toBe(before)
    expect(onAnimationUpdate).not.toHaveBeenCalled()
  })

  it('re-detects scale and base when returning from Builder', async () => {
    const { controls, enabled, animation, base } = setup()
    enabled.value = false
    await nextTick()
    for (const prop of animation.value.props) prop.anim[0]!.scale = 120
    enabled.value = true
    await nextTick()
    expect(controls.auto.value).toBe(true)
    expect(base.value).toBe(1)
  })

  it('re-evaluates the base when asynchronous matching supplies the loaded ratio', async () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:2', scale: 0.9 })!
    const { controls, ratio, base, onAnimationUpdate } = setup(source)
    ratio.value = '1:2'
    controls.hydrate()
    await nextTick()
    expect(controls.auto.value).toBe(true)
    expect(base.value).toBe(0.9)
    expect(onAnimationUpdate).not.toHaveBeenCalled()
  })

  it('keeps the Auto base while the user changes ratio', async () => {
    const { controls, ratio, base, animation } = setup()
    ratio.value = '1:2'
    await nextTick()
    expect(base.value).toBe(0.9)
    controls.apply()
    await nextTick()
    expect(readPatternScaleValues(animation.value)[0]['0']).toBe(0.7)
  })

  it('refreshes authored and inherited values after an in-place Editor change', async () => {
    const { controls, animation, revision } = setup()
    animation.value.props[0]!.anim[1]!.scale = 65
    revision.value++
    await nextTick()
    expect(controls.auto.value).toBe(false)
    expect(controls.values.value[0]['0.5']).toBe(0.65)
    expect(controls.displayValues.value[0]['1']).toBe(0.65)
  })

  it('seeds every Auto -> manual transition from the current effective size', async () => {
    const { controls, animation, base } = setup()
    expect(base.value).toBe(0.9)
    controls.updateAuto(false)
    await nextTick()
    expect(controls.auto.value).toBe(false)
    expect(controls.values.value).toEqual([{ 0: 1.1 }, { 0: 1.1 }])
    controls.updateValue(0, 0, 0.3)
    await nextTick()
    expect(readPatternScaleValues(animation.value)).toEqual([{ 0: 0.3 }, { 0: 1.1 }])
    controls.updateAuto(true)
    await nextTick()
    base.value = 0.6
    controls.apply()
    await nextTick()
    controls.updateAuto(false)
    await nextTick()
    expect(controls.values.value).toEqual([{ 0: 0.8 }, { 0: 0.8 }])
  })

  it('detects varying Scale as manual without rewriting authored values', () => {
    const source = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })!
    source.props[0]!.anim[1]!.scale = 65
    const { controls, onAnimationUpdate } = setup(source)
    expect(controls.auto.value).toBe(false)
    expect(controls.mode.value).toBe('advanced')
    expect(controls.values.value[0]['0.5']).toBe(0.65)
    expect(onAnimationUpdate).not.toHaveBeenCalled()
  })

  it('keeps a valid automatic base when legacy manual Scale falls outside the Auto range', async () => {
    const { controls, base, animation } = setup()
    controls.updateAuto(false)
    await nextTick()
    base.value = 0.2
    controls.updateValue(0, 0, 0.2)
    await nextTick()
    expect(controls.settings.value).toMatchObject({ auto: false, base: 0.8, mode: 'simple' })
    expect(readPatternScaleValues(animation.value)[0]['0']).toBe(0.2)
  })

  it('keeps Advanced edits across hydration and clears inherited values', async () => {
    const { controls, animation } = setup()
    controls.updateAuto(false)
    await nextTick()
    controls.updateMode('advanced')
    await nextTick()
    controls.updateValue(0, 0.5, 0.4)
    await nextTick()
    expect(controls.mode.value).toBe('advanced')
    expect(readPatternScaleValues(animation.value)[0]['0.5']).toBe(0.4)
    controls.updateValue(0, 0.5)
    await nextTick()
    expect(readPatternScaleValues(animation.value)[0]['0.5']).toBeUndefined()
    expect(readPatternScaleValues(animation.value, true)[0]['0.5']).toBe(1.1)
  })

  it('does not change Builder animation or controls when disabled', () => {
    const { controls, base, onAnimationUpdate } = setup(undefined, false)
    controls.updateAuto(false)
    controls.updateValue(0, 0, 0)
    controls.apply()
    expect(base.value).toBe(0.8)
    expect(onAnimationUpdate).not.toHaveBeenCalled()
  })
})
