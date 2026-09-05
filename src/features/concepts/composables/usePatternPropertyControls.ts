import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import type {
  VtgFoldMode,
  VtgFoldSpan,
  VtgFoldValue,
  VtgTwistMode,
} from '@/features/concepts/stores/useConceptsStore'
import {
  applyVtgFoldSettings,
  deriveVtgFoldSimpleSources,
  extractVtgFoldValues,
} from '@/features/vtg/applyVtgFoldSettings'
import {
  extractVtgThirdOrderSettings,
  getVtgThirdOrderDisplaySettings,
  updateVtgThirdOrderTimingSetting,
  type VtgThirdOrderDisplaySettings,
  type VtgThirdOrderInitial,
  type VtgThirdOrderTiming,
} from '@/features/vtg/thirdOrder'
import type { RootDataFinal } from '@/types/AnimTypes'
import { updateVtgMirroredSideSetting } from '@/features/vtg/propertySettings'

interface PatternPropertyControlOptions {
  animation: Readonly<Ref<RootDataFinal | undefined>>
  onAnimationUpdate: (animation: RootDataFinal) => void
  rebuildAnimationForThirdOrderCycle?: (minimumCycleCount: 1 | 2) => RootDataFinal | undefined
}

export const usePatternPropertyControls = ({
  animation,
  onAnimationUpdate,
  rebuildAnimationForThirdOrderCycle,
}: PatternPropertyControlOptions) => {
  const conceptsStore = useConceptsStore()
  const {
    vtgTwistMode,
    vtgTwistValues,
    vtgThirdOrderSettings,
    vtgThirdOrderMirror,
    vtgThirdOrderOpposed,
    vtgFoldValues,
    vtgFoldValuesMaterialized,
    vtgFoldMode,
    vtgFoldBeat,
    vtgFoldRepeat,
    vtgFoldEvery,
    vtgFoldAlternate,
    vtgFoldSpan,
    vtgFoldMirror,
    vtgActiveProperty,
  } = storeToRefs(conceptsStore)

  const vtgThirdOrderDisplaySettings = computed<VtgThirdOrderDisplaySettings>(() =>
    animation.value
      ? getVtgThirdOrderDisplaySettings(animation.value, vtgThirdOrderSettings.value)
      : { initial: [undefined, undefined], strength: [100, 100], timing: [undefined, undefined] },
  )

  const emitPropertyAnimation = (rebuildThirdOrderCycle = false) => {
    if (!animation.value) return
    const source = rebuildThirdOrderCycle
      ? (rebuildAnimationForThirdOrderCycle?.(conceptsStore.getVtgPropertyCycleCount()) ??
        animation.value)
      : animation.value
    onAnimationUpdate(conceptsStore.applyVtgPropertyControls(source))
  }

  const getSimpleFoldSources = () =>
    deriveVtgFoldSimpleSources(
      vtgFoldValues.value,
      vtgFoldBeat.value,
      vtgFoldSpan.value,
      vtgFoldValuesMaterialized.value,
    )

  const materializeSimpleFoldValues = (sources = getSimpleFoldSources()) => {
    if (!animation.value) return
    vtgFoldValues.value = extractVtgFoldValues(
      applyVtgFoldSettings(animation.value, sources, {
        mode: 'simple',
        beat: vtgFoldBeat.value,
        repeat: vtgFoldRepeat.value,
        every: vtgFoldEvery.value,
        alternate: vtgFoldAlternate.value,
        span: vtgFoldSpan.value,
        mirror: vtgFoldMirror.value,
      }),
    )
    vtgFoldValuesMaterialized.value = true
  }

  const updateTwistSetting = (propIndex: 0 | 1, beat: number, value?: number) => {
    conceptsStore.setVtgTwistValue(propIndex, beat, value)
    emitPropertyAnimation()
  }

  const updateTwistMode = (mode: VtgTwistMode) => {
    vtgTwistMode.value = mode
    emitPropertyAnimation()
  }

  const updateThirdOrderInitial = (propIndex: 0 | 1, value?: VtgThirdOrderInitial) => {
    const previousCycleCount = conceptsStore.getVtgPropertyCycleCount()
    conceptsStore.setVtgThirdOrderInitial(propIndex, value)
    emitPropertyAnimation(previousCycleCount !== conceptsStore.getVtgPropertyCycleCount())
  }

  const updateThirdOrderStrength = (propIndex: 0 | 1, value?: number) => {
    conceptsStore.setVtgThirdOrderStrength(propIndex, value)
    emitPropertyAnimation()
  }

  const updateThirdOrderTiming = (propIndex: 0 | 1, value?: VtgThirdOrderTiming) => {
    const previousCycleCount = conceptsStore.getVtgPropertyCycleCount()
    if (animation.value) {
      vtgThirdOrderSettings.value = updateVtgThirdOrderTimingSetting(
        animation.value,
        vtgThirdOrderSettings.value,
        propIndex,
        value,
      )
    } else {
      if (value === undefined) {
        conceptsStore.setVtgThirdOrderInitial(propIndex)
        conceptsStore.setVtgThirdOrderStrength(propIndex)
      }
      conceptsStore.setVtgThirdOrderTiming(propIndex, value)
    }
    emitPropertyAnimation(previousCycleCount !== conceptsStore.getVtgPropertyCycleCount())
  }

  const updateThirdOrderMirror = (mirror: boolean) => {
    const previousCycleCount = conceptsStore.getVtgPropertyCycleCount()
    if (!mirror && vtgThirdOrderMirror.value && animation.value) {
      vtgThirdOrderSettings.value = extractVtgThirdOrderSettings(animation.value)
    }
    vtgThirdOrderMirror.value = mirror
    if (!mirror) vtgThirdOrderOpposed.value = false
    emitPropertyAnimation(previousCycleCount !== conceptsStore.getVtgPropertyCycleCount())
  }

  const updateThirdOrderOpposed = (opposed: boolean) => {
    if (!vtgThirdOrderMirror.value) return
    vtgThirdOrderOpposed.value = opposed
    emitPropertyAnimation()
  }

  const updateFoldSetting = (
    propIndex: 0 | 1,
    beat: number,
    fold: keyof VtgFoldValue,
    value?: number,
  ) => {
    if (vtgFoldMode.value === 'simple') {
      const sources = getSimpleFoldSources()
      const source = sources[propIndex][String(beat)] ?? {}
      if (value === undefined) delete source[fold]
      else source[fold] = value
      if (source.yaw === undefined && source.rotate === undefined) {
        delete sources[propIndex][String(beat)]
      } else sources[propIndex][String(beat)] = source
      materializeSimpleFoldValues(sources)
    } else {
      conceptsStore.setVtgFoldValue(propIndex, beat, fold, value)
      vtgFoldValuesMaterialized.value = true
    }
    emitPropertyAnimation()
  }

  const updateFoldMode = (mode: VtgFoldMode) => {
    if (vtgFoldMode.value === 'simple' && mode === 'advanced') materializeSimpleFoldValues()
    vtgFoldMode.value = mode
    emitPropertyAnimation()
  }

  const updateFoldBeat = (propIndex: 0 | 1, beat: number) => {
    const sources = getSimpleFoldSources()
    const previousBeat = vtgFoldBeat.value[propIndex]
    const source = sources[propIndex][String(previousBeat)]
    vtgFoldBeat.value = updateVtgMirroredSideSetting(
      vtgFoldBeat.value,
      propIndex,
      beat,
      vtgFoldMirror.value,
    )
    delete sources[propIndex][String(previousBeat)]
    if (source) sources[propIndex][String(beat)] = source
    materializeSimpleFoldValues(sources)
    emitPropertyAnimation()
  }

  const updateFoldRepeat = (propIndex: 0 | 1, repeat: boolean) => {
    const sources = getSimpleFoldSources()
    vtgFoldRepeat.value = updateVtgMirroredSideSetting(
      vtgFoldRepeat.value,
      propIndex,
      repeat,
      vtgFoldMirror.value,
    )
    if (!repeat) vtgFoldAlternate.value[propIndex] = false
    materializeSimpleFoldValues(sources)
    emitPropertyAnimation()
  }

  const updateFoldEvery = (propIndex: 0 | 1, every: number) => {
    const sources = getSimpleFoldSources()
    vtgFoldEvery.value = updateVtgMirroredSideSetting(
      vtgFoldEvery.value,
      propIndex,
      every,
      vtgFoldMirror.value,
    )
    materializeSimpleFoldValues(sources)
    emitPropertyAnimation()
  }

  const updateFoldAlternate = (propIndex: 0 | 1, alternate: boolean) => {
    const sources = getSimpleFoldSources()
    vtgFoldAlternate.value = updateVtgMirroredSideSetting(
      vtgFoldAlternate.value,
      propIndex,
      alternate,
      vtgFoldMirror.value,
    )
    materializeSimpleFoldValues(sources)
    emitPropertyAnimation()
  }

  const updateFoldSpan = (span: VtgFoldSpan) => {
    const sources = getSimpleFoldSources()
    vtgFoldSpan.value = span
    materializeSimpleFoldValues(sources)
    emitPropertyAnimation()
  }

  const updateFoldMirror = (mirror: boolean) => {
    const sources = getSimpleFoldSources()
    vtgFoldMirror.value = mirror
    if (mirror) {
      vtgFoldBeat.value[1] = vtgFoldBeat.value[0]
      vtgFoldRepeat.value[1] = vtgFoldRepeat.value[0]
      vtgFoldEvery.value[1] = vtgFoldEvery.value[0]
      vtgFoldAlternate.value[1] = vtgFoldAlternate.value[0]
    }
    materializeSimpleFoldValues(sources)
    emitPropertyAnimation()
  }

  return {
    vtgTwistMode,
    vtgTwistValues,
    vtgThirdOrderSettings,
    vtgThirdOrderDisplaySettings,
    vtgThirdOrderMirror,
    vtgThirdOrderOpposed,
    vtgFoldValues,
    vtgFoldValuesMaterialized,
    vtgFoldMode,
    vtgFoldBeat,
    vtgFoldRepeat,
    vtgFoldEvery,
    vtgFoldAlternate,
    vtgFoldSpan,
    vtgFoldMirror,
    vtgActiveProperty,
    updateTwistSetting,
    updateTwistMode,
    updateThirdOrderInitial,
    updateThirdOrderStrength,
    updateThirdOrderTiming,
    updateThirdOrderMirror,
    updateThirdOrderOpposed,
    updateFoldSetting,
    updateFoldMode,
    updateFoldBeat,
    updateFoldRepeat,
    updateFoldEvery,
    updateFoldAlternate,
    updateFoldSpan,
    updateFoldMirror,
  }
}
