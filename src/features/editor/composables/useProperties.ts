import { usePlayerStore } from '@/stores/usePlayerStore'
import { usePropertiesStore } from '@/features/editor/stores/usePropertiesStore'

import {
  TTEXT,
  COLORS,
  PTEXT,
  INDPNT,
  PPOS,
  TTYPE,
  MOTION_SHAPES,
} from '@/domain/animation/AnimStruct'

import { VDEF } from '@/stores/useQSMainStore'

import { orthoModify, InitialPoint } from '@/math/animation/OrthogonalFunc'
import { closestPoint } from '@/math/animation/AnimFunc'
import { compressMotionFrames } from '@/math/animation/compressFrames'
import {
  MAX_MOTION_DISTANCE,
  cartesianToMotionAngles,
  clampCartesianMotion,
  createDefaultCameraFrame,
  createMotionDirectionState,
  fitMotionPathEndpoint,
  motionAnglesToCartesian,
} from '@/math/animation/MotionFunc'
import { MathUtils, Vector3 } from 'three'
import { formatScale } from '@/domain/animation/scale'
import { formatStrength } from '@/domain/animation/strength'

import type {
  VarTypes,
  RootKeys,
  PropKeys,
  AnimKeys,
  AnimCompKeys,
  PointInd,
  ValRetType,
  DynamicVal,
  SetterFunc,
  GetterFunc,
  AllVars,
  MotionKeys,
  MotionCompKeys,
  MotionData,
  MotionPathKeys,
  MotionPathCompKeys,
  CameraPose,
} from '@/types/AnimTypes'

export const VALUE = 0
export const EQUAL = 1
export const STRING = 2
export const FALL = 3

// Allows us to loosely assign values without upsetting TS
interface AnonObject {
  [key: string]: unknown
}

export function constraints(key: string, val?: VarTypes) {
  if (!(key in VDEF)) return val
  const def = VDEF[key as AllVars]
  const min = def[0]
  const max = def[1]
  if (Array.isArray(val)) {
    // Type check for OFFSET
    for (let i = 0; i < val.length; i++) {
      if (val[i]! < min) val[i] = min
      else if (val[i]! > max) val[i] = max
    }
  } else if (val !== undefined && typeof val !== 'boolean') {
    if (val < min) val = min
    else if (val > max) val = max
  }
  return val
}

// Convert property values to strings
function stringGet(key: string, val?: VarTypes) {
  if (val !== undefined)
    if (Array.isArray(val)) {
      if (key == 'move') {
        return (
          (val[0] / 10).toFixed(1) +
          ', ' +
          (val[1] / 10).toFixed(1) +
          ', ' +
          (val[2] / 10).toFixed(1)
        )
      }
    } else if (typeof val !== 'boolean') {
      switch (key) {
        case 'type':
          return TTEXT[val] ?? String(val)
        case 'color':
          return COLORS[val] ?? String(val)
        case 'prop':
          return PTEXT[val] ?? String(val)
        case 'point':
          return INDPNT[val] ?? String(val)
        case 'direct':
          return INDPNT[val] ?? String(val)
        case 'path':
          return INDPNT[val] ?? String(val)
        case 'scale':
          return formatScale(val)
        case 'strength':
          return formatStrength(val)
        case 'depth':
          return String((val / 10).toFixed(1))
        case 'turns':
          return String(Math.round((val / 180) * 1000) / 1000) + ' / ' + val + '°'
        case 'arc':
        case 'plane':
        case 'axis':
        case 'yaw':
        case 'rotate':
        case 'adjust':
        case 'warp':
        case 'twist':
          return val + '°'
      }
    }
  return String(val)
}

function motionStringGet(key: string, val?: VarTypes) {
  if (val !== undefined) {
    if (key === 'move' && Array.isArray(val))
      return val.map((coordinate) => (coordinate / 10).toFixed(1)).join(', ')
    if (typeof val === 'number') {
      if (key === 'distance') return (val / 10).toFixed(1)
      if (key === 'shape') return MOTION_SHAPES[val] ?? String(val)
      if (key === 'amount') return `${val}%`
      if (key === 'arc' || key === 'plane' || key === 'axis') return `${val}°`
    }
  }
  return String(val)
}

function motionConstraints(key: string, val?: VarTypes): VarTypes | undefined {
  if (val === undefined || typeof val === 'boolean' || Array.isArray(val)) return val

  switch (key) {
    case 'arc':
    case 'plane':
    case 'axis':
      return Math.round(Math.max(-180, Math.min(val, 180)))
    case 'distance':
      return Math.round(Math.max(0, Math.min(val, MAX_MOTION_DISTANCE)))
    case 'shape':
      return Math.round(Math.max(0, Math.min(val, MOTION_SHAPES.length - 1)))
    case 'amount':
      return Math.round(Math.max(0, Math.min(val, 100)))
    default:
      return constraints(key, val)
  }
}

function hasMotionDirection(frame: MotionData): boolean {
  return frame.arc !== undefined || frame.plane !== undefined || frame.distance !== undefined
}

export function useProperties(store: string = 'main') {
  const playerStore = usePlayerStore(store)
  const { ROOT, COMPILED } = playerStore.raw()
  const { PLAYING } = storeToRefs(playerStore)

  const propertiesStore = storeToRefs(usePropertiesStore(store))
  const { IDENT, ANIMS, CMPDS, MOTIONS, MCOMPDS, CAMERAS, CCOMPDS, CAMERA_IDENT, PROPS } =
    propertiesStore

  // Broke this out separate from animGet
  const animVals = (key: string) => {
    switch (key) {
      case 'direct':
      case 'point':
        return ANIMS.value.map((anim, ind) => {
          return closestPoint(pos.fromArray(CMPDS.value[ind]![key == 'point' ? 'pos' : 'rot']))
        })

      //case 'direct':
      case 'path':
        return ANIMS.value.map((anim, ind) => {
          const id = IDENT.value[ind]!,
            canim = COMPILED.value.props[id.prop]!.anim,
            index = id.index,
            prp = 'pos', //(key == 'direct' ? 'rot' : 'pos'),
            prpx = (prp + 'x') as 'posx' | 'rotx'

          // Previous position
          if (index == 0) pos.copy(InitialPoint)
          else pos.fromArray(canim[index - 1]![prp])

          // Orthogonal Point from Position Direction
          pos.applyAxisAngle(posx.fromArray(canim[index]![prpx]), Angle90)

          return closestPoint(pos)
        })

      default:
        return ANIMS.value.map((val) => val[key as AnimKeys])
    }
  }

  // Point Path and Direct no longer correspond to values, but rather calculate angle of other properties
  const animSet: SetterFunc = (key, val) => {
    if (PLAYING.value) return
    val = constraints(key, val)
    switch (key) {
      case 'path':
      case 'point':
      case 'direct':
        ANIMS.value.map((arr, ind) => {
          const target = PPOS[val as PointInd]!, // Pre-defined point user has selected
            id = IDENT.value[ind]!, // Indexes of Prop and this Anim
            canim = COMPILED.value.props[id.prop]!.anim, // Compiled values
            index = id.index,
            // Properties used below
            plane = key == 'direct' ? 'axis' : 'plane',
            prp = key == 'direct' ? 'rot' : 'pos',
            prpx = (prp + 'x') as 'posx' | 'rotx'

          // Previous position
          if (index == 0) pos.copy(InitialPoint)
          else pos.fromArray(canim[index - 1]![prp])

          // Update the plane using direction and plane that calculated the current point
          arr[plane] = Math.round(
            MathUtils.radToDeg(
              orthoModify(
                MathUtils.degToRad(canim[index]![plane]),
                pos,
                target,
                posx.fromArray(canim[index]![prpx]),
              ),
            ),
          )

          // Set Arc if POINT or DIRECT are being set
          if (key == 'point') arr.arc = Math.round(MathUtils.radToDeg(pos.angleTo(target)))
          else if (key == 'direct') {
            const neg = canim[index]!.type == TTYPE.SPHE ? (arr.arc ?? 0) : 0
            arr.turns = Math.round(MathUtils.radToDeg(pos.angleTo(target)) - neg)
          }
        })
        break

      default:
        if (val === undefined) (ANIMS.value as AnonObject[]).every((obj) => delete obj[key] || true)
        else (ANIMS.value as AnonObject[]).every((obj) => (obj[key] = val) || true)
        break
    }

    // trigger shallow watchers
    triggerRef(ROOT)
  }

  const animGet: GetterFunc = (key) => {
    let val: VarTypes | undefined
    let equal = true
    let str = 'Undefined'
    let fall = false

    if (ANIMS.value.length) {
      const vals = animVals(key)
      val = vals[0]

      // If val isn't set, check for a compiled value
      if (val === undefined) {
        val = CMPDS.value[0]![key as AnimCompKeys]
        if (val !== undefined) {
          fall = true
          equal = CMPDS.value.every((obj) => obj[key as AnimCompKeys] === val)
        } else equal = vals.every((val2) => val2 === val)
      } else equal = vals.every((val2) => val2 === val)

      if (equal && val === undefined) {
        // Check the base of the props
        val = PROPS.value[0]?.[key as PropKeys]
        equal = PROPS.value.every((obj) => obj[key as PropKeys] === val)
        if (equal && val === undefined) {
          // Check for a default value
          val = ROOT.value[key as RootKeys]
          if (val !== undefined) {
            str = stringGet(key, val)
            fall = true
          }
        } else {
          str = stringGet(key, val)
          fall = true
        }
      } else {
        str = stringGet(key, val)
        if (key == 'point' || key == 'path' || key == 'direct') fall = true
      }
    }
    if (!equal) str = 'Mismatch'
    return [val, equal, str, fall]
  }

  const motionSet: SetterFunc = (key, val) => {
    if (PLAYING.value) return

    if (key === 'movexyz' || key === 'movexyzpreserve') {
      if (Array.isArray(val)) setCartesianMotion(val, key === 'movexyzpreserve')
      triggerRef(ROOT)
      return
    }

    if (key === 'move') {
      if (val === undefined)
        for (const motion of MOTIONS.value) {
          delete motion.arc
          delete motion.plane
          delete motion.distance
        }
      triggerRef(ROOT)
      return
    }

    val = motionConstraints(key, val)
    if (val === undefined) (MOTIONS.value as AnonObject[]).every((obj) => delete obj[key] || true)
    else (MOTIONS.value as AnonObject[]).every((obj) => (obj[key] = val) || true)
    triggerRef(ROOT)
  }

  const motionGet: GetterFunc = (key) => {
    if (key === 'move') {
      const authored = MOTIONS.value.map(hasMotionDirection)
      if (authored.every((value) => !value)) {
        const val: [number, number, number] = [0, 0, 0]
        return [val, true, motionStringGet(key, val), true]
      }
      if (!authored.every(Boolean)) return [undefined, false, 'Mismatch', false]

      const values = MCOMPDS.value.map((frame) => clampCartesianMotion(frame.move))
      const val = values[0]
      const equal = values.every((value) => samePropertyValue(value, val))
      return [val, equal, equal ? motionStringGet(key, val) : 'Mismatch', false]
    }

    const values = MOTIONS.value.map((frame) => frame[key as MotionKeys])
    let val: VarTypes | undefined = values[0]
    let equal = values.every((value) => samePropertyValue(value, val))
    let fall = false

    if (val === undefined && MCOMPDS.value.length > 0) {
      val = MCOMPDS.value[0]![key as MotionCompKeys]
      equal = MCOMPDS.value.every((frame) => samePropertyValue(frame[key as MotionCompKeys], val))
      fall = val !== undefined
    }

    return [val, equal, equal ? motionStringGet(key, val) : 'Mismatch', fall]
  }

  const setCartesianMotion = (value: readonly number[], preserveNext: boolean) => {
    const cartesian = clampCartesianMotion(value)
    const selectedByProp = new Map<number, Set<number>>()

    for (const id of IDENT.value) {
      const selected = selectedByProp.get(id.prop) ?? new Set<number>()
      selected.add(id.index)
      selectedByProp.set(id.prop, selected)
    }

    for (const [propIndex, selected] of selectedByProp) {
      const frames = ROOT.value.props[propIndex]!.motion
      const compiled = COMPILED.value.props[propIndex]!.motion
      const lastSelected = Math.max(...selected)
      const preserveIndex = preserveNext
        ? frames.findIndex((frame, index) => index > lastSelected && hasMotionDirection(frame))
        : -1
      const preserveMove = preserveIndex >= 0 ? compiled[preserveIndex]?.move : undefined
      const state = createMotionDirectionState()

      for (let index = 0; index < frames.length; index++) {
        const frame = frames[index]!
        const requested = selected.has(index)
          ? cartesian
          : index === preserveIndex && preserveMove
            ? clampCartesianMotion(preserveMove)
            : undefined

        if (requested) {
          const [plane, arc, distance] = cartesianToMotionAngles(requested, state)
          frame.plane = plane
          frame.arc = arc
          frame.distance = distance
        } else if (hasMotionDirection(frame)) {
          motionAnglesToCartesian([frame.plane ?? 0, frame.arc ?? 0, frame.distance ?? 0], state)
        }
      }
    }
  }

  const cameraPathSet = (path: 'center' | 'orbit', key: string, val?: VarTypes) => {
    if (PLAYING.value) return

    if (key === 'beats') {
      val = motionConstraints(key, val)
      for (const frame of CAMERAS.value) {
        const orbit = (frame.orbit ??= {})
        if (val === undefined) delete orbit.beats
        else orbit.beats = val as number
      }
      triggerRef(ROOT)
      return
    }

    if (key === 'movexyz' || key === 'movexyzpreserve') {
      if (Array.isArray(val)) setCartesianCameraPath(path, val, key === 'movexyzpreserve')
      triggerRef(ROOT)
      return
    }

    const paths = CAMERAS.value.map((frame) => (frame[path] ??= {}))
    if (key === 'move') {
      if (val === undefined)
        for (const frame of paths) {
          delete frame.arc
          delete frame.plane
          delete frame.distance
        }
      triggerRef(ROOT)
      return
    }

    val = motionConstraints(key, val)
    if (val === undefined) (paths as AnonObject[]).every((frame) => delete frame[key] || true)
    else (paths as AnonObject[]).every((frame) => (frame[key] = val) || true)
    triggerRef(ROOT)
  }

  const cameraPathGet = (path: 'center' | 'orbit', key: string): ValRetType => {
    if (key === 'beats') {
      const authored = CAMERAS.value.map((frame) => frame.orbit?.beats)
      let val = authored[0]
      let equal = authored.every((value) => value === val)
      let fall = false
      if (val === undefined && CCOMPDS.value.length > 0) {
        val = CCOMPDS.value[0]!.orbit.beats
        equal = CCOMPDS.value.every((frame) => frame.orbit.beats === val)
        fall = true
      }
      return [val, equal, equal ? String(val) : 'Mismatch', fall]
    }

    const paths = CAMERAS.value.map((frame) => frame[path] ?? {})
    const compiled = CCOMPDS.value.map((frame) => frame[path])
    if (key === 'move') {
      const authored = paths.map(hasMotionDirection)
      if (authored.every((value) => !value)) {
        const val: [number, number, number] =
          path === 'orbit' && compiled[0] ? clampCartesianMotion(compiled[0].move) : [0, 0, 0]
        return [val, true, cameraPathStringGet(key, val), true]
      }
      if (!authored.every(Boolean)) return [undefined, false, 'Mismatch', false]

      const values = compiled.map((frame) => clampCartesianMotion(frame.move))
      const val = values[0]
      const equal = values.every((value) => samePropertyValue(value, val))
      return [val, equal, equal ? cameraPathStringGet(key, val) : 'Mismatch', false]
    }

    const values = paths.map((frame) => frame[key as MotionPathKeys])
    let val: VarTypes | undefined = values[0]
    let equal = values.every((value) => samePropertyValue(value, val))
    let fall = false

    if (val === undefined && compiled.length > 0) {
      val = compiled[0]![key as MotionPathCompKeys]
      equal = compiled.every((frame) => samePropertyValue(frame[key as MotionPathCompKeys], val))
      fall = val !== undefined
    }

    return [val, equal, equal ? cameraPathStringGet(key, val) : 'Mismatch', fall]
  }

  const setCartesianCameraPath = (
    path: 'center' | 'orbit',
    value: readonly number[],
    preserveNext: boolean,
  ) => {
    const cartesian = clampCartesianMotion(value)
    const selected = new Set(CAMERA_IDENT.value)
    const frames = ROOT.value.camera
    const compiled = COMPILED.value.camera
    const lastSelected = Math.max(...selected)
    const preserveIndex = preserveNext
      ? frames.findIndex(
          (frame, index) => index > lastSelected && hasMotionDirection(frame[path] ?? {}),
        )
      : -1
    const preserveMove = preserveIndex >= 0 ? compiled[preserveIndex]?.[path].move : undefined
    const state = createMotionDirectionState()

    for (let index = 0; index < frames.length; index++) {
      const frame = (frames[index]![path] ??= {})
      const requested = selected.has(index)
        ? cartesian
        : index === preserveIndex && preserveMove
          ? clampCartesianMotion(preserveMove)
          : undefined

      if (requested) {
        const [plane, arc, distance] = cartesianToMotionAngles(requested, state)
        frame.plane = plane
        frame.arc = arc
        frame.distance = distance
      } else if (hasMotionDirection(frame)) {
        motionAnglesToCartesian([frame.plane ?? 0, frame.arc ?? 0, frame.distance ?? 0], state)
      }
    }
  }

  const matchCameraFrameToPose = (index: number, pose: CameraPose) => {
    if (PLAYING.value || index < 0 || index >= ROOT.value.camera.length) return

    const position = new Vector3().fromArray(pose.position)
    const target = new Vector3().fromArray(pose.target)
    const requestedOffsets = {
      center: target,
      orbit: position.sub(target),
    }

    for (const path of ['center', 'orbit'] as const) {
      const state = createMotionDirectionState()
      const compiled = COMPILED.value.camera.map((frame) => frame[path])
      for (let previous = 0; previous < index; previous++) {
        const frame = compiled[previous]!
        motionAnglesToCartesian([frame.plane, frame.arc, frame.distance], state)
      }

      const previousOffset = index > 0 ? compiled[index - 1]!.offset : [0, 0, 0]
      const endpoint = requestedOffsets[path].clone().sub(new Vector3().fromArray(previousOffset))
      const current = compiled[index]!
      const [plane, arc, distance] = fitMotionPathEndpoint(
        endpoint.toArray(),
        state,
        current.shape,
        current.amount,
        current.axis,
      )
      const authored = (ROOT.value.camera[index]![path] ??= {})
      authored.plane = plane
      authored.arc = arc
      authored.distance = distance
      compressMotionFrames(
        ROOT.value.camera.map((frame) => frame[path] ?? {}),
        path === 'orbit' ? { firstFrameDefaults: createDefaultCameraFrame().orbit! } : {},
      )
    }

    triggerRef(ROOT)
  }

  const propSet: SetterFunc = (key, val) => {
    //if ( PLAYING.value )
    //  return
    val = constraints(key, val)
    if (val === undefined) (PROPS.value as AnonObject[]).every((obj) => delete obj[key] || true)
    else (PROPS.value as AnonObject[]).every((obj) => (obj[key] = val) || true)

    triggerRef(ROOT)
  }

  const rootSet: SetterFunc = (key, val) => {
    //if ( PLAYING.value )
    //  return
    val = constraints(key, val)
    if (val === undefined) delete ROOT.value[key as RootKeys]
    else Object.assign(ROOT.value, { [key]: val })

    triggerRef(ROOT)
  }

  const propGet: GetterFunc = (key) => {
    let val: VarTypes | undefined
    let equal = true
    let str = 'Undefined'
    let fall = false
    if (PROPS.value.length) {
      val = PROPS.value[0]![key as PropKeys]
      equal = PROPS.value.every((obj) => obj[key as PropKeys] === val)
      if (equal && val === undefined) {
        // Check for a default value
        val = ROOT.value[key as RootKeys]
        if (val !== undefined) {
          str = stringGet(key, val)
          fall = true
        }
      } else str = stringGet(key, val)
    }
    if (!equal) str = 'Mismatch'
    return [val, equal, str, fall]
  }

  const rootGet: GetterFunc = (key) => {
    const val = ROOT.value[key as RootKeys]
    const fall = false
    let str = 'Undefined'
    if (val !== undefined) str = stringGet(key, val)
    return [val, true, str, fall]
  }

  return {
    ...propertiesStore,
    constraints,
    animSet,
    animGet,
    motionSet,
    motionGet,
    cameraPathSet,
    cameraPathGet,
    matchCameraFrameToPose,
    propSet,
    propGet,
    rootSet,
    rootGet,

    propClass: (d: ValRetType) => {
      let type
      if (d[FALL]) type = 'fall'
      else if (!d[EQUAL]) type = 'mism'
      else if (d[VALUE] === undefined) type = 'undef'
      else type = 'def'

      return 'val-' + type
    },

    panelWatcher: (
      source: Ref,
      data: Ref<Record<string, ValRetType>>,
      vals: DynamicVal[],
      func: GetterFunc,
    ) => {
      watchImmediate(source, () => {
        data.value = {}
        for (const v of vals) data.value[v.name] = func(v.name)
      })
    },
  }
}

function cameraPathStringGet(key: string, val?: VarTypes): string {
  if (key === 'move' && Array.isArray(val)) return val.join(', ')
  if (key === 'distance' && typeof val === 'number') return String(val)
  return motionStringGet(key, val)
}

function samePropertyValue(first: VarTypes | undefined, second: VarTypes | undefined): boolean {
  if (!Array.isArray(first) || !Array.isArray(second)) return first === second
  return first.every((value, index) => value === second[index])
}

const pos = new Vector3(),
  posx = new Vector3(),
  //ortho = new Vector3(),
  //angled = new Vector3(),
  Angle90 = Math.PI / 2
