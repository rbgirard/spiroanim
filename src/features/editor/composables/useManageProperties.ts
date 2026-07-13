import { useProperties } from '@/features/editor/composables/useProperties'
import { usePlayerStore } from '@/stores/usePlayerStore'

// Shared routines for features/editor/components/properties/manage

export function useManageProperties(store: string) {
  const { SELECTION, SELECTED, INDEX, PTIMES, UTIMES } = storeToRefs(usePlayerStore(store))
  const { pSELECTED } = useProperties(store)

  const propSelection = (cb: (prop: number, start: number, end: number) => void) => {
    const sel: number[] = [],
      unq = UTIMES.value,
      startTime = unq[SELECTION.value ? SELECTED.value[0]! : INDEX.value] ?? 0,
      endTime = unq[SELECTION.value ? SELECTED.value[1]! : INDEX.value] ?? 0

    for (const i in pSELECTED.value) if (pSELECTED.value[i]) sel.push(parseInt(i, 10))

    for (const i in sel) {
      const ind = sel[i]!,
        times = PTIMES.value[ind] ?? []
      let start, end

      for (let j = 0; j < times.length; j++) {
        if (times[j]! > endTime) break
        else if (times[j]! >= startTime) {
          start = j
          break
        }
      }

      for (let j = times.length - 1; j >= 0; j--) {
        if (times[j]! < startTime) break
        else if (times[j]! <= endTime) {
          end = j
          break
        }
      }

      //if ( start !== undefined && end !== undefined )
      cb(ind, start ?? -1, end ?? -1)
    }
  }

  return { propSelection }
}
