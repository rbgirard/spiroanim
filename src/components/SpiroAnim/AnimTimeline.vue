<template>
  <div ref="eScroll" class="scrollbar" :style="scrollStyle">
    <div :style="gridStyle">
      <div
        v-for="(time, index) in UTIMES"
        ref="eCells"
        :key="`u${time}`"
        :style="thumbStyle"
        class="timeline-cell"
      >
        <span
          v-for="(color, prop) in circles[index]"
          :key="`u${time}-p${prop}`"
          class="circle"
          :style="circleCSS(prop, color)"
        />
        <img
          ref="eThumbs"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
          :data-index="index"
          :alt="`Animation thumbnail ${index + 1}`"
          class="thumb"
          :style="thumbStyle"
          role="button"
          tabindex="0"
          @click="thumbClick(index)"
          @keydown.enter="thumbClick(index)"
          @keydown.space.prevent="thumbClick(index)"
        />
        <AppTooltip class="thumbStart" text="Index: Beat">
          <template #activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps"
              ><span class="thumbIndex">{{ index + 1 }}: </span>{{ msToBeat(time, ROOT.bpm) }}</span
            >
          </template>
        </AppTooltip>
      </div>
    </div>
    <div :style="activeStyle"></div>
    <div class="cursor" :style="cursorStyle"></div>
  </div>
</template>

<script setup lang="ts">
// src\components\SpiroAnim\AnimTimeline.vue

import AppTooltip from '@/components/AppTooltip.vue'
import { usePingPongValue, easeInOut } from '@/composables/usePingPongValue'
import { throttleTrailing, nextFrame, toColor } from '@/utils/UtilFunc'
import { COLSET } from '@/domain/animation/AnimStruct'
import { msToBeat } from '@/math/animation/PlayerFunc'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useMainPaneStore } from '@/stores/useMainPaneStore'
import { useAnimWorkerCamera } from '@/composables/useAnimWorkerCamera'
import { createMessageChannel } from '@/workers/createMessageChannel'
import type { AnimBridgeMap } from '@/workers/animation/AnimWorkerTypes'

const props = withDefaults(
  defineProps<{
    dim: { width: number; height: number; perc: number }
    landscape?: boolean
    store?: string
    cols?: number
  }>(),
  {
    store: 'main',
    landscape: false,
    cols: undefined,
  },
)

const { parents: mainViews } = storeToRefs(useMainPaneStore())

// Dimensions provided by parent component
const dim: Readonly<typeof props.dim> = readonly(props.dim)

// Create worker and message channel
const worker = new Worker(new URL('@/workers/AnimWorker.ts', import.meta.url), { type: 'module' })
const msgChnl = createMessageChannel<AnimBridgeMap>(worker)
const { send, call, /*on, register,*/ warnStr } = msgChnl

// Send warning string to worker, gets sent back, then register it
call('warnStr', 'Player').then(warnStr)

const playerStore = usePlayerStore(props.store)
const { ROOT, COMPILED, CURRENT, ORBIT } = playerStore.raw()
const { INDEX, UTIMES, PLAYING, UPDATE, SELECTION, SELECTED, PTIMES, ASPECT } =
  storeToRefs(playerStore)

const eScroll = ref<HTMLElement>()
const eCells = ref<HTMLElement[]>([])
const eThumbs = ref<HTMLImageElement[]>([])
const circles = ref<number[][]>([])

const gridTemplateColumns = ref<CSSProperties['grid-template-columns']>('repeat(1, 100%)')
const gridAutoRows = ref<CSSProperties['grid-auto-rows']>('100px')

// Vars for thumbnail image requests
let requesting = false //            Prevents concurrent image requests
let repeat = false //                True when images have been requested during a request
let imgsLoaded: boolean[] = [] //    Tracks if images are up to date
const imgsVisible: boolean[] = [] // Tracks if thumbnail is visible

// Makes items in the image thicker than player
const girth = 2

// Values for thumbnail double click detection
let lastClick = 0
let lastIndex = -1

// Tracks visible thumbnails
let thumbObserver: IntersectionObserver

// Tracks cell dimensions
const cellDim = reactive({ width: 0, height: 0 })

// Grid position / layout properties
const gridPos = reactive({
  col: 0,
  row: 0,
  cols: 1,
  rows: 1, // Not used but gets set
})

// Active layer properties
const activePos = reactive({
  left: 0,
  top: 0,
  height: 20,
  bottom: 1,
})

// Cursor properties
const cursorPos = reactive({
  left: 0,
  top: 0,
  width: 10,
})

// Values for animating the Cursor animation
const cursorWidth = {
  playing: 10,
  min: 6,
  max: 12,
}

// Cursor animation handler
const { value: cursorAnimated, animating: cursorAnimating } = usePingPongValue(
  cursorWidth.min,
  cursorWidth.max,
  250,
  easeInOut,
)

// Calculates the aspect ratio from values in the store
const aspectRatio = computed(() => ASPECT.value[0] / ASPECT.value[1])

onMounted(() => {
  // Shared orbit logic
  useAnimWorkerCamera(msgChnl, cellDim, props.store)

  // Initialize worker, which creates the offscreenCanvas
  call('initialize', { girth, timeline: true })
    .then((success) => {
      if (!success) console.warn('Timeline Worker reported a failure to initialize.')
    })
    .catch((err) => {
      console.warn('Initialization of Timeline Worker failed.', err)
    })

  // Send data NOW, and when it updates
  watchImmediate(COMPILED, (data, old) => {
    send('data', toRaw(data))
    if (old !== undefined) requestImages()
  })

  // Observer for tracking visible thumbnails, requesting images from worker
  thumbObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const target = entry.target as HTMLElement
        const indexStr = target.dataset.index
        const index = indexStr !== undefined ? parseInt(indexStr) : NaN
        if (!isNaN(index)) imgsVisible[index] = entry.isIntersecting
      })
      requestImages()
    },
    { root: eScroll.value, threshold: 0.05 },
  )

  // Update the observer and reset image loaded tracking
  watch(
    eThumbs,
    (newThumbs, oldThumbs) => {
      oldThumbs?.forEach((o) => thumbObserver.unobserve(o))
      imgsLoaded = Array.from({ length: UTIMES.value.length }, () => false)
      newThumbs.forEach((o) => thumbObserver.observe(o))
    },
    // NOTE: Deep is necessary here
    { deep: true, immediate: true },
  )

  // Handle resizing based on eScroll's realtime dimensions, and update gridPos.cols
  // This eliminates race conditions that I previously ran into
  const { width, height } = useElementBounding(eScroll)
  watchImmediate([width, height, aspectRatio], ([width, height, aspect]) => {
    // If 0's this executes again
    if (width === 0 || height === 0) return

    // Use clientWidth to exclude the scroll bar
    const sWidth = eScroll.value?.clientWidth ?? 0
    const cCols = calcCols(dim.perc, props.landscape)
    gridPos.cols = props.cols ?? cCols
    gridPos.rows = Math.ceil(UTIMES.value.length / gridPos.cols)

    // Calculate width / height of the thumbnails
    cellDim.width = Math.floor(sWidth / gridPos.cols)
    cellDim.height = Math.floor(isNaN(aspect) ? cellDim.width * 0.75 : cellDim.width / aspect)

    // Layout CSS Updates
    gridTemplateColumns.value = `repeat(${gridPos.cols}, ${100 / gridPos.cols}%)`
    gridAutoRows.value = `${cellDim.height}px`
  })

  // Request images and scroll to active item when we've resized
  // Moved out of resize handler to resolve a race condition
  watch(cellDim, () => {
    scrollActive()
    requestImages()
  })

  // Calculate current row and column
  watchEffect(() => {
    gridPos.row = Math.floor(INDEX.value / gridPos.cols)
    gridPos.col = INDEX.value % gridPos.cols
  })

  // Reposition the active layer
  watchEffect(() => {
    activePos.left = cellDim.width * gridPos.col
    activePos.top =
      cellDim.height * gridPos.row + cellDim.height - activePos.height - activePos.bottom
  })

  // Pause cursor animation when playing
  watchEffect(() => {
    const playerHidden = mainViews.value.player == 'hidden'
    cursorAnimating.value = !PLAYING.value || playerHidden
  })

  // Animate and move the cursor
  // This was a source of lag in dev env and dev tools open
  // moved from watchEffect to watch and applied a throttle
  watch(
    [
      CURRENT,
      INDEX,
      UTIMES,
      cursorAnimated,
      cursorAnimating,
      () => [cellDim.width, cellDim.height],
    ],
    throttleTrailing(() => {
      // Cursor animation
      const anim = cursorAnimated.value
      const cursorW = cursorAnimating.value ? anim : cursorWidth.playing
      cursorPos.width = cursorW

      // Calculate core values
      const { width: cellW, height: cellH } = cellDim
      const { cols, col, row } = gridPos
      const { start, end } = cursorOffset(col, cols, cellW, cursorW)
      const perc = framePerc(CURRENT.value, INDEX.value, UTIMES.value)

      // Final assignment
      cursorPos.left = col * cellW + start + (end - start) * perc
      cursorPos.top = row * cellH
    }, 16), // Close to 60fps limit cap
  )

  // Update circles / colors data
  watchImmediate(ROOT, (data) => {
    const result: number[][] = []
    if (!UTIMES.value?.length) return

    // Loop through each unique timestamp
    for (let i = 0; i < UTIMES.value.length; i++) {
      const time = UTIMES.value[i]!
      const row: number[] = []

      // For each prop, check if the time exists in its PTIMES entry
      for (let j = 0; j < PTIMES.value.length; j++) {
        const times = PTIMES.value[j]!
        if (times.includes(time)) {
          const prop = data.props[j]!
          const colIndex = prop.color ?? data.color
          // Prop colors are fixed animation content rather than theme UI colors.
          row.push(COLSET[colIndex]![0])
        }
      }
      result.push(row)
    }
    circles.value = result
  })

  // Request images as orbit changes
  watch(ORBIT, () => {
    requestImages()
  })

  // Auto scroll to the active element as row
  watch([() => gridPos.row, PLAYING], scrollActive, { immediate: true })

  // Truncate lengths if UTIMES shrinks
  watch(
    () => UTIMES.value.length,
    (len) => {
      truncateArray(eCells.value, len)
      truncateArray(eThumbs.value, len)
    },
  )
})

onBeforeUnmount(() => {
  // Unmount Cleanup
  thumbObserver.disconnect()
  call('dispose', undefined).then(() => {
    worker.terminate()
  })
})

// Column count logic
function calcCols(perc: number, landscape: boolean): number {
  if (landscape) {
    if (perc >= 80) return 4
    if (perc >= 40) return 3
    if (perc > 20) return 2
    return 1
  } else {
    if (perc >= 80) return 1
    if (perc >= 40) return 2
    if (perc > 20) return 3
    return 4
  }
}

// Percentage completed of the current time block
function framePerc(ms: number, i: number, times: number[] = UTIMES.value) {
  if (i >= times.length - 1) return 0

  const startTime = times[i] ?? 0
  const endTime = times[i + 1] ?? startTime
  const dura = endTime - startTime

  // Fallback: if no next frame, snap to start
  return !isFinite(dura) ? 0 : (ms - startTime) / dura
}

// Calculates offsets for Cursor to always be within bounds and fluid
function cursorOffset(col: number, cols: number, cellW: number, cursorW: number) {
  // Only one column: left edge → right edge
  if (cols === 1) {
    return {
      start: 0,
      end: cellW - cursorW,
    }
  }
  // First column: left edge → center-right
  if (col === 0) {
    return {
      start: 0,
      end: cellW - cursorW / 2,
    }
  }
  // Last column: center-left → right edge
  if (col === cols - 1) {
    return {
      start: -cursorW / 2,
      end: cellW - cursorW,
    }
  }
  // Middle column: center-left → center-right
  return {
    start: -cursorW / 2,
    end: cellW - cursorW / 2,
  }
}

// Determines what percentage of a cell is visible
function getScrollVisibleHeightPercent(el: HTMLElement, scrollContainer: HTMLElement): number {
  const elRect = el.getBoundingClientRect()
  const containerRect = scrollContainer.getBoundingClientRect()

  const topVisible = Math.max(containerRect.top, elRect.top)
  const bottomVisible = Math.min(containerRect.bottom, elRect.bottom)

  const visibleHeight = Math.max(0, bottomVisible - topVisible)
  return visibleHeight / elRect.height
}

// Scrolls to the active thumbnail
async function scrollActive() {
  await nextFrame() // Fix from old version of SpiroAnim on old iPad, kept just in case
  const active = eThumbs.value[INDEX.value]
  const scroll = eScroll.value
  if (scroll == undefined || active == undefined) return
  if (!imgsVisible[INDEX.value] || getScrollVisibleHeightPercent(active, scroll) < 1) {
    const activeRect = active.getBoundingClientRect()
    const scrollRect = scroll.getBoundingClientRect()
    scroll.scrollTop += activeRect.top - scrollRect.top - scroll.clientTop
  }
}

// Shorthand function to shorten an array when data changes
function truncateArray(arr: unknown[], len: number) {
  if (arr.length > len) arr.length = len
}

// Handles thumbnail click logic: toggles selection on double click, updates CURRENT time
function thumbClick(index: number) {
  const now = performance.now()
  const editorVisible = mainViews.value.editor == 'hidden'
  UPDATE.value = Symbol()

  // Toggle SELECTION mode on double click (within 500ms)
  if (lastIndex === index && now - lastClick <= 500) {
    SELECTION.value = !SELECTION.value
    //if (SELECTION.value && !editorVisible) PLAYING.value = true
  } else {
    lastClick = now
    lastIndex = index
  }

  // Update current time to selected index
  CURRENT.value = UTIMES.value[index]!

  if (SELECTION.value) {
    // Select range: [index, index+1] (or clamp to last index)
    const max = UTIMES.value.length - 1
    SELECTED.value[0] = index
    SELECTED.value[1] = Math.min(index + 1, max)
  } // else if (!editorVisible) {
  //  PLAYING.value = false
  //}
  if (!editorVisible) PLAYING.value = false
}

// Requests images from worker upon events in onMounted
function requestImages() {
  if (requesting) {
    repeat = true
    return
  } else {
    // Determine items which are visible and need to be loaded
    const visible = []
    for (let i = 0; i < imgsVisible.length; i++) if (imgsVisible[i]) visible.push(i)
    // Request images as needed
    if (visible.length) {
      requesting = true
      call('reqimgs', visible).then((urls) => {
        for (const strI in urls) {
          const i = Number(strI)
          const img = eThumbs.value[i]
          if (!img) continue

          const prev = img.src
          const url = urls[i]!

          // Defer revoke until after new image has loaded
          const revoke = () => {
            if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
            img.removeEventListener('load', revoke)
            img.removeEventListener('error', revoke)
          }

          img.addEventListener('load', revoke)
          img.addEventListener('error', revoke)

          img.src = url
          imgsLoaded[i] = true
        }

        requesting = false
        if (repeat) {
          repeat = false
          setTimeout(requestImages, 0)
        }
      })
    }
  }
}

function circleCSS(prop: number, color: number): CSSProperties {
  const size = 6
  const left = 3 + prop * size + prop * 3
  return {
    left: left + 'px',
    'background-color': toColor(color),
    //visibility: left + size < cellDim.width ? 'visible' : 'hidden',
  }
}

const scrollStyle = computed<CSSProperties>(() => ({
  width: `${dim.width}px`,
  height: `${dim.height}px`,
  position: 'relative',
  'overflow-y': 'scroll',
  'overflow-x': 'visible',
  'border-top': 'solid 1px',
  'border-bottom': 'solid 1px',
  'border-color': 'var(--color-workspace-boundary)',
}))

const gridStyle = computed<CSSProperties>(() => ({
  width: `${gridPos.cols * cellDim.width}px`, // eliminates occasional gaps in cells
  'grid-template-columns': gridTemplateColumns.value,
  'grid-auto-rows': gridAutoRows.value,
  'padding-bottom': 'var(--size-pane-switch-bottom-clearance)',
  display: 'grid',
}))

const thumbStyle = computed<CSSProperties>(() => ({
  width: `${cellDim.width}px`,
  height: `${cellDim.height}px`,
}))

const activeStyle = computed<CSSProperties>(() => ({
  top: `${activePos.top}px`,
  left: `${activePos.left}px`,
  width: `${cellDim.width}px`,
  height: `${activePos.height}px`,
  position: 'absolute',
  'z-index': '500',
  'background-color': 'color-mix(in srgb, var(--color-action-primary) 5%, transparent)',
}))

const cursorStyle = computed<CSSProperties>(() => ({
  top: `${cursorPos.top}px`,
  left: `${cursorPos.left}px`,
  width: `${cursorPos.width}px`,
  height: `${cellDim.height}px`,
}))
</script>

<style scoped>
.cursor {
  position: absolute;
  z-index: 501;
  background-color: color-mix(in srgb, var(--color-action-primary) 10%, transparent);
}
.timeline-cell {
  position: relative;
  border-bottom: solid 1px;
  border-color: var(--color-workspace-separator);
  overflow: visible;
}
.circle {
  top: 12px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  position: absolute;
  z-index: 502;
  opacity: 75%;
}
.thumbStart {
  position: absolute;
  bottom: 0px;
  left: 22px;
  color: var(--color-text);
  font-size: 12px;
  z-index: 502;
}
.thumbIndex {
  color: var(--color-action-primary);
}
</style>
