// src\workers\AnimWorker.ts

/*
 * Notes for later
 * MediaRecorder (records from canvas)
 * WebCodecs API (manual frame control, experimental / limited browsers, but still no Alpha support for encoding)
 * backend/FFmpeg - Alpha support
 */

// TODO: Paths don't currently reflect the ADJUST property on first frame (disable it? Or resolve?) -- MAYBE FIXED?

import { createSpiroAnimator } from '@/workers/animation/createSpiroAnimator'

import { CMODES } from '@/domain/animation/AnimStruct'
import { PROPTIMES, UNQTIMES } from '@/math/animation/PlayerFunc'

import { WebGLRenderer, Scene, PerspectiveCamera, Raycaster, Vector2, Mesh } from 'three'

import {
  Material,
  Texture,
  Object3D /*Points, LineSegments, Sprite, InstancedMesh, Line*/,
} from 'three'

import { createMessageChannel } from '@/workers/createMessageChannel'
import type { AnimBridgeMap } from '@/workers/animation/AnimWorkerTypes'

const { send, on, register, /*call,*/ warnStr } = createMessageChannel<AnimBridgeMap>(
  self as DedicatedWorkerGlobalScope,
)

// Store the warnStr here for console.log's during testing
let _desc = ''

// Main thread provides the warning string, we register it, then send it back
register('warnStr', (str) => (_desc = warnStr(str)))

const dim = { width: 1, height: 1, ratio: 1 }
const camera = new PerspectiveCamera(45, 1, 0.1, 1000)
const minChg = 0.0000000001 // Minimum time change (reduce 0's for troubleshooting issues)
const raycaster = new Raycaster()
const pointer = new Vector2()

let renderer: WebGLRenderer
let canvas: OffscreenCanvas
let scene: Scene
let animators: ReturnType<typeof createSpiroAnimator>[] = []
let timeline = false

let completedCount = 0
let playing = false
let animating = false
let propTimes: number[][]
let unqTimes: number[]
let speed = 1
let girth = 1
let animationId: number
let selection = false
let min = 0
let max = 0

let fpsTime = 0
let fpsCount = 0

//const lastPosSent = 0
//const posThrottleMs = 16 // 60fps cap

// Receive dimensions
on('resize', (vals) => {
  Object.assign(dim, vals)
  resize(dim)
})

// Receive camera projection
on('projection', (vals) => {
  Object.assign(camera, vals)
  //console.log('projection:', vals)
  camera.updateProjectionMatrix()
})

// Receive camera transformation
on('transform', ({ pos, rot }) => {
  camera.position.fromArray(pos)
  camera.rotation.fromArray(rot)
  if (renderer && !renderer.autoClear) debouncedClear()
  animatorDim()
})

// Receive animation command
on('animate', ({ val, play }) => {
  animating = val === undefined ? true : val
  if (play) playing = play
  if (animating) animate()
  else cancelAnimationFrame(animationId)
})

// Jump play and stop commands
on('jump', (ms) => jump(ms))
on('play', () => (playing = true))
on('stop', () => (playing = false))

// Doesn't clear the animations, leaving trails
on('tracer', (val) => (renderer.autoClear = !val))

// Selection options
on('selection', (val) => (selection = val))
on('range', ({ min: mi, max: ma }) => {
  min = mi
  max = ma
})

// Receive offscreen canvas (or create one)
register('initialize', ({ offscreen, girth: g, timeline: tl /*RADIUS,*/ }) => {
  timeline = tl ?? false

  // Girth is used in Timeline (makes props thicker)
  if (g !== undefined) girth = g

  // Player supplies the canvas
  if (offscreen) canvas = offscreen
  // Timeline doesn't supply the canvas
  else canvas = new OffscreenCanvas(dim.width, dim.height)

  // Create Three.js Renderer
  renderer = new WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  })
  renderer.autoClear = true
  renderer.setClearColor(0x000000, 0)
  resize(dim) // trigger resize to make sure renderer dimensions get set

  return true // Set canvas visibility to visible in main thread
})

// Setup scene and SpiroAnimators when "compiled" data is received
on('data', (compiled) => {
  if (scene) disposeScene(scene)
  scene = new Scene()
  animators = []

  // Timeline specific rendering
  const anyActive = compiled.props.some((prop) => prop.active)
  if (timeline) {
    // Never display full paths
    compiled.paths = false
    compiled.hands = false
    compiled.visible = true
    for (const prop of compiled.props) {
      prop.paths = false
      prop.hands = false
      prop.visible = true
      // If user is clicking an item, we don't want the points blown up
      prop.click = undefined
      if (!anyActive) prop.active = true
    }
  }

  // Allow tracks to have different lengths
  const completed = () => {
    completedCount++
    if (completedCount == animators.length) {
      completedCount = 0

      // Start each animator at the beginning
      const now = performance.now()
      if (playing)
        for (let i = 0; i < animators.length; i++) {
          const animator = animators[i]!
          animator.index = 0
          animator.AnimStart = now
          animator.playing = true
          animator.animate(now)
        }
    }
  }

  // Millisecond intervals of each Prop and how they align
  propTimes = PROPTIMES(compiled)
  unqTimes = UNQTIMES(propTimes)

  speed = compiled.speed ? 1 / compiled.speed : 1

  // Build data for each prop
  const distance = camera.position.length()
  for (let i = 0; i < compiled.props.length; i++)
    animators.push(
      createSpiroAnimator({
        scene,
        speed,
        completed,
        girth,
        bpm: compiled.bpm,
        prop: compiled.props[i]!,
        smooth: compiled.smooth,
        width: dim.width,
        height: dim.height,
        distance,
        fov: camera.fov,
        timeline: timeline,
      }),
    )

  // Restart animate()
  if (animating) {
    if (animationId) cancelAnimationFrame(animationId)
    animate(undefined, false)
  }

  // TODO: Why is this necessary when the values are supplied above?
  // (appears to affect lines when new data is received, if this isn't called)
  animatorDim()
})

// Handles click event requests
register('click', ({ x, y }) => {
  pointer.x = (x / dim.width) * 2 - 1
  pointer.y = -(y / dim.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)

  const intersects = raycaster.intersectObjects(scene.children)
  for (let i = 0; i < intersects.length; i++) {
    const obj = intersects[i]!.object
    for (let j = 0; j < animators.length; j++) {
      const anim = animators[j]!

      if (anim.click == CMODES.points) {
        const pobjs = anim.pobjs

        for (const key in pobjs) {
          if (obj.visible && pobjs[key]!.id == obj.id) {
            // Send back to main thread
            return {
              type: CMODES.points,
              point: parseInt(key),
              prop: j,
            }
          }
        }
      }
    }
  }
  return { type: -1 } // Let main thread know nothing detected
})

// Used with Timeline to request images of specific frames
register('reqimgs', async (vals) => {
  const urls: Record<number, string> = {}
  if (unqTimes?.length === 0) return urls

  if (canvas instanceof OffscreenCanvas)
    for (const i of vals) {
      const time = unqTimes[i]!
      jump(time)
      renderer.render(scene, camera)

      const blob = await canvas.convertToBlob({ type: 'image/png' })
      urls[i] = URL.createObjectURL(blob)
    }

  return urls
})

register('reqimg', async () => {
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return URL.createObjectURL(blob)
})

// Cleanup resources, main then terminates the worker
register('dispose', () => {
  if (animating) cancelAnimationFrame(animationId)
  if (scene) disposeScene(scene)
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
  }
})

// Handle resize
function resize({ width, height, ratio }: typeof dim) {
  if (canvas) {
    canvas.width = width
    canvas.height = height
  }
  if (renderer) {
    renderer.setPixelRatio(ratio)
    renderer.setSize(width, height, false)
    //console.log('Renderer.setSize:', width, height)
  }
  animatorDim()
}

// Eliminates a ton of flickering when adjusting camera w/ "tracer" turned on
// Tradeoff is it isn't cleared until camera stops moving, which is kind of cool
const debouncedClear = debounce(() => {
  renderer.clear()
}, 100)

// This block was repeated several times in the old code
function animatorDim() {
  const distance = camera.position.length()
  for (let i = 0; i < animators.length; i++)
    animators[i]!.dimensions(dim.width, dim.height, distance, camera.fov)
}

function animate(time: number | undefined = undefined, render: boolean | undefined = true) {
  if (time === undefined) time = performance.now()

  if (animating) {
    animationId = requestAnimationFrame(animate)

    fpsCount++
    const elapsed = time - fpsTime
    if (elapsed >= 1000) {
      send('fps', Math.round((fpsCount / elapsed) * 1000))
      fpsTime = time
      fpsCount = 0
    }
  }

  // Parse current Millisecond
  if (playing && animators.length) {
    const animator = animators[0]!
    const index = animator.index
    let skip = false,
      MS = Math.floor((time - animator.AnimStart) / speed)
    if (index > 0) MS += propTimes[0]![index - 1]!

    // Check for selections and if we need to jump
    if (selection) {
      if (MS < unqTimes[min]! || MS >= unqTimes[max]!) {
        jump(unqTimes[min]!)
        skip = true
      }
    }

    // Prevent playing out of bounds
    else if (unqTimes.length > 0 && MS > unqTimes[unqTimes.length - 1]!) {
      jump(0)
      skip = true
    }

    if (!skip) {
      // Throttle how often POS updates are sent
      //if (time - lastPosSent >= posThrottleMs) {
      send('pos', MS)
      //lastPosSent = time
      //}
      for (let i = 0; i < animators.length; i++) animators[i]!.animate(time)
    }
  }

  //console.log('Render:', {
  //  canvas: [canvas.width, canvas.height],
  //  rendererSize: renderer.getSize(new Vector2()).toArray(),
  //  aspect: camera.aspect,
  //})

  if (render) renderer.render(scene, camera)
}

// Moves to a specific millisecond of the animations
function jump(ms: number) {
  const start = performance.now()
  completedCount = 0

  for (let i = 0; i < propTimes.length; i++) {
    const times = propTimes[i]!,
      animator = animators[i]!,
      last = propTimes[i]!.length - 1

    if (!times.length) continue

    let start2, index
    for (let j = 0; j < times.length; j++) {
      if (times[j]! == ms) {
        index = j
        start2 = times[index]
        break
      } else if (times[j]! > ms) {
        index = j - 1
        start2 = times[index]
        break
      }
    }

    let diff = ms - (start2 ?? 0)

    // Support for an incomplete prop (finishing before another)
    if (index === undefined) index = last
    if (index == last) {
      diff = 0
      completedCount++
    }

    if (index == -1) index = 0

    animator.playing = true
    animator.index = index
    animator.playing = ms < times[times.length - 1]!
    animator.animate((animator.AnimStart = start - Math.floor(diff * speed) + minChg), 0, true)

    if (diff > 0) animator.animate(start, 0, true)
  }
}

// Function to dispose of a material and its associated textures
function disposeMaterial(material: Material) {
  material.dispose()

  for (const key in material) {
    const value = material[key as keyof Material]
    if (value instanceof Texture) value.dispose()
  }
}

// Function to dispose of all objects in the scene, including InstancedMesh
function disposeScene(scene: Scene) {
  scene.traverse((object: Object3D) => {
    const obj = object as Mesh, // Can be a number of other types, like Line, etc.
      geometry = obj.geometry,
      material = obj.material

    // Dispose geometry if present
    if (geometry !== undefined) geometry.dispose()

    // Dispose material(s) if present
    if (material !== undefined) {
      if (Array.isArray(material)) material.forEach(disposeMaterial)
      else disposeMaterial(material)
    }
  })

  // Remove all children from the scene
  while (scene.children.length > 0) scene.remove(scene.children[0]!)
}

export function debounce(func: () => void, delay: number): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  return () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(func, delay)
  }
}
