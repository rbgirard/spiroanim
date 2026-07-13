// src\workers\createMessageChannel.ts

/**
 * Creates a strongly typed message channel between the main thread and a Worker (or vice versa).
 *
 * Designed for bi-directional communication using a message map (bridge map) where each key defines:
 *   - `arg` (optional): data sent with the message
 *   - `ret` (optional): expected response
 *
 * If `arg` or `ret` is omitted, it defaults to `void`.
 * However, TypeScript disallows `{}` as a type definition due to `no-empty-object` lint rules —
 * so at least one of `arg` or `ret` must be specified.
 *
 * The returned channel provides:
 *
 * send(type, data):
 *   - Fire-and-forget message.
 *   - Sends `arg` to the other side.
 *   - No response is expected.
 *
 * on(type, handler):
 *   - Register a listener for fire-and-forget messages of this type.
 *   - Handler receives the `arg` payload.
 *   - Does not return anything or send a response.
 *
 * off(type, handler):
 *   - Unregister a listener previously added with `on`.
 *   - Requires the same function reference passed to `on`.
 *
 * register(type, handler):
 *   - Register a responder for request-response messages (via `call`).
 *   - Handler receives the `arg`, returns (or resolves to) the `ret`.
 *   - If it throws, the sender receives the error via `call` rejection.
 *
 * call(type, data) => Promise:
 *   - Sends a message and waits for a response.
 *   - Resolves with `ret` defined for that message type.
 *   - Rejects with an Error if the registered handler throws or returns a rejected Promise
 *
 * Example usage:
 *   export interface BridgeMap {
 *     init: { arg: { path: string }; ret: boolean }
 *     log:  { arg: { msg: string } } // fire-and-forget
 *     ping: { ret: string }         // no input
 *     tick: { arg: { frame: number } } // no output
 *     crash: { ret: void }            // must specify at least one
 *   }
 *
 *   const channel = createMessageChannel<BridgeMap>(worker)
 */

// Generic message channel builder that enforces arg/ret typing based on a provided map
export function createMessageChannel<
  MessageMap extends {
    // Each key in the map can optionally define `arg` and/or `ret`, defaulting to `void` later
    [K in keyof MessageMap]: {
      arg?: unknown
      ret?: unknown
    }
  },
>(port: Worker | DedicatedWorkerGlobalScope) {
  // Extract the valid string keys from the message map
  type MsgKey = keyof MessageMap & string

  // Infer the input type for a given message key, defaulting to void if not defined
  type Input<K extends MsgKey> = MessageMap[K] extends { arg: infer I } ? I : void

  // Infer the output type for a given message key, defaulting to void if not defined
  type Output<K extends MsgKey> = MessageMap[K] extends { ret: infer O } ? O : void

  // Message sent *to* the worker (or main) to request a response
  type MsgRequest<K extends MsgKey> = {
    id?: string // optional if it's a one-way message (no response expected)
    type: K
    data: Input<K>
  }

  // Message sent *from* the handler as a response
  type MsgResponse<K extends MsgKey> = {
    id: string
    type: K
    data?: Output<K>
    error?: string // presence of this signals a rejection on the receiving end
  }

  // Map of in-flight request promises waiting for responses, keyed by ID
  const pending = new Map<
    string,
    {
      resolve: (value: Output<MsgKey>) => void
      reject: (error: unknown) => void
    }
  >()

  // Listeners for fire-and-forget messages (no return expected)
  const listeners: {
    [K in MsgKey]?: Set<(data: Input<K>) => void>
  } = {}

  // Registered handlers for callable messages (must return a value)
  const handlers: {
    [K in MsgKey]?: (data: Input<K>) => Output<K> | Promise<Output<K>>
  } = {}

  const isWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope
  let nextId = 0

  // Separate scopes for main thread / worker (bug fix)
  function getNextId() {
    const prefix = isWorker ? 'w' : 'm'
    return `${prefix}-${nextId++}`
  }

  // Fire-and-forget send to the other side (no response expected)
  function send<K extends MsgKey>(type: K, data: Input<K>, transfer?: Transferable[]) {
    postMessageOut({ type, data }, transfer)
  }

  // Send a message and await a typed response
  function call<K extends MsgKey>(
    type: K,
    data: Input<K>,
    transfer?: Transferable[],
  ): Promise<Output<K>> {
    const id = getNextId()
    return new Promise<Output<K>>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      postMessageOut({ id, type, data }, transfer)
    })
  }

  // Register a fire-and-forget listener
  function on<K extends MsgKey>(type: K, handler: (data: Input<K>) => void): void {
    listeners[type] ??= new Set()
    listeners[type]!.add(handler)
  }

  // Remove a previously added listener
  function off<K extends MsgKey>(type: K, handler: (data: Input<K>) => void) {
    listeners[type]?.delete(handler)
  }

  // Register a callable function (e.g. from worker to main or vice versa)
  function register<K extends MsgKey>(
    type: K,
    handler: (data: Input<K>) => Output<K> | Promise<Output<K>>,
  ) {
    handlers[type] = handler
  }

  // Cross-compatible way to post messages (works on both Worker and DedicatedWorkerGlobalScope)
  function postMessageOut(message: object, transfer?: Transferable[]) {
    try {
      if ('postMessage' in port) {
        port.postMessage(message, transfer ?? [])
      } else {
        ;(port as DedicatedWorkerGlobalScope).postMessage(message, transfer ?? [])
      }
    } catch (e) {
      console.warn(`[${wStr}${origin}] Failed to send`, message, transfer, e)
    }
  }

  const warnedTypes = new Set<string>()
  function handleMessage(event: MessageEvent) {
    const msg = event.data as MsgRequest<MsgKey> | MsgResponse<MsgKey>
    const { id, type, data } = msg

    // Case 1: This is a response to a previous 'call' from this side
    if (id !== undefined && pending.has(id)) {
      const entry = pending.get(id)!
      pending.delete(id)

      if ('error' in msg && msg.error) {
        // Reject promise with the error received from other side
        entry.reject(new Error(msg.error))
      } else {
        // Resolve with the returned data (may be undefined if handler returned void)
        entry.resolve(msg.data as Output<MsgKey>)
      }
      return
    }

    // Case 2: Incoming request that expects a response
    if (id !== undefined && type in handlers) {
      const handler = handlers[type]
      if (!handler) return

      // Start in a resolved promise so synchronous throws and rejected promises
      // both travel through the same error response path.
      Promise.resolve()
        .then(() => handler(data as Input<MsgKey>))
        .then((result) => {
          postMessageOut({ id, type, data: result })
        })
        .catch((err: unknown) => {
          postMessageOut({
            id,
            type,
            error: err instanceof Error ? err.message : String(err),
          })
        })
      return
    }

    // Case 3: Fire-and-forget push messages (e.g., 'tick', 'log')
    let found = false
    listeners[type]?.forEach((fn) => {
      found = true
      fn(data as Input<MsgKey>)
    })

    // Warn if not found
    if (!found && !handlers[type] && !warnedTypes.has(type)) {
      const origin = isWorker ? 'Worker' : 'Main'
      warnedTypes.add(type)
      console.warn(`[${wStr}${origin}] No handler or listener for '${type}'`, msg)
    }
  }

  // Distingquish between which worker is reporting the not found warnings
  let wStr = ''
  function warnStr(str: string) {
    wStr = `${str} `
    return str
  }

  // Wire up the message listener
  port.addEventListener('message', handleMessage as EventListener)

  // Required for SharedWorker ports or MessageChannel ports
  if ('start' in port && typeof port.start === 'function') {
    port.start()
  }

  // Return the channel API
  return {
    /** Send fire-and-forget message */
    send,
    /** Register fire-and-forget listener */
    on,
    /** Remove fire-and-forget listener */
    off,
    /** Register callable responder */
    register,
    /** Call and await a response */
    call,
    /** Set string for identifying warnings source */
    warnStr,
  }
}
