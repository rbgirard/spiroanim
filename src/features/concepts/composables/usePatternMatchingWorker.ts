import type { InjectionKey } from 'vue'

import { createMessageChannel } from '@/workers/createMessageChannel'
import type {
  EightStepPatternMatchRequest,
  EightStepPatternMatchResult,
  PatternMatchingBridgeMap,
  PatternMatchingClient,
  QstPatternMatchRequest,
  QstPatternMatchResult,
  VtgPatternMatchRequest,
  VtgPatternMatchResult,
  VtgCandidateLayoutRequest,
  VtgPreviewCandidatesRequest,
} from '@/workers/pattern-matching/PatternMatchingWorkerTypes'

const patternMatchingWorkerIdleMs = 30_000

interface PatternMatchingWorkerController {
  client: PatternMatchingClient
  acquire: () => () => void
}

export const patternMatchingWorkerKey: InjectionKey<PatternMatchingWorkerController> =
  Symbol('patternMatchingWorker')

const matchVtgWithoutWorker = async (
  request: VtgPatternMatchRequest,
): Promise<VtgPatternMatchResult> => {
  const { matchVtgPatternRequest } =
    await import('@/workers/pattern-matching/handlePatternMatchingRequest')
  return matchVtgPatternRequest(request)
}

const matchEightStepWithoutWorker = async (
  request: EightStepPatternMatchRequest,
): Promise<EightStepPatternMatchResult> => {
  const { matchEightStepPatternRequest } =
    await import('@/workers/pattern-matching/handlePatternMatchingRequest')
  return matchEightStepPatternRequest(request)
}

const matchQstWithoutWorker = async (
  request: QstPatternMatchRequest,
): Promise<QstPatternMatchResult> => {
  const { matchQstPatternRequest } =
    await import('@/workers/pattern-matching/handlePatternMatchingRequest')
  return matchQstPatternRequest(request)
}

const compareVtgCandidateLayoutWithoutWorker = async (
  request: VtgCandidateLayoutRequest,
): Promise<boolean> => {
  const { compareVtgCandidateLayoutRequest } =
    await import('@/workers/pattern-matching/handlePatternMatchingRequest')
  return compareVtgCandidateLayoutRequest(request)
}

const createVtgPreviewCandidatesWithoutWorker = async (request: VtgPreviewCandidatesRequest) => {
  const { createVtgPreviewCandidatesRequest } =
    await import('@/workers/pattern-matching/handlePatternMatchingRequest')
  return createVtgPreviewCandidatesRequest(request)
}

export const usePatternMatchingWorker = (): PatternMatchingWorkerController => {
  let worker: Worker | undefined
  let channel: ReturnType<typeof createMessageChannel<PatternMatchingBridgeMap>> | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let activeRequests = 0
  let activeConsumers = 0
  let disposed = false

  const clearIdleTimer = () => {
    if (idleTimer === undefined) return

    clearTimeout(idleTimer)
    idleTimer = undefined
  }

  const ensureChannel = () => {
    if (channel || typeof Worker === 'undefined') return channel

    worker = new Worker(
      new URL('@/workers/pattern-matching/PatternMatchingWorker.ts', import.meta.url),
      { type: 'module' },
    )
    channel = createMessageChannel<PatternMatchingBridgeMap>(worker)
    return channel
  }

  const stop = () => {
    clearIdleTimer()
    channel?.close(new Error('Pattern matching worker stopped.'))
    worker?.terminate()
    channel = undefined
    worker = undefined
  }

  const scheduleStop = () => {
    clearIdleTimer()
    if (disposed || activeRequests > 0 || activeConsumers > 0 || worker === undefined) return

    idleTimer = setTimeout(stop, patternMatchingWorkerIdleMs)
  }

  const callWorker = <Result>(
    call: (
      activeChannel: ReturnType<typeof createMessageChannel<PatternMatchingBridgeMap>>,
    ) => Promise<Result>,
    fallback: () => Promise<Result>,
  ): Promise<Result> => {
    clearIdleTimer()
    const activeChannel = ensureChannel()
    if (!activeChannel) return fallback()

    activeRequests += 1
    return call(activeChannel).finally(() => {
      activeRequests -= 1
      if (activeRequests === 0) scheduleStop()
    })
  }

  const matchVtg = (request: VtgPatternMatchRequest) =>
    callWorker(
      (activeChannel) => activeChannel.call('matchVtg', request),
      () => matchVtgWithoutWorker(request),
    )

  const matchEightStep = (request: EightStepPatternMatchRequest) =>
    callWorker(
      (activeChannel) => activeChannel.call('matchEightStep', request),
      () => matchEightStepWithoutWorker(request),
    )

  const matchQst = (request: QstPatternMatchRequest) =>
    callWorker(
      (activeChannel) => activeChannel.call('matchQst', request),
      () => matchQstWithoutWorker(request),
    )

  const compareVtgCandidateLayout = (request: VtgCandidateLayoutRequest) =>
    callWorker(
      (activeChannel) => activeChannel.call('compareVtgCandidateLayout', request),
      () => compareVtgCandidateLayoutWithoutWorker(request),
    )

  const createVtgPreviewCandidates = (request: VtgPreviewCandidatesRequest) =>
    callWorker(
      (activeChannel) => activeChannel.call('createVtgPreviewCandidates', request),
      () => createVtgPreviewCandidatesWithoutWorker(request),
    )

  const acquire = () => {
    if (disposed) return () => undefined

    activeConsumers += 1
    clearIdleTimer()
    let released = false

    return () => {
      if (released) return

      released = true
      activeConsumers -= 1
      if (activeConsumers === 0) scheduleStop()
    }
  }

  onBeforeUnmount(() => {
    disposed = true
    stop()
  })

  return {
    client: {
      matchVtg,
      matchEightStep,
      matchQst,
      compareVtgCandidateLayout,
      createVtgPreviewCandidates,
    },
    acquire,
  }
}

export const usePatternMatchingClient = (active: Readonly<Ref<boolean>>): PatternMatchingClient => {
  const controller = inject(patternMatchingWorkerKey) ?? usePatternMatchingWorker()
  let release: (() => void) | undefined

  watchImmediate(active, (isActive) => {
    if (isActive) {
      release ??= controller.acquire()
    } else {
      release?.()
      release = undefined
    }
  })

  onBeforeUnmount(() => release?.())
  return controller.client
}
