// src\stores\SpiroAnim\usePlayerStore.ts

import type { RootDataFinal, PointInd, RootDataCompiled } from '@/types/AnimTypes'
import { RADIUS, ORIGRADIUS } from '@/domain/animation/AnimStruct'

import { rootCompile } from '@/math/animation/AnimFunc'
import { rootFinal, PROPTIMES, UNQTIMES } from '@/math/animation/PlayerFunc'

import { debounce } from '@/utils/UtilFunc'

const multi = RADIUS / ORIGRADIUS

export const DEFAULT_POSITION = [0, 0, -22 * multi] as const

export const usePlayerStore = (id: string) => {
  return defineStore(
    `sa-player-${id}`,
    () => {
      // shallowRefs and items which rapidly change, or we don't want Pinia to track
      const r = {
        CURRENT: ref(0), //       current milliseconds
        FPS: ref(0), //           FPS reported from Worker

        ORBIT: ref({
          position: [...DEFAULT_POSITION],
          target: [0, 0, 0],
        }),

        // Animation data is stored here
        ROOT: shallowRef<RootDataFinal>(
          rootFinal({
            // These will get overitten
            bpm: 120,
            prop: 0,
            color: 0,
            //scale: 10,
            guides: false,
            paths: true,
            hands: true,
            visible: true,
            nodes: true,
            anchors: true,
            smooth: true,
            props: [],
            aspectx: 16,
            aspecty: 9,
            distance: 22,
            thick: 4,
          }),
        ),

        // Pre-compiled data which gets sent to the worker
        COMPILED: shallowRef<RootDataCompiled>({} as RootDataCompiled),
      }

      const v = {
        raw: () => r,

        INDEX: ref(0), //         current Unique Time index

        MAX: ref(0), //           max milliseconds
        SELECTION: ref(false), // Whether progress bar works as a selection, or position
        COUNT: ref(0), //         Max setting when selection is enabled
        SELECTED: ref([0, 0]), // Current selection
        UPDATE: ref(Symbol()), // Forces an update

        PLAYING: ref(true), //    Turns Playing on/off
        TRACER: ref(false), //    Turns tracer mode on/off

        PTIMES: ref<number[][]>([[]]), // Individual times for each prop
        UTIMES: ref<number[]>([]), //     Unique times derived from PTIMES

        PROJECTION: ref({
          fov: 45,
          near: 0.1,
          far: 1000,
          // NOTE: Aspect is calculated by width / height (therefor not stored here)
        }),

        // if [x]/[0] is NaN, meaning second value is 0, causes UI to use max width/height
        // Player uses maximum available width / height, and timeline displays with 4:3
        ASPECT: ref<[number, number]>([0, 0]),

        cameraCenter: ref(Symbol()), // When camera center is requested
        saveImage: ref(Symbol()), // Save image of current canvas

        trackClicks: ref<[number, PointInd, number][]>([]), // Receive click events from worker
      }

      // Recalculate Prop / Unique Times
      watchImmediate(r.ROOT, () => {
        r.COMPILED.value = rootCompile(r.ROOT.value)

        v.PTIMES.value = PROPTIMES(r.COMPILED.value)
        v.UTIMES.value = UNQTIMES(v.PTIMES.value)

        v.MAX.value = v.UTIMES.value.length > 0 ? v.UTIMES.value[v.UTIMES.value.length - 1]! : 0
        v.COUNT.value = v.UTIMES.value.length - 1
        if (v.MAX.value < 0)
          // In case only one pattern is set
          v.MAX.value = 0
        if (v.MAX.value < r.CURRENT.value) r.CURRENT.value = v.MAX.value

        // Update aspect ratio
        if (r.ROOT.value.aspectx == 0 || r.ROOT.value.aspecty == 0) {
          v.ASPECT.value[0] = 0
          v.ASPECT.value[1] = 0
        } else {
          v.ASPECT.value[0] = r.ROOT.value.aspectx
          v.ASPECT.value[1] = r.ROOT.value.aspecty
        }

        v.cameraCenter.value = Symbol()
      })

      // Update INDEX when position in player changes
      watchImmediate(r.CURRENT, (current) => {
        const times = v.UTIMES.value

        if (times.length > 0 && current >= times[times.length - 1]!)
          v.INDEX.value = times.length - 1

        for (let i = 0; i < times.length - 1; i++)
          if (current >= times[i]! && current < times[i + 1]!) {
            v.INDEX.value = i
            return
          }

        if (current >= times[times.length - 1]!) v.INDEX.value = times.length - 1
        else v.INDEX.value = 0
      })

      // Manually save, as persist module appears to be saving anytime any value is modified
      watch(
        [v.PLAYING, v.TRACER /*, r.ORBIT*/],
        debounce(([PLAYING, TRACER /*, ORBIT*/]: [boolean, boolean /*, typeof r.ORBIT.value*/]) => {
          localStorage.setItem(`sa-player-${id}`, JSON.stringify({ PLAYING, TRACER /*, ORBIT*/ }))
        }, 100),
      )

      // Load from localStorage on init
      const saved = localStorage.getItem(`sa-player-${id}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as {
            PLAYING?: boolean
            TRACER?: boolean
            ORBIT?: typeof r.ORBIT.value
          }
          v.PLAYING.value = parsed.PLAYING ?? v.PLAYING.value
          v.TRACER.value = parsed.TRACER ?? v.TRACER.value
          r.ORBIT.value = parsed.ORBIT ?? r.ORBIT.value
        } catch (e) {
          console.warn('Failed to parse saved player settings:', e)
        }
      }

      return v
    }, //,
    //{
    //  persist: {
    //    pick: ['PLAYING', 'TRACER', 'ORBIT'],
    //  },
    //}
  )()
}
