import { describe, expect, it } from 'vitest'

import { createMessageChannel } from '@/workers/createMessageChannel'

interface TestBridgeMap {
  notice: { arg: string }
  double: { arg: number; ret: number }
  fail: { arg: void; ret: void }
}

class LinkedWorker extends EventTarget implements Worker {
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null = null
  onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null = null
  onmessageerror: ((this: Worker, ev: MessageEvent) => unknown) | null = null
  peer?: LinkedWorker

  postMessage(message: unknown, options?: StructuredSerializeOptions | Transferable[]): void {
    void options
    queueMicrotask(() => {
      const event = new MessageEvent('message', { data: message })
      this.peer?.dispatchEvent(event)
      this.peer?.onmessage?.call(this.peer, event)
    })
  }

  terminate(): void {}
}

function linkedWorkers(): [Worker, Worker] {
  const main = new LinkedWorker()
  const worker = new LinkedWorker()
  main.peer = worker
  worker.peer = main
  return [main, worker]
}

describe('createMessageChannel', () => {
  it('delivers fire-and-forget messages and typed responses', async () => {
    const [mainPort, workerPort] = linkedWorkers()
    const main = createMessageChannel<TestBridgeMap>(mainPort)
    const worker = createMessageChannel<TestBridgeMap>(workerPort)
    let notice = ''

    worker.on('notice', (value) => (notice = value))
    worker.register('double', (value) => value * 2)

    main.send('notice', 'ready')
    await expect(main.call('double', 21)).resolves.toBe(42)
    expect(notice).toBe('ready')
  })

  it('returns handler failures to the caller', async () => {
    const [mainPort, workerPort] = linkedWorkers()
    const main = createMessageChannel<TestBridgeMap>(mainPort)
    const worker = createMessageChannel<TestBridgeMap>(workerPort)

    worker.register('fail', () => {
      throw new Error('worker failed')
    })

    await expect(main.call('fail', undefined)).rejects.toThrow('worker failed')
  })
})
