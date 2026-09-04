<template>
  <div class="shift-container">
    <AppTooltip>
      <template #activator="{ props: tooltipProps }">
        <a
          v-bind="tooltipProps"
          href="#"
          :aria-disabled="!canShift"
          :class="{ 'shift-link--warning': canShift && endpointsMismatch }"
          @click.prevent="activate"
        >
          Shift
        </a>
      </template>
      <template #html>
        <strong>Shift</strong><br />
        Moves the chosen number of animation intervals from the start of every selected prop or
        selected timeline range to the end.<br />
        Existing position and rotation paths stay in place when the first and last frames match. A
        warning appears before shifting unmatched endpoints. The final frame keeps its outgoing
        properties.
      </template>
    </AppTooltip>
    <div v-show="pINPUT === inputName" class="shift-controls">
      <label class="shift-count">
        <span>Times: {{ shiftCount }}</span>
        <input
          v-model.number="shiftCount"
          type="range"
          min="1"
          :max="maxShiftCount"
          :disabled="!canShift"
        />
      </label>
      <button class="action-button" type="button" :disabled="!canShift" @click="clickShift">
        APPLY
      </button>
    </div>
    <BaseDialog
      v-model="warningOpen"
      class="shift-warning"
      title="Shift unmatched endpoints?"
      close-label="Close shift warning"
    >
      <p>
        The first and last frames do not have matching positions and rotations. Shifting this
        pattern may change its path in unexpected ways.
      </p>
      <label class="shift-warning__choice">
        <input v-model="skipWarningChoice" type="checkbox" />
        <span>Do not show again</span>
      </label>
      <div class="shift-warning__actions">
        <button type="button" class="shift-warning__cancel" @click="cancelWarning">Cancel</button>
        <button type="button" class="shift-warning__proceed" @click="confirmShift">
          Shift anyway
        </button>
      </div>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import AppTooltip from '@/components/AppTooltip.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import { useProperties } from '@/features/editor/composables/useProperties'
import {
  animationRangeEndpointsAlign,
  shiftAnimationFrameRange,
} from '@/math/animation/shiftAnimationFrames'
import { resolveAnimationFrames } from '@/math/animation/frameSemantics'
import { useManageProperties } from '@/features/editor/composables/useManageProperties'
import { usePropertiesStore } from '@/features/editor/stores/usePropertiesStore'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useQSMainStore } from '@/stores/useQSMainStore'

const store = inject('store', ref('main'))
const playerStore = usePlayerStore(store.value)
const { ROOT, COMPILED } = playerStore.raw()
const { PLAYING, SELECTION, SELECTED, ETIMES } = storeToRefs(playerStore)
const { pINPUT, pSELECTED } = useProperties(store.value)
const shiftCount = toRef(usePropertiesStore(store.value).$state, 'pSHIFT', 1)
const { propSelection } = useManageProperties(store.value)
const { beginHistoryGroup, endHistoryGroup } = useQSMainStore()
const inputName = 'manage.shift'
const warningOpen = ref(false)
const skipWarningChoice = ref(false)
const suppressMismatchWarning = ref(false)

const selectedPropIndices = computed(() =>
  Object.keys(pSELECTED.value)
    .map(Number)
    .filter((index) => pSELECTED.value[index] && ROOT.value.props[index] !== undefined),
)

interface ShiftTarget {
  propIndex: number
  startIndex: number
  endIndex: number
}

const shiftTargets = computed<ShiftTarget[]>(() => {
  if (!SELECTION.value) {
    return selectedPropIndices.value.map((propIndex) => ({
      propIndex,
      startIndex: 0,
      endIndex: ROOT.value.props[propIndex]!.anim.length - 1,
    }))
  }

  const targets: ShiftTarget[] = []
  propSelection((propIndex, startIndex, endIndex) => {
    targets.push({ propIndex, startIndex, endIndex })
  })
  return targets
})

const targetIsShiftable = ({ propIndex, startIndex, endIndex }: ShiftTarget) => {
  const frames = COMPILED.value.props[propIndex]?.anim
  return (
    frames !== undefined &&
    startIndex >= 0 &&
    endIndex < frames.length &&
    endIndex - startIndex >= 2
  )
}

const canShift = computed(
  () =>
    !PLAYING.value && shiftTargets.value.length > 0 && shiftTargets.value.every(targetIsShiftable),
)

const maxShiftCount = computed(() => {
  if (shiftTargets.value.length === 0) return 1
  return Math.max(
    1,
    Math.min(...shiftTargets.value.map(({ startIndex, endIndex }) => endIndex - startIndex)),
  )
})

const endpointsMismatch = computed(() =>
  shiftTargets.value.some(({ propIndex, startIndex, endIndex }) => {
    const frames = COMPILED.value.props[propIndex]?.anim
    return frames !== undefined && !animationRangeEndpointsAlign(frames, startIndex, endIndex)
  }),
)

const performShift = async () => {
  const targets = shiftTargets.value.map((target) => ({ ...target }))
  const repetitions = Math.min(Math.max(shiftCount.value, 1), maxShiftCount.value)
  const selectedTimes = SELECTION.value
    ? ([ETIMES.value[SELECTED.value[0]!], ETIMES.value[SELECTED.value[1]!]] as const)
    : undefined
  beginHistoryGroup(ROOT.value)
  try {
    const shiftedProps = targets.map(({ propIndex, startIndex, endIndex }) => {
      const prop = ROOT.value.props[propIndex]!
      const compiled = COMPILED.value.props[propIndex]!.anim
      const followingFrame = prop.anim[endIndex + 1]
      const frames = shiftAnimationFrameRange(prop.anim, compiled, startIndex, endIndex, {
        allowEndpointMismatch: true,
        preserveFinalOutgoing: true,
        shiftCount: repetitions,
      })
      const shiftedFinalWarp =
        frames === undefined
          ? undefined
          : resolveAnimationFrames(
              frames,
              startIndex > 0 ? compiled[startIndex - 1] : undefined,
            ).at(-1)?.warp
      const resolvedFollowingWarp = compiled[endIndex + 1]?.warp
      const followingWarp =
        followingFrame !== undefined &&
        followingFrame.warp === undefined &&
        resolvedFollowingWarp !== shiftedFinalWarp
          ? resolvedFollowingWarp
          : undefined
      return { frames, followingWarp }
    })
    if (shiftedProps.some(({ frames }) => frames === undefined)) return

    for (const [selectionIndex, target] of targets.entries()) {
      const prop = ROOT.value.props[target.propIndex]!
      const shifted = shiftedProps[selectionIndex]!
      prop.anim.splice(
        target.startIndex,
        target.endIndex - target.startIndex + 1,
        ...shifted.frames!,
      )
      const followingFrame = prop.anim[target.endIndex + 1]
      if (followingFrame !== undefined && shifted.followingWarp !== undefined) {
        // Warp controls the transition into the shifted final frame, so replacing it with the old
        // final value would break the reconstructed seam. Preserve inheritance outside a partial
        // range by materializing the old resolved value on the following frame instead.
        followingFrame.warp = shifted.followingWarp
      }
    }
    triggerRef(ROOT)
    await nextTick()

    if (selectedTimes?.[0] !== undefined && selectedTimes[1] !== undefined) {
      const startIndex = ETIMES.value.indexOf(selectedTimes[0])
      const endIndex = ETIMES.value.indexOf(selectedTimes[1])
      if (startIndex >= 0 && endIndex >= 0) SELECTED.value = [startIndex, endIndex]
    }
  } finally {
    endHistoryGroup()
  }
}

const activate = () => {
  if (!canShift.value) return
  pINPUT.value = pINPUT.value === inputName ? '' : inputName
}

const clickShift = async () => {
  if (!canShift.value) return

  if (endpointsMismatch.value && !suppressMismatchWarning.value) {
    skipWarningChoice.value = false
    warningOpen.value = true
    return
  }

  await performShift()
}

const cancelWarning = () => {
  warningOpen.value = false
  skipWarningChoice.value = false
}

const confirmShift = async () => {
  suppressMismatchWarning.value = skipWarningChoice.value
  warningOpen.value = false
  await performShift()
}

watch(maxShiftCount, (maximum) => {
  if (shiftCount.value > maximum) shiftCount.value = maximum
})
</script>

<style scoped>
.shift-container {
  padding: 5px;
}

.shift-controls {
  display: grid;
  gap: var(--space-2);
  min-width: 12rem;
  padding-block-start: var(--space-2);
}

.shift-count {
  display: grid;
  gap: var(--space-1);
}

.shift-count input {
  width: 100%;
  accent-color: var(--color-action-primary);
}

.action-button {
  justify-self: start;
  padding: var(--space-2) var(--space-3);
  color: var(--color-on-action-primary);
  cursor: pointer;
  background: var(--color-action-primary);
  border: 0;
  border-radius: var(--radius-sm);
}

.action-button:disabled {
  cursor: default;
  opacity: 0.65;
}

[aria-disabled='true'] {
  color: var(--color-text-muted);
  cursor: default;
  opacity: 0.65;
}

.shift-link--warning {
  color: var(--color-text-muted);
  opacity: 0.65;
}

:deep(.shift-warning .base-dialog__body) {
  display: grid;
  gap: var(--space-6);
}

.shift-warning p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.55;
}

.shift-warning__choice {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  font-weight: 700;
}

.shift-warning__choice input {
  width: 1.15rem;
  height: 1.15rem;
  accent-color: var(--color-action-primary);
}

.shift-warning__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: flex-end;
}

.shift-warning__actions button {
  min-height: 2.75rem;
  padding-inline: var(--space-4);
  color: var(--color-text);
  font: inherit;
  font-weight: 750;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.shift-warning__actions .shift-warning__proceed {
  color: var(--color-on-action-primary);
  background: var(--color-action-primary);
  border-color: var(--color-action-primary);
}

.shift-warning__actions button:focus-visible,
.shift-warning__choice input:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
