<template>
  <div :style="containerStyle" data-role="player-container">
    <canvas ref="eCanvas" :style="canvasStyle" />
    <PlayerMinimalControls
      v-if="minimal"
      :store="props.store"
      :end-clearance="props.minimalControlsEndClearance"
    />
    <Controls
      v-else
      :store="props.store"
      :editor-visible="props.editorVisible"
      :selection-enabled="props.selectionEnabled"
      :start-clearance="props.controlsStartClearance"
      :end-clearance="props.controlsEndClearance"
    />
    <span v-if="!minimal" class="fps" :class="{ 'fps--without-aspect': props.conceptsVisible }">{{
      fps
    }}</span>
    <AppTooltip v-if="!minimal && !props.conceptsVisible" class="aspect-tooltip" placement="bottom">
      <template #activator="{ props: tooltipProps }">
        <span v-bind="tooltipProps" class="aspect">
          <span :style="{ color: aspect.color.value }">{{ aspectLabel.ratioText }}</span>
          {{ aspectLabel.approxText }}</span
        >
      </template>
      <template #html>
        <div style="min-width: 200px">
          <div style="margin-bottom: 0.5em">
            {{ aspect.description }}
          </div>
          <div><strong>Confidence:</strong> {{ aspect.confidence }}</div>
          <div><strong>Match Type:</strong> {{ aspect.label }}</div>
          <div v-if="aspect.data.value.ratio">
            <strong>Decimal:</strong> {{ aspect.data.value.ratio.toFixed(3) }}
          </div>
          <div v-if="aspect.data.value.reduced">
            <strong>Reduced:</strong> {{ aspect.data.value.reduced }}
          </div>
          <div v-if="aspect.data.value.nearby?.length">
            <strong>Nearby:</strong> {{ aspect.data.value.nearby.join(', ') }}
          </div>
          <div v-else-if="aspect.data.value.approx">
            <strong>Approx:</strong> {{ aspect.data.value.approx }}
          </div>
        </div>
      </template>
    </AppTooltip>
    <AppTooltip v-if="!minimal && composerUrl" class="tka-chip-tooltip" placement="bottom">
      <template #activator="{ props: tooltipProps }">
        <a
          v-bind="tooltipProps"
          class="tka-chip"
          :href="composerUrl"
          target="_blank"
          rel="noopener"
          aria-label="Open in Flow Arts Composer"
          data-role="tka-chip"
          >TKA</a
        >
      </template>
      <template #html>Open in Flow Arts Composer</template>
    </AppTooltip>
  </div>
</template>

<script setup lang="ts">
import Controls from './player/PlayerControls.vue'
import PlayerMinimalControls from './player/PlayerMinimalControls.vue'
import AppTooltip from '@/components/AppTooltip.vue'

import { useViewportStore } from '@/stores/useViewportStore'
import { usePlayerStore } from '@/stores/usePlayerStore'

import { CMODES } from '@/domain/animation/AnimStruct'
import type { PointInd } from '@/types/AnimTypes'
import type { ImageExportSettings } from '@/types/ImageExportTypes'
import type { VideoExportSettings } from '@/types/VideoExportTypes'

import { useAspectRatio } from '@/composables/useAspectRatio'

import { useAnimWorkerCamera } from '@/composables/useAnimWorkerCamera'
import { fitToAspect } from '@/math/aspectRatio'
import { videoExportFrameCount } from '@/math/videoExportTiming'
import { getPointerClientPosition } from '@/utils/pointerEvent'
import { createMessageChannel } from '@/workers/createMessageChannel'
import type { AnimBridgeMap } from '@/workers/animation/AnimWorkerTypes'
import { usePropertiesStore } from '@/features/editor/stores/usePropertiesStore'
import { PANE_CYCLE_CONTROL_START_CLEARANCE } from '@/components/layout/paneControlLayout'
import { buildComposerUrl, type ComposerCell } from '@/features/kinetic-alphabet/composerBridge'
import { Color } from 'three'

const props = withDefaults(
  defineProps<{
    dim: { width: number; height: number; perc: number }
    store?: string
    editorVisible?: boolean
    minimal?: boolean
    minimalControlsEndClearance?: string
    controlsStartClearance?: string
    controlsEndClearance?: string
    selectionEnabled?: boolean
    conceptsVisible?: boolean
    /** The catalog cell the concept panes recognized, or null when the animation matches none. */
    composerCell?: ComposerCell | null
  }>(),
  {
    store: 'main',
    editorVisible: false,
    minimal: false,
    minimalControlsEndClearance: '0px',
    controlsStartClearance: PANE_CYCLE_CONTROL_START_CLEARANCE,
    controlsEndClearance: '0px',
    selectionEnabled: true,
    conceptsVisible: false,
    composerCell: null,
  },
)

const composerUrl = computed(() =>
  props.composerCell ? buildComposerUrl(props.composerCell) : undefined,
)

// Dimensions provided by parent component
const dim = reactive({ ...props.dim })
watchEffect(() => Object.assign(dim, props.dim))
provide('dim', readonly(dim)) // Provide reactive dimensions to child components

// Create worker and message channel
const worker = new Worker(new URL('@/workers/AnimWorker.ts', import.meta.url), { type: 'module' })
const msgChnl = createMessageChannel<AnimBridgeMap>(worker)
const { send, call, on, /*register,*/ warnStr } = msgChnl

// Send warning string to worker, gets sent back, then register it
call('warnStr', 'Player').then(warnStr)

const { isVisible } = storeToRefs(useViewportStore())
const { pFRAMES } = storeToRefs(usePropertiesStore(props.store))

const playerStore = usePlayerStore(props.store)
const { PLAYBACK_COMPILED, CURRENT, FPS } = playerStore.raw()
const {
  SELECTION,
  SELECTED,
  UPDATE,
  PLAYING,
  PREVIEW_PLAYING,
  PLAYBACK_TEMPORARY_ACTIVE,
  TRACER,
  PROGRESSIVE_PATHS,
  ALL_HEAD_PATHS,
  CONTROL_TIMES,
  PLAYBACK_ASPECT,
  CANVAS_DIM,
  imageExportRequest,
  videoExportRequest,
  videoExportCancel,
  videoExportStatus,
  videoExportProgress,
  videoExportError,
  trackClicks,
} = storeToRefs(playerStore)
const effectiveSelection = computed(() => props.selectionEnabled && SELECTION.value)
const rendererPlaying = computed({
  get: () => (PLAYBACK_TEMPORARY_ACTIVE.value ? PREVIEW_PLAYING.value : PLAYING.value),
  set: (playing: boolean) => {
    if (PLAYBACK_TEMPORARY_ACTIVE.value) PREVIEW_PLAYING.value = playing
    else PLAYING.value = playing
  },
})

const eCanvas = ref<HTMLCanvasElement>()

const canvasDim = reactive({
  width: 0,
  height: 0,
})

// Calculates the aspect ratio from values in the store
const aspectRatio = computed(() => PLAYBACK_ASPECT.value[0] / PLAYBACK_ASPECT.value[1])

// Mode: 0 = none, 1 = limited by height, 2 = limited by width
const canvasMode = ref<0 | 1 | 2>(0)

// Limits Canvas width or height depending on aspect ratio and current dimensions
watchEffect(() => {
  const dWidth = Math.floor(dim.width)
  const dHeight = Math.floor(dim.height)
  const ratio = aspectRatio.value

  // Default is 0:0 "Auto" resulting in NaN, use all available space
  if (isNaN(ratio)) {
    canvasDim.width = dWidth
    canvasDim.height = dHeight
    canvasMode.value = 0
  } else {
    // Otherwise limit the width or height
    const { width, height, mode } = fitToAspect(dWidth, dHeight, ratio)
    canvasDim.width = Math.floor(width)
    canvasDim.height = Math.floor(height)
    canvasMode.value = mode
  }

  CANVAS_DIM.value = {
    width: canvasDim.width,
    height: canvasDim.height,
  }
})

onMounted(() => {
  // Shared orbit logic
  useAnimWorkerCamera(msgChnl, canvasDim, props.store, eCanvas)

  const colorScheme = matchMedia('(prefers-color-scheme: dark)')
  const updateCameraGuides = () => {
    const cssColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-camera-path')
      .trim()
    send('cameraGuides', {
      visible: pFRAMES.value === 'camera',
      color: new Color(cssColor || 'white').getHex(),
    })
  }
  watchImmediate(pFRAMES, updateCameraGuides)
  useEventListener(colorScheme, 'change', updateCameraGuides)

  // Receive the current millisecond while playing animations
  on('pos', (val) => {
    // pos should only be received when worker has modified it,
    // Therefor, update worker with CURRENT if we aren't playing
    if (!rendererPlaying.value) send('jump', CURRENT.value)
    // Otherwise update it locally
    else CURRENT.value = val
  })
  on('playbackComplete', () => {
    if (playerStore.PLAYBACK_PREVIEW_ACTIVE) playerStore.endPlaybackPreview()
  })

  // Receive frames per second every 1000ms when animating
  on('fps', (val) => (FPS.value = val))
  on('exportVideoProgress', (progress) => {
    videoExportProgress.value = progress
  })
  on('exportVideoFinalizing', () => {
    videoExportStatus.value = 'finalizing'
  })

  // Send offscreen canvas to the worker
  ;(() => {
    const offscreen = eCanvas.value?.transferControlToOffscreen()
    call('initialize', { offscreen, allHeadPaths: ALL_HEAD_PATHS.value }, [
      offscreen as OffscreenCanvas,
    ])
      .then((success) => {
        if (success) canvasVisibility.value = 'visible'
        else console.warn('Player Worker reported a failure to initialize.')
      })
      .catch((err) => {
        console.warn('Initialization of Player Worker failed.', err)
      })
  })()

  // Send data NOW, and when it updates
  watchImmediate(PLAYBACK_COMPILED, (data) => {
    send('data', toRaw(data))
    send('jump', CURRENT.value)
  })

  // Progress bar selection range change
  watch([UPDATE, CONTROL_TIMES], () => {
    if (effectiveSelection.value)
      send('range', {
        min: CONTROL_TIMES.value[SELECTED.value[0] ?? 0] ?? 0,
        max: CONTROL_TIMES.value[SELECTED.value[1] ?? 0] ?? 0,
      })
    send('jump', CURRENT.value)
  })

  // Progress bar selection change
  watchImmediate(effectiveSelection, (val) => send('selection', val))

  // Send "Tracer" toggles
  watchImmediate(
    computed(() => TRACER.value && !props.minimal && !props.editorVisible),
    (val) => send('tracer', val),
  )

  // Path Tracing includes mini players such as Builder, unlike Tracer. Editor, selection, and the
  // separate timeline renderer retain their full paths.
  watchImmediate(
    computed(() => PROGRESSIVE_PATHS.value && !props.editorVisible && !effectiveSelection.value),
    (val) => send('progressivePaths', val),
  )

  watchImmediate(ALL_HEAD_PATHS, (val) => send('allHeadPaths', val))

  // Stop animating when page isn't visible
  watchImmediate(isVisible, (val) => send('animate', { val }))

  // Some mobile browsers do not reliably deliver the matching visible state after the app has
  // been backgrounded. Focus/pageshow provide a second foreground signal for the main player.
  const recoverAfterForeground = () => {
    if (document.visibilityState === 'visible') {
      send('animate', { val: true, play: rendererPlaying.value })
    }
  }
  useEventListener(window, 'focus', recoverAfterForeground)
  useEventListener(window, 'pageshow', recoverAfterForeground)

  // Play / Pause
  watchImmediate(rendererPlaying, (val) => {
    if (val) {
      send('jump', CURRENT.value) // helps smooth things out
      send('play', undefined)
    } else send('stop', undefined)
  })

  watch(imageExportRequest, (request) => {
    if (request) void exportImage(request.id, request.settings)
  })

  watch(videoExportRequest, (request) => {
    if (request) void exportVideo(request.id, request.settings)
  })

  watch(videoExportCancel, () => {
    if (videoExportStatus.value === 'rendering' || videoExportStatus.value === 'finalizing') {
      send('exportVideoCancel', undefined)
    }
  })

  if (!props.minimal) {
    registerCanvasInteraction()
  }
})

async function exportImage(requestId: symbol, settings: ImageExportSettings) {
  try {
    const { fileName, ...renderSettings } = settings
    const blob = await call('exportImage', {
      ...renderSettings,
      positionMs: CURRENT.value,
    })
    if (imageExportRequest.value?.id !== requestId) return

    const extension =
      settings.fileType === 'image/jpeg'
        ? '.jpg'
        : settings.fileType === 'image/webp'
          ? '.webp'
          : '.png'
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `${fileName}${extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
  } catch (error) {
    console.warn('Image export failed.', error)
  }
}

async function exportVideo(requestId: symbol, settings: VideoExportSettings) {
  const totalFrames = videoExportFrameCount(settings.durationMs, settings.framerate)
  videoExportProgress.value = { completedFrames: 0, totalFrames }
  videoExportError.value = ''
  videoExportStatus.value = 'rendering'

  try {
    const { fileName, ...renderSettings } = settings
    const result = await call('exportVideo', {
      ...renderSettings,
      restorePositionMs: CURRENT.value,
    })
    if (videoExportRequest.value?.id !== requestId) return

    if (result.canceled || !result.blob) {
      videoExportStatus.value = 'canceled'
      return
    }

    const blobUrl = URL.createObjectURL(result.blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `${fileName}${result.extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
    videoExportStatus.value = 'complete'
  } catch (error) {
    if (videoExportRequest.value?.id !== requestId) return
    videoExportError.value = error instanceof Error ? error.message : String(error)
    videoExportStatus.value = 'error'
  }
}

onBeforeUnmount(() => {
  canvasStyle.value.visibility = 'hidden'
  call('dispose', undefined).then(() => {
    worker.terminate()
  })
})

// Forward clicks to the worker
const canvasClick = (e: MouseEvent | PointerEvent | TouchEvent) => {
  if (eCanvas.value === undefined) return

  const xy = getPointerClientPosition(e)
  if (!xy) return

  // Send click to worker, check and push result
  const rect = eCanvas.value?.getBoundingClientRect()
  call('click', {
    x: xy.clientX - rect.x,
    y: xy.clientY - rect.y,
  }).then(({ type, point, prop }) => {
    if (type == -1) return

    // Receive data about the click
    if (type == CMODES.points && point !== undefined && prop != undefined)
      trackClicks.value.push([type, point as PointInd, prop])
  })
}

const touchTapMovementThreshold = 8

const hasCanvasInteraction = () =>
  PLAYBACK_COMPILED.value.props.some((prop) => typeof prop.click === 'number' && prop.click >= 0)

const registerCanvasInteraction = () => {
  type TouchGesture = {
    pointerId: number
    startX: number
    startY: number
    moved: boolean
  }

  let gesture: TouchGesture | undefined

  useEventListener(eCanvas, 'click', (event: MouseEvent) => {
    const pointerType = Reflect.get(event, 'pointerType')
    if (typeof pointerType === 'string' && pointerType !== '' && pointerType !== 'mouse') return
    canvasClick(event)
  })

  useEventListener(eCanvas, 'pointerdown', (event: PointerEvent) => {
    if (event.pointerType === 'mouse' || event.button !== 0) return
    if (!event.isPrimary) {
      if (gesture) gesture.moved = true
      return
    }
    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
  })

  useEventListener(eCanvas, 'pointermove', (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointerId || gesture.moved) return
    const horizontalMovement = event.clientX - gesture.startX
    const verticalMovement = event.clientY - gesture.startY
    gesture.moved = Math.hypot(horizontalMovement, verticalMovement) > touchTapMovementThreshold
  })

  useEventListener(eCanvas, 'pointercancel', (event: PointerEvent) => {
    if (gesture?.pointerId === event.pointerId) gesture = undefined
  })

  useEventListener(eCanvas, 'pointerup', (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return
    if (!gesture || event.pointerId !== gesture.pointerId) return
    const completedGesture = gesture
    gesture = undefined
    if (completedGesture.moved) return

    if (hasCanvasInteraction()) canvasClick(event)
    else rendererPlaying.value = !rendererPlaying.value
  })
}

// Aspect Ratio strings for UI
const aspect = useAspectRatio(toRef(canvasDim, 'width'), toRef(canvasDim, 'height'))
const aspectLabel = computed(() => {
  const { match, reduced, ratio, nearby, approx } = aspect.data.value
  const decimal = ratio.toFixed(3)

  const ratioText = match
    ? //match === reduced ? ... : `${match} (${decimal}) [${reduced}]`
      `${match} (${decimal})`
    : `${reduced} (${decimal})`

  const approxText = nearby?.length ? `≈ ${nearby.join(', ')}` : approx ? `≈ ${approx}` : ''
  return {
    ratioText,
    approxText,
  }
})

const fps = computed(() => {
  const fps = FPS.value
  return /*PLAYING.value &&*/ fps > 0 ? `${FPS.value} fps` : ''
})

const canvasVisibility = ref<CSSProperties['visibility']>('hidden')

const canvasBorderStyle = '1px dashed var(--color-border)'

const canvasStyle = computed<CSSProperties>(() => {
  const mode = canvasMode.value
  return {
    width: `${canvasDim.width}px`,
    height: `${canvasDim.height}px`,
    visibility: canvasVisibility.value,

    // Center alignment (this method fixes issue with border being wonky)
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    margin: 'auto',

    'border-left': mode === 1 ? canvasBorderStyle : 'none',
    'border-right': mode === 1 ? canvasBorderStyle : 'none',
    'border-top': mode === 2 ? canvasBorderStyle : 'none',
    'border-bottom': mode === 2 ? canvasBorderStyle : 'none',
  }
})

const containerStyle = computed<CSSProperties>(() => ({
  width: `${dim.width}px`,
  height: `${dim.height}px`,
  position: 'relative',
}))
</script>

<style scoped>
.fps,
.aspect-tooltip,
.tka-chip-tooltip {
  /* Clear the 34px-wide side controls and their 2px right inset. */
  right: calc(34px + 2px);
}

.fps {
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: bold;
  position: absolute;
  top: 26px;
}
.fps--without-aspect {
  top: 6px;
}
.aspect-tooltip {
  position: absolute;
  top: 6px;
  z-index: 2;
}

.aspect {
  color: var(--color-text-muted);
  font-size: 14px;
}

.tka-chip-tooltip {
  position: absolute;
  top: 46px;
  z-index: 2;
}

/* Only rendered once a catalog cell is matched, so the chip has no unlit state. */
.tka-chip {
  display: inline-block;
  padding: 6px 14px;
  border: 1px solid var(--color-pattern-mode-active-border);
  border-radius: var(--radius-sm);
  background: var(--color-pattern-mode-active);
  color: var(--color-on-action-primary);
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 0.04em;
  text-decoration: none;
  /* Lifts the chip off whatever the canvas is drawing behind it. */
  box-shadow: 0 2px 6px rgb(0 0 0 / 35%);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.tka-chip:hover,
.tka-chip:focus-visible {
  background: var(--color-action-primary);
  border-color: var(--color-action-primary);
}
</style>
