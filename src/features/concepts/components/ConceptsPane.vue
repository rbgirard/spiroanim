<template>
  <section class="concepts-pane scrollbar" aria-label="Concepts" data-concepts-pane>
    <div
      v-if="selectedConcept === 'vtg'"
      class="concepts-pane__docs-anchor"
      data-role="concept-docs-anchor"
    >
      <ConceptDocsMenu :return-path="docsReturnPath" />
    </div>

    <div v-if="quickSlotCount === 0" class="concepts-pane__empty-quick-slots">
      <div class="concepts-pane__identity" data-role="concepts-identity">
        <span class="concepts-pane__identity-brand">SpiroAnim.com</span>
        <span class="concepts-pane__identity-label">Concepts</span>
      </div>
    </div>

    <QuickSlotsControl
      v-if="quickSlotCount > 0"
      @apply="emit('quickSlotApply', $event)"
      @save="emit('quickSlotSave', $event)"
    />

    <div
      class="concepts-pane__selector-row"
      :class="{ 'concepts-pane__selector-row--with-create': quickSlotCount === 0 }"
    >
      <select
        v-model="selectedConcept"
        class="concepts-pane__selector"
        aria-label="Concept"
        data-role="concept-selector"
      >
        <option value="vtg">Vulcan Tech Gospel 4</option>
        <option value="8stp">Eight Step</option>
        <option value="qst">Quarter Space Tech</option>
        <option value="tka">The Kinetic Alphabet</option>
      </select>

      <AppTooltip
        v-if="quickSlotCount === 0"
        text="Create four Quick Slots"
        :disabled="touchDevice"
      >
        <template #activator="{ props: activatorProps }">
          <QuickSlotVisual
            v-bind="activatorProps"
            aria-label="Create four Quick Slots"
            data-role="quick-slots-create"
            @click="createQuickSlots"
          >
            <BaseIcon :path="mdiPlus" :size="18" />
          </QuickSlotVisual>
        </template>
      </AppTooltip>
    </div>

    <VtgPane
      v-if="selectedConcept === 'vtg'"
      :animation="animation"
      :animation-revision="animationRevision"
      :animation-ready="animationReady"
      :pattern-matcher="patternMatcher"
      :builder-active="builderActive"
      :builder-full-catalog="builderFullCatalog"
      :builder-full-catalog-forced="builderFullCatalogForced"
      :builder-full-grid="builderFullGrid"
      :builder-insertion-index="builderInsertionIndex"
      :builder-match-animation="builderMatchAnimation"
      @pattern-select="emit('patternSelect', $event)"
      @pattern-preview="emit('patternPreview', $event)"
      @customize="emit('customize', $event)"
      @quick-slots-create="emit('quickSlotsCreate', $event)"
      @animation-update="emit('animationUpdate', $event)"
      @builder-open="emit('builderOpen', $event)"
      @composer-cell-change="updateComposerCell"
      @update:builder-full-grid="emit('update:builderFullGrid', $event)"
    />
    <EightStepPane
      v-else-if="selectedConcept === '8stp'"
      :animation="animation"
      :animation-ready="animationReady"
      :builder-active="builderActive"
      :pattern-matcher="patternMatcher"
      @pattern-select="emit('patternSelect', $event)"
      @customize="emit('customize', $event)"
      @animation-update="emit('animationUpdate', $event)"
      @builder-open="emit('builderOpen', $event)"
      @pattern-matched="emit('eightStepPatternMatched')"
      @composer-cell-change="updateComposerCell"
    />
    <QuarterSpaceTechPane
      v-else-if="selectedConcept === 'qst'"
      :animation="animation"
      :animation-ready="animationReady"
      :pattern-matcher="patternMatcher"
      @pattern-select="emit('patternSelect', $event)"
      @customize="emit('customize', $event)"
    />
    <KineticAlphabetPane v-else />
  </section>
</template>

<script setup lang="ts">
import EightStepPane from '@/features/eight-step/components/EightStepPane.vue'
import { mdiPlus } from '@mdi/js'
import AppTooltip from '@/components/AppTooltip.vue'
import BaseIcon from '@/components/icons/BaseIcon.vue'
import ConceptDocsMenu from '@/features/concepts/components/ConceptDocsMenu.vue'
import { usePatternMatchingClient } from '@/features/concepts/composables/usePatternMatchingWorker'
import QuickSlotsControl from '@/features/concepts/components/QuickSlotsControl.vue'
import QuickSlotVisual from '@/features/concepts/components/QuickSlotVisual.vue'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import type { ConceptPatternSelection } from '@/features/concepts/types'
import type { ComposerCell } from '@/features/kinetic-alphabet/composerBridge'
import KineticAlphabetPane from '@/features/kinetic-alphabet/components/KineticAlphabetPane.vue'
import QuarterSpaceTechPane from '@/features/quarter-space-tech/components/QuarterSpaceTechPane.vue'
import VtgPane from '@/features/vtg/components/VtgPane.vue'
import type { RootDataFinal } from '@/types/AnimTypes'
import { isTouchDevice } from '@/utils/device'

const props = defineProps<{
  animation?: RootDataFinal
  animationRevision?: number
  animationReady?: boolean
  builderActive?: boolean
  builderFullCatalog?: boolean
  builderFullCatalogForced?: boolean
  builderFullGrid?: boolean
  builderInsertionIndex?: number
  builderMatchAnimation?: RootDataFinal
  docsReturnPath?: string
  pane?: 'left' | 'right' | 'hidden'
}>()

const emit = defineEmits<{
  patternSelect: [selection: ConceptPatternSelection]
  patternPreview: [selection: ConceptPatternSelection]
  customize: [selection: ConceptPatternSelection]
  quickSlotApply: [path: string]
  quickSlotSave: [slot: number]
  quickSlotsCreate: [animations: readonly RootDataFinal[]]
  animationUpdate: [animation: RootDataFinal]
  builderOpen: [source: 'manual' | 'automatic']
  eightStepPatternMatched: []
  composerCellChange: [cell: ComposerCell | null]
  'update:builderFullGrid': [enabled: boolean]
}>()

const conceptsStore = useConceptsStore()
const { quickSlotCount, selectedConcept } = storeToRefs(conceptsStore)

const composerCell = ref<ComposerCell | null>(null)
const reportsComposerCell = computed(
  () => selectedConcept.value === 'vtg' || selectedConcept.value === '8stp',
)

const updateComposerCell = (cell: ComposerCell | null) => {
  composerCell.value = cell
  emit('composerCellChange', cell)
}

/**
 * Only the VTG and Eight Step matrices can recognize a catalog cell, so the last cell they
 * reported stays valid while the same animation is loaded and the reader is on another concept.
 * A different animation arriving while one of those concepts is open would otherwise leave a link
 * pointing at the previous pattern.
 */
watch(
  [
    () => props.animationRevision,
    // Standalone consumers that do not provide a revision retain the original prop-update API.
    () => (props.animationRevision === undefined ? props.animation : undefined),
  ],
  () => {
    if (!reportsComposerCell.value) updateComposerCell(null)
  },
)

const usesPatternMatching = computed(
  () =>
    selectedConcept.value !== 'tka' &&
    (!props.builderActive ||
      (selectedConcept.value === 'vtg' && props.builderMatchAnimation !== undefined)),
)
const patternMatcher = usePatternMatchingClient(usesPatternMatching)

const createQuickSlots = () => {
  conceptsStore.restoreQuickSlots()
  conceptsStore.selectedQuickSlot = 1
}

const touchDevice = typeof navigator !== 'undefined' && isTouchDevice()
</script>

<style scoped>
.concepts-pane {
  width: 100%;
  height: 100%;
  min-inline-size: 0;
  min-block-size: 0;
  overflow: auto;
  overscroll-behavior: contain;
  color: var(--color-text);
}

.concepts-pane__docs-anchor {
  position: sticky;
  inset-block-start: 1px;
  inset-inline-end: 1px;
  z-index: 2900;
  width: var(--size-concepts-docs-trigger);
  height: calc(var(--size-editor-toolbar-height) - 1px);
  margin-inline-start: auto;
  margin-block-end: calc(1px - var(--size-editor-toolbar-height));
  overflow: visible;
  pointer-events: none;
}

.concepts-pane__identity {
  position: relative;
  box-sizing: border-box;
  display: flex;
  width: min(15.5rem, calc(100% - var(--size-concepts-docs-trigger) - var(--space-1)));
  height: var(--size-quick-slot-control);
  padding: 0.28rem var(--space-3);
  overflow: clip;
  pointer-events: none;
  background:
    linear-gradient(
      110deg,
      color-mix(in srgb, var(--color-action-primary) 15%, transparent),
      transparent 46%
    ),
    linear-gradient(
      290deg,
      color-mix(in srgb, var(--color-element-water) 11%, transparent),
      transparent 55%
    ),
    color-mix(in srgb, var(--color-surface) 82%, transparent);
  background-size:
    180% 180%,
    180% 180%,
    auto;
  border: 1px solid color-mix(in srgb, var(--color-action-primary) 55%, var(--color-border));
  border-inline-start: 3px solid var(--color-action-primary);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--color-text) 10%, transparent),
    0 0 0.3rem color-mix(in srgb, var(--color-action-primary) 5%, transparent);
  align-items: center;
  gap: 0.45rem;
  line-height: 1.1;
  animation: concepts-identity-aurora 6s ease-in-out infinite alternate;
}

.concepts-pane__empty-quick-slots {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-height: calc(var(--size-quick-slot-control) + (2 * var(--space-1)));
  padding-block: var(--space-1);
  align-items: center;
}

.concepts-pane__identity::after {
  position: absolute;
  inset-inline-start: 0;
  inset-block-end: 0;
  width: 35%;
  height: 2px;
  content: '';
  background: linear-gradient(
    90deg,
    var(--color-action-primary),
    var(--color-element-water),
    transparent
  );
  transform: translateX(-110%);
  animation: concepts-identity-energy 3.6s ease-in-out infinite;
}

.concepts-pane__identity-brand,
.concepts-pane__identity-label {
  position: relative;
  z-index: 1;
  white-space: nowrap;
}

.concepts-pane__identity-brand {
  color: var(--color-text);
  font-size: 0.64rem;
  font-weight: 900;
  letter-spacing: 0.055em;
}

.concepts-pane__identity-label {
  color: color-mix(in srgb, var(--color-action-primary) 72%, var(--color-text));
  font-size: 0.79rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-shadow: 0 0 0.4rem color-mix(in srgb, var(--color-action-primary) 24%, transparent);
}

@keyframes concepts-identity-aurora {
  from {
    background-position:
      0% 50%,
      100% 50%,
      0 0;
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--color-text) 9%, transparent),
      0 0 0.25rem color-mix(in srgb, var(--color-action-primary) 4%, transparent);
  }

  to {
    background-position:
      100% 50%,
      0% 50%,
      0 0;
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--color-text) 12%, transparent),
      0 0 0.45rem color-mix(in srgb, var(--color-action-primary) 8%, transparent);
  }
}

@keyframes concepts-identity-energy {
  0%,
  18% {
    opacity: 0.3;
    transform: translateX(-110%);
  }

  58% {
    opacity: 0.72;
    transform: translateX(285%);
  }

  82%,
  100% {
    opacity: 0.24;
    transform: translateX(285%);
  }
}

.concepts-pane__selector-row {
  display: flex;
  width: min(100%, 18rem);
  margin: var(--space-2) auto;
  gap: var(--space-1);
  align-items: stretch;
}

.concepts-pane__selector-row--with-create {
  width: min(100%, 20.25rem);
}

.concepts-pane__selector {
  display: block;
  min-width: 0;
  flex: 1 1 auto;
  min-height: 2.75rem;
  padding: var(--space-2) var(--space-3);
  margin: 0;
  color: var(--color-text);
  font: inherit;
  font-size: 1.05rem;
  font-weight: 800;
  background: color-mix(in srgb, var(--color-action-primary) 9%, var(--color-surface));
  border: 2px solid color-mix(in srgb, var(--color-action-primary) 72%, var(--color-border));
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.concepts-pane__selector:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .concepts-pane__identity,
  .concepts-pane__identity::after {
    animation: none;
  }
}
</style>
