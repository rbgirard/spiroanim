// src/composables/useSpiroAnimQS.ts

import { debounce } from '@/utils/UtilFunc'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { useBaseQS } from '@/services/query/createBaseQS'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'

import type { BaseQS, VDefEntry } from '@/services/query/types/BaseQSTypes'
import type { ConfigData, ConfigItem, ConfigThird } from '@/services/query/types/SpiroAnimQSTypes'
import type { AllVars, RootData, RootDataFinal, PropData } from '@/types/AnimTypes'
import type { LocationQuery } from 'vue-router'

/**
 * Encapsulates all logic related to encoding and decoding a RootDataFinal object
 * to/from a query string. Dynamically loads config based on version.
 */
export async function useSpiroAnimQS(
  VDEF: Record<AllVars, VDefEntry>,
  BASE: BaseQS<AllVars>,
  VER: number,
) {
  // Dynamically import version-specific config creation methods
  const { createRootConfig, createPropConfig } = await loadSpiroAnimQSVersion(VER)

  /**
   * Decodes a query string, handling version mismatches
   */
  const decodeVer: (route: LocationQuery) => Promise<RootDataFinal> = async (route) => {
    const v = Number(route.v ?? VER)
    if (v != VER) {
      try {
        const { VDEF: VDEF2 } = await loadSpiroAnimQSVersion(v)
        const PAQS = await useSpiroAnimQS(VDEF2, useBaseQS(VDEF2), v)
        return PAQS.decodeQS(route)
      } catch {
        console.warn(`Falling back to v${VER} due to load failure for v${v}`)
        return decodeQS(route)
      }
    } else {
      return decodeQS(route)
    }
  }

  // Type aliases for clarity
  type ConfigType = ConfigData<AllVars>
  type DataType = Partial<Record<AllVars, unknown>> & { move?: unknown; anim?: unknown }
  type AnimFrame = Partial<DataType>
  const MOVE_KEY: AllVars = 'move'

  // Simple reactive state
  const qsHistory = ref<string[]>([])
  const qsPause = ref(false)
  const qsSkip = ref(false)

  // Create config from imported functions
  const rootConfig = createRootConfig()
  const propConfig = createPropConfig()

  // Debounced history tracker for query strings
  const qsUpdateHistory = debounce((args: Record<string, string>) => {
    qsHistory.value.push(new URLSearchParams(args).toString())
    while (qsHistory.value.length > 500) qsHistory.value.shift()
  }, 500)

  /**
   * Encodes a RootDataFinal object into a query string
   */
  const encodeQS: (root: RootDataFinal, hist?: boolean) => Record<string, string> = (
    root,
    hist = true,
  ) => {
    const query: Record<string, string> = {}

    query.r = encodeVar(rootConfig, root)

    for (const i in root.props) {
      const prop = root.props[i]
      if (prop !== undefined) query[`p${i}`] = encodeVar(propConfig, prop)
    }

    query.v = String(VER)

    if (hist) {
      if (qsSkip.value) {
        qsSkip.value = false
      } else {
        qsUpdateHistory(query)
      }
    }

    return query
  }

  /**
   * Decodes query string of current version
   */
  const decodeQS: (route: LocationQuery) => RootDataFinal = (route) => {
    // Query decoding is the external data boundary. Defaults and complete runtime normalization are
    // applied by the player/store layer; this preserves the legacy decoder's sparse object shape.
    const data = decodeBoundary<RootData>(
      Object.assign({ props: [] }, decodeVar(rootConfig, route.r as string)),
    )

    let i = 0
    let val: string | undefined
    while ((val = route[`p${i++}`] as string | undefined)) {
      data.props.push(Object.assign({ anim: [] }, decodeVar(propConfig, val)) as PropData)
    }

    return rootFinal(data)
  }

  /**
   * Encodes a single move coordinate into a base64 string
   */
  const encodeMove = (val: number | undefined, bits: number) => {
    return BASE.encodeBase64(BASE.normalize(MOVE_KEY, val, bits))
  }

  /**
   * Decodes a single move coordinate from base64
   */
  const decodeMove = (val: string, bits: number) => {
    return BASE.denormalize(MOVE_KEY, BASE.decodeBase64(val), bits)
  }

  /**
   * Encodes data using the provided config (root or prop)
   */
  const encodeVar = (config: ConfigType, vals: Partial<DataType>) => {
    const ret: string[] = []
    let item: ConfigItem<AllVars> | undefined
    let arr: ConfigThird<AllVars>

    for (item of config) {
      const pad = item[1]
      arr = item[2]

      switch (item[0]) {
        case 'bits':
          ret.push(
            BASE.packBase64(
              arr as AllVars[],
              vals as Record<AllVars, number | boolean | undefined>,
              pad,
            ),
          )
          break

        case 'move':
          if ('move' in vals) {
            const val = vals.move
            const bits = VDEF[MOVE_KEY][2]
            if (Array.isArray(val)) {
              ret.push(
                encodeMove(val[0], bits) + encodeMove(val[1], bits) + encodeMove(val[2], bits),
              )
            } else {
              ret.push(''.padStart(pad, BASE.basemax))
            }
          }
          break
      }
    }

    // Strip trailing max-value padding segments
    EXIT: for (let i = ret.length - 1; i >= 0; i--) {
      const str = ret[i]
      if (str === undefined) continue
      for (let j = 0; j < str.length; j++) {
        if (str[j] !== BASE.basemax) break EXIT
      }
      ret.pop()
    }

    // Encode animation frames if provided
    if (item?.[0] === 'anim' && 'anim' in vals) {
      const arr2: string[] = []
      if (Array.isArray(vals.anim)) {
        for (const i in vals.anim) {
          arr2.push(encodeVar(item[2], vals.anim[i]))
        }
        ret.push('.' + arr2.join('.'))
      }
    }

    return ret.join('')
  }

  /**
   * Decodes a packed string using the provided config
   */
  const decodeVar = (config: ConfigType, str: string): Record<string, unknown> => {
    const ret: Record<string, unknown> = {}
    let pos = 0,
      vstr = str,
      astr = '',
      item: ConfigItem<AllVars> | undefined,
      arr: ConfigThird<AllVars>

    // If there's an animation section, separate it
    const dotIndex = str.indexOf('.')
    if (dotIndex !== -1) {
      // && dotIndex < str.length - 1 // Bug fix, not sure if it'll break something else
      vstr = str.substring(0, dotIndex)
      astr = str.substring(dotIndex + 1)
    }

    // Decode main segments
    for (item of config) {
      const pad = item[1]
      const sub = vstr.substring(pos, pos + pad)
      arr = item[2]

      if (!sub) break

      switch (item[0]) {
        case 'bits':
          Object.assign(ret, BASE.unpackBase64(arr as AllVars[], sub))
          break

        case 'move':
          if (sub !== ''.padStart(pad, BASE.basemax)) {
            const ipad = pad / 3
            const bits = VDEF[MOVE_KEY][2]
            ret['move'] = [
              decodeMove(sub.substring(0, ipad), bits),
              decodeMove(sub.substring(ipad * 1, ipad * 2), bits),
              decodeMove(sub.substring(ipad * 2, ipad * 3), bits),
            ]
          }
          break
      }

      pos += pad
    }

    // Decode animation segment
    item = config.at(-1)
    if (item && item[0] === 'anim') {
      const arr2 = astr.split('.')
      ret.anim = []
      for (let i = 0; i < arr2.length; i++) {
        const frame = arr2[i]
        if (frame !== undefined) {
          const frames = ret.anim as AnimFrame[]
          frames.push(decodeVar(item[2], frame) as AnimFrame)
        }
      }
    }

    return ret
  }

  // Final return: exposed API
  return {
    qsHistory,
    qsPause,
    qsSkip,
    encodeQS,
    decodeQS,
    decodeVer,
  }
}

/**
 * Narrows untrusted decoded records at the single serialization boundary. The legacy query format
 * is sparse; complete runtime defaults are applied after decoding by `rootFinal` and store logic.
 */
function decodeBoundary<Value extends object>(value: object): Value {
  return Object.assign({}, value) as Value
}
