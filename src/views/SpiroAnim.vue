<template>
  <div class="spiro-workspace" data-role="main-container" :style="containerStyle">
    <div v-show="paneVisible.left" ref="eLeft" data-role="left-pane" :style="leftStyle">
      <PaneRotate pane="left" />
    </div>
    <div v-show="paneVisible.right" ref="eRight" data-role="right-pane" :style="rightStyle">
      <PaneRotate pane="right" />
    </div>
    <div v-show="false" ref="eHidden" data-role="hidden-pane">
      <Player
        v-if="viewVisible.player"
        ref="cPlayer"
        store="main"
        data-type="player"
        data-role="player-view"
        :dim="dPlayer"
      />
      <Editor
        v-if="viewVisible.editor"
        ref="cEditor"
        store="main"
        data-type="editor"
        data-role="editor-view"
        :dim="dEditor"
        :landscape="isLandscape"
        :vtl="viewVisible.timeline"
      />
      <Timeline
        v-if="viewVisible.timeline"
        ref="cTimeline"
        store="main"
        data-type="timeline"
        data-role="timeline-view"
        :dim="dTimeline"
        :landscape="isLandscape"
      />
    </div>
    <FullScreen />
    <PaneSplitter
      data-role="splitter-main"
      :parent="parentDim"
      :object="leftDim"
      :landscape="isLandscape"
      @perc="onEmitPerc"
    />
  </div>
</template>

<script setup lang="ts">
// src\views\SpiroAnim.vue

// TODO: Research - Progressive Web Apps

import PaneSplitter from '@/components/layout/PaneSplitter.vue'
import PaneRotate from '@/components/layout/PaneRotate.vue'
import FullScreen from '@/components/layout/FullScreen.vue'

import Player from '@/components/SpiroAnim/AnimPlayer.vue'
import Editor from '@/components/SpiroAnim/AnimEditor.vue'
import Timeline from '@/components/SpiroAnim/AnimTimeline.vue'

import { useViewDimensions } from '@/composables/useViewDimensions'
import { useScrollSelectScale } from '@/composables/useScrollSelectScale'
import { useMainRoute } from '@/composables/useMainRoute'
import { useSpiroAnimKeyboard } from '@/composables/useSpiroAnimKeyboard'

import { useViewportStore } from '@/stores/useViewportStore'
import { useSplitterStore } from '@/stores/useSplitterStore'
import { useMainPaneStore } from '@/stores/useMainPaneStore'

useScrollSelectScale()
useMainRoute() // Handles updates to route path and query
useSpiroAnimKeyboard()

const { viewWidth, viewHeight, viewLeft, viewTop, isLandscape } = storeToRefs(useViewportStore())

const splitterStore = useSplitterStore('main')
const { leftWidth, leftHeight, rightWidth, rightHeight, leftPerc } = storeToRefs(splitterStore)

const paneStore = useMainPaneStore()
const { registerComponentEl } = paneStore

const { parents, paneVisible, viewVisible, ePlayer, eEditor, eTimeline, eLeft, eRight, eHidden } =
  storeToRefs(paneStore)

// Component references
const cPlayer = ref<ComponentPublicInstance>()
const cEditor = ref<ComponentPublicInstance>()
const cTimeline = ref<ComponentPublicInstance>()

// Supply root elements from components to Pane Store
registerComponentEl(cPlayer, ePlayer)
registerComponentEl(cEditor, eEditor)
registerComponentEl(cTimeline, eTimeline)

const parentDim = computed(() => ({ width: viewWidth.value, height: viewHeight.value }))

const leftDim = computed(() => {
  const width = viewWidth.value
  const height = viewHeight.value
  return {
    width: leftWidth.value,
    height: leftHeight.value,
    perc: isLandscape.value
      ? Math.round((leftWidth.value / width) * 100)
      : Math.round((leftHeight.value / height) * 100),
  }
})

const rightDim = computed(() => {
  const width = viewWidth.value
  const height = viewHeight.value
  return {
    width: rightWidth.value,
    height: rightHeight.value,
    perc: isLandscape.value
      ? Math.round((rightWidth.value / width) * 100)
      : Math.round((rightHeight.value / height) * 100),
  }
})

// Dimensions of each pane for tracking view dimensions
const dimComputeds = {
  left: leftDim,
  right: rightDim,
}

// Dimensions of the current pane a view is mounted in, to pass into each component
const dPlayer = useViewDimensions('player', parents, dimComputeds)
const dEditor = useViewDimensions('editor', parents, dimComputeds)
const dTimeline = useViewDimensions('timeline', parents, dimComputeds)

const flexDirection = ref<CSSProperties['flex-direction']>('row')
const flexLeft = ref<CSSProperties['flex']>('0 0 0')
const flexRight = ref<CSSProperties['flex']>('0 0 0')

// Change layout based on isLandscape
watchImmediate(isLandscape, (val) => {
  if (val) flexDirection.value = 'row'
  else flexDirection.value = 'column'
})

// Percentage updates
watchImmediate(leftPerc, (val) => {
  // Update sizes of left/right
  flexLeft.value = `0 0 ${val}%`
  flexRight.value = `0 0 ${100 - val}%`

  const vis = paneVisible.value
  if (val <= 0) vis.left = !(vis.right = true)
  else if (val >= 100) vis.right = !(vis.left = true)
  else vis.right = vis.left = true
})

onMounted(() => {
  // Register elements with splitterStore
  splitterStore.trackElements(eLeft.value, eRight.value)
})

// Emitted from PaneSplitter
const onEmitPerc = (val: number) => {
  if (val < 5)
    val = 0 // Snap to the left
  else if (val < 20) val = 20
  else if (val > 95)
    val = 100 // Snap to the right
  else if (val > 80) val = 80
  leftPerc.value = val
}

const containerStyle = computed<CSSProperties>(() => ({
  width: `${viewWidth.value}px`,
  height: `${viewHeight.value}px`,
  // Mobile browser chrome can move the visual viewport relative to the layout viewport.
  left: `${viewLeft.value}px`,
  top: `${viewTop.value}px`,
  position: 'fixed',
  display: 'flex',
  'flex-direction': flexDirection.value,
}))

const leftStyle = computed<CSSProperties>(() => ({
  flex: flexLeft.value,
  position: 'relative',
  overflow: 'hidden',
}))

const rightStyle = computed<CSSProperties>(() => ({
  flex: flexRight.value,
  position: 'relative',
  'overflow-x': 'auto',
}))
</script>

<style scoped>
.spiro-workspace {
  background:
    radial-gradient(
      ellipse at 8% 12%,
      color-mix(in srgb, var(--color-action-primary) 24%, transparent),
      transparent 42%
    ),
    radial-gradient(
      ellipse at 92% 88%,
      color-mix(in srgb, var(--color-workspace-separator) 26%, transparent),
      transparent 46%
    ),
    linear-gradient(
      132deg,
      transparent 24%,
      color-mix(in srgb, var(--color-workspace-boundary) 12%, transparent) 48%,
      transparent 72%
    ),
    repeating-linear-gradient(
      118deg,
      transparent 0 5rem,
      color-mix(in srgb, var(--color-border) 8%, transparent) 5rem 5.08rem,
      transparent 5.08rem 10rem
    ),
    var(--color-canvas);
}

/* Keep keyboard focus visible without the heavy outlines used outside the workspace. */
.spiro-workspace :deep(:focus-visible) {
  outline: 1px solid color-mix(in srgb, var(--color-action-primary) 55%, var(--color-text-muted));
  outline-offset: 1px;
}

.spiro-workspace :deep(.range--custom:focus-visible::-webkit-slider-thumb),
.spiro-workspace :deep(.range--selection:focus-visible::-webkit-slider-thumb) {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-action-primary) 40%, transparent);
}

.spiro-workspace :deep(.range--custom:focus-visible::-moz-range-thumb),
.spiro-workspace :deep(.range--selection:focus-visible::-moz-range-thumb) {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-action-primary) 40%, transparent);
}
</style>
