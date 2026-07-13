// src\workers\AnimWorker\AnimWorkerTypes.ts

import type { RootDataCompiled } from '@/types/AnimTypes'

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

  // Sets camera transform (position + rotation)
  transform: {
    arg: {
      pos: [number, number, number]
      rot: [number, number, number]
    }
  }

  // Sends full animation data
  data: {
    arg: RootDataCompiled
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
    arg: number[]
    ret: Record<number, string>
  }

  reqimg: {
    arg: void
    ret: string
  }

  // ========== Cleanup ==========

  // Informs the worker to cleanup resources, when complete main thread terminates the worker
  dispose: {
    arg: void
    ret: void
  }
}
