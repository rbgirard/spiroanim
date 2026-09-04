<template>
  <div class="spiro-workspace" data-role="main-container" :style="containerStyle">
    <div v-show="paneVisible.left" ref="eLeft" data-role="left-pane" :style="leftStyle">
      <PaneRotate v-if="paneCycleControlsVisible" pane="left" />
    </div>
    <div v-show="paneVisible.right" ref="eRight" data-role="right-pane" :style="rightStyle">
      <PaneRotate v-if="paneCycleControlsVisible" pane="right" />
    </div>
    <div v-show="false" ref="eHidden" data-role="hidden-pane">
      <div
        v-if="viewVisible.player"
        ref="ePlayer"
        class="spiro-workspace__player-marker"
        data-type="player"
        data-role="main-player-host"
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
        :player-visible="viewVisible.player"
        :pane-cycle-controls-visible="paneCycleControlsVisible"
      />
      <ConceptsPane
        v-if="viewVisible.concepts"
        ref="cConcepts"
        :animation="ROOT"
        :animation-revision="animationRevision"
        :animation-ready="animationReady"
        :builder-active="paneStore.isPaneHijacked"
        :builder-full-catalog="builderFullCatalog"
        :builder-full-catalog-forced="builderFullCatalogForced"
        :builder-full-grid="builderFullGrid"
        :builder-insertion-index="selectedBuilderPreviewIndex"
        :builder-match-animation="builderPatternMatchAnimation"
        :docs-return-path="currentRoute.fullPath"
        :pane="parents.concepts"
        data-type="concepts"
        data-role="concepts-view"
        @pattern-select="applyConceptPattern"
        @pattern-preview="previewConceptPattern"
        @quick-slot-apply="applyQuickSlotFromView($event, 'concepts')"
        @quick-slot-save="saveCurrentPatternToQuickSlot"
        @quick-slots-create="saveAnimationsToQuickSlots"
        @animation-update="applyPropertyAnimation"
        @builder-open="handleBuilderOpen"
        @eight-step-pattern-matched="handleEightStepPatternMatched"
        @customize="applyBuilderCustomization"
        @update:builder-full-grid="builderFullGrid = $event"
      />
      <BuilderPane
        v-if="viewVisible.builder"
        ref="cBuilder"
        data-type="builder"
        data-role="builder-pane-view"
        :allow-first-drop="builderFullGrid"
        :mode="activeBuilderOwner ?? 'vtg'"
        @quick-slots-create="saveAnimationsToQuickSlots"
        @preview-selection-change="selectedBuilderPreviewIndex = $event"
        @pattern-match-animation-change="builderPatternMatchAnimation = $event"
        @close="closeActiveBuilder(true)"
      />
    </div>
    <div
      v-if="playerRequired"
      class="spiro-workspace__player-surface"
      data-role="stable-player-surface"
      :data-player-placement="playerPlacement"
      :style="playerSurfaceStyle"
    >
      <Player
        store="main"
        data-role="player-view"
        :dim="playerSurfaceDimensions"
        :editor-visible="viewVisible.editor"
        :concepts-visible="viewVisible.concepts"
        :selection-enabled="playerSelectionEnabled"
        :controls-start-clearance="playerControlsStartClearance"
        :controls-end-clearance="playerControlsEndClearance"
      />
    </div>
    <div
      v-if="timelineContentRequired"
      class="spiro-workspace__timeline-surface"
      data-role="stable-timeline-surface"
      :data-timeline-placement="timelineSurfacePlacement"
      :style="timelineSurfaceStyle"
    >
      <AnimTimeline
        store="main"
        data-role="timeline-content"
        :dim="timelineSurfaceDimensions"
        :landscape="false"
        :cols="timelineSurfaceColumns"
        @quick-slot-apply="applyQuickSlotFromTimeline"
        @quick-slot-save="saveCurrentPatternToQuickSlot"
      />
    </div>
    <AppNavigationMenu />
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

import PaneSplitter from '@/components/layout/PaneSplitter.vue'
import PaneRotate from '@/components/layout/PaneRotate.vue'
import AppNavigationMenu from '@/components/layout/AppNavigationMenu.vue'

import Player from '@/components/SpiroAnim/AnimPlayer.vue'
import AnimTimeline from '@/components/SpiroAnim/AnimTimeline.vue'
import Editor from '@/components/SpiroAnim/AnimEditor.vue'
import Timeline from '@/features/timeline/components/TimelinePane.vue'
import ConceptsPane from '@/features/concepts/components/ConceptsPane.vue'
import BuilderPane from '@/features/builder/components/BuilderPane.vue'
import { applyConceptPattern as createConceptPattern } from '@/features/concepts/applyConceptPattern'
import {
  isEightStepPatternSelection,
  isQtrPatternSelection,
  isVtgPatternSelection,
  type ConceptPatternSelection,
} from '@/features/concepts/types'
import {
  getVtgBuilderMaximumScale,
  toVtgBuilderDisplayAnimation,
} from '@/features/builder/toVtgBuilderDisplayAnimation'
import { applyVtgCustomization } from '@/features/vtg/applyVtgCustomization'
import { createVtgBuilderDropPreview } from '@/features/builder/createVtgBuilderDropPreview'

import { useViewDimensions } from '@/composables/useViewDimensions'
import { usePaneSurface } from '@/composables/usePaneSurface'
import { useScrollSelectScale } from '@/composables/useScrollSelectScale'
import { useMainRoute } from '@/composables/useMainRoute'
import { useSpiroAnimKeyboard } from '@/composables/useSpiroAnimKeyboard'

import { useViewportStore } from '@/stores/useViewportStore'
import { useSplitterStore } from '@/stores/useSplitterStore'
import { useMainPaneStore } from '@/stores/useMainPaneStore'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useQSMainStore } from '@/stores/useQSMainStore'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { findConceptForPath } from '@/features/concepts/conceptRoutes'
import { useQueryVersionStore } from '@/stores/useQueryVersionStore'
import { UnsupportedSpiroAnimQSVersionError } from '@/services/query/versions'
import { usePropertiesStore } from '@/features/editor/stores/usePropertiesStore'
import { useEditorPaneAvailability } from '@/features/editor/composables/useEditorPaneAvailability'
import { useTimelinePaneStore } from '@/features/timeline/stores/useTimelinePaneStore'
import { useBuilderPaneStore } from '@/features/builder/stores/useBuilderPaneStore'
import { useEditorPaneStore } from '@/features/editor/stores/useEditorPaneStore'
import { resolveEmbeddedTimelineColumns } from '@/features/timeline/resolveEmbeddedTimelineColumns'
import {
  PANE_CORNER_CONTROL_CLEARANCE,
  PANE_CYCLE_CONTROL_START_CLEARANCE,
} from '@/components/layout/paneControlLayout'
import type { RootDataFinal } from '@/types/AnimTypes'

useScrollSelectScale()
const { animationReady, saveCurrentPatternToQuickSlot, saveAnimationsToQuickSlots } = useMainRoute() // Handles updates to route path and query
useSpiroAnimKeyboard()

const { viewWidth, viewHeight, viewLeft, viewTop, isLandscape } = storeToRefs(useViewportStore())

const splitterStore = useSplitterStore('main')
const { leftWidth, leftHeight, rightWidth, rightHeight, leftPerc } = storeToRefs(splitterStore)

const paneStore = useMainPaneStore()
const currentRoute = useRoute()
useEditorPaneAvailability()
const playerStore = usePlayerStore('main')
const conceptsStore = useConceptsStore()
const qsStore = useQSMainStore()
const queryVersionStore = useQueryVersionStore()
const { ROOT } = playerStore.raw()
const animationRevision = ref(0)
let suppressNextConceptAnimationRevision = false
watch(
  ROOT,
  () => {
    if (suppressNextConceptAnimationRevision) {
      suppressNextConceptAnimationRevision = false
      return
    }
    animationRevision.value++
  },
  { flush: 'sync' },
)
const commitConceptAnimation = (animation: RootDataFinal) => {
  suppressNextConceptAnimationRevision = true
  if (ROOT.value === animation) triggerRef(ROOT)
  else ROOT.value = animation
}
const selectedBuilderPreviewIndex = ref<number>()
const builderPatternMatchAnimation = shallowRef<RootDataFinal>()
const builderFullGrid = ref(false)
type BuilderOwner = 'vtg' | 'eight-step'
const activeBuilderOwner = ref<BuilderOwner>()
const vtgBuilderOpen = ref<boolean>()
const eightStepBuilderOpen = ref<boolean>()
const builderFullCatalogForced = computed(
  () =>
    paneStore.isPaneHijacked &&
    (ROOT.value.props.length === 0 || selectedBuilderPreviewIndex.value === 0),
)
const builderFullCatalog = computed(() => builderFullCatalogForced.value || builderFullGrid.value)
const paneCycleControlsVisible = computed(() => !paneStore.isPaneHijacked)
const { showFullTimeline } = storeToRefs(usePropertiesStore('main'))
const { registerComponentEl } = paneStore
const timelinePaneStore = useTimelinePaneStore()
const {
  ePlayer: eTimelinePlayer,
  eTimeline: eMainTimelineContent,
  parents: timelineParents,
  paneVisible: timelinePaneVisible,
  viewVisible: timelineViewVisible,
} = storeToRefs(timelinePaneStore)
const builderPaneStore = useBuilderPaneStore()
const {
  ePlayer: eBuilderPlayer,
  parents: builderParents,
  paneVisible: builderPaneVisible,
} = storeToRefs(builderPaneStore)
const editorPaneStore = useEditorPaneStore()
const {
  eTimeline: eEditorTimelineContent,
  parents: editorParents,
  paneVisible: editorPaneVisible,
  viewVisible: editorViewVisible,
} = storeToRefs(editorPaneStore)

const {
  parents,
  paneVisible,
  viewVisible,
  ePlayer,
  eEditor,
  eTimeline,
  eConcepts,
  eBuilder,
  eLeft,
  eRight,
  eHidden,
} = storeToRefs(paneStore)
watch(
  () => parents.value.editor,
  (editorPane) => {
    if (editorPane !== 'hidden') showFullTimeline.value = false
  },
)

// Component references
const cEditor = ref<ComponentPublicInstance>()
const cTimeline = ref<ComponentPublicInstance>()
const cConcepts = ref<ComponentPublicInstance>()
const cBuilder = ref<ComponentPublicInstance>()

// Supply root elements from components to Pane Store
registerComponentEl(cEditor, eEditor)
registerComponentEl(cTimeline, eTimeline)
registerComponentEl(cConcepts, eConcepts)
registerComponentEl(cBuilder, eBuilder)

type PlayerPlacement = 'main' | 'timeline' | 'builder'

const playerPlacement = computed<PlayerPlacement | undefined>(() => {
  if (viewVisible.value.builder) return 'builder'
  if (viewVisible.value.player) return 'main'
  if (viewVisible.value.timeline) return 'timeline'
  return undefined
})
const playerRequired = computed(() => playerPlacement.value !== undefined)
const playerPlacementTarget = computed(() => {
  switch (playerPlacement.value) {
    case 'main':
      return ePlayer.value
    case 'timeline':
      return eTimelinePlayer.value
    case 'builder':
      return eBuilderPlayer.value
    default:
      return undefined
  }
})
const {
  width: playerTargetWidth,
  height: playerTargetHeight,
  positionStyle: playerPositionStyle,
} = usePaneSurface(playerPlacementTarget, viewLeft, viewTop, [
  playerPlacement,
  () => parents.value.player,
  () => paneVisible.value.left,
  () => paneVisible.value.right,
  () => timelineParents.value.player,
  () => timelinePaneVisible.value.top,
  () => timelinePaneVisible.value.bottom,
  () => builderParents.value.player,
  () => builderPaneVisible.value.top,
  () => builderPaneVisible.value.bottom,
  leftWidth,
  leftHeight,
  rightWidth,
  rightHeight,
])

const timelinePlayerOwnsBottomEdge = computed(
  () =>
    timelineParents.value.player === 'bottom' ||
    (timelineParents.value.player === 'top' && !timelinePaneVisible.value.bottom),
)
const builderPlayerOwnsBottomEdge = computed(
  () =>
    builderParents.value.player === 'bottom' ||
    (builderParents.value.player === 'top' && !builderPaneVisible.value.bottom),
)
const embeddedPlayerOwnsBottomEdge = computed(() => {
  if (playerPlacement.value === 'timeline') return timelinePlayerOwnsBottomEdge.value
  if (playerPlacement.value === 'builder') return builderPlayerOwnsBottomEdge.value
  return true
})
const playerSelectionEnabled = computed(() => playerPlacement.value !== 'builder')
const playerControlsStartClearance = computed(() => {
  if (playerPlacement.value === 'main') {
    return paneCycleControlsVisible.value ? PANE_CYCLE_CONTROL_START_CLEARANCE : '0px'
  }
  if (
    playerPlacement.value === 'timeline' &&
    paneCycleControlsVisible.value &&
    embeddedPlayerOwnsBottomEdge.value
  ) {
    return PANE_CYCLE_CONTROL_START_CLEARANCE
  }
  return '0px'
})
const playerControlsEndClearance = computed(() =>
  playerPlacement.value !== 'main' && embeddedPlayerOwnsBottomEdge.value
    ? PANE_CORNER_CONTROL_CLEARANCE
    : '0px',
)
const playerBottomOffset = computed(() =>
  playerPlacement.value === 'main' || embeddedPlayerOwnsBottomEdge.value
    ? 'var(--space-workspace-bottom-offset)'
    : 'var(--space-pane-switch-bottom)',
)
const playerSurfaceDimensions = computed(() => ({
  width: playerTargetWidth.value,
  height: playerTargetHeight.value,
  perc: 1,
}))
const playerSurfaceStyle = computed<CSSProperties>(() => ({
  ...playerPositionStyle.value,
  '--space-pane-bottom-offset': playerBottomOffset.value,
}))

const applyConceptPattern = (selection: ConceptPatternSelection) => {
  const createdAnimation = createConceptPattern(ROOT.value, selection, {
    minimumVtgCycleCount: conceptsStore.getVtgPropertyCycleCount(),
  })
  if (createdAnimation) {
    const animation =
      isVtgPatternSelection(selection) ||
      isQtrPatternSelection(selection) ||
      isEightStepPatternSelection(selection)
        ? conceptsStore.applyVtgPropertyControls(createdAnimation)
        : createdAnimation
    commitConceptAnimation(animation)
    playerStore.cameraReset = Symbol()
  }
}

const previewConceptPattern = (selection: ConceptPatternSelection) => {
  if (!paneStore.isPaneHijacked) return
  const animation =
    (isVtgPatternSelection(selection) || isQtrPatternSelection(selection)) &&
    selectedBuilderPreviewIndex.value !== undefined
      ? createVtgBuilderDropPreview(ROOT.value, selection, selectedBuilderPreviewIndex.value, {
          minimumCycleCount: conceptsStore.getVtgPropertyCycleCount(),
        })
      : createConceptPattern(ROOT.value, selection, {
          minimumVtgCycleCount: conceptsStore.getVtgPropertyCycleCount(),
        })
  if (!animation) return

  const previewAnimation =
    isVtgPatternSelection(selection) || isQtrPatternSelection(selection)
      ? conceptsStore.applyVtgPropertyControls(animation)
      : animation

  playerStore.startPlaybackPreview(
    toVtgBuilderDisplayAnimation(previewAnimation, undefined, {
      maximumScale: Math.max(
        getVtgBuilderMaximumScale(ROOT.value),
        getVtgBuilderMaximumScale(previewAnimation),
      ),
    }),
  )
}

const applyBuilderCustomization = (selection: ConceptPatternSelection) => {
  if (selectedBuilderPreviewIndex.value !== undefined) return
  if (playerStore.PLAYBACK_PREVIEW_ACTIVE) playerStore.endPlaybackPreview()
  const animation = isVtgPatternSelection(selection)
    ? applyVtgCustomization(ROOT.value, selection)
    : (() => {
        const createdAnimation = createConceptPattern(ROOT.value, selection, {
          minimumVtgCycleCount: conceptsStore.getVtgPropertyCycleCount(),
        })
        return createdAnimation &&
          (isQtrPatternSelection(selection) || isEightStepPatternSelection(selection))
          ? conceptsStore.applyVtgPropertyControls(createdAnimation)
          : createdAnimation
      })()
  if (!animation) return
  qsStore.qsSkip = true
  commitConceptAnimation(animation)
}

const applyPropertyAnimation = (animation: RootDataFinal) => {
  qsStore.qsSkip = true
  commitConceptAnimation(animation)
}

const selectedBuilderOwner = (): BuilderOwner =>
  conceptsStore.selectedConcept === '8stp' ? 'eight-step' : 'vtg'

const rememberBuilderOpen = (owner: BuilderOwner, open: boolean) => {
  if (owner === 'eight-step') eightStepBuilderOpen.value = open
  else vtgBuilderOpen.value = open
}

const shouldRestoreBuilder = (owner: BuilderOwner) =>
  owner === 'eight-step' ? eightStepBuilderOpen.value === true : vtgBuilderOpen.value === true

const openBuilder = (owner: BuilderOwner) => {
  if (paneStore.isPaneHijacked && activeBuilderOwner.value === owner) {
    rememberBuilderOpen(owner, true)
    return
  }
  builderFullGrid.value = false
  if (paneStore.isPaneHijacked) paneStore.exitPaneHijack()
  if (!paneStore.hijackOppositePane('builder', 'concepts')) return
  activeBuilderOwner.value = owner
  rememberBuilderOpen(owner, true)
}

const closeActiveBuilder = (rememberClosure: boolean) => {
  if (rememberClosure && activeBuilderOwner.value)
    rememberBuilderOpen(activeBuilderOwner.value, false)
  builderFullGrid.value = false
  if (paneStore.isPaneHijacked) paneStore.exitPaneHijack()
  activeBuilderOwner.value = undefined
}

const toggleBuilder = () => {
  const owner = selectedBuilderOwner()
  if (
    paneStore.isPaneHijacked &&
    (activeBuilderOwner.value === owner || activeBuilderOwner.value === undefined)
  ) {
    closeActiveBuilder(true)
    return
  }
  openBuilder(owner)
}

const handleBuilderOpen = (source: 'manual' | 'automatic') => {
  if (source === 'automatic') {
    if (conceptsStore.selectedConcept === 'vtg' && vtgBuilderOpen.value !== false) {
      openBuilder('vtg')
    }
    return
  }
  toggleBuilder()
}

const handleEightStepPatternMatched = () => {
  if (eightStepBuilderOpen.value === undefined) eightStepBuilderOpen.value = true
  if (
    eightStepBuilderOpen.value &&
    conceptsStore.selectedConcept === '8stp' &&
    activeBuilderOwner.value !== 'eight-step'
  ) {
    openBuilder('eight-step')
  }
}

watch(
  () => conceptsStore.selectedConcept,
  (concept) => {
    closeActiveBuilder(false)
    const owner = concept === '8stp' ? 'eight-step' : concept === 'vtg' ? 'vtg' : undefined
    if (owner && shouldRestoreBuilder(owner)) {
      void nextTick(() => {
        if (selectedBuilderOwner() === owner) openBuilder(owner)
      })
    }
  },
)

const applyQuickSlot = async (path: string): Promise<boolean> => {
  const conceptRoute = findConceptForPath(path)
  const query = Object.fromEntries(new URLSearchParams(path.split('?', 2)[1] ?? ''))
  try {
    const animation = await qsStore.decodeVer(query)
    if (conceptRoute) {
      conceptsStore.selectedConcept = conceptRoute.concept
      conceptsStore.qtrEnabled = conceptRoute.qtrEnabled
    }
    ROOT.value = animation
    playerStore.cameraReset = Symbol()
    return true
  } catch (error: unknown) {
    if (error instanceof UnsupportedSpiroAnimQSVersionError) {
      queryVersionStore.reportUnsupportedVersion(error.version)
    }
    console.warn('Failed to apply animation data from the Quick Slot.', error)
    return false
  }
}

type QuickSlotHostView = 'editor' | 'timeline' | 'concepts'
type QuickSlotTargetView = 'player' | QuickSlotHostView

const quickSlotViewByRoutePart: Readonly<Record<string, QuickSlotTargetView>> = {
  play: 'player',
  player: 'player',
  edit: 'editor',
  editor: 'editor',
  time: 'timeline',
  timeline: 'timeline',
  cnc: 'concepts',
  concepts: 'concepts',
  vtg: 'concepts',
  qtr: 'concepts',
  '8stp': 'concepts',
  qst: 'concepts',
  tka: 'concepts',
  'vulcan-tech-gospel': 'concepts',
  quarterspacing: 'concepts',
  'eight-step': 'concepts',
  'quarter-space-tech': 'concepts',
  'the-kinetic-alphabet': 'concepts',
}

const quickSlotTargetViews = (path: string): QuickSlotTargetView[] => {
  const page = path.split(/[?#]/, 1)[0]?.replace(/^\//, '')
  if (!page) return []
  const fullPageView = quickSlotViewByRoutePart[page]
  if (fullPageView) return [fullPageView]
  return page
    .split('-')
    .map((part) => quickSlotViewByRoutePart[part])
    .filter((view): view is QuickSlotTargetView => view !== undefined)
}

const applyQuickSlotFromView = async (path: string, sourceView: QuickSlotHostView) => {
  if (!(await applyQuickSlot(path))) return

  const sourcePane = parents.value[sourceView]
  if (sourcePane === 'hidden') return

  const otherPane = sourcePane === 'left' ? 'right' : 'left'
  const otherView = Object.entries(parents.value).find(([, pane]) => pane === otherPane)?.[0]
  const targetView =
    quickSlotTargetViews(path).find((view) => view !== otherView) ?? quickSlotTargetViews(path)[0]
  if (sourceView === 'editor' && targetView === 'timeline') return
  if (targetView && targetView !== sourceView) paneStore.setViewInPane(targetView, sourcePane)
}

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
const dEditor = useViewDimensions('editor', parents, dimComputeds)
const dTimeline = useViewDimensions('timeline', parents, dimComputeds)

type TimelinePlacement = 'main' | 'editor'

const timelinePlacement = computed<TimelinePlacement | undefined>(() => {
  if (viewVisible.value.timeline) return 'main'
  if (viewVisible.value.editor && editorViewVisible.value.timeline) return 'editor'
  return undefined
})
const timelineSurfacePlacement = computed<TimelinePlacement | undefined>(() => {
  if (timelinePlacement.value !== undefined) return timelinePlacement.value
  if (eMainTimelineContent.value) return 'main'
  if (eEditorTimelineContent.value) return 'editor'
  return undefined
})
const timelinePlacementTarget = computed(() => {
  if (timelineSurfacePlacement.value === 'main') {
    return eMainTimelineContent.value ?? eEditorTimelineContent.value
  }
  if (timelineSurfacePlacement.value === 'editor') {
    return eEditorTimelineContent.value ?? eMainTimelineContent.value
  }
  return undefined
})
const timelineContentRequired = computed(
  () => timelinePlacement.value !== undefined || timelinePlacementTarget.value !== undefined,
)
const {
  width: timelineTargetWidth,
  height: timelineTargetHeight,
  positionStyle: timelinePositionStyle,
} = usePaneSurface(timelinePlacementTarget, viewLeft, viewTop, [
  timelineSurfacePlacement,
  () => parents.value.timeline,
  () => parents.value.editor,
  () => paneVisible.value.left,
  () => paneVisible.value.right,
  () => timelineParents.value.timeline,
  () => timelinePaneVisible.value.top,
  () => timelinePaneVisible.value.bottom,
  () => editorParents.value.timeline,
  () => editorPaneVisible.value.top,
  () => editorPaneVisible.value.bottom,
  leftWidth,
  leftHeight,
  rightWidth,
  rightHeight,
])
const timelineSurfaceDimensions = computed(() => ({
  width: timelineTargetWidth.value,
  height: timelineTargetHeight.value,
  perc: timelineSurfacePlacement.value === 'editor' ? dEditor.perc : dTimeline.perc,
}))
const timelineSurfaceColumns = computed(() => {
  if (timelineSurfacePlacement.value === 'main') {
    return resolveEmbeddedTimelineColumns(timelineViewVisible.value.player)
  }
  if (timelineSurfacePlacement.value === 'editor') {
    return resolveEmbeddedTimelineColumns(editorViewVisible.value.timeline)
  }
  return undefined
})
const mainTimelineOwnsBottomEdge = computed(
  () =>
    timelineParents.value.timeline === 'bottom' ||
    (timelineParents.value.timeline === 'top' && !timelinePaneVisible.value.bottom),
)
const editorTimelineOwnsBottomEdge = computed(
  () =>
    editorParents.value.timeline === 'bottom' ||
    (editorParents.value.timeline === 'top' && !editorPaneVisible.value.bottom),
)
const timelineOwnsBottomEdge = computed(() =>
  timelineSurfacePlacement.value === 'editor'
    ? editorTimelineOwnsBottomEdge.value
    : mainTimelineOwnsBottomEdge.value,
)
const timelineSurfaceStyle = computed<CSSProperties>(() => ({
  ...timelinePositionStyle.value,
  '--space-pane-bottom-offset': timelineOwnsBottomEdge.value
    ? 'var(--space-workspace-bottom-offset)'
    : 'var(--space-pane-switch-bottom)',
}))
const applyQuickSlotFromTimeline = (path: string) =>
  applyQuickSlotFromView(path, timelineSurfacePlacement.value === 'editor' ? 'editor' : 'timeline')

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
  'min-width': '0',
  'min-height': '0',
  overflow: 'clip',
}))

const rightStyle = computed<CSSProperties>(() => ({
  flex: flexRight.value,
  position: 'relative',
  'min-width': '0',
  'min-height': '0',
  overflow: 'clip',
}))
</script>

<style scoped>
.spiro-workspace {
  min-inline-size: 0;
  min-block-size: 0;
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

.spiro-workspace__player-marker {
  position: absolute;
  inset: 0;
  min-inline-size: 0;
  min-block-size: 0;
  pointer-events: none;
}

.spiro-workspace__player-surface,
.spiro-workspace__timeline-surface {
  position: absolute;
  z-index: 1008;
  min-inline-size: 0;
  min-block-size: 0;
  overflow: clip;
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
