import type { ThirdOrderPatternMatch } from '@/features/third-order/types'
import type { RootDataFinal } from '@/types/AnimTypes'
import type {
  ThirdOrderPatternMatchRequest,
  ThirdOrderPatternMatchResult,
} from '@/workers/pattern-matching/PatternMatchingWorkerTypes'

interface Options {
  animation: Readonly<Ref<RootDataFinal | undefined>>
  ready: Readonly<Ref<boolean>>
  revision: Readonly<Ref<number | undefined>>
  preferred: Readonly<Ref<ThirdOrderPatternMatch | undefined>>
  match: (request: ThirdOrderPatternMatchRequest) => Promise<ThirdOrderPatternMatchResult>
  hydrate: (match: ThirdOrderPatternMatch | undefined) => Promise<void>
}

/** One active request plus the latest pending animation; stale results never reach the UI. */
export const useThirdOrderPatternMatching = (options: Options) => {
  let mounted = false
  let running = false
  let generation = 0
  let pending: { animation: RootDataFinal; generation: number } | undefined

  const invalidate = () => {
    generation++
    pending = undefined
  }

  const run = async () => {
    if (running) return
    running = true
    try {
      while (pending && mounted) {
        const current = pending
        pending = undefined
        try {
          const result = await options.match({
            animation: toRaw(current.animation),
            preferred: options.preferred.value ? { ...options.preferred.value } : undefined,
          })
          if (!mounted || current.generation !== generation || !options.ready.value) continue
          await options.hydrate(result.status === 'matched' ? result.match : undefined)
        } catch (error) {
          if (mounted && current.generation === generation)
            console.warn('Third Order pattern matching failed.', error)
        }
      }
    } finally {
      running = false
    }
  }

  const schedule = () => {
    invalidate()
    if (!mounted || !options.ready.value || !options.animation.value) return
    pending = { animation: options.animation.value, generation }
    // Props and revision can change together during one Vue flush; send only their latest state.
    void nextTick(run)
  }
  watch([options.animation, options.ready, options.revision], schedule, { flush: 'sync' })
  onMounted(() => {
    mounted = true
    schedule()
  })
  onBeforeUnmount(() => {
    mounted = false
    invalidate()
  })
  return { invalidate }
}
