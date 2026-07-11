function supportsES2022(): boolean {
  try {
    const supportsStaticBlocks = (() => {
      try {
        new Function('class Supported { static { this.value = true } }')()
        return true
      } catch {
        return false
      }
    })()

    return (
      typeof WeakRef !== 'undefined' &&
      typeof FinalizationRegistry !== 'undefined' &&
      supportsStaticBlocks
    )
  } catch {
    return false
  }
}

function supportsRendering(): boolean {
  try {
    const canvas = document.createElement('canvas')

    return (
      typeof OffscreenCanvas !== 'undefined' &&
      typeof canvas.transferControlToOffscreen === 'function' &&
      canvas.getContext('webgl2') !== null
    )
  } catch {
    return false
  }
}

export function isBrowserSupported(): boolean {
  if (typeof document === 'undefined') return false

  return supportsES2022() && supportsRendering()
}
