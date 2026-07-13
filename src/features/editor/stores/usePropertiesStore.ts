import type { PropDataFinal, AnimData, AnimDataCompiled } from '@/types/AnimTypes'
import { usePlayerStore } from '@/stores/usePlayerStore'

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
      const { ROOT, COMPILED } = playerStore.raw()
      const { INDEX, SELECTION, SELECTED, PTIMES, UTIMES } = storeToRefs(playerStore)

      // Default collapsed state
      const pMOBILE = ref<Record<string, string[]>>({
        anim: ['anim'],
        advanced: ['advanced'],
      })

      const START = ref(0)
      const END = ref(0)
      const ACTIVE = ref<number[]>([])

      const IDENT = ref<AnimIdent[]>([])
      const ANIMS = ref<AnimData[]>([])
      const CMPDS = ref<AnimDataCompiled[]>([])
      const PROPS = ref<PropDataFinal[]>([])

      const pBOUND = ref(true)
      const pMULTI = ref(false)
      const pSELECTED = ref<Record<number, boolean>>({ 0: true })
      const pRADIO = ref(-1)

      // Default expanded state "Desktop Mode"
      const pDESKTOP = ref<Record<string, string[]>>({
        anim: ['anim'],
        advanced: ['advanced'],
        base: ['base'],
        root: ['root'],
        manage: ['manage'],
        rotate: ['rotate'],
      })
      const pEXPANDED = ref<Record<string, string[]>>(pMOBILE.value)

      watch(
        [COMPILED, INDEX, SELECTION, SELECTED, pBOUND, pSELECTED],
        () => {
          const propTimes = PTIMES.value,
            unqTimes = UTIMES.value
          START.value = unqTimes[SELECTION.value ? SELECTED.value[0]! : INDEX.value] ?? 0
          END.value = unqTimes[SELECTION.value ? SELECTED.value[1]! : INDEX.value] ?? 0
          ANIMS.value = []
          CMPDS.value = []
          IDENT.value = []
          PROPS.value = []
          ACTIVE.value = []
          for (let i = 0; i < propTimes.length; i++) {
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
                  ANIMS.value.push(ROOT.value.props[i]!.anim[j]!)
                  CMPDS.value.push(COMPILED.value.props[i]!.anim[j]!)
                  IDENT.value.push({
                    prop: i,
                    index: j,
                  })
                }
              }
            }
            if (add || INDEX.value == 0) {
              ACTIVE.value.push(i)
              if (pSELECTED.value[i]) PROPS.value.push(ROOT.value.props[i]!)
            }
          }
          for (const i in pSELECTED.value)
            if (pSELECTED.value[i]) {
              pRADIO.value = parseInt(i, 10)
              break
            }
        },
        { immediate: true /*, deep: true*/ },
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
        pSELECTED,
        pRADIO,

        pINPUT: ref(''),
        pEXPANDED,

        IDENT,
        ANIMS,
        CMPDS,
        PROPS,

        START,
        END,
        ACTIVE,

        ARCDENOM: computed(() => calculateIncrement(CMPDS.value[0]?.arc ?? 90)),
      }
    },
    {
      persist: {
        pick: [/*'pMOBILE',*/ 'pDESKTOP', 'pBOUND', 'pMULTI'],
      },
    },
  )()
}
