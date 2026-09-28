import type {
  PropDataFinal,
  AnimData,
  AnimDataCompiled,
  FrameSet,
  MotionData,
  MotionDataCompiled,
  CameraData,
  CameraDataCompiled,
} from '@/types/AnimTypes'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { UNQTIMES } from '@/math/animation/PlayerFunc'
import { useEditorAccessStore } from '@/features/editor/stores/useEditorAccessStore'

export interface AnimIdent {
  prop: number
  index: number
}

const MIN_INCREMENT = 30

function calculateIncrement(value: number) {
  let divisor = 360

  // Calculate the Greatest Common Denominator (GCD)
  while (divisor !== 0) [value, divisor] = [divisor, value % divisor]

  // Reduce the value while maintaining divisibility and respecting the soft minimum
  while (value % 2 === 0) {
    const halved = value / 2
    if (halved >= MIN_INCREMENT) value = halved
    else break
  }

  return value
}

export const usePropertiesStore = (id: string) => {
  return defineStore(
    `sa-properties-${id}`,
    () => {
      const playerStore = usePlayerStore(id)
      const { editorLoaded } = storeToRefs(useEditorAccessStore())
      const { ROOT, COMPILED } = playerStore.raw()
      const { EINDEX, SELECTION, SELECTED, PTIMES, MTIMES, CTIMES, UTIMES, ETIMES } =
        storeToRefs(playerStore)

      // Default collapsed state
      const pMOBILE = ref<Record<string, string[]>>({
        anim: ['anim'],
        advanced: ['advanced'],
        motion: ['motion'],
        center: ['center'],
        orbit: ['orbit'],
      })

      const START = ref(0)
      const END = ref(0)
      const ACTIVE = ref<number[]>([])

      const IDENT = ref<AnimIdent[]>([])
      const ANIMS = ref<AnimData[]>([])
      const CMPDS = ref<AnimDataCompiled[]>([])
      const MOTIONS = ref<MotionData[]>([])
      const MCOMPDS = ref<MotionDataCompiled[]>([])
      const CAMERAS = ref<CameraData[]>([])
      const CCOMPDS = ref<CameraDataCompiled[]>([])
      const CAMERA_IDENT = ref<number[]>([])
      const PROPS = ref<PropDataFinal[]>([])

      const pBOUND = ref(true)
      const pMULTI = ref(false)
      const pFRAMES = ref<FrameSet>('animation')
      const pSELECTED = ref<Record<number, boolean>>({ 0: true })
      const pRADIO = ref(-1)
      const pMOVENEXT = ref(false)
      const pSHIFT = ref(1)
      const showFullTimeline = ref(false)

      // Default expanded state "Desktop Mode"
      const pDESKTOP = ref<Record<string, string[]>>({
        anim: ['anim'],
        advanced: ['advanced'],
        base: ['base'],
        root: ['root'],
        settings: ['settings'],
        manage: ['manage'],
        rotate: ['rotate'],
        motion: ['motion'],
        center: ['center'],
        orbit: ['orbit'],
      })
      const pEXPANDED = ref<Record<string, string[]>>(pMOBILE.value)

      watch(
        [
          COMPILED,
          EINDEX,
          SELECTION,
          SELECTED,
          pBOUND,
          pSELECTED,
          pFRAMES,
          showFullTimeline,
          editorLoaded,
        ],
        () => {
          const propTimes =
            pFRAMES.value === 'animation'
              ? PTIMES.value
              : pFRAMES.value === 'motion'
                ? MTIMES.value
                : [CTIMES.value]
          const timelinePropTimes =
            !editorLoaded.value || showFullTimeline.value
              ? PTIMES.value
              : pFRAMES.value === 'camera'
                ? propTimes
                : propTimes.filter((_, index) => pSELECTED.value[index])
          const ownTimes = UNQTIMES(timelinePropTimes)
          const overallEnd = UTIMES.value.at(-1) ?? 0
          const unqTimes =
            ownTimes.length === 0
              ? [0]
              : overallEnd > ownTimes.at(-1)!
                ? [...ownTimes, overallEnd]
                : ownTimes
          if (
            unqTimes.length !== ETIMES.value.length ||
            unqTimes.some((time, index) => time !== ETIMES.value[index])
          )
            ETIMES.value = unqTimes
          let activeIndex = 0
          const current = playerStore.raw().CURRENT.value
          for (let i = 0; i < unqTimes.length; i++) {
            if (unqTimes[i]! > current) break
            activeIndex = i
          }
          START.value = unqTimes[SELECTION.value ? SELECTED.value[0]! : activeIndex] ?? 0
          END.value = unqTimes[SELECTION.value ? SELECTED.value[1]! : activeIndex] ?? 0
          ANIMS.value = []
          CMPDS.value = []
          MOTIONS.value = []
          MCOMPDS.value = []
          CAMERAS.value = []
          CCOMPDS.value = []
          CAMERA_IDENT.value = []
          IDENT.value = []
          PROPS.value = []
          ACTIVE.value = []
          if (pFRAMES.value === 'camera') {
            const times = CTIMES.value
            for (let index = 0; index < times.length; index++) {
              const time = times[index]!
              if (time < START.value || time > END.value) continue
              const camera = ROOT.value.camera[index]
              const compiledCamera = COMPILED.value.camera[index]
              if (!camera || !compiledCamera) continue
              CAMERAS.value.push(camera)
              CCOMPDS.value.push(compiledCamera)
              CAMERA_IDENT.value.push(index)
            }
          }

          for (let i = 0; pFRAMES.value !== 'camera' && i < propTimes.length; i++) {
            // A selection refresh can run before ROOT's queued recompilation after deletion.
            // Old timing indices must not dereference removed props or publish missing frames.
            const prop = ROOT.value.props[i]
            const compiledProp = COMPILED.value.props[i]
            if (!prop || !compiledProp) continue
            const pt = propTimes[i]!
            let add = false
            if (
              SELECTION.value &&
              propTimes.length &&
              pBOUND.value &&
              (!pt.includes(START.value) || !pt.includes(END.value))
            )
              continue
            for (let j = 0; j < pt.length; j++) {
              const val = pt[j]!
              if (val >= START.value && val <= END.value) {
                add = true
                if (pSELECTED.value[i]) {
                  if (pFRAMES.value === 'animation') {
                    const frame = prop.anim[j]
                    const compiledFrame = compiledProp.anim[j]
                    if (!frame || !compiledFrame) continue
                    ANIMS.value.push(frame)
                    CMPDS.value.push(compiledFrame)
                  } else {
                    const frame = prop.motion[j]
                    const compiledFrame = compiledProp.motion[j]
                    if (!frame || !compiledFrame) continue
                    MOTIONS.value.push(frame)
                    MCOMPDS.value.push(compiledFrame)
                  }
                  IDENT.value.push({
                    prop: i,
                    index: j,
                  })
                }
              }
            }
            if (add || EINDEX.value == 0) {
              ACTIVE.value.push(i)
              if (pSELECTED.value[i]) PROPS.value.push(prop)
            }
          }
          for (const i in pSELECTED.value)
            if (pSELECTED.value[i]) {
              pRADIO.value = parseInt(i, 10)
              break
            }
        },
        { immediate: true, deep: true },
      )

      watchImmediate([pRADIO, pMULTI], () => {
        const val = pRADIO.value
        if (ACTIVE.value.indexOf(val) != -1 && !pMULTI.value) {
          for (const i in pSELECTED.value) pSELECTED.value[i] = false
          pSELECTED.value[val] = true
        }
      })

      return {
        pMOBILE,

        pDESKTOP,

        pBOUND,
        pMULTI,
        pFRAMES,
        pSELECTED,
        pRADIO,
        pMOVENEXT,
        pSHIFT,
        showFullTimeline,

        pINPUT: ref(''),
        pEXPANDED,

        IDENT,
        ANIMS,
        CMPDS,
        MOTIONS,
        MCOMPDS,
        CAMERAS,
        CCOMPDS,
        CAMERA_IDENT,
        PROPS,

        START,
        END,
        ACTIVE,

        ARCDENOM: computed(() => calculateIncrement(CMPDS.value[0]?.arc ?? 90)),
      }
    },
    {
      persist: {
        pick: [/*'pMOBILE',*/ 'pDESKTOP', 'pBOUND', 'pMULTI', 'pMOVENEXT'],
      },
    },
  )()
}
