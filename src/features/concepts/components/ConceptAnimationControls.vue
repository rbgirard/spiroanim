<template>
  <div class="concept-button-rows">
    <slot
      name="before-controls"
      :begin-slider-history="beginSliderHistory"
      :end-slider-history="endSliderHistory"
    />

    <slot name="between-controls" />
  </div>

  <slot name="before-customize" />

  <details
    class="concept-customize"
    :data-role="`${rolePrefix}-customize`"
    :open="customizeExpanded"
  >
    <summary
      :data-role="`${rolePrefix}-customize-toggle`"
      @click.prevent="customizeExpanded = !customizeExpanded"
    >
      CUSTOMIZE...
    </summary>
    <div class="concept-customize__content">
      <fieldset
        class="concept-pattern-options concept-render-options vtg-pattern-options vtg-render-options"
      >
        <legend class="concept-controls__visually-hidden">Rendered features</legend>
        <slot name="before-render-controls" />
        <AppTooltip text="Show the complete prop motion paths">
          <template #activator="{ props: activatorProps }">
            <label v-bind="activatorProps">
              <input
                v-model="paths"
                type="checkbox"
                aria-label="Show the complete prop motion paths"
                :data-role="`${rolePrefix}-paths`"
              />
              <span>Paths</span>
            </label>
          </template>
        </AppTooltip>
        <AppTooltip text="Show the hand motion paths">
          <template #activator="{ props: activatorProps }">
            <label v-bind="activatorProps">
              <input
                v-model="hands"
                type="checkbox"
                aria-label="Show the hand motion paths"
                :data-role="`${rolePrefix}-hands`"
              />
              <span>Hands</span>
            </label>
          </template>
        </AppTooltip>
        <AppTooltip text="Show the performer's arms">
          <template #activator="{ props: activatorProps }">
            <label v-bind="activatorProps">
              <input
                v-model="arms"
                type="checkbox"
                aria-label="Show the performer's arms"
                :data-role="`${rolePrefix}-arms`"
              />
              <span>Arms</span>
            </label>
          </template>
        </AppTooltip>
        <AppTooltip text="Show the left prop">
          <template #activator="{ props: activatorProps }">
            <label v-bind="activatorProps">
              <input
                v-model="leftPropVisible"
                type="checkbox"
                aria-label="Show the left prop"
                :data-role="`${rolePrefix}-left`"
              />
              <span>Left</span>
            </label>
          </template>
        </AppTooltip>
        <AppTooltip text="Show the right prop">
          <template #activator="{ props: activatorProps }">
            <label v-bind="activatorProps">
              <input
                v-model="rightPropVisible"
                type="checkbox"
                aria-label="Show the right prop"
                :data-role="`${rolePrefix}-right`"
              />
              <span>Right</span>
            </label>
          </template>
        </AppTooltip>
        <slot name="after-controls" />
      </fieldset>

      <fieldset
        class="concept-slider-controls vtg-slider-controls"
        :class="{ 'concept-slider-controls--touch': protectTouchScrolling }"
      >
        <legend class="concept-controls__visually-hidden">Animation settings</legend>
        <div v-if="showScale">
          <span class="concept-slider-controls__label vtg-slider-controls__label">
            <span>Scale</span>
            <output v-if="sliders">{{ scale.toFixed(1) }}</output>
          </span>
          <input
            v-if="sliders"
            v-model.number="scale"
            type="range"
            :min="vtgScaleControl.min"
            :max="vtgScaleControl.max"
            :step="vtgScaleControl.step"
            :data-role="`${rolePrefix}-scale`"
            @pointerdown="beginPointerSlider"
            @pointerup="endPointerSlider"
            @pointercancel="cancelPointerSlider"
          />
          <ConceptStepper
            v-else
            v-model="scale"
            label="Scale"
            :data-role="`${rolePrefix}-scale-stepper`"
            :min="vtgScaleControl.min"
            :max="vtgScaleControl.max"
            :step="vtgScaleControl.step"
            :display-value="scale.toFixed(1)"
          />
        </div>
        <div>
          <span class="concept-slider-controls__label vtg-slider-controls__label">
            <span>Thick</span>
            <output v-if="sliders">{{ thick }}</output>
          </span>
          <input
            v-if="sliders"
            v-model.number="thick"
            type="range"
            :min="vtgThickControl.min"
            :max="vtgThickControl.max"
            :step="vtgThickControl.step"
            :data-role="`${rolePrefix}-thick`"
            @pointerdown="beginPointerSlider"
            @pointerup="endPointerSlider"
            @pointercancel="cancelPointerSlider"
          />
          <ConceptStepper
            v-else
            v-model="thick"
            label="Thick"
            :data-role="`${rolePrefix}-thick-stepper`"
            :min="vtgThickControl.min"
            :max="vtgThickControl.max"
            :step="vtgThickControl.step"
            :display-value="String(thick)"
          />
        </div>
        <div>
          <span class="concept-slider-controls__label vtg-slider-controls__label">
            <span>Spacing</span>
            <output v-if="sliders">{{ spacing }}</output>
          </span>
          <input
            v-if="sliders"
            v-model.number="spacing"
            type="range"
            :min="vtgSpacingControl.min"
            :max="vtgSpacingControl.max"
            :step="vtgSpacingControl.step"
            :data-role="`${rolePrefix}-spacing`"
            @pointerdown="beginPointerSlider"
            @pointerup="endPointerSlider"
            @pointercancel="cancelPointerSlider"
          />
          <ConceptStepper
            v-else
            v-model="spacing"
            label="Spacing"
            :data-role="`${rolePrefix}-spacing-stepper`"
            :min="vtgSpacingControl.min"
            :max="vtgSpacingControl.max"
            :step="vtgSpacingControl.step"
            :display-value="String(spacing)"
          />
        </div>
        <div>
          <span class="concept-slider-controls__label vtg-slider-controls__label">
            <span>BPM</span>
            <output v-if="sliders">{{ bpm }}</output>
          </span>
          <input
            v-if="sliders"
            v-model.number="bpm"
            type="range"
            :min="vtgBpmControl.min"
            :max="vtgBpmControl.max"
            :step="vtgBpmControl.step"
            :data-role="`${rolePrefix}-bpm`"
            @pointerdown="beginPointerSlider"
            @pointerup="endPointerSlider"
            @pointercancel="cancelPointerSlider"
          />
          <ConceptStepper
            v-else
            v-model="bpm"
            label="BPM"
            :data-role="`${rolePrefix}-bpm-stepper`"
            :min="vtgBpmControl.min"
            :max="vtgBpmControl.max"
            :step="10"
            :display-value="String(bpm)"
          />
        </div>
      </fieldset>

      <fieldset class="concept-color-controls">
        <legend class="concept-controls__visually-hidden">Prop colors</legend>
        <label>
          <span>Left</span>
          <select v-model="leftPropColor" :data-role="`${rolePrefix}-left-color`">
            <option v-for="color in propColors" :key="color" :value="color">{{ color }}</option>
          </select>
        </label>
        <label>
          <span>Right</span>
          <select v-model="rightPropColor" :data-role="`${rolePrefix}-right-color`">
            <option v-for="color in propColors" :key="color" :value="color">{{ color }}</option>
          </select>
        </label>
        <label class="concept-color-controls__prop">
          <span>Prop</span>
          <select v-model.number="prop" :data-role="`${rolePrefix}-prop-type`">
            <option v-for="(propName, index) in propTypes" :key="propName" :value="index">
              {{ propName }}
            </option>
          </select>
        </label>
      </fieldset>
      <div
        class="concept-pattern-options concept-customize__display-options"
        role="group"
        aria-label="Usability Settings"
      >
        <span class="concept-customize__display-title">Usability Settings</span>
        <label>
          <input v-model="sliders" type="checkbox" :data-role="`${rolePrefix}-sliders`" />
          <span>Sliders</span>
        </label>
      </div>
    </div>
  </details>

  <slot name="after-customize" />
</template>

<script setup lang="ts">
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import AppTooltip from '@/components/AppTooltip.vue'
import {
  vtgBpmControl,
  vtgScaleControl,
  vtgSpacingControl,
  vtgThickControl,
} from '@/features/vtg/data/vtgPlayerSettings'
import { useQSMainStore } from '@/stores/useQSMainStore'
import type { RootDataFinal } from '@/types/AnimTypes'
import { useTouchSafeRangeSlider } from '@/composables/useTouchSafeRangeSlider'
import { COLORS, PTEXT } from '@/domain/animation/AnimStruct'
import ConceptStepper from '@/features/concepts/components/ConceptStepper.vue'

const props = withDefaults(
  defineProps<{
    animation?: RootDataFinal
    rolePrefix?: string
    showScale?: boolean
  }>(),
  { rolePrefix: 'vtg', showScale: true },
)

const {
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
  leftPropColor,
  rightPropColor,
  prop,
  sliders,
} = storeToRefs(useConceptsStore())
const propColors = COLORS
const propTypes = PTEXT

watch(
  [leftPropVisible, rightPropVisible],
  ([leftVisible, rightVisible], previousVisibility) => {
    if (leftVisible || rightVisible) return

    const [previousLeft, previousRight] = previousVisibility ?? [true, true]
    if (!previousLeft && previousRight) leftPropVisible.value = true
    else rightPropVisible.value = true
  },
  { flush: 'sync', immediate: true },
)

const { beginHistoryGroup, endHistoryGroup } = useQSMainStore()
let sliderHistoryActive = false

const beginSliderHistory = () => {
  if (sliderHistoryActive || props.animation === undefined) return

  beginHistoryGroup(props.animation)
  sliderHistoryActive = true
}

const endSliderHistory = () => {
  if (!sliderHistoryActive) return

  sliderHistoryActive = false
  endHistoryGroup()
}

const { protectTouchScrolling, beginPointerSlider, endPointerSlider, cancelPointerSlider } =
  useTouchSafeRangeSlider({ begin: () => {}, end: () => {} })

onBeforeUnmount(endSliderHistory)
</script>

<style scoped>
.concept-customize {
  box-sizing: border-box;
  width: min(calc(100% - var(--space-2)), 45rem);
  min-width: var(--size-concept-content-min-width);
  margin: var(--space-1) auto 0;
  overflow: hidden;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.concept-customize summary {
  display: flex;
  padding: var(--space-2) var(--space-3);
  color: var(--color-action-primary);
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  list-style: none;
  background: color-mix(in srgb, var(--color-action-primary) 7%, var(--color-surface));
  align-items: center;
  justify-content: space-between;
  transition: background var(--transition-fast);
}

.concept-customize summary::-webkit-details-marker {
  display: none;
}

.concept-customize summary::after {
  content: '+';
  font-size: 1rem;
}

.concept-customize[open] summary::after {
  content: '-';
}

.concept-customize[open] summary {
  background: color-mix(in srgb, var(--color-action-primary) 13%, var(--color-surface));
  border-block-end: 1px solid var(--color-border);
}

.concept-customize summary:hover {
  background: color-mix(in srgb, var(--color-action-primary) 13%, var(--color-surface));
}

.concept-customize summary:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: -2px;
}

.concept-customize__content {
  display: grid;
  padding-block: var(--space-1) var(--space-2);
  row-gap: var(--space-1);
}

.concept-slider-controls {
  display: flex;
  width: min(100%, 45rem);
  padding: var(--space-1) var(--space-2) 0;
  margin: 0 auto;
  border: 0;
  flex-wrap: wrap;
  column-gap: var(--space-4);
  row-gap: var(--space-1);
}

.concept-color-controls {
  display: grid;
  width: min(100%, 45rem);
  padding: var(--space-1) var(--space-2);
  margin: 0 auto;
  border: 0;
  grid-template-columns: repeat(2, minmax(9rem, 16rem));
  gap: var(--space-3);
  justify-content: center;
}

.concept-color-controls label {
  display: grid;
  width: 100%;
  gap: var(--space-1);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-weight: 700;
}

.concept-color-controls select {
  width: 100%;
}

.concept-slider-controls > div {
  display: grid;
  flex: 1 1 9rem;
  min-width: 9rem;
  gap: 0;
}

.concept-slider-controls__label {
  display: flex;
  color: var(--color-text);
  font-size: 0.8125rem;
  font-weight: 700;
  justify-content: space-between;
}

.concept-slider-controls output {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.concept-slider-controls input {
  width: 100%;
  margin-block: 0;
  cursor: pointer;
  accent-color: var(--color-action-primary);
}

.concept-slider-controls--touch input {
  touch-action: pan-y;
}

.concept-slider-controls input:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.concept-pattern-options {
  display: grid;
  grid-auto-columns: max-content;
  grid-auto-flow: column;
  padding: 0;
  margin: 0;
  border: 0;
  gap: var(--space-1);
}

.concept-pattern-options.concept-customize__display-options {
  display: grid;
  box-sizing: border-box;
  width: min(100%, 45rem);
  padding: var(--space-2);
  margin: var(--space-1) auto 0;
  border-block-start: 1px solid var(--color-border);
  grid-auto-flow: column;
  gap: var(--space-3);
  align-items: center;
  justify-content: center;
}

.concept-customize__display-title {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.concept-pattern-options label {
  position: relative;
  cursor: pointer;
}

.concept-pattern-options input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.concept-pattern-options label > span {
  display: grid;
  padding: var(--space-2);
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 700;
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

.concept-pattern-options input:checked + span {
  color: var(--color-on-action-primary);
  background: var(--color-action-primary);
  border-color: var(--color-action-primary);
}

.concept-pattern-options input:focus-visible + span {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}

.concept-button-rows {
  --space-concept-control-inline: clamp(2px, 1.5cqi, var(--space-2));
  --font-size-concept-control: clamp(0.625rem, 3cqi, 0.875rem);

  container-type: inline-size;
  display: grid;
  margin-block-start: 2px;
  row-gap: var(--space-1);
}

.concept-render-options {
  --space-concept-control-inline: clamp(var(--space-1), 2.3cqi, var(--space-2));
  --font-size-concept-control: clamp(0.625rem, 4cqi, 0.875rem);

  container-type: inline-size;
  box-sizing: border-box;
  width: min(100%, 45rem);
  min-width: var(--size-concept-content-min-width);
  padding-inline: var(--space-concept-control-row-inline);
  margin: 0 auto;
  justify-content: center;
}

.concept-render-options label {
  min-width: 0;
}

.concept-render-options label > span {
  padding-block: var(--space-1);
  padding-inline: var(--space-concept-control-inline);
  font-size: var(--font-size-concept-control);
  white-space: nowrap;
}

.concept-controls__visually-hidden {
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
</style>
