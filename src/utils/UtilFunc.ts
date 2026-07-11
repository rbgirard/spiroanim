// src/utils/UtilFunc.ts

export function debounceImmediate<Args extends unknown[], R>(
  func: (...args: Args) => R,
  wait: number = 50,
): (...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function (...args: Args) {
    const callNow = !timeout
    if (timeout) clearTimeout(timeout)

    timeout = setTimeout(() => {
      timeout = null
      if (!callNow) func(...args)
    }, wait)

    if (callNow) func(...args)
  }
}

export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number = 50,
): (...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined

  return function (...args: Args): void {
    if (timeout !== undefined) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

/*
  Fires immediately on the first change (leading)—even if values aren't fully in
  sync yet—then fires again later (trailing) with the latest values.
  This can cause brief incorrect jumps.
*/
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0
  let timeout: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T>

  return function (...args: Parameters<T>): void {
    const now = Date.now()
    lastArgs = args

    if (now - lastCall >= limit) {
      lastCall = now
      fn(...args)
    } else {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(
        () => {
          lastCall = Date.now()
          fn(...lastArgs)
        },
        limit - (now - lastCall),
      )
    }
  }
}

/*
  Skips the immediate call. It waits until the interval finishes and fires only once 
  with the most recent values.
  There are no early out-of-sync updates, so there is no jump.
*/
// This worked much better for the cursor animations
export function throttleTrailing<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T>

  return function (...args: Parameters<T>): void {
    lastArgs = args
    if (timeout) return

    timeout = setTimeout(() => {
      fn(...lastArgs)
      timeout = undefined
    }, limit)
  }
}

export function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve)
  })
}

export function toColor(num: number) {
  num >>>= 0
  const b = num & 0xff,
    g = (num & 0xff00) >>> 8,
    r = (num & 0xff0000) >>> 16 //,
  //a = ( (num & 0xFF000000) >>> 24 ) / 255
  //return "rgba(" + [r, g, b, a].join(",") + ")";
  return 'rgb(' + [r, g, b].join(',') + ')'
}

export function findKeyByValue<T extends Record<string, V>, V>(obj: T, target: V): keyof T | null {
  for (const key in obj) {
    if (obj[key] === target) {
      return key
    }
  }
  return null
}
