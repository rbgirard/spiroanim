<template>
  <div data-role="main-container" :style="containerStyle">
    <div v-show="paneVisible.top" ref="eTop" data-role="top-pane" :style="topStyle" />
    <div v-show="paneVisible.bottom" ref="eBottom" data-role="bottom-pane" :style="bottomStyle" />
    <div v-show="false" ref="eHidden" data-role="hidden-pane">
      <Properties
        v-if="viewVisible.properties"
        ref="cProperties"
        store="main"
        data-type="properties"
        data-role="properties-view"
        :dim="dProperties"
        :cols="pCols"
      />
      <Timeline
        v-if="viewVisible.timeline"
        ref="cTimeline"
        store="main"
        data-type="timeline"
        data-role="timeline-view"
        :dim="dTimeline"
        :landscape="false"
        :cols="tCols"
      />
    </div>
    <BaseTooltip class="pane-rotate-icon" text="Swap Editor Views" :disabled="!showTooltips">
      <template #activator="{ props: tooltipProps }">
        <button
          v-if="enabled"
          v-bind="tooltipProps"
          class="pane-rotate-button"
          type="button"
          aria-label="Swap editor views"
          @click.prevent="onClick"
        >
          <BaseIcon :path="mdiSwapVerticalBold" size="30" />
        </button>
      </template>
    </BaseTooltip>
    <PaneSplitter
      v-if="enabled"
      data-role="splitter-main"
      :parent="dim"
      :object="topDim"
      :landscape="false"
      @perc="onEmitPerc"
    />
  </div>
</template>

<script setup lang="ts">
// src\components\SpiroAnim\AnimEditor.vue

import Properties from '@/features/editor/components/AnimProperties.vue'
import Timeline from '@/components/SpiroAnim/AnimTimeline.vue'
import PaneSplitter from '@/components/layout/PaneSplitter.vue'
import BaseTooltip from '@/components/ui/BaseTooltip.vue'
import BaseIcon from '@/components/icons/BaseIcon.vue'
import { mdiSwapVerticalBold } from '@mdi/js'

import { useViewDimensions } from '@/composables/useViewDimensions'

import { useSplitterStore } from '@/stores/useSplitterStore'
import { useEditorPaneStore } from '@/features/editor/stores/useEditorPaneStore'
import { useViewportStore } from '@/stores/useViewportStore'

const props = defineProps<{
  dim: { width: number; height: number; perc: number }
  landscape: boolean
  vtl: boolean // whether view timeline is visible or not
}>()

const dim: Readonly<typeof props.dim> = readonly(props.dim)
const { showTooltips } = storeToRefs(useViewportStore())

const splitterStore = useSplitterStore('editor', 'top', 'bottom')
const { topWidth, topHeight, bottomWidth, bottomHeight, topPerc } = storeToRefs(splitterStore)

const paneStore = useEditorPaneStore()
const { setViewInPane, registerComponentEl } = paneStore
const { parents, paneVisible, viewVisible, eProperties, eTimeline, eTop, eBottom, eHidden } =
  storeToRefs(paneStore)

// Component references
const cProperties = ref<ComponentPublicInstance>()
const cTimeline = ref<ComponentPublicInstance>()

// Supply root elements from components to Pane Store
registerComponentEl(cProperties, eProperties)
registerComponentEl(cTimeline, eTimeline)

const topDim = computed(() => {
  return {
    width: topWidth.value,
    height: topHeight.value,
    perc: dim.perc, // Supply parent's perc (intentional, as landscape is a requirement for additional pane)
  }
})

const bottomDim = computed(() => {
  return {
    width: bottomWidth.value,
    height: bottomHeight.value,
    perc: dim.perc,
  }
})

// Dimensions of each pane for tracking view dimensions
const dimComputeds = {
  top: topDim,
  bottom: bottomDim,
}

// Dimensions of the current pane a view is mounted in, to pass into each component
const dProperties = useViewDimensions('properties', parents, dimComputeds)
const dTimeline = useViewDimensions('timeline', parents, dimComputeds)

const flexTop = ref<CSSProperties['flex']>('0 0 0')
const flexBottom = ref<CSSProperties['flex']>('0 0 0')

// Minimum settings to enable second pane
const minTimeHeight = 300
const minTimeCols = 2

// TODO: add slot at bottom of timeline, add +/- buttons, and move value to persist store
// Sets column count in the editor's timeline
const tCols = ref(4)

// Number of columns in the properties view
const pCols = ref(2)

// Second pane is enabled when main timeline is hidden and additional criteria is met
const enabled = computed(
  () =>
    !props.vtl && // timeline is hidden in main layout
    props.landscape &&
    pCols.value >= minTimeCols &&
    dim.height > minTimeHeight,
)

// Calculate the properties column count
watchImmediate(dim, () => {
  let colsWidth, cols

  // These are likely to need refining
  if (screen.width > 1280) colsWidth = 300
  else if (screen.width > 600) colsWidth = 250
  else colsWidth = 200

  cols = Math.floor(dim.width / colsWidth)

  if (cols < 1) cols = 1

  pCols.value = cols
})

// Percentage updates
watchImmediate([topPerc, enabled], () => {
  // If disabled, fully collapse one pane based on current view position
  const disabledPerc = parents.value['properties'] == 'top' ? 100 : 0
  const val = enabled.value ? topPerc.value : disabledPerc

  // Update sizes of left/right
  flexTop.value = `0 0 ${val}%`
  flexBottom.value = `0 0 ${100 - val}%`

  const vis = paneVisible.value
  if (val <= 0) vis.top = !(vis.bottom = true)
  else if (val >= 100) vis.bottom = !(vis.top = true)
  else vis.bottom = vis.top = true
})

onMounted(() => {
  // Register elements with splitterStore
  splitterStore.trackElements(eTop.value, eBottom.value)
})

// Emitted from PaneSplitter
const onEmitPerc = (val: number) => {
  if (val < 5)
    val = 0 // Snap to the left
  else if (val < 20) val = 20
  else if (val > 95)
    val = 100 // Snap to the right
  else if (val > 80) val = 80
  topPerc.value = val
}

function onClick() {
  setViewInPane('properties', parents.value['properties'] == 'top' ? 'bottom' : 'top')
}

const topStyle = computed<CSSProperties>(() => ({
  flex: flexTop.value,
  position: 'relative',
  overflow: 'hidden',
}))

const bottomStyle = computed<CSSProperties>(() => ({
  flex: flexBottom.value,
  position: 'relative',
  overflow: 'hidden',
}))

const containerStyle = computed<CSSProperties>(() => ({
  width: `${dim.width}px`,
  height: `${dim.height}px`,
  position: 'relative',
  display: 'flex',
  'flex-direction': 'column',
}))
</script>

<style scoped>
.pane-rotate-icon {
  position: absolute;
  bottom: 10px;
  right: 11px;
  z-index: 1010;
}

.pane-rotate-button {
  display: inline-flex;
  padding: 2px;
  color: var(--color-action-primary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
}

.pane-rotate-button:hover {
  color: var(--color-text);
}

.pane-rotate-button:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
