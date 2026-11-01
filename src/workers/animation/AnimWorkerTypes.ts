// src\workers\AnimWorker\AnimWorkerTypes.ts

import type { CameraPose, RootDataCompiled, RootDataFinal } from '@/types/AnimTypes'
import type { ImageExportSettings } from '@/types/ImageExportTypes'
import type { VideoExportProgress, VideoExportSettings } from '@/types/VideoExportTypes'

export interface AnimBridgeMap {
  // Identifies the source (Player or Timeline) for warning messages
  warnStr: { arg: string; ret: string }

  // ========== Core Initialization ==========

  // Initializes the worker with canvas and optional settings
  initialize: {
    arg: {
      offscreen?: OffscreenCanvas
      girth?: number
      timeline?: boolean
      thumbnail?: boolean
      allHeadPaths?: boolean
    }
    ret: boolean
  }

  // Sets renderer dimensions and pixel ratio
  resize: {
    arg: {
      width: number
      height: number
      ratio: number
    }
  }

  // Camera projection values
  projection: {
    arg: {
      fov: number
      aspect: number
      near: number
      far: number
    }
  }

  // Sets the manual camera pose (position + look-at target)
  transform: {
    arg: CameraPose
  }

  cameraAcquire: {
    arg: void
    ret: CameraPose
  }

  cameraReset: {
    arg: void
    ret: CameraPose
  }

  cameraRelease: {
    arg: void
  }

  cameraGuides: {
    arg: {
      visible: boolean
      color: number
    }
  }

  // Sends full animation data
  data: {
    arg: RootDataCompiled
  }

  // Compiles and loads final animation data inside the worker.
  loadFinalData: {
    arg: RootDataFinal
    ret: number
  }

  // ========== Playback Control ==========

  // Starts or stops animation playback
  animate: {
    arg: {
      val?: boolean
      play?: boolean
    }
  }

  // Jumps to a specific millisecond
  jump: {
    arg: number
  }

  // Plays animation from current position
  play: {
    arg: void
  }

  // Stops playback
  stop: {
    arg: void
  }

  // Sets the current playback position in milliseconds
  // Used for syncing the external progress bar
  // Worker -> Main
  pos: {
    arg: number
  }

  // Emitted immediately before full-animation playback loops to its starting position.
  // Worker -> Main
  playbackComplete: {
    arg: void
  }

  // FPS sent back to main every 1000ms
  // Worker -> Main
  fps: {
    arg: number
  }

  // ========== Selection / Editor Controls ==========

  // Whether a specific area on the progress bar is selected (narrows playing to that selection)
  selection: {
    arg: boolean
  }

  // Range of selection when narrowed
  range: {
    arg: {
      min: number
      max: number
    }
  }

  // Doesn't clear the animations, leaving trails
  tracer: {
    arg: boolean
  }

  // Draw completed prop and hand paths only through the current playback time
  progressivePaths: {
    arg: boolean
  }

  // Draw paths for every modeled prop head instead of only the primary head
  allHeadPaths: {
    arg: boolean
  }

  // ========== UI Feedback / Utility ==========

  // For UI / Editor, determines "points" which can be clicked
  click: {
    arg: {
      x: number
      y: number
    }
    ret: {
      type: number
      point?: number
      prop?: number
    }
  }

  // For Timeline, returns images as camera (or data) transforms
  reqimgs: {
    arg: { index: number; time: number }[]
    ret: Record<number, string>
  }

  reqimg: {
    arg: void
    ret: string
  }

  exportImage: {
    arg: Omit<ImageExportSettings, 'fileName'> & {
      positionMs: number
    }
    ret: Blob
  }

  exportVideo: {
    arg: Omit<VideoExportSettings, 'fileName'> & {
      restorePositionMs: number
    }
    ret: {
      blob?: Blob
      extension: string
      canceled: boolean
    }
  }

  exportVideoCancel: {
    arg: void
  }

  exportVideoProgress: {
    arg: VideoExportProgress
  }

  exportVideoFinalizing: {
    arg: void
  }

  // ========== Cleanup ==========

  // Informs the worker to cleanup resources, when complete main thread terminates the worker
  dispose: {
    arg: void
    ret: void
  }
}
