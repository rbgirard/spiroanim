import { usePlayerStore } from '@/stores/usePlayerStore'

export function usePlayerFrameNavigation(storeId: string): {
  rewind: () => void
  forward: () => void
} {
  const playerStore = usePlayerStore(storeId)
  const { CURRENT } = playerStore.raw()
  const { INDEX, SELECTION, SELECTED, UTIMES, UPDATE } = storeToRefs(playerStore)

  function rewind() {
    if (CURRENT.value > 0) {
      if (SELECTION.value) {
        if (CURRENT.value <= UTIMES.value[SELECTED.value[0]!]!) return // don't click beyond selections
        CURRENT.value = UTIMES.value[INDEX.value - 1]! // Beginning of previous
      } else if (CURRENT.value == UTIMES.value[INDEX.value]!)
        CURRENT.value = UTIMES.value[INDEX.value]! - 1 // End of previous
      else CURRENT.value = UTIMES.value[INDEX.value]! // Start of current
      UPDATE.value = Symbol()
    }
  }

  function forward() {
    if (UTIMES.value.length - 1 > INDEX.value) {
      if (
        SELECTION.value &&
        UTIMES.value.length >= SELECTED.value[1]! + 1 &&
        CURRENT.value >= UTIMES.value[SELECTED.value[1]!]! - 1
      )
        return // don't click beyond selections
      if (SELECTION.value || CURRENT.value == UTIMES.value[INDEX.value + 1]! - 1)
        CURRENT.value = UTIMES.value[INDEX.value + 1]! // Start of next
      else CURRENT.value = UTIMES.value[INDEX.value + 1]! - 1 // End of current
      UPDATE.value = Symbol()
    }
  }

  return { rewind, forward }
}
