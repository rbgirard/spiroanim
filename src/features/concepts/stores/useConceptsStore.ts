import { conceptKeys } from '@/features/concepts/types'
import type { ConceptKey } from '@/features/concepts/types'
import {
  vtgBpmControl,
  vtgPlayerSettings,
  vtgScaleControl,
  vtgSpacingControl,
  vtgThickControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import { isVtgSpeedRatio, vtgDefaultSpeedRatio, vtgPatternOrientations } from '@/features/vtg/types'
import type { VtgPatternOrientation, VtgSpeedRatio } from '@/features/vtg/types'
import type { PropInd } from '@/types/AnimTypes'
import type { RootDataFinal } from '@/types/AnimTypes'
import { COLORS, PROPSR } from '@/domain/animation/AnimStruct'
import { isTouchDevice } from '@/utils/device'
import {
  defaultPatternPropColors,
  type PatternPropColor,
} from '@/features/concepts/patternPropColors'
import { detectVtgTwistMode, extractVtgTwistValues } from '@/features/vtg/applyVtgTwistSettings'
import {
  detectVtgFoldSimpleSettings,
  extractVtgFoldValues,
} from '@/features/vtg/applyVtgFoldSettings'
import {
  detectVtgThirdOrderRelationship,
  extractVtgThirdOrderSettings,
  updateVtgThirdOrderSettings,
  type VtgThirdOrderInitial,
  type VtgThirdOrderSettings,
  type VtgThirdOrderTiming,
} from '@/features/vtg/thirdOrder'
import {
  applyVtgPropertySettings,
  createDefaultVtgPropertySettings,
  getVtgPropertyCycleCount as getVtgPropertySettingsCycleCount,
  type VtgPropertySettings,
} from '@/features/vtg/propertySettings'

const defaultQuickSlotCount = 0
const restoredQuickSlotCount = 4
const createEmptyQuickSlots = (count: number) => Array<string | null>(count).fill(null)

export interface QuickSlotSet {
  id: string
  name: string
  paths: Array<string | null>
  selectedSlot: number | null
}

export type {
  VtgFoldMode,
  VtgFoldSideSettings,
  VtgFoldSpan,
  VtgFoldValue,
  VtgFoldValues,
  VtgPropertyKey,
  VtgTwistMode,
  VtgTwistValues,
} from '@/features/vtg/propertyTypes'
import type {
  VtgFoldMode,
  VtgFoldSideSettings,
  VtgFoldSpan,
  VtgFoldValue,
  VtgFoldValues,
  VtgPropertyKey,
  VtgTwistMode,
  VtgTwistValues,
} from '@/features/vtg/propertyTypes'

const quickSlotSetIdPrefix = 'quick-slot-set-'
const defaultQuickSlotSetName = (number: number) => `Quick Slot Set #${number}`
const copyQuickSlotPaths = (paths: Array<string | null>) => [...paths]

export const useConceptsStore = defineStore(
  'sa-concepts',
  () => {
    const propertyDefaults = createDefaultVtgPropertySettings()
    const selectedConcept = ref<ConceptKey>('vtg')
    const quickSlotCount = ref(defaultQuickSlotCount)
    const selectedQuickSlot = ref<number | null>(null)
    const quickSlotPaths = ref<Array<string | null>>(createEmptyQuickSlots(defaultQuickSlotCount))
    const quickSlotSets = ref<QuickSlotSet[]>([])
    const selectedQuickSlotSetId = ref<string | null>(null)
    const nextQuickSlotSetId = ref(1)
    const vtgAdvanced = ref(false)
    const qtrEnabled = ref(false)
    const speedRatio = ref<VtgSpeedRatio>(vtgDefaultSpeedRatio)
    const swapProps = ref(false)
    const reversePlane = ref(false)
    const orientation = ref<VtgPatternOrientation>(0)
    const bpm = ref<number>(vtgBpmControl.default)
    const scale = ref<number>(vtgScaleControl.default)
    const thick = ref<number>(vtgThickControl.default)
    const spacing = ref<number>(vtgSpacingControl.default)
    const paths = ref<boolean>(vtgPlayerSettings.paths)
    const hands = ref<boolean>(vtgPlayerSettings.hands)
    const arms = ref<boolean>(vtgPlayerSettings.arms)
    const leftPropVisible = ref(true)
    const rightPropVisible = ref(true)
    const customizeExpanded = ref(false)
    const classicLayout = ref(true)
    const elementalLayout = ref(false)
    const leftPropColor = ref<PatternPropColor>(defaultPatternPropColors[0])
    const rightPropColor = ref<PatternPropColor>(defaultPatternPropColors[1])
    const prop = ref<PropInd>(2)
    const sliders = ref(!isTouchDevice())
    const vtgTwistMode = ref<VtgTwistMode>(propertyDefaults.twist.mode)
    const vtgTwistValues = ref<VtgTwistValues>(propertyDefaults.twist.values)
    const vtgThirdOrderSettings = ref<VtgThirdOrderSettings>(propertyDefaults.thirdOrder.settings)
    const vtgThirdOrderMirror = ref(propertyDefaults.thirdOrder.mirror)
    const vtgThirdOrderOpposed = ref(propertyDefaults.thirdOrder.opposed)
    const vtgFoldValues = ref<VtgFoldValues>(propertyDefaults.fold.values)
    const vtgFoldValuesMaterialized = ref(propertyDefaults.fold.valuesMaterialized)
    const vtgFoldMode = ref<VtgFoldMode>(propertyDefaults.fold.mode)
    const vtgFoldBeat = ref<VtgFoldSideSettings<number>>(propertyDefaults.fold.beat)
    const vtgFoldRepeat = ref<VtgFoldSideSettings<boolean>>(propertyDefaults.fold.repeat)
    const vtgFoldEvery = ref<VtgFoldSideSettings<number>>(propertyDefaults.fold.every)
    const vtgFoldAlternate = ref<VtgFoldSideSettings<boolean>>(propertyDefaults.fold.alternate)
    const vtgFoldSpan = ref<VtgFoldSpan>(propertyDefaults.fold.span)
    const vtgFoldMirror = ref(propertyDefaults.fold.mirror)
    const vtgActiveProperty = ref<VtgPropertyKey | null>(null)

    const setVtgTwistValue = (propIndex: 0 | 1, beat: number, value?: number) => {
      const beatKey = String(beat)
      if (value === undefined) delete vtgTwistValues.value[propIndex][beatKey]
      else vtgTwistValues.value[propIndex][beatKey] = value
    }
    const setVtgThirdOrderInitial = (propIndex: 0 | 1, value?: VtgThirdOrderInitial) => {
      vtgThirdOrderSettings.value = updateVtgThirdOrderSettings(
        vtgThirdOrderSettings.value,
        propIndex,
        { initial: value },
      )
    }
    const setVtgThirdOrderStrength = (propIndex: 0 | 1, value?: number) => {
      vtgThirdOrderSettings.value = updateVtgThirdOrderSettings(
        vtgThirdOrderSettings.value,
        propIndex,
        { strength: value },
      )
    }
    const setVtgThirdOrderTiming = (propIndex: 0 | 1, value?: VtgThirdOrderTiming) => {
      vtgThirdOrderSettings.value = updateVtgThirdOrderSettings(
        vtgThirdOrderSettings.value,
        propIndex,
        { timing: value },
      )
    }
    const setVtgFoldValue = (
      propIndex: 0 | 1,
      beat: number,
      fold: keyof VtgFoldValue,
      value?: number,
    ) => {
      const beatKey = String(beat)
      const beatValue = vtgFoldValues.value[propIndex][beatKey] ?? {}
      if (value === undefined) delete beatValue[fold]
      else beatValue[fold] = value
      if (beatValue.yaw === undefined && beatValue.rotate === undefined) {
        delete vtgFoldValues.value[propIndex][beatKey]
      } else vtgFoldValues.value[propIndex][beatKey] = beatValue
    }

    const getVtgPropertySettings = (): VtgPropertySettings => ({
      twist: { mode: vtgTwistMode.value, values: vtgTwistValues.value },
      thirdOrder: {
        settings: vtgThirdOrderSettings.value,
        mirror: vtgThirdOrderMirror.value,
        opposed: vtgThirdOrderOpposed.value,
      },
      fold: {
        values: vtgFoldValues.value,
        valuesMaterialized: vtgFoldValuesMaterialized.value,
        mode: vtgFoldMode.value,
        beat: vtgFoldBeat.value,
        repeat: vtgFoldRepeat.value,
        every: vtgFoldEvery.value,
        alternate: vtgFoldAlternate.value,
        span: vtgFoldSpan.value,
        mirror: vtgFoldMirror.value,
      },
    })

    const applyVtgPropertyControls = (animation: RootDataFinal): RootDataFinal =>
      applyVtgPropertySettings(animation, getVtgPropertySettings())

    const getVtgPropertyCycleCount = (): 1 | 2 =>
      getVtgPropertySettingsCycleCount(getVtgPropertySettings())

    const hydrateVtgPropertyControls = (animation: RootDataFinal) => {
      const twistValues = extractVtgTwistValues(animation)
      vtgTwistValues.value = twistValues
      vtgTwistMode.value = detectVtgTwistMode(twistValues)
      vtgThirdOrderSettings.value = extractVtgThirdOrderSettings(animation)
      const thirdOrderRelationship = detectVtgThirdOrderRelationship(animation)
      vtgThirdOrderMirror.value = thirdOrderRelationship.mirror
      vtgThirdOrderOpposed.value = thirdOrderRelationship.opposed

      const foldValues = extractVtgFoldValues(animation)
      const simple = detectVtgFoldSimpleSettings(animation, foldValues)
      vtgFoldValues.value = foldValues
      vtgFoldValuesMaterialized.value = true
      vtgFoldMode.value = simple ? 'simple' : 'advanced'
      vtgFoldMirror.value = simple?.mirror ?? false
      if (!simple) return
      vtgFoldBeat.value = simple.beat
      vtgFoldRepeat.value = simple.repeat
      vtgFoldEvery.value = simple.every
      vtgFoldAlternate.value = simple.alternate
      vtgFoldSpan.value = simple.span
    }

    const resetPatternControls = () => {
      speedRatio.value = vtgDefaultSpeedRatio
      swapProps.value = false
      reversePlane.value = false
      orientation.value = 0
      bpm.value = vtgBpmControl.default
      scale.value = vtgScaleControl.default
      thick.value = vtgThickControl.default
      spacing.value = vtgSpacingControl.default
      paths.value = vtgPlayerSettings.paths
      hands.value = vtgPlayerSettings.hands
      arms.value = vtgPlayerSettings.arms
      leftPropVisible.value = true
      rightPropVisible.value = true
      leftPropColor.value = defaultPatternPropColors[0]
      rightPropColor.value = defaultPatternPropColors[1]
      const defaults = createDefaultVtgPropertySettings()
      vtgTwistMode.value = defaults.twist.mode
      vtgTwistValues.value = defaults.twist.values
      vtgThirdOrderSettings.value = defaults.thirdOrder.settings
      vtgThirdOrderMirror.value = defaults.thirdOrder.mirror
      vtgThirdOrderOpposed.value = defaults.thirdOrder.opposed
      vtgFoldValues.value = defaults.fold.values
      vtgFoldValuesMaterialized.value = defaults.fold.valuesMaterialized
      vtgFoldMode.value = defaults.fold.mode
      vtgFoldBeat.value = defaults.fold.beat
      vtgFoldRepeat.value = defaults.fold.repeat
      vtgFoldEvery.value = defaults.fold.every
      vtgFoldAlternate.value = defaults.fold.alternate
      vtgFoldSpan.value = defaults.fold.span
      vtgFoldMirror.value = defaults.fold.mirror
      vtgActiveProperty.value = null
      sliders.value = !isTouchDevice()
    }

    const addQuickSlot = () => {
      quickSlotCount.value++
      quickSlotPaths.value.push(null)
    }

    const removeQuickSlot = () => {
      if (quickSlotCount.value <= 0) return

      quickSlotCount.value--
      quickSlotPaths.value.length = quickSlotCount.value
      if (quickSlotCount.value === 0) {
        selectedQuickSlot.value = null
      } else if (selectedQuickSlot.value !== null) {
        selectedQuickSlot.value = Math.min(selectedQuickSlot.value, quickSlotCount.value)
      }
    }

    const replaceQuickSlots = (paths: readonly (string | null)[]) => {
      if (!paths.every((path) => path === null || (typeof path === 'string' && path.length > 0))) {
        return false
      }

      quickSlotCount.value = paths.length
      quickSlotPaths.value = [...paths]
      selectedQuickSlot.value = null
      return true
    }

    const replaceQuickSlotsWithEmpty = (count: number) => {
      if (!Number.isSafeInteger(count) || count < 0) return false
      return replaceQuickSlots(createEmptyQuickSlots(count))
    }

    const restoreQuickSlots = () => {
      replaceQuickSlotsWithEmpty(restoredQuickSlotCount)
    }

    const saveCurrentQuickSlot = (path: string) => {
      if (selectedQuickSlot.value === null) return
      quickSlotPaths.value[selectedQuickSlot.value - 1] = path
    }

    const clearQuickSlot = (slot: number) => {
      if (!Number.isSafeInteger(slot) || slot < 1 || slot > quickSlotCount.value) return
      quickSlotPaths.value[slot - 1] = null
    }

    const toggleQuickSlot = (slot: number) => {
      selectedQuickSlot.value = selectedQuickSlot.value === slot ? null : slot
    }

    const selectQuickSlotForPath = (path: string) => {
      const query = path.split('?', 2)[1]?.split('#', 1)[0]
      if (!query) {
        selectedQuickSlot.value = null
        return
      }

      const selectedPath =
        selectedQuickSlot.value === null
          ? undefined
          : quickSlotPaths.value[selectedQuickSlot.value - 1]
      if (selectedPath?.split('?', 2)[1]?.split('#', 1)[0] === query) return

      const matchingIndex = quickSlotPaths.value.findIndex(
        (quickSlotPath) => quickSlotPath?.split('?', 2)[1]?.split('#', 1)[0] === query,
      )
      selectedQuickSlot.value = matchingIndex === -1 ? null : matchingIndex + 1
    }

    const nextQuickSlotSetName = () => {
      const existingNames = new Set(quickSlotSets.value.map((set) => set.name))
      let number = 1
      while (existingNames.has(defaultQuickSlotSetName(number))) number++
      return defaultQuickSlotSetName(number)
    }

    const snapshotQuickSlots = (id: string, name: string): QuickSlotSet => ({
      id,
      name: name.trim() || nextQuickSlotSetName(),
      paths: copyQuickSlotPaths(quickSlotPaths.value),
      selectedSlot: selectedQuickSlot.value,
    })

    const saveNewQuickSlotSet = (name: string) => {
      const id = `${quickSlotSetIdPrefix}${nextQuickSlotSetId.value++}`
      quickSlotSets.value.push(snapshotQuickSlots(id, name))
      selectedQuickSlotSetId.value = id
      return id
    }

    const overwriteQuickSlotSet = (id: string, name: string) => {
      const index = quickSlotSets.value.findIndex((set) => set.id === id)
      if (index === -1) return false

      quickSlotSets.value[index] = snapshotQuickSlots(id, name)
      selectedQuickSlotSetId.value = id
      return true
    }

    const loadQuickSlotSet = (id: string) => {
      const set = quickSlotSets.value.find((candidate) => candidate.id === id)
      if (!set) return false

      quickSlotCount.value = set.paths.length
      quickSlotPaths.value = copyQuickSlotPaths(set.paths)
      selectedQuickSlot.value =
        set.selectedSlot !== null && set.selectedSlot <= quickSlotCount.value
          ? set.selectedSlot
          : null
      selectedQuickSlotSetId.value = id
      return true
    }

    const deleteQuickSlotSet = (id: string) => {
      const index = quickSlotSets.value.findIndex((set) => set.id === id)
      if (index === -1) return false

      quickSlotSets.value.splice(index, 1)
      if (selectedQuickSlotSetId.value === id) {
        selectedQuickSlotSetId.value =
          quickSlotSets.value[index]?.id ?? quickSlotSets.value.at(-1)?.id ?? null
      }
      return true
    }

    return {
      selectedConcept,
      quickSlotCount,
      selectedQuickSlot,
      quickSlotPaths,
      quickSlotSets,
      selectedQuickSlotSetId,
      nextQuickSlotSetId,
      vtgAdvanced,
      qtrEnabled,
      speedRatio,
      swapProps,
      reversePlane,
      orientation,
      bpm,
      scale,
      thick,
      spacing,
      paths,
      hands,
      arms,
      leftPropVisible,
      rightPropVisible,
      customizeExpanded,
      classicLayout,
      elementalLayout,
      leftPropColor,
      rightPropColor,
      prop,
      sliders,
      vtgTwistMode,
      vtgTwistValues,
      setVtgTwistValue,
      vtgThirdOrderSettings,
      vtgThirdOrderMirror,
      vtgThirdOrderOpposed,
      setVtgThirdOrderInitial,
      setVtgThirdOrderStrength,
      setVtgThirdOrderTiming,
      vtgFoldValues,
      vtgFoldValuesMaterialized,
      setVtgFoldValue,
      applyVtgPropertyControls,
      getVtgPropertySettings,
      getVtgPropertyCycleCount,
      hydrateVtgPropertyControls,
      vtgFoldMode,
      vtgFoldBeat,
      vtgFoldRepeat,
      vtgFoldEvery,
      vtgFoldAlternate,
      vtgFoldSpan,
      vtgFoldMirror,
      vtgActiveProperty,
      resetPatternControls,
      addQuickSlot,
      removeQuickSlot,
      replaceQuickSlots,
      replaceQuickSlotsWithEmpty,
      restoreQuickSlots,
      saveCurrentQuickSlot,
      clearQuickSlot,
      toggleQuickSlot,
      selectQuickSlotForPath,
      nextQuickSlotSetName,
      saveNewQuickSlotSet,
      overwriteQuickSlotSet,
      loadQuickSlotSet,
      deleteQuickSlotSet,
    }
  },
  {
    persist: {
      pick: [
        'selectedConcept',
        'quickSlotCount',
        'selectedQuickSlot',
        'quickSlotPaths',
        'quickSlotSets',
        'selectedQuickSlotSetId',
        'nextQuickSlotSetId',
        'vtgAdvanced',
        'qtrEnabled',
        'speedRatio',
        'swapProps',
        'reversePlane',
        'orientation',
        'bpm',
        'scale',
        'thick',
        'spacing',
        'paths',
        'hands',
        'arms',
        'leftPropVisible',
        'rightPropVisible',
        'leftPropColor',
        'rightPropColor',
        'prop',
        'sliders',
        'vtgActiveProperty',
        'customizeExpanded',
        'classicLayout',
        'elementalLayout',
      ],
      afterHydrate: ({ store }) => {
        const hydratedConcept: string = store.selectedConcept
        if (hydratedConcept === 'qtr') {
          store.selectedConcept = 'vtg'
          store.qtrEnabled = true
        }
        if (!conceptKeys.some((concept) => concept === store.selectedConcept)) {
          store.selectedConcept = 'vtg'
        }
        if (typeof store.vtgAdvanced !== 'boolean') store.vtgAdvanced = false
        if (!Number.isSafeInteger(store.quickSlotCount) || store.quickSlotCount < 0) {
          store.quickSlotCount = defaultQuickSlotCount
        }
        if (store.quickSlotCount === 0 || store.selectedQuickSlot === null) {
          store.selectedQuickSlot = null
          // An explicitly cleared selection is valid persisted state.
        } else if (!Number.isSafeInteger(store.selectedQuickSlot) || store.selectedQuickSlot < 1) {
          store.selectedQuickSlot = 1
        } else {
          store.selectedQuickSlot = Math.min(store.selectedQuickSlot, store.quickSlotCount)
        }
        if (!Array.isArray(store.quickSlotPaths)) {
          store.quickSlotPaths = createEmptyQuickSlots(store.quickSlotCount)
        } else {
          store.quickSlotPaths = Array.from({ length: store.quickSlotCount }, (_, index) => {
            const path = store.quickSlotPaths[index]
            return typeof path === 'string' && path.length > 0 ? path : null
          })
        }
        if (!Array.isArray(store.quickSlotSets)) {
          store.quickSlotSets = []
        } else {
          store.quickSlotSets = store.quickSlotSets.flatMap((set: QuickSlotSet) => {
            if (
              typeof set?.id !== 'string' ||
              typeof set.name !== 'string' ||
              !Array.isArray(set.paths)
            )
              return []
            const paths = set.paths.map((path) =>
              typeof path === 'string' && path.length > 0 ? path : null,
            )
            const selectedSlot =
              Number.isSafeInteger(set.selectedSlot) &&
              set.selectedSlot !== null &&
              set.selectedSlot >= 1 &&
              set.selectedSlot <= paths.length
                ? set.selectedSlot
                : null
            return [{ id: set.id, name: set.name.trim() || 'Quick Slot Set', paths, selectedSlot }]
          })
        }
        if (
          typeof store.selectedQuickSlotSetId !== 'string' ||
          !store.quickSlotSets.some((set: QuickSlotSet) => set.id === store.selectedQuickSlotSetId)
        ) {
          store.selectedQuickSlotSetId = null
        }
        const nextIdAfterHydratedSets = store.quickSlotSets.reduce(
          (highest: number, set: QuickSlotSet) => {
            const numericId = Number(set.id.slice(quickSlotSetIdPrefix.length))
            return set.id.startsWith(quickSlotSetIdPrefix) && Number.isSafeInteger(numericId)
              ? Math.max(highest, numericId + 1)
              : highest
          },
          1,
        )
        store.nextQuickSlotSetId =
          Number.isSafeInteger(store.nextQuickSlotSetId) && store.nextQuickSlotSetId >= 1
            ? Math.max(store.nextQuickSlotSetId, nextIdAfterHydratedSets)
            : nextIdAfterHydratedSets
        if (!isVtgSpeedRatio(store.speedRatio)) {
          store.speedRatio = vtgDefaultSpeedRatio
        }
        if (!vtgPatternOrientations.includes(store.orientation)) store.orientation = 0
        if (
          !Number.isInteger(store.bpm) ||
          store.bpm < vtgBpmControl.min ||
          store.bpm > vtgBpmControl.max
        ) {
          store.bpm = vtgBpmControl.default
        }
        if (
          typeof store.scale !== 'number' ||
          !Number.isFinite(store.scale) ||
          store.scale < vtgScaleControl.min ||
          store.scale > vtgScaleControl.max
        ) {
          store.scale = vtgScaleControl.default
        }
        if (
          !Number.isInteger(store.thick) ||
          store.thick < vtgThickControl.min ||
          store.thick > vtgThickControl.max
        ) {
          store.thick = vtgThickControl.default
        }
        if (
          !Number.isInteger(store.spacing) ||
          store.spacing < vtgSpacingControl.min ||
          store.spacing > vtgSpacingControl.max
        ) {
          store.spacing = vtgSpacingControl.default
        }
        if (typeof store.paths !== 'boolean') store.paths = vtgPlayerSettings.paths
        if (typeof store.hands !== 'boolean') store.hands = vtgPlayerSettings.hands
        if (typeof store.arms !== 'boolean') store.arms = vtgPlayerSettings.arms
        if (typeof store.leftPropVisible !== 'boolean') store.leftPropVisible = true
        if (typeof store.rightPropVisible !== 'boolean') store.rightPropVisible = true
        if (!store.leftPropVisible && !store.rightPropVisible) store.rightPropVisible = true
        if (!COLORS.includes(store.leftPropColor)) {
          store.leftPropColor = defaultPatternPropColors[0]
        }
        if (!COLORS.includes(store.rightPropColor)) {
          store.rightPropColor = defaultPatternPropColors[1]
        }
        if (!Number.isInteger(store.prop) || store.prop < 0 || store.prop >= PROPSR.length) {
          store.prop = 2
        }
        if (typeof store.sliders !== 'boolean') store.sliders = !isTouchDevice()
        if (
          !['offset', 'axis', 'twist', 'turns', 'third-order', null].includes(
            store.vtgActiveProperty,
          )
        ) {
          store.vtgActiveProperty = null
        }
        if (typeof store.customizeExpanded !== 'boolean') store.customizeExpanded = false
        if (typeof store.classicLayout !== 'boolean') store.classicLayout = true
        if (typeof store.elementalLayout !== 'boolean') store.elementalLayout = false
      },
    },
  },
)
