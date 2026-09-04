<template>
  <section
    ref="paneElement"
    class="vtg-pane"
    :class="{
      'vtg-pane--touch': touchDevice,
      'vtg-pane--builder-active': compactBuilder,
      'vtg-pane--builder-drag-active': builderActive,
      'vtg-pane--classic': usesClassicLayout,
    }"
    aria-labelledby="vtg-pane-title"
    data-role="vtg-pane"
    :data-blank-width="blankWidth"
    :data-blank-height="blankHeight"
    :data-selected-cell="selectedCellReference"
    :data-speed-ratio="speedRatio"
    data-concept="vtg"
  >
    <h1 id="vtg-pane-title" class="vtg-pane__visually-hidden">VTG generator</h1>

    <div class="vtg-top-options">
      <fieldset class="vtg-speed-ratio">
        <legend class="vtg-pane__visually-hidden">Speed ratio</legend>
        <div v-if="!moreRatios" class="vtg-radio-options">
          <div v-for="(ratios, rowIndex) in speedRatioRows" :key="rowIndex" class="vtg-radio-row">
            <AppTooltip v-for="ratio in ratios" :key="ratio" :text="`Use the ${ratio} speed ratio`">
              <template #activator="{ props: activatorProps }">
                <label v-bind="activatorProps">
                  <input
                    v-model="speedRatio"
                    type="radio"
                    name="vtg-speed-ratio"
                    :value="ratio"
                    :aria-label="`Use the ${ratio} speed ratio`"
                  />
                  <span>{{ ratio }}</span>
                </label>
              </template>
            </AppTooltip>
          </div>
        </div>
        <div v-else class="vtg-ratio-selects">
          <label class="vtg-ratio-select">
            <span class="vtg-ratio-select__label">Left:</span>
            <AppTooltip text="Choose the timing ratio for the left prop">
              <template #activator="{ props: activatorProps }">
                <select
                  v-bind="activatorProps"
                  v-model="firstPropRatio"
                  aria-label="Left prop timing ratio"
                  @change="applyMoreRatios"
                >
                  <option v-for="ratio in ratioPickerRatios" :key="ratio" :value="ratio">
                    {{ ratio }}
                  </option>
                </select>
              </template>
            </AppTooltip>
          </label>
          <label class="vtg-ratio-select">
            <span class="vtg-ratio-select__label">Right:</span>
            <AppTooltip text="Choose the right prop timing ratio, or none to match the left prop">
              <template #activator="{ props: activatorProps }">
                <select
                  v-bind="activatorProps"
                  v-model="secondPropRatio"
                  aria-label="Right prop timing ratio"
                  @change="applyMoreRatios"
                >
                  <option value="">none</option>
                  <option v-for="ratio in ratioPickerRatios" :key="ratio" :value="ratio">
                    {{ ratio }}
                  </option>
                </select>
              </template>
            </AppTooltip>
          </label>
        </div>
      </fieldset>

      <PatternTransformControls
        v-model:more="moreRatios"
        v-model:classic="classicLayout"
        v-model:elemental="elementalLayout"
        confirm-reset
        show-more
        :show-classic="vtgAdvanced && !compactBuilder"
        show-elemental
        :show-swap="vtgAdvanced && !compactBuilder"
        :show-reverse="vtgAdvanced"
        :reverse-label="isQtr ? 'Flip' : '180°'"
        :reverse-description="
          isQtr ? 'Flip QTR orientation and direction' : 'Rotate floor plane by 180 degrees'
        "
        @reset="resetPatternControls"
      />
    </div>

    <div class="vtg-board">
      <AppTooltip class="vtg-shuffle-tooltip" text="Select a random VTG pattern">
        <template #activator="{ props: activatorProps }">
          <button
            v-bind="activatorProps"
            type="button"
            class="vtg-shuffle"
            aria-label="Shuffle VTG rules"
            data-role="vtg-shuffle"
            @click="selectRandomTile"
          >
            <BaseIcon :path="mdiShuffleVariant" size="42%" />
          </button>
        </template>
      </AppTooltip>

      <div class="vtg-column-headers" data-role="vtg-column-headers">
        <template v-if="usesClassicLayout">
          <VtgRuleCard
            v-for="rule in displayedSideRules"
            :key="`column-${rule.number}`"
            :labels="rule.labels"
            :display-labels="
              isQtr ? qtrSideRuleLabels[rule.sourceNumber ?? rule.number] : undefined
            "
            :number="rule.number"
            :diagram="rule.diagram"
            :description="rule.description"
            :orientation="sideHeaderOrientation"
            :accent="(rule.sourceNumber ?? rule.number) === selectedCell?.row"
            :show-divider="!isQtr"
            :prop-colors="isQtr ? vtgHeaderPropColors : undefined"
            :tooltip-disabled="isQtr"
            :reversed="sideHeaderReversed"
            :mirror-props="!isQtr"
            :diagram-rotation="isQtr ? orientation : 0"
            @select="selectRow(rule.sourceNumber ?? rule.number)"
          />
        </template>
        <VtgRuleCard
          v-else
          v-for="header in displayedColumnRules"
          :key="`column-${header.column}`"
          :labels="header.rule.labels"
          :display-labels="
            hideColumnHeaderDetails ? qtrColumnRuleLabels[header.rule.number] : undefined
          "
          :number="header.column"
          :diagram="header.rule.diagram"
          :description="header.rule.description"
          :orientation="columnHeaderOrientation"
          :accent="header.column === selectedCell?.column"
          :show-divider="!hideColumnHeaderDetails"
          :show-props="!hideColumnHeaderDetails"
          :tooltip-disabled="hideColumnHeaderDetails"
          :mirror-props="!hideColumnHeaderDetails"
          @select="selectColumn(header.column)"
        />
      </div>

      <div class="vtg-sidebar" data-role="vtg-sidebar">
        <template v-if="usesClassicLayout">
          <VtgRuleCard
            v-for="header in classicSideHeaderRules"
            :key="`side-${header.column}`"
            :labels="header.rule.labels"
            :display-labels="
              hideColumnHeaderDetails ? qtrColumnRuleLabels[header.rule.number] : undefined
            "
            :number="header.column"
            :diagram="header.rule.diagram"
            :description="header.rule.description"
            :orientation="columnHeaderOrientation"
            :accent="header.column === selectedCell?.column"
            :show-divider="!hideColumnHeaderDetails"
            :show-props="!hideColumnHeaderDetails"
            :tooltip-disabled="hideColumnHeaderDetails"
            :mirror-props="!hideColumnHeaderDetails"
            @select="selectColumn(header.column)"
          />
        </template>
        <VtgRuleCard
          v-else
          v-for="rule in displayedSideRules"
          :key="`side-${rule.number}`"
          :labels="rule.labels"
          :display-labels="
            compactBuilder
              ? qtrSideRuleLabels[rule.sourceNumber ?? rule.number]
              : isQtr
                ? qtrSideRuleLabels[rule.sourceNumber ?? rule.number]
                : undefined
          "
          :number="rule.number"
          :diagram="rule.diagram"
          :description="rule.description"
          :orientation="sideHeaderOrientation"
          :accent="(rule.sourceNumber ?? rule.number) === selectedCell?.row"
          :show-divider="!isQtr && !compactBuilder"
          :show-props="!compactBuilder"
          :prop-colors="isQtr ? vtgHeaderPropColors : undefined"
          :tooltip-disabled="isQtr || compactBuilder"
          :reversed="sideHeaderReversed"
          :mirror-props="!isQtr"
          :diagram-rotation="isQtr ? orientation : 0"
          @select="selectRow(rule.sourceNumber ?? rule.number)"
        />
      </div>

      <div class="vtg-matrix" data-role="vtg-matrix">
        <div class="vtg-tile-grid">
          <BaseTooltip
            v-for="tile in matrixTiles"
            :key="tile.reference"
            class="vtg-tile-tooltip"
            :text="getTileDescription(tile)"
            :style="getTileGridStyle(tile)"
          >
            <template #activator="{ props: activatorProps }">
              <button
                v-bind="activatorProps"
                type="button"
                class="vtg-tile"
                :class="getTileClasses(tile)"
                :aria-label="`${getTileAccessibleLabel(tile)}, cell ${displayCellReference(tile)}`"
                :aria-pressed="tile.reference === selectedCellReference"
                :data-board-column="getTileBoardColumn(tile)"
                :data-board-row="getTileBoardRow(tile)"
                :data-cell-reference="displayCellReference(tile)"
                data-role="vtg-tile"
                :draggable="builderActive && !touchDevice"
                @click="selectTile(tile)"
                @dragstart="startBuilderDrag(tile, $event)"
                @pointerdown="startBuilderPointerDrag(tile, $event)"
                @pointermove="moveBuilderPointerDrag"
                @pointerup="finishBuilderPointerDrag"
                @pointercancel="cancelBuilderPointerDrag"
                @lostpointercapture="cancelBuilderPointerDrag"
              >
                <span class="vtg-tile__label" :style="getTileLabelSwapStyle(tile)">
                  <Transition name="vtg-label-swap">
                    <span
                      v-if="elementalLayout"
                      key="elemental"
                      class="vtg-tile__label-text vtg-tile__elements"
                    >
                      <span v-if="compactBuilder">{{ getBuilderSpinLabel(tile) }} /</span>
                      <ElementalRelationshipIcons
                        responsive
                        :hands="tile.hands"
                        :props="tile.props"
                        :hands-indeterminate="tile.handsIndeterminate"
                        :props-indeterminate="tile.propsIndeterminate"
                      />
                    </span>
                    <span v-else key="classic" class="vtg-tile__label-text">{{ tile.label }}</span>
                  </Transition>
                </span>
              </button>
              <AppTooltip
                v-if="tile.reference === selectedCellReference && isSpinToggleCell(tile.reference)"
                class="vtg-spin-toggle-tooltip"
                :text="`Use the ${isAnti ? 'Spin' : 'Anti'} variant for this cell`"
              >
                <template #activator="{ props: controlActivatorProps }">
                  <button
                    v-bind="controlActivatorProps"
                    type="button"
                    class="vtg-tile__spin-toggle"
                    :class="getSpinTogglePositionClasses(tile)"
                    :aria-label="`Use ${isAnti ? 'Spin' : 'Anti'} pattern for cell ${tile.reference}`"
                    :aria-pressed="isAnti"
                    data-role="vtg-spin-toggle"
                    @click.stop="toggleSpinDirection(tile)"
                  >
                    {{ isAnti ? 'Anti' : 'Spin' }}
                  </button>
                </template>
              </AppTooltip>
            </template>
            <template #html>
              <span class="vtg-tile-tooltip__text">{{ getTileDescription(tile) }}</span>
            </template>
          </BaseTooltip>
        </div>

        <div class="vtg-blank-grid">
          <div
            v-for="preview in displayedPreviews"
            :key="`blank-${preview.reference}`"
            class="vtg-blank"
            :class="{ 'vtg-blank--paired': usesPairedPreviewLayout }"
            :style="preview.style"
            data-role="vtg-blank"
            :data-blank-index="preview.rendererIndex"
            :data-width="blankDimensions[preview.rendererIndex]?.width"
            :data-height="blankDimensions[preview.rendererIndex]?.height"
            aria-hidden="true"
          >
            <img
              v-if="previewUrls[preview.rendererIndex]"
              :src="previewUrls[preview.rendererIndex]"
              alt=""
              class="vtg-blank__preview"
              data-role="vtg-preview"
              :data-preview-reference="preview.reference"
            />
          </div>
        </div>
      </div>
    </div>

    <ConceptAnimationControls :animation="animation">
      <template #before-controls="{ beginSliderHistory, endSliderHistory }">
        <PatternPlaybackControls
          v-if="vtgAdvanced && (!builderActive || builderFullCatalogForced)"
          v-model:beat="beat"
          v-model:qtr="isQtr"
          v-model:orientation="orientation"
          concept="vtg"
          :speed-ratio="speedRatio"
          :orientation-options="availablePatternOrientations"
          :show-orientation="!builderActive || builderFullCatalogForced"
          @slider-start="beginSliderHistory"
          @slider-end="endSliderHistory"
        />
      </template>
      <template #between-controls>
        <template v-if="vtgAdvanced && !builderActive">
          <PatternTransitionControls
            v-model:transition="transition"
            v-model:after-beat="transitionAfterBeat"
            v-model:beats="transitionBeats"
            v-model:quad="transitionQuad"
            v-model:second="transitionSecond"
            :q-slots-warning-required="hasPopulatedQuickSlots"
            @q-slots="createQSlots"
          />
        </template>
        <label v-if="builderActive && !builderFullCatalogForced" class="vtg-pattern-builder-button">
          <input
            type="checkbox"
            :checked="builderFullGrid"
            data-role="vtg-builder-full-grid"
            @change="emit('update:builderFullGrid', ($event.target as HTMLInputElement).checked)"
          />
          <span>Full Grid</span>
        </label>
        <div class="vtg-pattern-builder-actions">
          <PatternWorkspaceToggle
            label="Pattern Builder"
            control-role="vtg-pattern-builder"
            :checked="builderActive"
            grouped
            @toggle="emit('builderOpen', 'manual')"
          />
          <label class="vtg-pattern-builder-button vtg-pattern-builder-button--advanced">
            <input v-model="vtgAdvanced" type="checkbox" data-role="vtg-advanced" />
            <span>Advanced</span>
          </label>
        </div>
        <p
          v-if="!builderActive && quickSlotCreationError"
          class="vtg-transition-quick-slot-error"
          data-role="vtg-transition-qslots-error"
          role="alert"
        >
          {{ quickSlotCreationError }}
        </p>
        <p
          v-if="!builderActive && showStaticPropsTransitionNote"
          class="vtg-transition-static-note"
          data-role="vtg-transition-static-note"
        >
          Some or all of these 45° Transitions may only work with Static Props in the current ratio
          selection.
        </p>
      </template>
      <template #before-customize>
        <PatternPropertyControls
          v-if="vtgAdvanced && !builderActive"
          context="vtg"
          :show-turns="showVtgTurns"
          :animation="animation"
          :offset-values="propRotationOffsets"
          :twist-mode="vtgTwistMode"
          :twist-values="vtgTwistValues"
          :third-order-settings="vtgThirdOrderSettings"
          :third-order-display-settings="vtgThirdOrderDisplaySettings"
          :third-order-mirror="vtgThirdOrderMirror"
          :third-order-opposed="vtgThirdOrderOpposed"
          :fold-values="vtgFoldValues"
          :fold-values-materialized="vtgFoldValuesMaterialized"
          :fold-mode="vtgFoldMode"
          :fold-beat="vtgFoldBeat"
          :fold-repeat="vtgFoldRepeat"
          :fold-every="vtgFoldEvery"
          :fold-alternate="vtgFoldAlternate"
          :fold-span="vtgFoldSpan"
          :fold-mirror="vtgFoldMirror"
          :active-property="vtgActiveProperty"
          :sliders="sliders"
          @offset-update="updatePropRotationOffset"
          @twist-update="updateTwistSetting"
          @third-order-initial-update="updateThirdOrderInitial"
          @third-order-strength-update="updateThirdOrderStrength"
          @third-order-timing-update="updateThirdOrderTiming"
          @update:third-order-mirror="updateThirdOrderMirror"
          @update:third-order-opposed="updateThirdOrderOpposed"
          @fold-update="updateFoldSetting"
          @update:twist-mode="updateTwistMode"
          @update:fold-mode="updateFoldMode"
          @update:fold-beat="updateFoldBeat"
          @update:fold-repeat="updateFoldRepeat"
          @update:fold-every="updateFoldEvery"
          @update:fold-alternate="updateFoldAlternate"
          @update:fold-span="updateFoldSpan"
          @update:fold-mirror="updateFoldMirror"
          @update:active-property="updateVtgActiveProperty"
        />
      </template>
    </ConceptAnimationControls>
  </section>
</template>

<script setup lang="ts">
import { mdiShuffleVariant } from '@mdi/js'

import BaseIcon from '@/components/icons/BaseIcon.vue'
import ElementalRelationshipIcons from '@/features/concepts/components/ElementalRelationshipIcons.vue'
import AppTooltip from '@/components/AppTooltip.vue'
import BaseTooltip from '@/components/ui/BaseTooltip.vue'
import PatternPropertyControls from '@/components/pattern/PatternPropertyControls.vue'
import { COLORS, COLSET, PROPSR } from '@/domain/animation/AnimStruct'
import ConceptAnimationControls from '@/features/concepts/components/ConceptAnimationControls.vue'
import PatternPlaybackControls from '@/features/concepts/components/PatternPlaybackControls.vue'
import PatternTransitionControls from '@/features/concepts/components/PatternTransitionControls.vue'
import PatternWorkspaceToggle from '@/features/concepts/components/PatternWorkspaceToggle.vue'
import PatternTransformControls from '@/features/concepts/components/PatternTransformControls.vue'
import { usePatternPropertyControls } from '@/features/concepts/composables/usePatternPropertyControls'
import {
  describePatternSelectionRelationshipsAcrossBeats,
  inferPatternRelationshipOrientation,
  inferPatternRelationshipPropRotationOffsets,
} from '@/features/concepts/math/describePatternSelectionRelationships'
import type { PatternRelationshipLabel } from '@/features/concepts/math/describePatternRelationships'
import { isPatternPropVisible } from '@/features/concepts/patternPropVisibility'
import { defaultPatternPropColors } from '@/features/concepts/patternPropColors'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import type { VtgPropertyKey } from '@/features/concepts/stores/useConceptsStore'
import {
  relationshipElement,
  type ElementalRelationship,
} from '@/features/concepts/elementalRelationships'
import type { ConceptPatternSelection } from '@/features/concepts/types'
import {
  builderPatternPointerDropEvent,
  builderPatternPointerEndEvent,
  builderPatternPointerMoveEvent,
  createBuilderPatternPointerEvent,
} from '@/features/builder/patternPointerDrag'
import type { BuilderPatternPointerPreview } from '@/features/builder/patternPointerDrag'
import { builderPatternDragType } from '@/features/builder/types'
import {
  describeVtgBuilderMotion,
  describeVtgBuilderMotionLabel,
  type VtgBuilderMotionLabel,
} from '@/features/builder/describeVtgBuilderMotion'
import { qtrColumnRuleLabels, qtrSideRuleLabels } from '@/features/vtg/qtr/data/qtrLabels'
import { createDefaultQtrAnimation } from '@/features/vtg/qtr/createQtrAnimation'
import { exactlyMatchesQtrSelection } from '@/features/vtg/qtr/matchQtrAnimation'
import {
  createDefaultVtgAnimation,
  createVtgAnimation,
  toVtgPreviewAnimation,
} from '@/features/vtg/createVtgAnimation'
import { createVtgBuilderDropPreview } from '@/features/builder/createVtgBuilderDropPreview'
import { createVtgPreviewCandidate } from '@/features/concepts/createVtgPreviewCandidate'
import { describeVtgBuilderPreviewRelationship } from '@/features/builder/describeVtgBuilderPreviewRelationships'
import { exactlyMatchesVtgSelection } from '@/features/vtg/matchVtgAnimation'
import { stripVtgPropertySettings } from '@/features/vtg/stripVtgPropertySettings'
import { createQtrSideDiagram, vtgPropBounds } from '@/features/vtg/qtr/math/createQtrHeaderDiagram'
import VtgRuleCard from '@/features/vtg/components/VtgRuleCard.vue'
import {
  builderPatternPreviewReferences,
  pairedPatternPreviewReferences,
  patternPreviewReferences,
  usePatternPreviews,
} from '@/features/concepts/composables/usePatternPreviews'
import {
  vtgBpmControl,
  vtgPlayerSettings,
  vtgPropSettings,
  vtgScaleControl,
  vtgSpacingControl,
  vtgThickControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import { getVtgTopHeaderRule } from '@/features/vtg/data/vtgTopHeaderRules'
import type {
  QtrPatternSelection,
  VtgCellAddress,
  VtgBeat,
  VtgCellReference,
  VtgPropPlacement,
  VtgRuleDiagram,
  VtgRuleNumber,
  VtgRuleSpec,
  VtgPatternSelection,
  VtgPatternOrientation,
  VtgTransitionInitialTurnsOffset,
  VtgTransitionBeats,
  VtgIndividualSpeedRatio,
  VtgSpeedRatio,
} from '@/features/vtg/types'
import {
  formatVtgSpeedRatio,
  getVtgBeats,
  getVtgPropSpeedRatios,
  getDefaultVtgPatternOrientation,
  getVtgTimingCycleCount,
  getVtgPatternOrientations,
  requiresPairedVtgPreviewLayout,
  vtgDefaultTransitionBeats,
  vtgRatioPickerRatios,
  vtgSpeedRatioRows,
} from '@/features/vtg/types'
import {
  createVtgTransitionPreviewAnimations,
  createVtgTransitionQuickSlotAnimationCandidates,
  resolveVtgTransitionQuickSlotAnimations,
} from '@/features/vtg/math/createVtgTransitionQuickSlotAnimations'
import { prepareVtg45TransitionPattern } from '@/features/vtg/math/prepareVtg45TransitionPattern'
import { cloneVtgPropertySettings, hasVtgPropertySettings } from '@/features/vtg/propertySettings'
import type { RootDataFinal } from '@/types/AnimTypes'
import { PRODUCTION_PWA_HOSTNAME } from '@/sys/pwaManifest'
import { toColor } from '@/utils/UtilFunc'
import { isTouchDevice } from '@/utils/device'
import type { PatternMatchingClient } from '@/workers/pattern-matching/PatternMatchingWorkerTypes'

interface BlankDimensions {
  width: number
  height: number
}

interface VtgMatrixTile {
  label: PatternRelationshipLabel | VtgBuilderMotionLabel
  description: string
  column: VtgRuleNumber
  row: VtgRuleNumber
  boardColumn: number
  boardRow: number
  reference: VtgCellReference
  hands?: ElementalRelationship
  props?: ElementalRelationship
  handsIndeterminate?: boolean
  propsIndeterminate?: boolean
}

type VtgMatrixAddress = Omit<VtgMatrixTile, 'label' | 'description'>

const props = withDefaults(
  defineProps<{
    animation?: RootDataFinal
    animationRevision?: number
    animationReady?: boolean
    patternMatcher?: PatternMatchingClient
    builderActive?: boolean
    builderFullCatalog?: boolean
    builderFullCatalogForced?: boolean
    builderFullGrid?: boolean
    builderInsertionIndex?: number
    builderMatchAnimation?: RootDataFinal
  }>(),
  {
    animationReady: true,
    builderActive: false,
    builderFullCatalog: false,
    builderFullCatalogForced: false,
    builderFullGrid: false,
  },
)

const emit = defineEmits<{
  patternSelect: [selection: ConceptPatternSelection]
  patternPreview: [selection: ConceptPatternSelection]
  customize: [selection: ConceptPatternSelection]
  quickSlotsCreate: [animations: readonly RootDataFinal[]]
  animationUpdate: [animation: RootDataFinal]
  builderOpen: [source: 'manual' | 'automatic']
  'update:builderFullGrid': [enabled: boolean]
}>()

const showVtgTurns = ref(false)

const basicHiddenSpeedRatios = new Set<VtgSpeedRatio>(['2:1', '1:2', '2:3', '1:4', '2:5'])
const ratioPickerRatios = vtgRatioPickerRatios
const touchDevice = typeof navigator !== 'undefined' && isTouchDevice()
const conceptsStore = useConceptsStore()
const {
  vtgAdvanced,
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
  leftPropColor,
  rightPropColor,
  prop,
  sliders,
  classicLayout,
  elementalLayout,
  qtrEnabled: isQtr,
} = storeToRefs(conceptsStore)
const {
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
} = usePatternPropertyControls({
  animation: toRef(props, 'animation'),
  onAnimationUpdate: (animation) => emit('animationUpdate', animation),
  rebuildAnimationForThirdOrderCycle: (minimumCycleCount) => {
    if (props.builderActive || !props.animation || isQtr.value) return undefined
    const tile = matrixTiles.value.find(({ reference }) => reference === matchedCellReference.value)
    if (!tile) return undefined
    const selection = createPatternSelection(tile)
    return 'quarters' in selection
      ? undefined
      : createVtgAnimation(props.animation, selection, { minimumCycleCount })
  },
})
const isAnti = ref(false)
const speedRatioRows = computed(() =>
  vtgAdvanced.value
    ? vtgSpeedRatioRows
    : vtgSpeedRatioRows
        .map((ratios) => ratios.filter((ratio) => !basicHiddenSpeedRatios.has(ratio)))
        .filter((ratios) => ratios.length > 0),
)
const visibleSpeedRatios = computed<ReadonlySet<VtgSpeedRatio>>(
  () => new Set<VtgSpeedRatio>(speedRatioRows.value.flat()),
)
const updateVtgActiveProperty = (property: VtgPropertyKey | 'scale' | null) => {
  if (property !== 'scale') vtgActiveProperty.value = property
}
const updatePropRotationOffset = (propIndex: 0 | 1, value?: number) => {
  const offsets: [number, number] = [
    propRotationOffsets.value?.[0] ?? 0,
    propRotationOffsets.value?.[1] ?? 0,
  ]
  offsets[propIndex] = value ?? 0
  propRotationOffsets.value = offsets.every((offset) => offset === 0) ? undefined : offsets
}
const initialPropRatios = getVtgPropSpeedRatios(speedRatio.value)
const moreRatios = ref(
  initialPropRatios[0] !== initialPropRatios[1] || !visibleSpeedRatios.value.has(speedRatio.value),
)
const firstPropRatio = ref<VtgIndividualSpeedRatio>(initialPropRatios[0])
const secondPropRatio = ref<VtgIndividualSpeedRatio | ''>(
  initialPropRatios[0] === initialPropRatios[1] ? '' : initialPropRatios[1],
)
const syncMoreRatioControls = (value: VtgSpeedRatio) => {
  const [first, second] = getVtgPropSpeedRatios(value)
  firstPropRatio.value = first
  secondPropRatio.value = first === second ? '' : second
  if (first !== second || !visibleSpeedRatios.value.has(value)) moreRatios.value = true
}
const applyMoreRatios = () => {
  speedRatio.value =
    secondPropRatio.value === ''
      ? firstPropRatio.value
      : formatVtgSpeedRatio(firstPropRatio.value, secondPropRatio.value)
}
watch(moreRatios, (enabled) => {
  if (enabled) syncMoreRatioControls(speedRatio.value)
  else {
    secondPropRatio.value = ''
    speedRatio.value = firstPropRatio.value
  }
})
watch(vtgAdvanced, (enabled) => {
  syncMoreRatioControls(speedRatio.value)
  if (enabled && secondPropRatio.value === '') moreRatios.value = false
})
const beat = ref<VtgBeat>(1)
const propRotationOffsets = ref<readonly [number, number]>()
const initialTurnsOffset = ref<VtgTransitionInitialTurnsOffset>()
const initialTurnsOffsetBeat = ref<VtgBeat>()
const transition = ref(false)
const transitionAfterBeat = ref(false)
const transitionBeats = ref<VtgTransitionBeats>(vtgDefaultTransitionBeats)
const transitionQuad = ref(false)
const transitionSecond = ref(false)
const quickSlotCreationError = ref<string>()
const hasPopulatedQuickSlots = computed(
  () =>
    conceptsStore.quickSlotCount > 0 &&
    conceptsStore.quickSlotPaths.some((path) => typeof path === 'string'),
)
const showStaticPropsTransitionNote = computed(() => transition.value && speedRatio.value === '1:1')
const compactBuilder = computed(() => props.builderActive && !props.builderFullCatalog)
const usesClassicLayout = computed(
  () => (vtgAdvanced.value ? classicLayout.value : true) && !compactBuilder.value,
)
const spinToggleCells: ReadonlySet<VtgCellReference> = new Set(['5-6', '6-6', '5-5', '6-5'])
const createPreviewSelection = (
  reference: VtgCellReference,
): VtgPatternSelection | QtrPatternSelection => {
  const selection: VtgPatternSelection = {
    reference,
    speedRatio: speedRatio.value,
    scale: scale.value,
    spacing: spacing.value,
    propColors: [leftPropColor.value, rightPropColor.value],
    prop: prop.value,
    hands: hands.value,
    ...(spinToggleCells.has(reference) ? { isAnti: isAnti.value } : undefined),
    ...(swapProps.value ? { swapProps: true } : undefined),
    ...(reversePlane.value ? { reversePlane: true } : undefined),
    ...(beat.value === 1 ? undefined : { beat: beat.value }),
    ...(transition.value ? { transition: true } : undefined),
    ...(transition.value && transitionAfterBeat.value ? { transitionAfterBeat: true } : undefined),
    ...(initialTurnsOffset.value === undefined
      ? undefined
      : {
          initialTurnsOffset: initialTurnsOffset.value,
          initialTurnsOffsetBeat: initialTurnsOffsetBeat.value,
        }),
    ...(orientation.value !== 0 ? { orientation: orientation.value } : undefined),
    ...(propRotationOffsets.value === undefined
      ? undefined
      : { propRotationOffsets: [...propRotationOffsets.value] as readonly [number, number] }),
  }
  return isQtr.value ? { ...selection, quarters: 1 } : selection
}
const appliesPropertiesToPreviews = computed(
  () => !props.builderActive || props.builderMatchAnimation !== undefined,
)
const previewPropertySettings = computed(() =>
  appliesPropertiesToPreviews.value ? conceptsStore.getVtgPropertySettings() : undefined,
)
const createPreviewCandidate = (
  selection: VtgPatternSelection | QtrPatternSelection,
  applyProperties = true,
) =>
  createVtgPreviewCandidate(selection, {
    ...(props.animation && props.builderInsertionIndex !== undefined
      ? { source: props.animation, builderInsertionIndex: props.builderInsertionIndex }
      : undefined),
    ...(applyProperties && previewPropertySettings.value
      ? { properties: previewPropertySettings.value }
      : undefined),
  })
const contextualPropertyPairing = ref<boolean>()
const layoutComparisonKey = computed(() =>
  JSON.stringify([
    speedRatio.value,
    scale.value,
    spacing.value,
    isAnti.value,
    swapProps.value,
    reversePlane.value,
    beat.value,
    transition.value,
    transitionAfterBeat.value,
    initialTurnsOffset.value,
    initialTurnsOffsetBeat.value,
    orientation.value,
    propRotationOffsets.value,
    previewPropertySettings.value,
  ]),
)
let layoutComparisonRevision = 0
let layoutComparisonTimer: ReturnType<typeof setTimeout> | undefined
const compareCandidateLayout = async (
  request: Parameters<NonNullable<PatternMatchingClient['compareVtgCandidateLayout']>>[0],
) => {
  if (props.patternMatcher?.compareVtgCandidateLayout) {
    return props.patternMatcher.compareVtgCandidateLayout(request)
  }
  const { compareVtgCandidateLayoutRequest } =
    await import('@/workers/pattern-matching/handlePatternMatchingRequest')
  return compareVtgCandidateLayoutRequest(request)
}
watch(
  [
    layoutComparisonKey,
    isQtr,
    () => props.animation,
    () => props.animationRevision,
    () => props.builderInsertionIndex,
  ],
  () => {
    const revision = ++layoutComparisonRevision
    if (layoutComparisonTimer !== undefined) {
      clearTimeout(layoutComparisonTimer)
      layoutComparisonTimer = undefined
    }
    const activeProperties = previewPropertySettings.value
    if (
      isQtr.value ||
      activeProperties === undefined ||
      !hasVtgPropertySettings(activeProperties)
    ) {
      contextualPropertyPairing.value = undefined
      return
    }
    const properties = cloneVtgPropertySettings(activeProperties)

    layoutComparisonTimer = setTimeout(() => {
      layoutComparisonTimer = undefined
      const request = {
        selections: [createPreviewSelection('1-6'), createPreviewSelection('2-6')],
        options: {
          properties,
          ...(props.animation !== undefined && props.builderInsertionIndex !== undefined
            ? {
                source: toRaw(props.animation),
                builderInsertionIndex: props.builderInsertionIndex,
              }
            : undefined),
        },
      } as const
      void compareCandidateLayout(request).then(
        (paired) => {
          if (revision === layoutComparisonRevision) contextualPropertyPairing.value = paired
        },
        () => {
          if (revision === layoutComparisonRevision) contextualPropertyPairing.value = undefined
        },
      )
    }, 50)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  layoutComparisonRevision += 1
  if (layoutComparisonTimer !== undefined) clearTimeout(layoutComparisonTimer)
})
const usesPairedPreviewLayout = computed(() => {
  if (compactBuilder.value) return true
  return (
    requiresPairedVtgPreviewLayout(speedRatio.value) || contextualPropertyPairing.value === true
  )
})
const topHeaderRule = computed(() => getVtgTopHeaderRule(speedRatio.value))
const hideColumnHeaderDetails = computed(
  () => compactBuilder.value || isQtr.value || !topHeaderRule.value.showDetails,
)
const usesQuarterTurnHeaderLayout = computed(
  () => orientation.value === 90 || orientation.value === -90,
)
const columnHeaderOrientation = computed(() =>
  usesQuarterTurnHeaderLayout.value ? 'horizontal' : 'vertical',
)
const sideHeaderOrientation = computed(() =>
  usesQuarterTurnHeaderLayout.value ? 'vertical' : 'horizontal',
)
const sideHeaderReversed = computed(() => {
  if (usesQuarterTurnHeaderLayout.value) return orientation.value === -90
  const hasHalfTurnRotation = orientation.value === 180
  return reversePlane.value !== hasHalfTurnRotation
})
const activeQtrMode = computed<1 | false>(() => (isQtr.value ? 1 : false))
const vtgHeaderPropColors = vtgPropSettings.map(({ color }) => {
  const colorSet = COLSET[COLORS.indexOf(color)]
  if (!colorSet) throw new Error(`Missing VTG prop color set for ${color}`)

  // These map directly to the POI model's head, handle, and tether materials.
  return {
    head: toColor(colorSet[0]),
    handle: toColor(colorSet[1]),
    tether: toColor(colorSet[2]),
  }
})
const createQSlots = async () => {
  quickSlotCreationError.value = undefined
  if (!props.animation) return
  const quickSlotBeatCount = getVtgTimingCycleCount(speedRatio.value) * 4
  const candidates = createVtgTransitionQuickSlotAnimationCandidates(
    props.animation,
    quickSlotBeatCount,
  )
  if (!candidates) return

  const preferences = {
    swapProps: swapProps.value,
    reversePlane: reversePlane.value,
    quarters: 1 as const,
  }
  try {
    const resolution = await resolveVtgTransitionQuickSlotAnimations(
      candidates,
      async (animation, rotationFilter) => {
        const result = await matchPattern({ animation, preferences, rotationFilter })
        if (result.status !== 'matched') return false
        return result.match.initialTurnsOffset === undefined ? 'exact' : 'transitionTurns'
      },
    )
    if (resolution.status === 'partial') {
      console.warn(
        `VTG Quick Slot${resolution.unmatchedSlots.length === 1 ? '' : 's'} ${resolution.unmatchedSlots.join(', ')} did not resolve to a known pattern; the generated extraction${resolution.unmatchedSlots.length === 1 ? ' was' : 's were'} used.`,
      )
    }
    emit('quickSlotsCreate', resolution.animations)
  } catch (error) {
    quickSlotCreationError.value =
      'Quick Slots could not be created. Your current Quick Slots were not changed.'
    console.warn('VTG Quick Slot normalization failed.', error)
  }
}

let suppressPatternEmit = false
let patternEmitSuppressionOwner = 0
let hydrationVersion = 0
let lastEmittedSelection: VtgPatternSelection | QtrPatternSelection | undefined
let componentMounted = false
let initialAnimationHandled = false
let ratioOrientationChangeActive = false
const previewsReady = ref(false)

const beginPatternEmitSuppression = () => {
  suppressPatternEmit = true
  return ++patternEmitSuppressionOwner
}

const releasePatternEmitSuppression = (owner: number) => {
  if (owner === patternEmitSuppressionOwner) suppressPatternEmit = false
}

const columnRuleNumbers = [1, 2, 3, 4, 5, 6] as const
const leftRuleNumbers = [1, 2, 3, 4, 5, 6] as const

const createCellReference = (row: VtgRuleNumber, column: VtgRuleNumber): VtgCellReference =>
  `${row}-${column}`

const matrixAddresses: readonly VtgMatrixAddress[] = leftRuleNumbers.flatMap(
  (rowNumber, rowIndex) => {
    return columnRuleNumbers.map((columnNumber, columnIndex) => {
      return {
        column: columnNumber,
        row: rowNumber,
        boardColumn: columnIndex + 2,
        boardRow: rowIndex + 1,
        reference: createCellReference(rowNumber, columnNumber),
      }
    })
  },
)

const matrixTiles = computed<readonly VtgMatrixTile[]>(() =>
  matrixAddresses
    .filter(
      (address) =>
        !compactBuilder.value || ((address.row === 1 || address.row === 6) && address.column <= 4),
    )
    .map((address) => {
      const selection = createPreviewSelection(address.reference)

      const relationships = describePatternSelectionRelationshipsAcrossBeats(selection)
      const builderAnimation =
        props.builderActive && props.builderInsertionIndex !== undefined && props.animation
          ? createVtgBuilderDropPreview(props.animation, selection, props.builderInsertionIndex, {
              minimumCycleCount: conceptsStore.getVtgPropertyCycleCount(),
            })
          : undefined
      const displayedRelationships =
        builderAnimation && (props.builderInsertionIndex ?? 0) > 0
          ? describeVtgBuilderPreviewRelationship(builderAnimation, selection.speedRatio)
          : relationships
      if (!compactBuilder.value) return { ...address, ...displayedRelationships }

      const animation = isQtr.value
        ? createDefaultQtrAnimation(selection as QtrPatternSelection)
        : (builderAnimation ?? createDefaultVtgAnimation(selection as VtgPatternSelection))
      if (!animation) throw new Error(`Missing Builder animation for ${selection.reference}`)

      const label = describeVtgBuilderMotion(animation)
      return {
        ...address,
        ...displayedRelationships,
        label,
        description: describeVtgBuilderMotionLabel(label),
      }
    }),
)

const displayCellReference = (tile: VtgMatrixTile): string =>
  compactBuilder.value ? `${tile.row === 6 ? 2 : tile.row}-${tile.column}` : tile.reference

const getTileDescription = (tile: VtgMatrixTile) => tile.description
const getBuilderSpinLabel = (tile: VtgMatrixTile) => tile.label.split(' / ')[0] ?? tile.label
const getElementalAccessibleLabel = (
  relationship: ElementalRelationship | undefined,
  indeterminate: boolean | undefined,
): string | undefined => {
  if (indeterminate) return 'Indeterminate'
  if (relationship?.timing === 'Q') return relationship.direction === 'S' ? 'Sun' : 'Moon'
  return relationshipElement(relationship)
}
const getTileAccessibleLabel = (tile: VtgMatrixTile) => {
  if (!elementalLayout.value) return tile.label
  const handsElement = getElementalAccessibleLabel(tile.hands, tile.handsIndeterminate)
  const propsElement = getElementalAccessibleLabel(tile.props, tile.propsIndeterminate)
  return handsElement && propsElement ? `${handsElement} / ${propsElement}` : tile.label
}

const getTileGridPosition = (tile: VtgMatrixTile) => {
  if (!usesClassicLayout.value) {
    return {
      column: tile.column,
      row: compactBuilder.value ? (tile.row === 6 ? 2 : 1) : tile.row,
    }
  }

  return {
    column: compactBuilder.value ? (tile.row === 6 ? 2 : 1) : tile.row,
    row: compactBuilder.value ? 5 - tile.column : 7 - tile.column,
  }
}

const getTileGridStyle = (tile: VtgMatrixTile) => {
  if (!compactBuilder.value && !usesClassicLayout.value) return undefined
  const position = getTileGridPosition(tile)
  return { gridColumn: String(position.column), gridRow: String(position.row) }
}

/**
 * Staggers the classic/elemental label crossfade so the swap ripples across the
 * board instead of every tile flipping on the same frame.
 */
const getTileLabelSwapStyle = (tile: VtgMatrixTile) => {
  const topRow = Math.max(...matrixTiles.value.map(getTileBoardRow))
  const wave = topRow - getTileBoardRow(tile) + getTileBoardColumn(tile) - 1
  return { '--vtg-label-swap-delay': `calc(${wave} * var(--delay-label-swap-step))` }
}

const getTileBoardColumn = (tile: VtgMatrixTile) =>
  usesClassicLayout.value ? getTileGridPosition(tile).column + 1 : tile.boardColumn

const getTileBoardRow = (tile: VtgMatrixTile) =>
  usesClassicLayout.value ? getTileGridPosition(tile).row : tile.boardRow

const getTileClasses = (tile: VtgMatrixTile): Record<string, boolean> => {
  const pairedEdge = tile.column % 2 === 0 ? 'top' : 'bottom'
  const standardPairedEdge = tile.column % 2 === 0 ? 'right' : 'left'
  const sharedPreviewEdge = usesClassicLayout.value
    ? pairedEdge
    : tile.row % 2 === 0
      ? 'bottom'
      : 'top'

  return {
    'vtg-tile--highlighted': isTileHighlighted(tile),
    'vtg-tile--selected': tile.reference === selectedCellReference.value,
    [`vtg-tile--paired-${usesClassicLayout.value ? pairedEdge : standardPairedEdge}`]:
      usesPairedPreviewLayout.value,
    [`vtg-tile--shared-preview-${sharedPreviewEdge}`]: !usesPairedPreviewLayout.value,
  }
}

const getSpinTogglePositionClasses = (tile: VtgMatrixTile): readonly string[] => {
  const isTop = usesClassicLayout.value ? tile.column === 6 : tile.row === 5
  const classes = [`vtg-tile__spin-toggle--${isTop ? 'top' : 'bottom'}`]
  if (!usesPairedPreviewLayout.value) return classes

  const isLeft = usesClassicLayout.value ? tile.row === 5 : tile.column % 2 === 1
  classes.push(`vtg-tile__spin-toggle--${isLeft ? 'left' : 'right'}`)
  return classes
}

const selectedCell = ref<VtgCellAddress>()
const patternControlKey = computed(() =>
  JSON.stringify([
    speedRatio.value,
    isAnti.value,
    swapProps.value,
    reversePlane.value,
    beat.value,
    transition.value,
    transitionAfterBeat.value,
    transitionBeats.value,
    transitionQuad.value,
    transitionSecond.value,
    initialTurnsOffset.value,
    initialTurnsOffsetBeat.value,
    orientation.value,
    propRotationOffsets.value,
    activeQtrMode.value,
  ]),
)

const matchedCellReference = computed<VtgCellReference | undefined>(() => {
  const cell = selectedCell.value
  return cell ? createCellReference(cell.row, cell.column) : undefined
})

const selectedCellReference = computed<VtgCellReference | undefined>(
  () => matchedCellReference.value,
)

const includeCurrentOrientation = (
  orientations: readonly VtgPatternOrientation[],
): readonly VtgPatternOrientation[] =>
  orientations.includes(orientation.value)
    ? orientations
    : [...orientations, orientation.value].sort((left, right) => left - right)

const availablePatternOrientations = computed(() =>
  includeCurrentOrientation(getVtgPatternOrientations(speedRatio.value)),
)

watch(
  transition,
  (enabled) => {
    if (enabled && !suppressPatternEmit) {
      initialTurnsOffset.value = undefined
      initialTurnsOffsetBeat.value = undefined
    }
  },
  { flush: 'sync' },
)

const isTileHighlighted = (tile: VtgMatrixTile) =>
  selectedCell.value !== undefined &&
  (tile.column === selectedCell.value.column || tile.row === selectedCell.value.row)

const isSpinToggleCell = (reference: VtgCellReference) => spinToggleCells.has(reference)

const createPatternSelection = (tile: VtgMatrixTile): VtgPatternSelection | QtrPatternSelection => {
  if (!suppressPatternEmit) hydrationVersion++

  const baseSelection: VtgPatternSelection = {
    reference: tile.reference,
    speedRatio: speedRatio.value,
  }
  if (PROPSR[prop.value] !== vtgPlayerSettings.prop) baseSelection.prop = prop.value
  if (isSpinToggleCell(tile.reference)) baseSelection.isAnti = isAnti.value
  if (swapProps.value) baseSelection.swapProps = true
  if (reversePlane.value) baseSelection.reversePlane = true
  if (beat.value !== 1) baseSelection.beat = beat.value
  const includeTransition = transition.value && !props.builderActive
  if (includeTransition) baseSelection.transition = true
  if (includeTransition && transitionAfterBeat.value) baseSelection.transitionAfterBeat = true
  if (includeTransition && transitionBeats.value !== vtgDefaultTransitionBeats) {
    baseSelection.transitionBeats = transitionBeats.value
  }
  if (includeTransition && transitionQuad.value) {
    baseSelection.transitionQuad = true
  }
  if (includeTransition && transitionQuad.value && transitionSecond.value) {
    baseSelection.transitionSecond = true
  }
  if (initialTurnsOffset.value !== undefined) {
    baseSelection.initialTurnsOffset = initialTurnsOffset.value
    baseSelection.initialTurnsOffsetBeat = initialTurnsOffsetBeat.value
  }
  if (orientation.value !== 0) {
    baseSelection.orientation = orientation.value
  }
  if (propRotationOffsets.value !== undefined) {
    baseSelection.propRotationOffsets = propRotationOffsets.value
  }
  if (bpm.value !== vtgBpmControl.default) baseSelection.bpm = bpm.value
  if (scale.value !== vtgScaleControl.default) baseSelection.scale = scale.value
  if (thick.value !== vtgThickControl.default) baseSelection.thick = thick.value
  if (spacing.value !== vtgSpacingControl.default) baseSelection.spacing = spacing.value
  if (paths.value !== vtgPlayerSettings.paths) baseSelection.paths = paths.value
  if (hands.value !== vtgPlayerSettings.hands) baseSelection.hands = hands.value
  if (arms.value !== vtgPlayerSettings.arms) baseSelection.arms = arms.value
  if (!leftPropVisible.value) baseSelection.left = false
  if (!rightPropVisible.value) baseSelection.right = false
  if (
    leftPropColor.value !== defaultPatternPropColors[0] ||
    rightPropColor.value !== defaultPatternPropColors[1]
  ) {
    baseSelection.propColors = [leftPropColor.value, rightPropColor.value]
  }
  const selection: ConceptPatternSelection = isQtr.value
    ? { ...baseSelection, quarters: 1 }
    : baseSelection
  return selection
}

const createCustomizationSelection = () => {
  const tile =
    matrixTiles.value.find(({ reference }) => reference === matchedCellReference.value) ??
    matrixTiles.value[0]
  return tile === undefined ? undefined : createPatternSelection(tile)
}

const emitPatternSelection = (tile: VtgMatrixTile) => {
  if (props.builderActive) return
  const selection = createPatternSelection(tile)
  lastEmittedSelection = selection
  emit('patternSelect', selection)
}

const emitBuilderPreview = (tile?: VtgMatrixTile) => {
  if (!props.builderActive) return
  const activeTile =
    tile ??
    matrixTiles.value.find(
      (candidate) =>
        candidate.column === selectedCell.value?.column &&
        candidate.row === selectedCell.value?.row,
    )
  if (!activeTile) return

  emit('patternPreview', createPatternSelection(activeTile))
}

// Full Grid thumbnails sit at the shared corner of each 2x2 tile group. Paired layouts share
// only across columns, so touch and desktop drag previews must resolve the same visible anchor.
const previewReferenceForTile = (tile: VtgMatrixTile) =>
  usesPairedPreviewLayout.value
    ? createCellReference(
        tile.row,
        tile.column % 2 === 0 ? ((tile.column - 1) as VtgRuleNumber) : tile.column,
      )
    : createCellReference(
        tile.row % 2 === 0 ? ((tile.row - 1) as VtgRuleNumber) : tile.row,
        tile.column % 2 === 0 ? ((tile.column - 1) as VtgRuleNumber) : tile.column,
      )

const createBuilderPointerPreview = (
  tile: VtgMatrixTile,
  source: HTMLElement | null,
): BuilderPatternPointerPreview => {
  const previewReference = previewReferenceForTile(tile)
  const rendererIndex = pairedPatternPreviewReferences.indexOf(previewReference)
  const bounds = source?.getBoundingClientRect()
  const renderedImage = paneElement.value?.querySelector<HTMLImageElement>(
    `[data-preview-reference="${previewReference}"]`,
  )
  const imageUrl =
    renderedImage?.currentSrc || renderedImage?.src || previewUrls.value[rendererIndex]
  return {
    width: bounds?.width ?? 0,
    height: bounds?.height ?? 0,
    label: tile.label,
    ...(imageUrl ? { imageUrl } : undefined),
    ...(elementalLayout.value
      ? {
          elemental: {
            hands: tile.hands,
            props: tile.props,
            handsIndeterminate: tile.handsIndeterminate,
            propsIndeterminate: tile.propsIndeterminate,
            ...(compactBuilder.value ? { prefix: getBuilderSpinLabel(tile) } : undefined),
          },
        }
      : undefined),
  }
}

const setBuilderDragImage = (
  tile: VtgMatrixTile,
  source: HTMLElement,
  dataTransfer: DataTransfer,
) => {
  const dragImage = source.cloneNode(true) as HTMLElement
  const patternImage = paneElement.value
    ?.querySelector<HTMLImageElement>(`[data-preview-reference="${previewReferenceForTile(tile)}"]`)
    ?.cloneNode(true) as HTMLImageElement | undefined
  if (patternImage) {
    patternImage.style.position = 'absolute'
    patternImage.style.inset = '11%'
    patternImage.style.width = '78%'
    patternImage.style.height = '78%'
    dragImage.prepend(patternImage)
  }

  const bounds = source.getBoundingClientRect()
  dragImage.removeAttribute('id')
  dragImage.removeAttribute('aria-describedby')
  dragImage.setAttribute('aria-hidden', 'true')
  dragImage.setAttribute('draggable', 'false')
  dragImage.style.position = 'fixed'
  dragImage.style.inset = '0 auto auto -10000px'
  dragImage.style.width = `${bounds.width}px`
  dragImage.style.height = `${bounds.height}px`
  dragImage.style.pointerEvents = 'none'
  paneElement.value?.appendChild(dragImage)
  dataTransfer.setDragImage(dragImage, bounds.width / 2, bounds.height / 2)
  setTimeout(() => dragImage.remove())
}

const startBuilderDrag = (tile: VtgMatrixTile, event: DragEvent) => {
  if (!props.builderActive || !event.dataTransfer) return
  const selection = createPatternSelection(tile)
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(builderPatternDragType, JSON.stringify(selection))
  event.dataTransfer.setData('text/plain', `VTG ${tile.reference}`)
  const source = event.currentTarget as HTMLElement | null
  if (source && typeof event.dataTransfer.setDragImage === 'function') {
    setBuilderDragImage(tile, source, event.dataTransfer)
  }
}

const pointerDragThreshold = 10
let builderPointerDrag:
  | {
      pointerId: number
      startX: number
      startY: number
      selection: ConceptPatternSelection
      tile: VtgMatrixTile
      source: HTMLElement | null
      active: boolean
    }
  | undefined
let suppressBuilderPointerClick = false

const startBuilderPointerDrag = (tile: VtgMatrixTile, event: PointerEvent) => {
  suppressBuilderPointerClick = false
  if (
    !props.builderActive ||
    event.pointerType === 'mouse' ||
    event.button !== 0 ||
    !event.isPrimary
  )
    return

  const source = event.currentTarget as HTMLElement | null
  builderPointerDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    selection: createPatternSelection(tile),
    tile,
    source,
    active: false,
  }
  if (source && typeof source.setPointerCapture === 'function') {
    source.setPointerCapture(event.pointerId)
  }
}

const moveBuilderPointerDrag = (event: PointerEvent) => {
  const drag = builderPointerDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  if (
    !drag.active &&
    Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < pointerDragThreshold
  )
    return

  drag.active = true
  event.preventDefault()
  const preview = createBuilderPointerPreview(drag.tile, drag.source)
  document.dispatchEvent(
    createBuilderPatternPointerEvent(builderPatternPointerMoveEvent, {
      clientX: event.clientX,
      clientY: event.clientY,
      selection: drag.selection,
      preview,
    }),
  )
}

const finishBuilderPointerDrag = (event: PointerEvent) => {
  const drag = builderPointerDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  if (drag.active) {
    event.preventDefault()
    suppressBuilderPointerClick = true
    const preview = createBuilderPointerPreview(drag.tile, drag.source)
    document.dispatchEvent(
      createBuilderPatternPointerEvent(builderPatternPointerDropEvent, {
        clientX: event.clientX,
        clientY: event.clientY,
        selection: drag.selection,
        preview,
      }),
    )
  }
  builderPointerDrag = undefined
  document.dispatchEvent(new Event(builderPatternPointerEndEvent))
}

const cancelBuilderPointerDrag = (event: PointerEvent) => {
  if (builderPointerDrag?.pointerId !== event.pointerId) return
  builderPointerDrag = undefined
  document.dispatchEvent(new Event(builderPatternPointerEndEvent))
}

const selectTile = (tile: VtgMatrixTile) => {
  if (suppressBuilderPointerClick) {
    suppressBuilderPointerClick = false
    return
  }
  const isReselectedSpinToggleCell =
    tile.reference === selectedCellReference.value && isSpinToggleCell(tile.reference)

  if (props.builderActive) {
    const suppressionOwner = beginPatternEmitSuppression()
    selectedCell.value = { column: tile.column, row: tile.row }
    if (isReselectedSpinToggleCell) isAnti.value = !isAnti.value
    releasePatternEmitSuppression(suppressionOwner)
    emitBuilderPreview(tile)
    return
  }
  selectedCell.value = {
    column: tile.column,
    row: tile.row,
  }
  if (isReselectedSpinToggleCell) isAnti.value = !isAnti.value
  emitPatternSelection(tile)
}

const selectRandomTile = () => {
  const tile = matrixTiles.value[Math.floor(Math.random() * matrixTiles.value.length)]
  if (tile === undefined) throw new Error('Cannot select a random VTG cell from an empty matrix')
  selectTile(tile)
}

const selectRandomTileFrom = (tiles: readonly VtgMatrixTile[]) => {
  const tile = tiles[Math.floor(Math.random() * tiles.length)]
  if (tile === undefined) throw new Error('Cannot select a random VTG cell from an empty line')
  selectTile(tile)
}

const selectRow = (row: VtgRuleNumber) => {
  const column = selectedCell.value?.column
  const tile =
    column === undefined
      ? undefined
      : matrixTiles.value.find((candidate) => candidate.column === column && candidate.row === row)

  if (tile) selectTile(tile)
  else selectRandomTileFrom(matrixTiles.value.filter((candidate) => candidate.row === row))
}

const selectColumn = (column: VtgRuleNumber) => {
  const row = selectedCell.value?.row
  const tile =
    row === undefined
      ? undefined
      : matrixTiles.value.find((candidate) => candidate.column === column && candidate.row === row)

  if (tile) selectTile(tile)
  else selectRandomTileFrom(matrixTiles.value.filter((candidate) => candidate.column === column))
}

const toggleSpinDirection = (tile: VtgMatrixTile) => {
  const suppressionOwner = props.builderActive ? beginPatternEmitSuppression() : undefined
  isAnti.value = !isAnti.value
  if (suppressionOwner !== undefined) {
    releasePatternEmitSuppression(suppressionOwner)
    emitBuilderPreview(tile)
  } else emitPatternSelection(tile)
}

const resetPatternControls = async () => {
  const activeReference = props.builderActive
    ? matchedCellReference.value
    : selectedCellReference.value
  const tile = matrixTiles.value.find(({ reference }) => reference === activeReference)
  const suppressionOwner = beginPatternEmitSuppression()
  conceptsStore.resetPatternControls()
  moreRatios.value = false
  isQtr.value = false
  isAnti.value = false
  beat.value = 1
  transition.value = false
  transitionAfterBeat.value = false
  transitionQuad.value = false
  transitionSecond.value = false
  initialTurnsOffset.value = undefined
  initialTurnsOffsetBeat.value = undefined
  orientation.value = getDefaultVtgPatternOrientation(speedRatio.value)
  propRotationOffsets.value = undefined
  await nextTick()
  releasePatternEmitSuppression(suppressionOwner)
  if (props.builderActive) {
    const selection = createCustomizationSelection()
    if (selection !== undefined) emit('customize', selection)
    if (tile !== undefined) emitBuilderPreview(tile)
  } else if (tile !== undefined) {
    emitPatternSelection(tile)
  }
}

watch(
  beat,
  () => {
    if (suppressPatternEmit || ratioOrientationChangeActive || props.builderActive) return
    const tile = matrixTiles.value.find(({ reference }) => reference === matchedCellReference.value)
    if (tile !== undefined) emitPatternSelection(tile)
  },
  { flush: 'sync' },
)

watch(
  [
    swapProps,
    reversePlane,
    transition,
    transitionBeats,
    transitionQuad,
    transitionSecond,
    initialTurnsOffset,
    initialTurnsOffsetBeat,
    orientation,
    propRotationOffsets,
    activeQtrMode,
  ],
  () => {
    if (suppressPatternEmit || ratioOrientationChangeActive || props.builderActive) return

    const tile = matrixTiles.value.find(({ reference }) => reference === matchedCellReference.value)
    if (tile !== undefined) emitPatternSelection(tile)
  },
  { flush: 'sync' },
)

watch(
  transitionAfterBeat,
  () => {
    if (
      !transition.value ||
      suppressPatternEmit ||
      ratioOrientationChangeActive ||
      props.builderActive
    ) {
      return
    }

    const tile = matrixTiles.value.find(({ reference }) => reference === matchedCellReference.value)
    if (tile !== undefined) emitPatternSelection(tile)
  },
  { flush: 'sync' },
)

watch(
  [
    bpm,
    scale,
    thick,
    spacing,
    paths,
    hands,
    arms,
    leftPropVisible,
    rightPropVisible,
    leftPropColor,
    rightPropColor,
    prop,
  ],
  () => {
    if (suppressPatternEmit) return

    const selection = createCustomizationSelection()
    if (selection !== undefined) emit('customize', selection)
  },
  { flush: 'sync' },
)

watch(
  speedRatio,
  (nextSpeedRatio, previousSpeedRatio) => {
    syncMoreRatioControls(nextSpeedRatio)
    ratioOrientationChangeActive = true
    try {
      const nextBeats = getVtgBeats(nextSpeedRatio)
      if (!nextBeats.includes(beat.value)) beat.value = nextBeats.at(-1) ?? 1
      if (orientation.value === getDefaultVtgPatternOrientation(previousSpeedRatio)) {
        orientation.value = getDefaultVtgPatternOrientation(nextSpeedRatio)
      }
    } finally {
      ratioOrientationChangeActive = false
    }
    if (suppressPatternEmit || props.builderActive) return
    const tile = matrixTiles.value.find(({ reference }) => reference === matchedCellReference.value)
    if (tile !== undefined) emitPatternSelection(tile)
  },
  { flush: 'sync' },
)

watch(
  [matchedCellReference, patternControlKey],
  () => {
    if (!props.builderActive || suppressPatternEmit || ratioOrientationChangeActive) return
    emitBuilderPreview()
  },
  { flush: 'sync' },
)

const matchPattern = async (request: Parameters<PatternMatchingClient['matchVtg']>[0]) => {
  if (props.patternMatcher) return props.patternMatcher.matchVtg(request)

  const { matchVtgPatternRequest } =
    await import('@/workers/pattern-matching/handlePatternMatchingRequest')
  return matchVtgPatternRequest(request)
}

let autoBuilderOpenAnimation: RootDataFinal | undefined
let autoBuilderOpenRevision: number | undefined
const markAutoBuilderOpenEvaluated = (animation: RootDataFinal) => {
  autoBuilderOpenAnimation = animation
  autoBuilderOpenRevision = props.animationRevision
}
const shouldEvaluateAutoBuilderOpen = (animation: RootDataFinal): boolean =>
  autoBuilderOpenAnimation !== animation || autoBuilderOpenRevision !== props.animationRevision
const hasMultipleVtgBuilderPortions = (animation: RootDataFinal): boolean => {
  const prepared = prepareVtg45TransitionPattern(animation)
  return (
    prepared.supported && (createVtgTransitionPreviewAnimations(prepared.pattern)?.length ?? 0) > 1
  )
}

const hydratePatternControls = async (animation: RootDataFinal) => {
  const version = ++hydrationVersion
  conceptsStore.hydrateVtgPropertyControls(animation)
  const patternAnimation = stripVtgPropertySettings(animation)
  // The parent suppresses revisions produced by this pane. A supplied revision therefore marks
  // an external change (Editor, Timeline, Quick Slots, or another control surface) and must be
  // canonicalized independently instead of preserving the pane's previous cell alias.
  const selection =
    !props.builderActive && props.animationRevision === undefined ? lastEmittedSelection : undefined
  lastEmittedSelection = undefined

  const matchPreferences = {
    swapProps: swapProps.value,
    reversePlane: reversePlane.value,
    quarters: 1 as const,
    orientation: orientation.value,
  }

  let result
  try {
    result = await matchPattern({
      animation: patternAnimation,
      preferences: matchPreferences,
      ...(selection ? { lastSelection: selection } : undefined),
    })
  } catch (error) {
    if (version === hydrationVersion && componentMounted) {
      console.warn('VTG pattern matching failed.', error)
      previewsReady.value = true
    }
    return
  }

  const currentMatchAnimation = props.builderActive ? props.builderMatchAnimation : props.animation
  if (version !== hydrationVersion || !componentMounted || currentMatchAnimation !== animation)
    return
  const evaluateAutoBuilderOpen = !props.builderActive && shouldEvaluateAutoBuilderOpen(animation)
  if (evaluateAutoBuilderOpen) markAutoBuilderOpenEvaluated(animation)
  if (result.status === 'unchanged') {
    previewsReady.value = true
    return
  }

  const match = result.status === 'matched' ? result.match : undefined
  const suppressionOwner = beginPatternEmitSuppression()

  if (match) {
    speedRatio.value = match.speedRatio
    isAnti.value = match.isAnti
    swapProps.value = match.swapProps
    reversePlane.value = match.reversePlane
    beat.value = match.beat ?? 1
    transition.value = match.transition ?? false
    transitionAfterBeat.value = match.transitionAfterBeat ?? false
    transitionBeats.value = match.transitionBeats ?? vtgDefaultTransitionBeats
    transitionQuad.value = match.transitionQuad ?? false
    transitionSecond.value = match.transitionSecond ?? false
    initialTurnsOffset.value = match.initialTurnsOffset
    initialTurnsOffsetBeat.value =
      match.initialTurnsOffset === undefined ? undefined : (match.beat ?? 1)
    const exactPatternMatch =
      result.status === 'matched' &&
      (result.exact ??
        (result.source === 'qtr'
          ? exactlyMatchesQtrSelection(patternAnimation, result.match)
          : exactlyMatchesVtgSelection(patternAnimation, result.match)))
    const inferredOrientation = exactPatternMatch
      ? undefined
      : inferPatternRelationshipOrientation(patternAnimation, match)
    orientation.value = match.orientation ?? inferredOrientation ?? 0
    const relationshipSelection =
      inferredOrientation === undefined ? match : { ...match, orientation: inferredOrientation }
    propRotationOffsets.value =
      match.propRotationOffsets ??
      (exactPatternMatch
        ? undefined
        : inferPatternRelationshipPropRotationOffsets(patternAnimation, relationshipSelection))
    // Builder matching identifies one extracted portion. BPM belongs to the complete pattern, so
    // selecting a portion must not replace the user's global VTG setting with that slice's BPM.
    if (!props.builderActive) bpm.value = match.bpm
    scale.value = match.scale
    thick.value = animation.thick
    paths.value = animation.paths
    hands.value = animation.hands ?? vtgPlayerSettings.hands
    arms.value = animation.arms
    leftPropVisible.value = isPatternPropVisible(animation.props[0])
    rightPropVisible.value = isPatternPropVisible(animation.props[1])
    leftPropColor.value =
      animation.props[0]?.color === undefined
        ? defaultPatternPropColors[0]
        : COLORS[animation.props[0].color]
    rightPropColor.value =
      animation.props[1]?.color === undefined
        ? defaultPatternPropColors[1]
        : COLORS[animation.props[1].color]
    prop.value = animation.prop
    isQtr.value = result.status === 'matched' && result.source === 'qtr'
    const tile =
      matrixTiles.value.find(({ reference }) => reference === match.reference) ??
      (compactBuilder.value
        ? matrixTiles.value.find(
            ({ label }) => label === describeVtgBuilderMotion(patternAnimation),
          )
        : undefined)
    selectedCell.value = tile ? { column: tile.column, row: tile.row } : undefined
  } else {
    selectedCell.value = undefined
    isQtr.value = false
    isAnti.value = false
    beat.value = 1
    transition.value = false
    transitionAfterBeat.value = false
    transitionBeats.value = vtgDefaultTransitionBeats
    transitionQuad.value = false
    transitionSecond.value = false
    initialTurnsOffset.value = undefined
    initialTurnsOffsetBeat.value = undefined
    orientation.value = getDefaultVtgPatternOrientation(speedRatio.value)
    propRotationOffsets.value = undefined
  }

  releasePatternEmitSuppression(suppressionOwner)
  previewsReady.value = true
  if (
    evaluateAutoBuilderOpen &&
    result.status === 'unmatched' &&
    hasMultipleVtgBuilderPortions(animation)
  ) {
    emit('builderOpen', 'automatic')
  }
}

const selectInitialRandomPattern = () => {
  hydrationVersion++
  const suppressionOwner = beginPatternEmitSuppression()
  selectedCell.value = undefined
  conceptsStore.resetPatternControls()
  moreRatios.value = false
  isAnti.value = false
  beat.value = 1
  transition.value = false
  transitionAfterBeat.value = false
  transitionBeats.value = vtgDefaultTransitionBeats
  transitionQuad.value = false
  transitionSecond.value = false
  initialTurnsOffset.value = undefined
  initialTurnsOffsetBeat.value = undefined
  orientation.value = getDefaultVtgPatternOrientation(speedRatio.value)
  propRotationOffsets.value = undefined
  selectRandomTile()

  releasePatternEmitSuppression(suppressionOwner)
}

const clearBuilderPatternMatch = () => {
  hydrationVersion++
  previewsReady.value = true
  const suppressionOwner = beginPatternEmitSuppression()
  selectedCell.value = undefined
  isQtr.value = false
  orientation.value = 0
  propRotationOffsets.value = undefined
  nextTick(() => releasePatternEmitSuppression(suppressionOwner))
}

const syncPatternControls = () => {
  if (!componentMounted) return
  if (!props.animationReady) {
    previewsReady.value = false
    return
  }

  const animation = props.builderActive ? props.builderMatchAnimation : props.animation
  if (!animation) {
    if (props.builderActive) clearBuilderPatternMatch()
    else previewsReady.value = true
    return
  }

  if (props.builderActive) {
    previewsReady.value = false
    void hydratePatternControls(animation)
    return
  }

  if (animation.props.length === 0) {
    if (initialAnimationHandled) return

    initialAnimationHandled = true
    selectInitialRandomPattern()
    previewsReady.value = true
    return
  }

  initialAnimationHandled = true
  previewsReady.value = false
  void hydratePatternControls(animation)
}

watch(
  [
    () => props.animationReady,
    () => props.animationRevision,
    () => props.builderMatchAnimation,
    // Standalone consumers that do not provide a revision retain the original prop-update API.
    () => (props.animationRevision === undefined ? props.animation : undefined),
  ],
  syncPatternControls,
)

watch(
  () => props.builderActive,
  (active, previousActive) => {
    hydrationVersion++
    if (!active && previousActive === true && props.animation) {
      markAutoBuilderOpenEvaluated(props.animation)
    }
    if (active) {
      syncPatternControls()
      return
    }

    syncPatternControls()
  },
  { immediate: true },
)

const createSplitDiagram = (
  firstLargeEnd: VtgPropPlacement['largeEnd'],
  secondLargeEnd: VtgPropPlacement['largeEnd'],
): VtgRuleDiagram => ({
  props: [
    {
      lane: 50,
      start: vtgPropBounds.outerStart,
      end: vtgPropBounds.beforeDivider,
      largeEnd: firstLargeEnd,
    },
    {
      lane: 50,
      start: vtgPropBounds.afterDivider,
      end: vtgPropBounds.outerEnd,
      largeEnd: secondLargeEnd,
    },
  ],
})

const createParallelDiagram = (
  dividerSide: 'before' | 'after',
  largeEnd: VtgPropPlacement['largeEnd'],
): VtgRuleDiagram => {
  const start = dividerSide === 'before' ? vtgPropBounds.outerStart : vtgPropBounds.afterDivider
  const end = dividerSide === 'before' ? vtgPropBounds.beforeDivider : vtgPropBounds.outerEnd

  return {
    props: [
      { lane: 42, start, end, largeEnd },
      { lane: 58, start, end, largeEnd },
    ],
  }
}

const diagrams = {
  alternatingSplit: createSplitDiagram('start', 'start'),
  outsideSplit: createSplitDiagram('start', 'end'),
  insideSplit: createSplitDiagram('end', 'start'),
  clusteredOutsideSplit: {
    divider: 97,
    props: [
      {
        lane: 50,
        start: vtgPropBounds.outerStart,
        end: vtgPropBounds.beforeDivider,
        largeEnd: 'start',
      },
      {
        lane: 50,
        start: 48,
        end: 85,
        largeEnd: 'end',
      },
    ],
  },
  parallelAfterInside: createParallelDiagram('after', 'start'),
  parallelAfterOutside: createParallelDiagram('after', 'end'),
} as const satisfies Readonly<Record<string, VtgRuleDiagram>>

const ruleDescriptions: Readonly<Record<VtgRuleNumber, string>> = {
  1: 'Tog Out - Both props are together facing out either on the left or right or the top and bottom.',
  2: 'Split Out - Props facing out, separated by 180 degrees, and located on the opposite sides of the circle.',
  3: 'Tog In - Both props are together facing in either on the left or right or the top and bottom.',
  4: 'Split In - Props facing in, separated by 180 degrees, and located on the opposite sides of the circle.',
  5: 'Tog Split - Hands are together but the props are facing 180 degrees apart.',
  6: 'Split Tog - Hands are split but the props are facing the same direction.',
}

const columnRules: readonly VtgRuleSpec[] = [
  {
    labels: ['TOG', 'OUT'],
    number: 1,
    diagram: diagrams.parallelAfterOutside,
    description: ruleDescriptions[1],
  },
  {
    labels: ['SPLIT', 'OUT'],
    number: 2,
    diagram: diagrams.outsideSplit,
    description: ruleDescriptions[2],
  },
  {
    labels: ['TOG', 'IN'],
    number: 3,
    diagram: diagrams.parallelAfterInside,
    description: ruleDescriptions[3],
  },
  {
    labels: ['SPLIT', 'IN'],
    number: 4,
    diagram: diagrams.insideSplit,
    description: ruleDescriptions[4],
  },
  {
    labels: ['TOG', 'SPLIT'],
    number: 5,
    diagram: diagrams.clusteredOutsideSplit,
    description: ruleDescriptions[5],
  },
  {
    labels: ['SPLIT', 'TOG'],
    number: 6,
    diagram: diagrams.alternatingSplit,
    description: ruleDescriptions[6],
  },
]

const displayedColumnRules = computed(() => {
  const displayedColumns = compactBuilder.value ? columnRuleNumbers.slice(0, 4) : columnRuleNumbers
  return displayedColumns.map((column, index) => {
    const ruleNumber = topHeaderRule.value.ruleNumbers[index]
    const rule = columnRules.find((candidate) => candidate.number === ruleNumber)
    if (!rule) throw new Error(`Missing VTG column header rule ${ruleNumber}`)

    return { column, rule }
  })
})

const classicSideHeaderRules = computed(() => [...displayedColumnRules.value].reverse())

const sideRules: readonly VtgRuleSpec[] = [
  {
    labels: ['TOG', 'OUT'],
    number: 1,
    diagram: diagrams.parallelAfterOutside,
    description: ruleDescriptions[1],
  },
  {
    labels: ['SPLIT', 'OUT'],
    number: 2,
    diagram: diagrams.outsideSplit,
    description: ruleDescriptions[2],
  },
  {
    labels: ['TOG', 'IN'],
    number: 3,
    diagram: diagrams.parallelAfterInside,
    description: ruleDescriptions[3],
  },
  {
    labels: ['SPLIT', 'IN'],
    number: 4,
    diagram: diagrams.insideSplit,
    description: ruleDescriptions[4],
  },
  {
    labels: ['TOG', 'SPLIT'],
    number: 5,
    diagram: diagrams.clusteredOutsideSplit,
    description: ruleDescriptions[5],
  },
  {
    labels: ['SPLIT', 'TOG'],
    number: 6,
    diagram: diagrams.alternatingSplit,
    description: ruleDescriptions[6],
  },
]

const quarterDiagramOptions = computed(() => ({
  speedRatio: speedRatio.value,
  quarters: 1 as const,
  swapProps: swapProps.value,
  reversePlane: reversePlane.value,
}))

type DisplayedSideRule = VtgRuleSpec & { sourceNumber?: VtgRuleNumber }

const displayedSideRules = computed<readonly DisplayedSideRule[]>(() => {
  if (compactBuilder.value) {
    const first = sideRules[0]
    const sixth = sideRules[5]
    if (!first || !sixth) throw new Error('Missing compact Builder side rules')
    return [first, { ...sixth, number: 2, sourceNumber: 6 }]
  }
  if (!isQtr.value) return sideRules

  return sideRules.map((rule) => ({
    ...rule,
    diagram: createQtrSideDiagram({
      ...quarterDiagramOptions.value,
      row: rule.number,
    }),
  }))
})

const paneElement = ref<HTMLElement>()
const blankWidth = ref(0)
const blankHeight = ref(0)
const blankDimensions = reactive<BlankDimensions[]>(
  pairedPatternPreviewReferences.map(() => ({ width: 0, height: 0 })),
)

const getPreviewGridStyle = (row: number, column: number) => {
  if (compactBuilder.value) {
    return { gridColumn: `${column} / span 2`, gridRow: row === 6 ? '2' : '1' }
  }

  if (!usesClassicLayout.value) {
    return usesPairedPreviewLayout.value
      ? { gridColumn: `${column} / span 2`, gridRow: String(row) }
      : { gridColumn: String(column + 1), gridRow: String(row + 1) }
  }

  return usesPairedPreviewLayout.value
    ? { gridColumn: String(row), gridRow: `${6 - column} / span 2` }
    : { gridColumn: String(row + 1), gridRow: String(7 - column) }
}

const displayedPreviews = computed(() => {
  const references = compactBuilder.value
    ? builderPatternPreviewReferences
    : usesPairedPreviewLayout.value
      ? pairedPatternPreviewReferences
      : patternPreviewReferences

  return references.map((reference) => {
    const [rowText, columnText] = reference.split('-')
    const column = Number(columnText)
    const row = Number(rowText)
    const rendererIndex = pairedPatternPreviewReferences.indexOf(reference)

    return {
      reference,
      rendererIndex,
      style: getPreviewGridStyle(row, column),
    }
  })
})
const { previewUrls, requestPreviews } = usePatternPreviews({
  dimensions: blankDimensions,
  speedRatio,
  isAnti,
  swapProps,
  reversePlane,
  beat,
  scale,
  spacing,
  hands,
  quarters: activeQtrMode,
  leftPropColor,
  rightPropColor,
  prop,
  orientation,
  propRotationOffsets,
  initialTurnsOffset,
  initialTurnsOffsetBeat,
  activeReferences: computed(() => displayedPreviews.value.map(({ reference }) => reference)),
  active: previewsReady,
  createSelection: createPreviewSelection,
  previewContext: computed(() => [
    props.animationRevision,
    props.builderInsertionIndex,
    transition.value,
    transitionAfterBeat.value,
    JSON.stringify(previewPropertySettings.value),
  ]),
  createVtgPreviews: async (selections) => {
    const activeProperties = previewPropertySettings.value
    const options = {
      ...(props.animation !== undefined && props.builderInsertionIndex !== undefined
        ? { source: toRaw(props.animation), builderInsertionIndex: props.builderInsertionIndex }
        : undefined),
      ...(activeProperties === undefined
        ? undefined
        : { properties: cloneVtgPropertySettings(activeProperties) }),
    }
    const candidates = props.patternMatcher?.createVtgPreviewCandidates
      ? await props.patternMatcher.createVtgPreviewCandidates({ selections, options })
      : selections.map((selection) => createVtgPreviewCandidate(selection, options))
    return candidates.map((animation) =>
      animation ? toVtgPreviewAnimation(animation, { hands: hands.value }) : undefined,
    )
  },
  createVtgPreview: (selection) => {
    const animation = createPreviewCandidate(selection)
    if (!animation) return undefined
    return toVtgPreviewAnimation(animation, { hands: hands.value })
  },
})

let blankObserver: ResizeObserver | undefined

const roundDimension = (value: number) => Math.round(value * 100) / 100
const observeDisplayedPreviews = () => {
  paneElement.value
    ?.querySelectorAll<HTMLElement>('[data-role="vtg-blank"]')
    .forEach((element) => blankObserver?.observe(element))
}

watch(displayedPreviews, () => void nextTick(observeDisplayedPreviews))

onMounted(() => {
  componentMounted = true
  showVtgTurns.value = globalThis.location.hostname !== PRODUCTION_PWA_HOSTNAME
  syncPatternControls()

  if (typeof ResizeObserver === 'undefined') return

  const observer = new ResizeObserver((entries) => {
    let renderDimensionsChanged = false
    for (const entry of entries) {
      if (!(entry.target instanceof HTMLElement)) continue

      const index = Number(entry.target.dataset.blankIndex)
      const dimensions = blankDimensions[index]
      if (!dimensions) continue

      const width = roundDimension(entry.contentRect.width)
      const height = roundDimension(entry.contentRect.height)
      renderDimensionsChanged ||=
        Math.round(dimensions.width) !== Math.round(width) ||
        Math.round(dimensions.height) !== Math.round(height)
      dimensions.width = width
      dimensions.height = height
      blankWidth.value = dimensions.width
      blankHeight.value = dimensions.height
    }
    if (renderDimensionsChanged) requestPreviews()
  })
  blankObserver = observer

  observeDisplayedPreviews()
})

onBeforeUnmount(() => {
  componentMounted = false
  hydrationVersion++
  blankObserver?.disconnect()
})

defineExpose({
  blankDimensions,
  blankWidth,
  blankHeight,
  selectedCell,
  selectedCellReference,
  speedRatio,
  isAnti,
  swapProps,
  reversePlane,
  beat,
  transition,
  bpm,
  scale,
  thick,
  spacing,
  paths,
  hands,
  arms,
  leftPropVisible,
  rightPropVisible,
  previewUrls,
})
</script>

<style scoped>
.vtg-pane {
  container-name: concept-pane;
  container-type: inline-size;
  width: 100%;
  min-inline-size: 0;
  min-block-size: 0;
  padding-block-end: var(--size-pane-switch-bottom-clearance);
  color: var(--color-text);
  background: transparent;
}

.vtg-top-options {
  --space-concept-control-inline: clamp(var(--space-1), calc(3.5cqi - 5.3px), var(--space-2));
  --font-size-concept-control: clamp(0.625rem, 3.7cqi, 0.875rem);

  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 45rem);
  min-width: var(--size-concept-content-min-width);
  padding: 0 var(--space-concept-control-row-inline) var(--space-1);
  margin: 0 auto;
  gap: var(--space-1);
  justify-content: center;
}

.vtg-top-options fieldset {
  padding: 0;
  margin: 0;
  border: 0;
}

.vtg-radio-options {
  display: grid;
  gap: var(--space-1);
}

.vtg-ratio-selects {
  display: grid;
  grid-auto-columns: max-content;
  grid-auto-flow: column;
  gap: var(--space-2);
}

.vtg-ratio-select {
  display: grid;
  grid-template-columns: max-content max-content;
  gap: var(--space-1);
  align-items: center;
}

.vtg-ratio-select__label {
  display: grid;
  min-block-size: 2rem;
  padding-inline: var(--space-2);
  color: var(--color-text);
  font-size: var(--font-size-concept-control);
  font-weight: 800;
  letter-spacing: 0.04em;
  background: linear-gradient(90deg, var(--color-surface), transparent);
  border-inline-start: 3px solid var(--color-action-primary);
  border-radius: var(--radius-sm);
  place-items: center;
}

.vtg-ratio-selects select {
  min-block-size: 2rem;
  padding-inline: var(--space-concept-control-inline);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-concept-control);
  font-weight: 700;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.vtg-ratio-selects select:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.vtg-radio-row {
  display: grid;
  grid-auto-columns: max-content;
  grid-auto-flow: column;
  gap: var(--space-1);
  justify-content: center;
}

.vtg-radio-options label {
  position: relative;
  cursor: pointer;
}

.vtg-radio-options input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.vtg-radio-options label > span {
  display: grid;
  padding-block: var(--space-1);
  padding-inline: var(--space-concept-control-inline);
  color: var(--color-text);
  font-size: var(--font-size-concept-control);
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  place-items: center;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.vtg-radio-options input:checked + span {
  color: var(--color-on-action-primary);
  background: var(--color-action-primary);
  border-color: var(--color-action-primary);
}

.vtg-radio-options input:focus-visible + span {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.vtg-transition-static-note {
  box-sizing: border-box;
  width: min(calc(100% - var(--space-2)), 45rem);
  padding: var(--space-2) var(--space-3);
  margin: 0 auto;
  color: var(--color-text);
  font-size: clamp(0.6875rem, 2.7cqi, 0.8125rem);
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  background: color-mix(in srgb, var(--color-status-warning) 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-status-warning) 48%, var(--color-border));
  border-inline-start-width: 3px;
  border-radius: var(--radius-sm);
}

.vtg-pattern-builder-button {
  display: flex;
  width: max-content;
  margin: var(--space-2) auto 0;
  cursor: pointer;
}

.vtg-pattern-builder-actions {
  display: flex;
  width: max-content;
  max-width: calc(100% - var(--space-2));
  margin: var(--space-2) auto;
  align-items: stretch;
  justify-content: center;
  gap: var(--space-2);
}

.vtg-pattern-builder-actions .vtg-pattern-builder-button {
  width: max-content;
  margin: 0;
  flex: 0 0 auto;
}

.vtg-pattern-builder-actions .vtg-pattern-builder-button span {
  box-sizing: border-box;
  width: max-content;
  min-width: 0;
  padding-inline: clamp(var(--space-2), 4cqi, var(--space-4));
  white-space: nowrap;
}

.vtg-pattern-builder-button input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.vtg-pattern-builder-button span {
  position: relative;
  display: flex;
  min-width: 10.5rem;
  min-height: 2.75rem;
  padding: var(--space-2) var(--space-4);
  overflow: hidden;
  color: var(--color-text);
  font: inherit;
  font-size: clamp(0.875rem, 3cqi, 1rem);
  font-weight: 800;
  letter-spacing: 0.055em;
  background:
    linear-gradient(
      115deg,
      color-mix(in srgb, var(--color-action-primary) 16%, transparent),
      transparent 42%
    ),
    var(--color-surface);
  border: 2px solid color-mix(in srgb, var(--color-action-primary) 52%, var(--color-border));
  border-radius: var(--radius-md);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--color-text) 12%, transparent),
    var(--shadow-sm);
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-transform: uppercase;
}

.vtg-pattern-builder-button--advanced span {
  padding-inline: var(--space-3);
  background:
    linear-gradient(
      245deg,
      color-mix(in srgb, var(--color-action-primary) 16%, transparent),
      transparent 42%
    ),
    var(--color-surface);
}

.vtg-pattern-builder-button span::before {
  flex: 0 0 0.75rem;
  width: 0.75rem;
  height: 0.75rem;
  content: '';
  border: 2px solid var(--color-action-primary);
  border-radius: 2px;
  box-shadow: inset 0 0 0 2px var(--color-surface);
  transform: rotate(45deg);
}

.vtg-pattern-builder-button:hover span {
  color: var(--color-action-primary);
  border-color: var(--color-action-primary);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--color-text) 16%, transparent),
    0 0 0 1px color-mix(in srgb, var(--color-action-primary) 25%, transparent),
    var(--shadow-sm);
}

.vtg-pattern-builder-button input:checked + span {
  color: var(--color-on-action-primary);
  background: var(--color-action-primary);
  border-color: var(--color-action-primary);
}

.vtg-pattern-builder-button input:checked + span::before {
  background: var(--color-on-action-primary);
  border-color: var(--color-on-action-primary);
  box-shadow: inset 0 0 0 2px var(--color-action-primary);
}

.vtg-pattern-builder-button input:focus-visible + span {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.vtg-transition-quick-slot-error {
  box-sizing: border-box;
  width: min(calc(100% - var(--space-2)), 45rem);
  padding: var(--space-2) var(--space-3);
  margin: 0 auto;
  color: var(--color-text);
  font-size: clamp(0.6875rem, 2.7cqi, 0.8125rem);
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
  background: color-mix(in srgb, var(--color-status-warning) 14%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-status-warning) 58%, var(--color-border));
  border-inline-start-width: 3px;
  border-radius: var(--radius-sm);
}

.vtg-board {
  /* VTG categories are fixed domain colors, so they intentionally remain stable across themes. */
  --vtg-color-primary: #5968df;
  --vtg-color-secondary: #2dc8a8;
  --vtg-color-ink: #071d26;
  --vtg-color-rule: #111820;
  --vtg-color-rule-text: #f6f8fb;
  --vtg-color-preview: #071421;
  --vtg-color-line: #e9eef2;
  --vtg-board-gap: 0.65cqi;
  --vtg-paired-preview-width: 39%;

  container-type: inline-size;
  display: grid;
  width: 100%;
  min-width: var(--size-concept-content-min-width);
  aspect-ratio: 1;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(7, minmax(0, 1fr));
  gap: 0.65%;
  padding: 0.65%;
}

.vtg-pane--builder-active .vtg-board {
  aspect-ratio: 5 / 3;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
}

.vtg-pane--builder-active .vtg-column-headers {
  grid-column: 2 / span 4;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.vtg-pane--builder-active .vtg-sidebar {
  grid-row: 2 / span 2;
  grid-template-rows: repeat(2, minmax(0, 1fr));
}

.vtg-pane--builder-active .vtg-matrix {
  grid-row: 2 / span 2;
  grid-column: 2 / span 4;
}

.vtg-pane--builder-active .vtg-tile-grid,
.vtg-pane--builder-active .vtg-blank-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
}

.vtg-sidebar {
  display: grid;
  grid-row: 2 / span 6;
  grid-column: 1;
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: var(--vtg-board-gap);
}

.vtg-matrix {
  position: relative;
  grid-row: 2 / span 6;
  grid-column: 2 / span 6;
}

.vtg-tile-grid,
.vtg-blank-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
  gap: var(--vtg-board-gap);
}

.vtg-blank-grid {
  z-index: 2;
  pointer-events: none;
}

.vtg-tile {
  appearance: none;
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0;
  place-items: center;
  color: var(--vtg-color-rule-text);
  cursor: pointer;
  background: var(--vtg-color-primary);
  border: 0;
  border-radius: 1.7cqi;
  box-shadow:
    inset 0 0.15cqi 0.15cqi color-mix(in srgb, var(--vtg-color-rule-text) 12%, transparent),
    0 0.45cqi 1cqi color-mix(in srgb, var(--vtg-color-preview) 22%, transparent);
  font-family: 'Arial Narrow', var(--font-family-sans);
  font-size: max(0.68rem, 2.55cqi);
  font-weight: 700;
  letter-spacing: 0.025em;
  line-height: 1;
  text-rendering: geometricPrecision;
  white-space: nowrap;
}

.vtg-pane--builder-drag-active .vtg-tile {
  touch-action: none;
}

.vtg-tile-grid > .vtg-tile-tooltip {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.vtg-tile-tooltip__text {
  white-space: pre-line;
}

.vtg-tile__spin-toggle {
  position: absolute;
  z-index: 1;
  inset-block-start: max(0.2rem, 0.6cqi);
  inset-inline-start: 50%;
  padding: 0.3em;
  color: var(--vtg-color-ink);
  cursor: pointer;
  background: var(--vtg-color-secondary);
  border: max(1px, 0.12cqi) solid var(--vtg-color-ink);
  border-radius: 0.4em;
  font-family: 'Arial Narrow', var(--font-family-sans);
  font-size: max(0.62rem, 1.7cqi);
  font-weight: 700;
  letter-spacing: 0.025em;
  line-height: 1;
  transform: translateX(-50%);
}

.vtg-tile__spin-toggle--top {
  inset-block-start: max(0.2rem, 0.6cqi);
  inset-block-end: auto;
}

.vtg-tile__spin-toggle--bottom {
  inset-block-start: auto;
  inset-block-end: max(0.2rem, 0.6cqi);
}

.vtg-tile__spin-toggle--left,
.vtg-tile__spin-toggle--right {
  transform: none;
}

.vtg-tile__spin-toggle--left {
  inset-inline-start: max(0.2rem, 0.6cqi);
  inset-inline-end: auto;
}

.vtg-tile__spin-toggle--right {
  inset-inline-start: auto;
  inset-inline-end: max(0.2rem, 0.6cqi);
}

.vtg-tile__spin-toggle:focus-visible {
  outline: max(2px, 0.2cqi) solid var(--vtg-color-rule-text);
  outline-offset: max(1px, 0.1cqi);
}

.vtg-tile--highlighted {
  color: var(--vtg-color-ink);
  background: var(--vtg-color-secondary);
}

.vtg-tile--selected {
  box-shadow:
    inset 0 0 0 max(2px, 0.28cqi) var(--vtg-color-rule-text),
    inset 0 0 0 max(4px, 0.52cqi) var(--vtg-color-ink),
    0 0.45cqi 1cqi color-mix(in srgb, var(--vtg-color-preview) 22%, transparent);
}

.vtg-blank {
  z-index: 3;
  align-self: start;
  justify-self: start;
  width: 78%;
  aspect-ratio: 1;
  background: color-mix(in srgb, var(--vtg-color-preview) 94%, transparent);
  border-radius: 0.9cqi;
  box-shadow: 0 0.35cqi 0.85cqi color-mix(in srgb, var(--vtg-color-preview) 30%, transparent);
  transform: translate(-50%, calc(-50% - 0.33cqi));
}

.vtg-blank--paired {
  width: var(--vtg-paired-preview-width);
  align-self: center;
  justify-self: center;
  transform: none;
}

.vtg-pane--classic .vtg-blank--paired {
  width: 78%;
}

.vtg-tile--paired-left .vtg-tile__label,
.vtg-tile--paired-right .vtg-tile__label,
.vtg-tile--paired-top .vtg-tile__label,
.vtg-tile--paired-bottom .vtg-tile__label,
.vtg-tile--shared-preview-top .vtg-tile__label,
.vtg-tile--shared-preview-bottom .vtg-tile__label {
  position: absolute;
  display: grid;
  place-items: center;
}

.vtg-tile--paired-left .vtg-tile__label,
.vtg-tile--paired-right .vtg-tile__label {
  inline-size: auto;
}

.vtg-tile--paired-left .vtg-tile__label {
  inset: 0 var(--vtg-paired-preview-width) 0 0;
}

.vtg-tile--paired-right .vtg-tile__label {
  inset: 0 0 0 var(--vtg-paired-preview-width);
}

.vtg-tile--paired-left .vtg-tile__label-text {
  transform: rotate(-90deg);
}

.vtg-tile--paired-right .vtg-tile__label-text {
  transform: rotate(90deg);
}

.vtg-tile--paired-left .vtg-tile__label-text,
.vtg-tile--paired-right .vtg-tile__label-text {
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  translate: -50% -50%;
  white-space: nowrap;
}

.vtg-tile__label {
  display: grid;
  place-items: center;
}

.vtg-tile__label > .vtg-tile__label-text {
  grid-area: 1 / 1;
}

.vtg-label-swap-enter-active,
.vtg-label-swap-leave-active {
  transition:
    opacity var(--transition-label-swap) var(--vtg-label-swap-delay, 0ms),
    scale var(--transition-label-swap) var(--vtg-label-swap-delay, 0ms),
    filter var(--transition-label-swap) var(--vtg-label-swap-delay, 0ms);
}

.vtg-label-swap-enter-from,
.vtg-label-swap-leave-to {
  opacity: 0;
  scale: 0.72;
  filter: blur(3px);
}

.vtg-tile__elements {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.vtg-tile--paired-top .vtg-tile__label,
.vtg-tile--paired-bottom .vtg-tile__label,
.vtg-tile--shared-preview-top .vtg-tile__label,
.vtg-tile--shared-preview-bottom .vtg-tile__label {
  block-size: auto;
  inline-size: 100%;
}

.vtg-tile--paired-top .vtg-tile__label,
.vtg-tile--shared-preview-top .vtg-tile__label {
  inset: 0 0 var(--vtg-paired-preview-width);
}

.vtg-tile--paired-bottom .vtg-tile__label,
.vtg-tile--shared-preview-bottom .vtg-tile__label {
  inset: var(--vtg-paired-preview-width) 0 0;
}

.vtg-tile--paired-top .vtg-tile__label-text,
.vtg-tile--paired-bottom .vtg-tile__label-text {
  transform: none;
}

.vtg-blank__preview {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.vtg-shuffle {
  appearance: none;
  display: grid;
  grid-row: 1;
  grid-column: 1;
  padding: 0;
  color: var(--vtg-color-ink);
  cursor: pointer;
  background: var(--vtg-color-secondary);
  border: 0;
  border-radius: 0.75cqi;
  box-shadow: 0 0.4cqi 0.9cqi color-mix(in srgb, var(--vtg-color-preview) 22%, transparent);
  place-items: center;
}

.vtg-shuffle-tooltip {
  display: flex;
  min-width: 0;
  min-height: 0;
  grid-row: 1;
  grid-column: 1;
}

.vtg-shuffle-tooltip > .vtg-shuffle {
  width: 100%;
  height: 100%;
}

.vtg-spin-toggle-tooltip.tooltip-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.vtg-spin-toggle-tooltip > .vtg-tile__spin-toggle {
  pointer-events: auto;
}

.vtg-column-headers {
  display: grid;
  grid-row: 1;
  grid-column: 2 / span 6;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--vtg-board-gap);
}

.vtg-pane--classic .vtg-shuffle-tooltip,
.vtg-pane--classic .vtg-shuffle {
  grid-row: 7;
}

.vtg-pane--classic .vtg-column-headers {
  grid-row: 7;
}

.vtg-pane--classic .vtg-sidebar,
.vtg-pane--classic .vtg-matrix {
  grid-row: 1 / span 6;
}

.vtg-pane__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}

@media (prefers-reduced-motion: reduce) {
  .vtg-label-swap-enter-active,
  .vtg-label-swap-leave-active {
    transition: none;
  }
}
</style>
