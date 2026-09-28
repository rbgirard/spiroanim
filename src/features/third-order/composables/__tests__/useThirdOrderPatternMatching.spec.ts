import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useThirdOrderPatternMatching } from '../useThirdOrderPatternMatching'
import { createThirdOrderAnimation } from '@/features/third-order/createThirdOrderAnimation'
import type { ThirdOrderPatternMatch } from '@/features/third-order/types'
import type {
  ThirdOrderPatternMatchRequest,
  ThirdOrderPatternMatchResult,
} from '@/workers/pattern-matching/PatternMatchingWorkerTypes'

const identity: ThirdOrderPatternMatch = {
  handRatio: '1:2',
  propRatio: '1:7',
  handDirection: 'anti',
  propDirection: 'spin',
  version: 2,
  duplicate: 1,
}

describe('Third Order matching lifecycle', () => {
  it('coalesces pending inputs and ignores stale, user-invalidated and unmounted results', async () => {
    const animation = shallowRef(
      createThirdOrderAnimation(undefined, { concept: 'to', ...identity }),
    )
    const revision = ref(0)
    const ready = ref(false)
    const resolve: ((result: ThirdOrderPatternMatchResult) => void)[] = []
    const match = vi.fn<
      (request: ThirdOrderPatternMatchRequest) => Promise<ThirdOrderPatternMatchResult>
    >(() => new Promise((done) => resolve.push(done)))
    const hydrate = vi.fn<(match: ThirdOrderPatternMatch | undefined) => Promise<void>>(
      async () => undefined,
    )
    let invalidate: (() => void) | undefined
    const wrapper = mount(
      defineComponent({
        setup() {
          invalidate = useThirdOrderPatternMatching({
            animation,
            revision,
            ready,
            preferred: ref(identity),
            match,
            hydrate,
          }).invalidate
          return () => null
        },
      }),
    )
    expect(match).not.toHaveBeenCalled()
    ready.value = true
    await nextTick()
    expect(match).toHaveBeenCalledOnce()
    revision.value++
    revision.value++
    expect(match).toHaveBeenCalledOnce()
    resolve[0]!({ status: 'matched', match: identity })
    await flushPromises()
    expect(hydrate).not.toHaveBeenCalled()
    expect(match).toHaveBeenCalledTimes(2)
    resolve[1]!({ status: 'matched', match: identity })
    await flushPromises()
    expect(hydrate).toHaveBeenCalledExactlyOnceWith(identity)
    revision.value++
    await nextTick()
    invalidate!()
    resolve[2]!({ status: 'unmatched' })
    await flushPromises()
    expect(hydrate).toHaveBeenCalledOnce()
    revision.value++
    await nextTick()
    wrapper.unmount()
    resolve[3]!({ status: 'unmatched' })
    await flushPromises()
    expect(hydrate).toHaveBeenCalledOnce()
  })
})
