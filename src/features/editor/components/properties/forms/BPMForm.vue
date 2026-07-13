<template>
  <Decimal :data="data" :vals="vals" :setter="setter" />
</template>

<script setup lang="ts">
import Decimal from './DecimalForm.vue'
import { VALUE } from '@/features/editor/composables/useProperties'
import { usePlayerStore } from '@/stores/usePlayerStore'
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

const props = defineProps<{
  data: ValRetType
  vals: DynamicVal
  setter: SetterFunc
}>()

const store = inject('store', ref('main'))

const playerStore = usePlayerStore(store.value)
const { CURRENT } = playerStore.raw()
const { INDEX, UTIMES } = storeToRefs(playerStore)

let ind: number, perc: number

// Track the percentage of current and unqTimes[index]
watch(
  [CURRENT, INDEX],
  () => {
    ind = INDEX.value
    perc = CURRENT.value / UTIMES.value[ind]!
  },
  { immediate: true },
)

//if (props.data?.[VALUE]) {
// Update the current position when BPM changes
watch(
  () => props.data[VALUE],
  () => {
    CURRENT.value = Math.round(UTIMES.value[ind]! * perc)
  },
)
//}
</script>
