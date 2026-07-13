import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PerspectiveCamera } from 'three'
import { debounce } from '@/utils/UtilFunc'

import { usePlayerStore } from '@/stores/usePlayerStore'
import { useViewportStore } from '@/stores/useViewportStore'

import type { createMessageChannel } from '@/workers/createMessageChannel'
import type { AnimBridgeMap } from '@/workers/animation/AnimWorkerTypes'

// Shared logic for syncing camera data with the AnimWorker.
//
// A PerspectiveCamera is created and updated based on projection data from the store.
// OrbitControls are always initialized (even without a canvas) to handle calculations like
// rotation and target direction, but user interaction is only enabled if a canvas is provided.
//
// If a canvas is present, user-driven camera movement updates ORBIT in the store.
// If no canvas is provided (e.g., in the timeline), the setup is passive: it reacts to
// changes made by an interactive player instance and uses OrbitControls for internal math.

export function useAnimWorkerCamera(
  msgChnl: ReturnType<typeof createMessageChannel<AnimBridgeMap>>,
  dim: { width: number; height: number },
  store = 'main',
  eCanvas: Ref<HTMLElement | null | undefined> = ref(),
) {
  const { pixelRatio } = storeToRefs(useViewportStore())

  const playerStore = usePlayerStore(store)
  const { ORBIT } = playerStore.raw()
  const { PROJECTION } = storeToRefs(playerStore)
  const { send } = msgChnl

  // Initialize Perspective Camera
  const camera = new PerspectiveCamera(
    // Initial values
    PROJECTION.value.fov,
    1, // Aspect gets set by dim.width / dim.height
    PROJECTION.value.near,
    PROJECTION.value.far,
  )

  // Update dimensions, pixelRatio, and camera aspect when they change
  watchImmediate([dim, pixelRatio], () => {
    send('resize', {
      width: dim.width,
      height: dim.height,
      ratio: pixelRatio.value,
    })
  })

  // Sync store with camera settings, and worker
  watchImmediate(
    [PROJECTION, dim], // Aspect is based off dimensions, so we react to dimensions as well
    () => {
      const raw = { ...toRaw(PROJECTION.value), aspect: dim.width / dim.height }
      Object.assign(camera, raw) //      copy to perspective camera
      camera.updateProjectionMatrix() // update
      send('projection', raw) //         send to worker
    },
  )

  // Handle Camera Transformation
  const controls = new OrbitControls(camera, eCanvas.value)
  useEventListener(controls, 'change', () => {
    const r = camera.rotation
    send('transform', {
      pos: camera.position.toArray(),
      rot: [r.x, r.y, r.z],
    })
    // Only update ORBIT if a canvas is set!
    if (eCanvas.value) updateTarget()
  })

  // Debounce to prevent massive writes to store which persists
  const updateTarget = debounce(() => {
    ORBIT.value = {
      position: camera.position.toArray(),
      target: controls.target.toArray(),
    }
    //ORBIT.value.position = camera.position.toArray()
    //ORBIT.value.target = controls.target.toArray()
  }, 0) //100) // This caused thumbnails to not update!

  // Moved to Store so that it would maintain after destruction
  watchImmediate(ORBIT, ({ position, target }) => {
    camera.position.fromArray(position)
    controls.target.fromArray(target)
    controls.update() // Trigger transform change
  })
}
