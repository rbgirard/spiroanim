// src\workers\AnimWorker.ts

/*
 * Notes for later
 * MediaRecorder (records from canvas)
 * WebCodecs API (manual frame control, experimental / limited browsers, but still no Alpha support for encoding)
 * backend/FFmpeg - Alpha support
 */

// TODO: Paths don't currently reflect the ADJUST property on first frame (disable it? Or resolve?) -- MAYBE FIXED?

import { createSpiroAnimator } from '@/workers/animation/createSpiroAnimator'
import { createCameraAnimator } from '@/workers/animation/createCameraAnimator'
import { applyAnimatorPathModes } from '@/workers/animation/applyAnimatorPathModes'

import { CMODES } from '@/domain/animation/AnimStruct'
import { CAMERATIMES, MOTIONTIMES, PROPTIMES, UNQTIMES } from '@/math/animation/PlayerFunc'
import { rootCompile } from '@/math/animation/AnimFunc'
import {
  videoExportAnimationTimeMs,
  videoExportFrameCount,
  videoExportFrameTimeMs,
} from '@/math/videoExportTiming'

import {
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { Color } from 'three'
import type { Output, VideoCodec } from 'mediabunny'

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
let cameraAnimator: ReturnType<typeof createCameraAnimator> | undefined
let propKeyLight: DirectionalLight | undefined
let propRimLight: DirectionalLight | undefined
const propLightDirection = new Vector3()
const propLightRight = new Vector3()
const propLightUp = new Vector3()
let timeline = false
let thumbnail = false
let progressivePaths = false
let allHeadPaths = false
let cameraGuides = { visible: false, color: 0xffffff }

let playing = false
let animating = false
let propTimes: number[][] = []
let motionTimes: number[][] = []
let cameraTimes: number[] = []
let unqTimes: number[] = []
let speed = 1
let currentMs = 0
let playbackStartedAt = 0
let girth = 1
let animationId: number | undefined
let selection = false
let min = 0
let max = 0
let cancelVideoExport = false
let videoExportActive = false
let deferredResize: typeof dim | undefined
let deferredProjection:
  | {
      fov: number
      aspect: number
      near: number
      far: number
    }
  | undefined

let fpsTime = 0
let fpsCount = 0

//const lastPosSent = 0
//const posThrottleMs = 16 // 60fps cap

// Receive dimensions
on('resize', (vals) => {
  if (videoExportActive) {
    deferredResize = { ...vals }
    return
  }
  Object.assign(dim, vals)
  resize(dim)
})

// Receive camera projection
on('projection', (vals) => {
  if (videoExportActive) {
    deferredProjection = { ...vals }
    return
  }
  Object.assign(camera, vals)
  //console.log('projection:', vals)
  camera.updateProjectionMatrix()
  animatorDim()
})

// Receive camera transformation
on('transform', (pose) => {
  cameraAnimator?.transform(pose)
  if (renderer && !renderer.autoClear) debouncedClear()
  animatorDim()
})

register(
  'cameraAcquire',
  () =>
    cameraAnimator?.acquire() ?? {
      position: camera.position.toArray(),
      target: [0, 0, 0] as [number, number, number],
    },
)
register('cameraReset', () => {
  cameraAnimator?.release(0)
  animatorDim()
  return (
    cameraAnimator?.acquire() ?? {
      position: camera.position.toArray(),
      target: [0, 0, 0] as [number, number, number],
    }
  )
})
on('cameraRelease', () => {
  cameraAnimator?.release(currentMs)
  animatorDim()
})
on('cameraGuides', (settings) => {
  cameraGuides = settings
  cameraAnimator?.setGuides(settings.visible, settings.color)
})

// Receive animation command
on('animate', ({ val, play }) => {
  animating = val === undefined ? true : val
  if (play) {
    playbackStartedAt = performance.now()
    playing = true
  }
  if (animating) restartAnimationLoop()
  else stopAnimationLoop()
})

// Jump play and stop commands
on('jump', (ms) => jump(ms))
on('play', () => {
  playbackStartedAt = performance.now()
  playing = true
  animating = true
  // Mobile browsers can drop a worker's animation-frame callback during app or tab transitions
  // or leave its visibility state stale without terminating the worker. An explicit Play action is
  // authoritative and must recover the loop even when the last visibility message said hidden.
  restartAnimationLoop(false)
})
on('stop', () => (playing = false))

// Doesn't clear the animations, leaving trails
on('tracer', (val) => (renderer.autoClear = !val))
on('progressivePaths', (val) => {
  progressivePaths = val
  applyPathModes()
})
on('allHeadPaths', (val) => {
  allHeadPaths = val
  applyPathModes()
})

// Selection options
on('selection', (val) => {
  selection = val
  applyPathModes()
})
on('range', ({ min: mi, max: ma }) => {
  min = mi
  max = ma
})

// Receive offscreen canvas (or create one)
register(
  'initialize',
  ({ offscreen, girth: g, timeline: tl, thumbnail: thumb, allHeadPaths: initialAllHeadPaths }) => {
    timeline = tl ?? false
    thumbnail = thumb ?? false
    if (initialAllHeadPaths !== undefined) allHeadPaths = initialAllHeadPaths

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
  },
)

// Setup scene and SpiroAnimators when compiled data is received.
const loadCompiledData = (compiled: Parameters<typeof PROPTIMES>[0]) => {
  const manualWasActive = cameraAnimator?.manual ?? false
  const manualPose = manualWasActive ? cameraAnimator?.acquire() : undefined
  if (scene) disposeScene(scene)
  scene = new Scene()
  scene.add(new HemisphereLight(0xbadfff, 0x1b1028, 0.68))
  propKeyLight = new DirectionalLight(0xffe2bb, 1.05)
  propKeyLight.target.position.set(0, 0, 0)
  scene.add(propKeyLight, propKeyLight.target)
  propRimLight = new DirectionalLight(0x74cfff, 0.38)
  propRimLight.target.position.set(0, 0, 0)
  scene.add(propRimLight, propRimLight.target)
  animators = []

  cameraAnimator = createCameraAnimator({
    camera,
    scene,
    frames: compiled.camera,
    bpm: compiled.bpm,
    width: dim.width,
    height: dim.height,
    timeline,
  })
  cameraAnimator.setGuides(cameraGuides.visible, cameraGuides.color)

  // Timeline specific rendering
  const anyActive = compiled.props.some((prop) => prop.active)
  if (timeline) {
    // Never display full paths
    compiled.paths = false
    compiled.travel = false
    compiled.hands = false
    compiled.visible = true
    for (const prop of compiled.props) {
      prop.paths = false
      prop.travel = false
      prop.hands = false
      prop.visible = true
      // If user is clicking an item, we don't want the points blown up
      prop.click = undefined
      if (!anyActive) prop.active = true
    }
  }

  // Millisecond intervals of each prop track and how they align.
  propTimes = PROPTIMES(compiled)
  motionTimes = MOTIONTIMES(compiled)
  cameraTimes = CAMERATIMES(compiled)
  unqTimes = UNQTIMES([...propTimes, ...motionTimes, cameraTimes])

  speed = compiled.speed ? 1 / compiled.speed : 1

  // Build data for each prop
  const distance = Math.max(camera.position.distanceTo(cameraAnimator.target), 0.000001)
  for (let i = 0; i < compiled.props.length; i++)
    animators.push(
      createSpiroAnimator({
        scene,
        speed,
        completed: () => undefined,
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

  // Fresh animators start with their additional head paths visible, so every data rebuild must
  // reapply the current controls and renderer-specific restrictions.
  applyPathModes()

  currentMs = Math.min(currentMs, unqTimes.at(-1) ?? 0)
  playbackStartedAt = performance.now()
  if (manualPose) cameraAnimator.transform(manualPose)
  else {
    cameraAnimator.seek(currentMs)
    if (manualWasActive) cameraAnimator.acquire()
  }
  for (const animator of animators) animator.seek(currentMs)

  // Restart animate()
  if (animating) restartAnimationLoop(false)

  // TODO: Why is this necessary when the values are supplied above?
  // (appears to affect lines when new data is received, if this isn't called)
  animatorDim()
}

on('data', loadCompiledData)
register('loadFinalData', (animation) => {
  loadCompiledData(rootCompile(animation))
  return propTimes[0]?.at(-1) ?? 0
})

function applyPathModes() {
  applyAnimatorPathModes(animators, {
    progressivePaths,
    allHeadPaths,
    timeline,
    thumbnail,
    selection,
  })
}

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
    for (const { index, time } of vals) {
      jump(time)
      renderScene()

      const blob = await canvas.convertToBlob({ type: 'image/png' })
      urls[index] = URL.createObjectURL(blob)
    }

  return urls
})

register('reqimg', async () => {
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return URL.createObjectURL(blob)
})

register(
  'exportImage',
  async ({
    width,
    height,
    backgroundColor,
    transparent,
    fileType,
    quality,
    hiddenFeatures,
    positionMs,
  }) => {
    if (videoExportActive) throw new Error('Another export is already in progress.')

    videoExportActive = true
    cameraAnimator?.setExporting(true)
    deferredResize = undefined
    deferredProjection = undefined
    const previous = {
      dim: { ...dim },
      cameraAspect: camera.aspect,
      clearColor: renderer.getClearColor(new Color()).clone(),
      clearAlpha: renderer.getClearAlpha(),
      autoClear: renderer.autoClear,
      playing,
      animating,
    }

    try {
      playing = false
      animating = false
      stopAnimationLoop()

      Object.assign(dim, { width, height, ratio: 1 })
      resize(dim)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.autoClear = true
      renderer.setClearColor(backgroundColor, transparent ? 0 : 1)
      for (const animator of animators) animator.setExportHidden(hiddenFeatures, true)
      jump(positionMs)
      renderScene()

      return await canvas.convertToBlob(
        fileType === 'image/png' ? { type: fileType } : { type: fileType, quality },
      )
    } finally {
      for (const animator of animators) animator.setExportHidden(hiddenFeatures, false)
      Object.assign(dim, deferredResize ?? previous.dim)
      resize(dim)
      if (deferredProjection) Object.assign(camera, deferredProjection)
      else camera.aspect = previous.cameraAspect
      camera.updateProjectionMatrix()
      renderer.autoClear = previous.autoClear
      renderer.setClearColor(previous.clearColor, previous.clearAlpha)
      jump(positionMs)
      renderScene()

      playing = previous.playing
      animating = previous.animating
      videoExportActive = false
      cameraAnimator?.setExporting(false)
      deferredResize = undefined
      deferredProjection = undefined
      if (animating) restartAnimationLoop(false)
    }
  },
)

on('exportVideoCancel', () => {
  cancelVideoExport = true
})

register(
  'exportVideo',
  async ({
    width,
    height,
    framerate,
    bitrate,
    backgroundColor,
    transparent,
    codec,
    container,
    durationMs,
    playbackSpeed,
    restorePositionMs,
  }) => {
    if (videoExportActive) throw new Error('A video export is already in progress.')

    videoExportActive = true
    cameraAnimator?.setExporting(true)
    for (const animator of animators) animator.setExporting(true)
    cancelVideoExport = false
    deferredResize = undefined
    deferredProjection = undefined

    const previous = {
      dim: { ...dim },
      cameraAspect: camera.aspect,
      clearColor: renderer.getClearColor(new Color()).clone(),
      clearAlpha: renderer.getClearAlpha(),
      autoClear: renderer.autoClear,
      playing,
      animating,
    }

    let output: Output | undefined

    try {
      const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, WebMOutputFormat } =
        await import('mediabunny')

      playing = false
      animating = false
      stopAnimationLoop()

      Object.assign(dim, { width, height, ratio: 1 })
      resize(dim)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      // Preserve Tracer mode during export. Resizing clears the live framebuffer, so the exported
      // trail starts clean and then accumulates across the deterministic frame sequence.
      renderer.autoClear = previous.autoClear
      renderer.setClearColor(backgroundColor, transparent ? 0 : 1)
      renderer.clear()

      const format = container === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat()
      const target = new BufferTarget()
      output = new Output({ format, target })
      const source = new CanvasSource(canvas, {
        codec: videoCodec(codec),
        fullCodecString: codec,
        bitrate,
        bitrateMode: 'variable',
        latencyMode: 'quality',
        alpha: transparent ? 'keep' : 'discard',
      })
      output.addVideoTrack(source, { frameRate: framerate })
      await output.start()

      const frameDuration = 1 / framerate
      const totalFrames = videoExportFrameCount(durationMs, framerate)

      for (let frame = 0; frame < totalFrames; frame++) {
        if (cancelVideoExport) break

        const timestamp = frame * frameDuration
        jump(
          videoExportAnimationTimeMs(
            videoExportFrameTimeMs(frame, totalFrames, durationMs, framerate),
            playbackSpeed,
          ),
        )
        renderScene()
        await source.add(timestamp, frameDuration)
        send('exportVideoProgress', {
          completedFrames: frame + 1,
          totalFrames,
        })
      }

      if (cancelVideoExport) {
        await output.cancel()
        return { extension: `.${container}`, canceled: true }
      }

      send('exportVideoFinalizing', undefined)
      await output.finalize()
      if (!target.buffer) throw new Error('The video encoder did not produce an output file.')

      return {
        blob: new Blob([target.buffer], { type: format.mimeType }),
        extension: format.fileExtension,
        canceled: false,
      }
    } catch (error) {
      if (output && (output.state === 'pending' || output.state === 'started')) {
        await output.cancel()
      }
      throw error
    } finally {
      Object.assign(dim, deferredResize ?? previous.dim)
      resize(dim)
      if (deferredProjection) Object.assign(camera, deferredProjection)
      else camera.aspect = previous.cameraAspect
      camera.updateProjectionMatrix()
      renderer.autoClear = previous.autoClear
      renderer.setClearColor(previous.clearColor, previous.clearAlpha)
      jump(restorePositionMs)
      renderScene()

      playing = previous.playing
      animating = previous.animating
      videoExportActive = false
      cameraAnimator?.setExporting(false)
      for (const animator of animators) animator.setExporting(false)
      cancelVideoExport = false
      deferredResize = undefined
      deferredProjection = undefined
      if (animating) restartAnimationLoop(false)
    }
  },
)

// Cleanup resources, main then terminates the worker
register('dispose', () => {
  stopAnimationLoop()
  if (scene) disposeScene(scene)
  if (renderer) renderer.dispose()
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
  cameraAnimator?.dimensions(dim.width, dim.height)
}

function videoCodec(codec: string): VideoCodec {
  if (codec.startsWith('avc1')) return 'avc'
  if (codec.startsWith('hvc1') || codec.startsWith('hev1')) return 'hevc'
  if (codec.startsWith('vp09')) return 'vp9'
  if (codec.startsWith('av01')) return 'av1'
  if (codec === 'vp8') return 'vp8'
  throw new Error(`Unsupported video codec: ${codec}`)
}

// Eliminates a ton of flickering when adjusting camera w/ "tracer" turned on
// Tradeoff is it isn't cleared until camera stops moving, which is kind of cool
const debouncedClear = debounce(() => {
  renderer.clear()
}, 100)

// This block was repeated several times in the old code
function animatorDim() {
  const distance = Math.max(
    camera.position.distanceTo(cameraAnimator?.target ?? camera.position),
    0.000001,
  )
  for (let i = 0; i < animators.length; i++)
    animators[i]!.dimensions(dim.width, dim.height, distance, camera.fov)
}

function renderScene() {
  if (propKeyLight) {
    const target = cameraAnimator?.target ?? scene.position
    const lightOffset = Math.max(camera.position.distanceTo(target), 1)
    camera.getWorldDirection(propLightDirection)
    propLightUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    propLightRight.crossVectors(propLightDirection, propLightUp).normalize()
    propKeyLight.position
      .copy(camera.position)
      .addScaledVector(propLightUp, lightOffset * 0.28)
      .addScaledVector(propLightRight, lightOffset * 0.18)
    propKeyLight.target.position.copy(target)
    propKeyLight.target.updateMatrixWorld()
    if (propRimLight) {
      propRimLight.position
        .copy(target)
        .addScaledVector(propLightDirection, lightOffset * 0.75)
        .addScaledVector(propLightRight, lightOffset * -0.45)
        .addScaledVector(propLightUp, lightOffset * 0.12)
      propRimLight.target.position.copy(target)
      propRimLight.target.updateMatrixWorld()
    }
  }
  renderer.render(scene, camera)
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
  if (playing && unqTimes.length) {
    let skip = false
    const MS = Math.floor(currentMs + (time - playbackStartedAt) / speed)

    // Check for selections and if we need to jump
    if (selection) {
      if (MS < min || MS >= max) {
        jump(min)
        skip = true
      }
    }

    // Prevent playing out of bounds
    else if (unqTimes.length > 0 && MS > unqTimes[unqTimes.length - 1]!) {
      send('playbackComplete', undefined)
      jump(0)
      skip = true
    }

    if (!skip) {
      // Throttle how often POS updates are sent
      //if (time - lastPosSent >= posThrottleMs) {
      send('pos', MS)
      //lastPosSent = time
      //}
      currentMs = MS
      playbackStartedAt = time
      cameraAnimator?.seek(MS)
      animatorDim()
      for (const animator of animators) animator.seek(MS)
    }
  }

  //console.log('Render:', {
  //  canvas: [canvas.width, canvas.height],
  //  rendererSize: renderer.getSize(new Vector2()).toArray(),
  //  aspect: camera.aspect,
  //})

  if (render) renderScene()
}

function stopAnimationLoop() {
  if (animationId !== undefined) cancelAnimationFrame(animationId)
  animationId = undefined
}

function restartAnimationLoop(render = true) {
  stopAnimationLoop()
  if (animating) animate(undefined, render)
}

// Moves to a specific millisecond of the animations
function jump(ms: number) {
  currentMs = ms
  playbackStartedAt = performance.now() + minChg
  cameraAnimator?.seek(ms)
  animatorDim()
  for (const animator of animators) animator.seek(ms)
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
