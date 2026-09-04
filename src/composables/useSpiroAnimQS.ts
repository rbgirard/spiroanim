// src/composables/useSpiroAnimQS.ts

import { rootFinal } from '@/math/animation/PlayerFunc'
import { useBaseQS } from '@/services/query/createBaseQS'
import { loadSpiroAnimQSVersion } from '@/services/query/versions'
import { migrateLegacyMotion } from '@/services/query/migrateLegacyMotion'
import { migrateLegacyScale } from '@/services/query/migrateLegacyScale'

import type { BaseQS, VDefEntry } from '@/services/query/types/BaseQSTypes'
import type { ConfigData, ConfigItem, ConfigThird } from '@/services/query/types/SpiroAnimQSTypes'
import type { AllVars, RootData, RootDataFinal, PropData, MotionData } from '@/types/AnimTypes'
import type { LocationQuery } from 'vue-router'

export type HistoryAction = 'undo' | 'redo'

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
  const {
    createRootConfig,
    createPropConfig,
    createExtendedAnimationConfig,
    createRotationAnimationConfig,
    createMotionConfig,
    createCameraConfig,
    encodeMotionFrame,
    decodeMotionFrame,
    omitStandaloneMotionPrefix,
    omitEmptyCameraCenter,
  } = await loadSpiroAnimQSVersion(VER)

  /**
   * Decodes a query string, handling version mismatches
   */
  const decodeVer: (route: LocationQuery) => Promise<RootDataFinal> = async (route) => {
    const v = Number(route.v ?? VER)
    if (v != VER) {
      // Never decode an unknown format with the current codec. Installed PWAs can briefly run an
      // older bundle after a newer shared URL is deployed; preserving the route unchanged allows
      // the service-worker update flow to reload it with the matching decoder.
      const { CHARSET: charset, VDEF: VDEF2 } = await loadSpiroAnimQSVersion(v)
      const PAQS = await useSpiroAnimQS(VDEF2, useBaseQS(VDEF2, { charset }), v)
      let decoded = PAQS.decodeQS(route)
      if (VER >= 4 && v < 4) decoded = migrateLegacyMotion(decoded)
      if (VER >= 12 && v < 12) decoded = migrateLegacyScale(decoded)
      return decoded
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
  const qsFuture = ref<string[]>([])
  const qsPause = ref(false)
  const qsSkip = ref(false)
  const historyApplied = shallowRef<{ id: symbol; action: HistoryAction }>()
  let historyGroupActive = false
  let historyGroupIndex = -1

  // Create config from imported functions
  const rootConfig = createRootConfig()
  const propConfig = createPropConfig()
  const extendedAnimationConfig = createExtendedAnimationConfig?.()
  const rotationAnimationConfig = createRotationAnimationConfig?.()
  const motionConfig = createMotionConfig?.()
  const cameraConfig = createCameraConfig?.()

  const encodeOptionalAnimationTrack = (
    config: ConfigType,
    frames: RootDataFinal['props'][number]['anim'],
  ): string => encodeVar(config, { anim: frames }).replace(/^\./, '').replace(/\.+$/, '')

  const qsUpdateHistory = (args: Record<string, string>) => {
    const encoded = new URLSearchParams(args).toString()

    if (historyGroupActive && historyGroupIndex >= 0) {
      if (qsHistory.value[historyGroupIndex] === encoded) return
      qsHistory.value[historyGroupIndex] = encoded
      qsFuture.value = []
      return
    }

    if (qsHistory.value.at(-1) === encoded) return

    qsHistory.value.push(encoded)
    qsFuture.value = []
    while (qsHistory.value.length > 500) qsHistory.value.shift()
    if (historyGroupActive) historyGroupIndex = qsHistory.value.length - 1
  }

  /**
   * Encodes a RootDataFinal object into a query string
   */
  const encodeQS: (root: RootDataFinal, hist?: boolean) => Record<string, string> = (
    root,
    hist = true,
  ) => {
    const query: Record<string, string> = {}
    const rootForEncoding = VER < 5 ? { ...root, distance: root.camera[0]?.orbit?.distance } : root

    query.r = encodeVar(rootConfig, rootForEncoding)

    for (const i in root.props) {
      const prop = root.props[i]
      if (prop !== undefined) {
        query[`p${i}`] = encodeVar(propConfig, prop)
        if (extendedAnimationConfig) {
          const extendedAnimation = encodeOptionalAnimationTrack(extendedAnimationConfig, prop.anim)
          if (extendedAnimation !== '') query[`x${i}`] = extendedAnimation
        }
        if (rotationAnimationConfig) {
          const rotationAnimation = encodeOptionalAnimationTrack(rotationAnimationConfig, prop.anim)
          if (rotationAnimation !== '') query[`r${i}`] = rotationAnimation
        }
        if (motionConfig && (prop.motion?.length ?? 0) > 0) {
          const encodedMotion = encodeVar(motionConfig, {
            anim: (prop.motion ?? []).map((frame) =>
              encodeMotionFrame ? encodeMotionFrame(frame) : frame,
            ),
          })
          const standaloneMotion =
            omitStandaloneMotionPrefix && encodedMotion.startsWith('.')
              ? encodedMotion.slice(1)
              : encodedMotion
          if (standaloneMotion !== '') query[`m${i}`] = standaloneMotion
        }
      }
    }

    if (cameraConfig) {
      const orbit = root.camera.map((frame) => frame.orbit ?? {})
      const center = root.camera.map((frame) => frame.center ?? {})
      const [encodedOrbit = '', encodedCenter = ''] = [orbit, center].map((frames) =>
        encodeVar(cameraConfig, {
          anim: frames.map((frame) => (encodeMotionFrame ? encodeMotionFrame(frame) : frame)),
        }).replace(/^\./, ''),
      )
      const centerIsEmpty = /^\.*$/.test(encodedCenter)
      query.c =
        omitEmptyCameraCenter && encodedOrbit !== '' && centerIsEmpty
          ? encodedOrbit
          : `${encodedOrbit}~${encodedCenter}`
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

  const beginHistoryGroup = (root: RootDataFinal) => {
    if (historyGroupActive) return

    qsUpdateHistory(encodeQS(root, false))
    historyGroupActive = true
    historyGroupIndex = -1
  }

  const endHistoryGroup = () => {
    historyGroupActive = false
    historyGroupIndex = -1
  }

  const decodeHistoryEntry = (entry: string) => {
    const query: Record<string, string> = {}
    new URLSearchParams(entry).forEach((value, key) => {
      query[key] = value
    })
    return decodeQS(query)
  }

  const undoQS = (): RootDataFinal | undefined => {
    if (qsHistory.value.length <= 1) return undefined

    qsSkip.value = true
    qsFuture.value.push(qsHistory.value.pop()!)
    return decodeHistoryEntry(qsHistory.value.at(-1)!)
  }

  const redoQS = (): RootDataFinal | undefined => {
    const entry = qsFuture.value.pop()
    if (entry === undefined) return undefined

    qsSkip.value = true
    qsHistory.value.push(entry)
    return decodeHistoryEntry(entry)
  }

  const notifyHistoryApplied = (action: HistoryAction) => {
    historyApplied.value = { id: Symbol(), action }
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
      const prop = Object.assign({ anim: [], motion: [] }, decodeVar(propConfig, val)) as PropData
      const mergeAnimationTrack = (config: ConfigType, encoded: string) => {
        const decoded = decodeVar(config, `.${encoded}`)
        const frames: AnimFrame[] = Array.isArray(decoded.anim) ? (decoded.anim as AnimFrame[]) : []
        for (const [frameIndex, frame] of frames.entries()) {
          Object.assign((prop.anim[frameIndex] ??= {}), frame)
        }
      }
      const extendedAnimation = route[`x${i - 1}`] as string | undefined
      if (extendedAnimationConfig && extendedAnimation)
        mergeAnimationTrack(extendedAnimationConfig, extendedAnimation)
      const rotationAnimation = route[`r${i - 1}`] as string | undefined
      if (rotationAnimationConfig && rotationAnimation)
        mergeAnimationTrack(rotationAnimationConfig, rotationAnimation)
      const motion = route[`m${i - 1}`] as string | undefined
      if (motionConfig && motion) {
        const encodedMotion = omitStandaloneMotionPrefix ? `.${motion}` : motion
        const decoded = decodeVar(motionConfig, encodedMotion)
        const frames: MotionData[] = Array.isArray(decoded.anim)
          ? (decoded.anim as MotionData[])
          : []
        prop.motion = decodeMotionFrame ? frames.map(decodeMotionFrame) : frames
      }
      data.props.push(prop)
    }

    const encodedCamera = route.c as string | undefined
    if (cameraConfig && encodedCamera) {
      const [encodedOrbit = '', encodedCenter = ''] = encodedCamera.split('~')
      const decodeCameraPath = (encoded: string): MotionData[] => {
        const decoded = decodeVar(cameraConfig, `.${encoded}`)
        const frames = Array.isArray(decoded.anim) ? (decoded.anim as MotionData[]) : []
        return decodeMotionFrame ? frames.map(decodeMotionFrame) : frames
      }
      const orbit = decodeCameraPath(encodedOrbit)
      const center = decodeCameraPath(encodedCenter)
      data.camera = Array.from({ length: Math.max(center.length, orbit.length) }, (_, index) => {
        const orbitPath = orbit[index] ?? {}
        const { beats: _centerBeats, ...centerPath } = center[index] ?? {}
        return {
          orbit: orbitPath,
          center: centerPath,
        }
      })
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
    qsFuture,
    qsPause,
    qsSkip,
    historyApplied,
    beginHistoryGroup,
    endHistoryGroup,
    undoQS,
    redoQS,
    notifyHistoryApplied,
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
