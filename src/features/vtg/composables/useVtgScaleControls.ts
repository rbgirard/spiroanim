import { applyVtgScaleSettings, readPatternScaleValues } from '@/features/vtg/scaleSettings'
import { vtgScaleControl } from '@/features/vtg/data/vtgPlayerSettings'
import type { RootDataFinal } from '@/types/AnimTypes'
import type { PatternScaleMode, PatternScaleValues, VtgScaleSettings } from '@/types/AnimationScale'
import type { VtgSpeedRatio } from '@/features/vtg/types'

interface VtgScaleControlOptions {
  animation: Readonly<Ref<RootDataFinal | undefined>>
  revision?: Readonly<Ref<number | undefined>>
  enabled: Readonly<Ref<boolean>>
  base: Ref<number>
  ratio: Readonly<Ref<VtgSpeedRatio>>
  onAnimationUpdate: (animation: RootDataFinal) => void
}

export const useVtgScaleControls = ({
  animation,
  revision,
  enabled,
  base,
  ratio,
  onAnimationUpdate,
}: VtgScaleControlOptions) => {
  const auto = ref(true)
  const mode = ref<PatternScaleMode>('simple')
  const values = ref<PatternScaleValues>([{}, {}])
  const hydrating = ref(false)
  const displayValues = computed<PatternScaleValues>(() => {
    // Editor changes can mutate the shallow animation in place.
    void revision?.value
    return animation.value ? readPatternScaleValues(animation.value, true) : [{}, {}]
  })
  const settings = computed<VtgScaleSettings>(() => ({
    auto: auto.value,
    base:
      base.value >= vtgScaleControl.min && base.value <= vtgScaleControl.max
        ? base.value
        : vtgScaleControl.default,
    mode: mode.value,
    values: [{ ...values.value[0] }, { ...values.value[1] }],
  }))

  const hydrate = () => {
    if (!enabled.value) return
    const current = animation.value
    if (!current || current.props.length === 0) {
      auto.value = true
      mode.value = 'simple'
      values.value = [{}, {}]
      return
    }
    // Unmarked legacy links retain their authored scales; never infer Auto from matching numbers.
    auto.value = current.vtgScale?.auto ?? false
    hydrating.value = true
    if (current.vtgScale) base.value = current.vtgScale.base
    hydrating.value = false
    values.value = readPatternScaleValues(current)
    mode.value =
      current.vtgScale?.mode ??
      (values.value.some((side) => Object.keys(side).some((beat) => beat !== '0'))
        ? 'advanced'
        : 'simple')
  }
  watch([animation, enabled, () => revision?.value], hydrate, { immediate: true })

  const apply = () => {
    if (!enabled.value || !animation.value) return
    onAnimationUpdate(applyVtgScaleSettings(animation.value, settings.value, ratio.value))
  }
  const updateAuto = (nextAuto: boolean) => {
    if (!enabled.value || nextAuto === auto.value) return
    if (!nextAuto) {
      // Each Auto -> manual transition starts with today's rendered values, not old manual edits.
      values.value = [
        { '0': displayValues.value[0]['0'] ?? 1 },
        { '0': displayValues.value[1]['0'] ?? 1 },
      ]
      mode.value = 'simple'
    } else {
      mode.value = 'simple'
      base.value = settings.value.base
    }
    auto.value = nextAuto
    apply()
  }
  const updateValue = (propIndex: 0 | 1, beat: number, value?: number) => {
    if (auto.value || !enabled.value) return
    const next: PatternScaleValues = [{ ...values.value[0] }, { ...values.value[1] }]
    if (value === undefined) delete next[propIndex][String(beat)]
    else next[propIndex][String(beat)] = value
    values.value = next
    apply()
  }
  const updateMode = (nextMode: PatternScaleMode) => {
    if (auto.value || !enabled.value) return
    mode.value = nextMode
    apply()
  }
  const reset = () => {
    auto.value = true
    mode.value = 'simple'
    values.value = [{}, {}]
  }
  return {
    auto,
    mode,
    values,
    displayValues,
    settings,
    hydrating,
    updateAuto,
    updateValue,
    updateMode,
    apply,
    reset,
  }
}
