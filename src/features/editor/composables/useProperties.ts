import { usePlayerStore } from '@/stores/usePlayerStore'
import { usePropertiesStore } from '@/features/editor/stores/usePropertiesStore'

import { TTEXT, COLORS, PTEXT, INDPNT, PPOS, TTYPE } from '@/domain/animation/AnimStruct'

import { VDEF } from '@/stores/useQSMainStore'

import { orthoModify, InitialPoint } from '@/math/animation/OrthogonalFunc'
import { closestPoint } from '@/math/animation/AnimFunc'
import { MathUtils, Vector3 } from 'three'

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
          return String((val / 10).toFixed(1))
        case 'depth':
          return String((val / 10).toFixed(1))
        case 'turns':
          return String(Math.round((val / 180) * 1000) / 1000) + ' / ' + val + '°'
        case 'arc':
        case 'plane':
        case 'axis':
        case 'adjust':
          return val + '°'
      }
    }
  return String(val)
}

export function useProperties(store: string = 'main') {
  const playerStore = usePlayerStore(store)
  const { ROOT, COMPILED } = playerStore.raw()
  const { PLAYING } = storeToRefs(playerStore)

  const propertiesStore = storeToRefs(usePropertiesStore(store))
  const { IDENT, ANIMS, CMPDS, PROPS } = propertiesStore

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

const pos = new Vector3(),
  posx = new Vector3(),
  //ortho = new Vector3(),
  //angled = new Vector3(),
  Angle90 = Math.PI / 2
