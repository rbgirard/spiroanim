<template>
  <div :style="containerStyle" data-role="player-container">
    <canvas ref="eCanvas" :style="canvasStyle" />
    <Controls :store="props.store" />
    <span class="fps">{{ fps }}</span>
    <BaseTooltip :disabled="!showTooltips">
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
    </BaseTooltip>
  </div>
</template>

<script setup lang="ts">
import Controls from './player/PlayerControls.vue'
import BaseTooltip from '@/components/ui/BaseTooltip.vue'

import { useViewportStore } from '@/stores/useViewportStore'
import { usePlayerStore /*, DEFAULT_POSITION*/ } from '@/stores/usePlayerStore'

import { CMODES, RADIUS, ORIGRADIUS } from '@/domain/animation/AnimStruct'
import type { PointInd } from '@/types/AnimTypes'

import { useAspectRatio } from '@/composables/useAspectRatio'

import { useAnimWorkerCamera } from '@/composables/useAnimWorkerCamera'
import { createMessageChannel } from '@/workers/createMessageChannel'
import type { AnimBridgeMap } from '@/workers/animation/AnimWorkerTypes'

const multi = RADIUS / ORIGRADIUS

const props = withDefaults(
  defineProps<{
    dim: { width: number; height: number; perc: number }
    store?: string
  }>(),
  {
    store: 'main',
  },
)

// Dimensions provided by parent component
const dim: Readonly<typeof props.dim> = readonly(props.dim)
provide('dim', dim) // Provide to child components

// Create worker and message channel
const worker = new Worker(new URL('@/workers/AnimWorker.ts', import.meta.url), { type: 'module' })
const msgChnl = createMessageChannel<AnimBridgeMap>(worker)
const { send, call, on, /*register,*/ warnStr } = msgChnl

// Send warning string to worker, gets sent back, then register it
call('warnStr', 'Player').then(warnStr)

const { isVisible, showTooltips } = storeToRefs(useViewportStore())

const playerStore = usePlayerStore(props.store)
const { ROOT, COMPILED, CURRENT, FPS, ORBIT } = playerStore.raw()
const {
  SELECTION,
  SELECTED,
  UPDATE,
  PLAYING,
  TRACER,
  ASPECT,
  cameraCenter,
  saveImage,
  trackClicks,
} = storeToRefs(playerStore)

const eCanvas = ref<HTMLCanvasElement>()

const canvasDim = reactive({
  width: 0,
  height: 0,
})

// Calculates the aspect ratio from values in the store
const aspectRatio = computed(() => ASPECT.value[0] / ASPECT.value[1])

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
})

onMounted(() => {
  // Shared orbit logic
  useAnimWorkerCamera(msgChnl, canvasDim, props.store, eCanvas)

  // Receive the current millisecond while playing animations
  on('pos', (val) => {
    // pos should only be received when worker has modified it,
    // Therefor, update worker with CURRENT if we aren't playing
    if (!PLAYING.value) send('jump', CURRENT.value)
    // Otherwise update it locally
    else CURRENT.value = val
  })

  // Receive frames per second every 1000ms when animating
  on('fps', (val) => (FPS.value = val))

  // Send offscreen canvas to the worker
  ;(() => {
    const offscreen = eCanvas.value?.transferControlToOffscreen()
    call('initialize', { offscreen }, [offscreen as OffscreenCanvas])
      .then((success) => {
        if (success) canvasVisibility.value = 'visible'
        else console.warn('Player Worker reported a failure to initialize.')
      })
      .catch((err) => {
        console.warn('Initialization of Player Worker failed.', err)
      })
  })()

  // Send data NOW, and when it updates
  watchImmediate(COMPILED, (data) => {
    send('data', toRaw(data))
    send('jump', CURRENT.value)
  })

  // Progress bar selection range change
  watch(UPDATE, () => {
    if (SELECTION.value) send('range', { min: SELECTED.value[0]!, max: SELECTED.value[1]! })
    send('jump', CURRENT.value)
  })

  // Progress bar selection change
  watchImmediate(SELECTION, (val) => send('selection', val))

  // Send "Tracer" toggles
  watchImmediate(TRACER, (val) => send('tracer', val))

  // Stop animating when page isn't visible
  watchImmediate(isVisible, (val) => send('animate', { val }))

  // Play / Pause
  watchImmediate(PLAYING, (val) => {
    if (val) {
      send('jump', CURRENT.value) // helps smooth things out
      send('play', undefined)
    } else send('stop', undefined)
  })

  // Center Animation Event (triggers from the Center button,) triggers transform
  watch(cameraCenter, () => {
    ORBIT.value.position = [0, 0, ROOT.value.distance * -1 * multi] //[...DEFAULT_POSITION]
    ORBIT.value.target = [0, 0, 0]
    ORBIT.value = { ...ORBIT.value } // trigger shallow watchers
  })

  watch(saveImage, () => {
    call('reqimg', undefined).then((blobUrl) => {
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'Saved.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    })
  })

  // Register canvas click or touchend
  const prefersTouch = matchMedia('(pointer: coarse)').matches
  useEventListener(eCanvas, prefersTouch ? 'touchend' : 'click', canvasClick)
})

onBeforeUnmount(() => {
  canvasStyle.value.visibility = 'hidden'
  call('dispose', undefined).then(() => {
    worker.terminate()
  })
})

// Forward clicks to the worker
const canvasClick = (e: MouseEvent | TouchEvent) => {
  if (eCanvas.value === undefined) return

  // Define a custom type with the properties needed from MouseEvent and Touch
  let xy: { clientX: number; clientY: number }

  if (e instanceof TouchEvent) {
    // Touch event
    const touch = e.changedTouches?.[0] ?? e.touches?.[0]
    if (!touch) return

    xy = {
      clientX: touch.clientX,
      clientY: touch.clientY,
    }
  } else {
    // If it's a MouseEvent, directly assign the event to ev
    xy = {
      clientX: e?.clientX,
      clientY: e?.clientY,
    }
  }

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

/**
 * Calculate a new width/height that fits inside max bounds
 * while maintaining the desired aspect ratio.
 */
function fitToAspect(
  maxWidth: number,
  maxHeight: number,
  aspectRatio: number, // width / height
): {
  width: number
  height: number
  mode: 0 | 1 | 2 // 0 = already fits, 1 = limited by height, 2 = limited by width
} {
  const actualRatio = maxWidth / maxHeight
  const diff = Math.abs(actualRatio - aspectRatio)

  if (diff < 0.01) {
    // Already matches the aspect ratio within tolerance
    return {
      width: maxWidth,
      height: maxHeight,
      mode: 0,
    }
  }

  const heightBasedWidth = maxHeight * aspectRatio
  if (heightBasedWidth <= maxWidth) {
    // Width fits, so limit by height
    return {
      width: heightBasedWidth,
      height: maxHeight,
      mode: 1,
    }
  } else {
    // Width would overflow — limit by width instead
    const widthBasedHeight = maxWidth / aspectRatio
    return {
      width: maxWidth,
      height: widthBasedHeight,
      mode: 2,
    }
  }
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
.fps {
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: bold;
  position: absolute;
  right: 10px;
  top: 26px;
}
.aspect {
  color: var(--color-text-muted);
  font-size: 14px;
  position: absolute;
  right: 10px;
  top: 6px;
}
</style>
