// Slapped together real quick to animate the progress line in Timeline
// Gotta love AI

import { useViewportStore } from '@/stores/useViewportStore'

// easeIn cubic
export function easeIn(t: number) {
  return t * t * t
}

// Ease in-out cubic
export function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Core interpolation
export function getInterpolatedValue(
  start: number,
  end: number,
  t: number,
  easing: (t: number) => number = easeIn,
): number {
  const eased = easing(Math.min(Math.max(t, 0), 1))
  return start + (end - start) * eased
}

export function usePingPongValue(
  start: number,
  end: number,
  duration = 2000,
  easingFn = (t: number) => t * t * t, // default to easeIn
) {
  const { isVisible } = storeToRefs(useViewportStore())

  const value = ref(start)
  const animating = ref(false)

  let direction = 1
  let startTime: number | null = null
  let rafId: number | null = null

  const animate = (timestamp: number) => {
    if (startTime === null) startTime = timestamp
    const elapsed = timestamp - startTime
    const t = elapsed / duration

    value.value =
      direction === 1
        ? getInterpolatedValue(start, end, t, easingFn)
        : getInterpolatedValue(end, start, t, easingFn)

    if (elapsed >= duration) {
      direction *= -1
      startTime = timestamp
    }

    rafId = requestAnimationFrame(animate)
  }

  const startAnimation = () => {
    if (rafId === null) {
      startTime = null
      rafId = requestAnimationFrame(animate)
    }
  }

  const stopAnimation = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onMounted(() => {
    // React to visibility
    watchImmediate(isVisible, (visible) => {
      if (visible && animating.value) startAnimation()
      else stopAnimation()
    })

    // React to external animation control
    watch(animating, (val) => {
      if (val && isVisible.value) startAnimation()
      else stopAnimation()
    })
  })

  onBeforeUnmount(() => stopAnimation())

  return { value, animating, startAnimation, stopAnimation }
}
