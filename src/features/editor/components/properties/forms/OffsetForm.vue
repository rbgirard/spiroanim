<template>
  <Decimal :data="offsGet(0)" :vals="data0" :setter="offsSet" />
  <Decimal :data="offsGet(1)" :vals="data1" :setter="offsSet" />
  <Decimal :data="offsGet(2)" :vals="data2" :setter="offsSet" />
</template>

<script setup lang="ts">
import Decimal from './DecimalForm.vue'
import { VALUE } from '@/features/editor/composables/useProperties'
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

const props = defineProps<{
  data: ValRetType
  vals: DynamicVal
  setter: SetterFunc
}>()

const val = computed<[number, number, number]>({
  get(): [number, number, number] {
    const ret = props.data?.[VALUE]
    if (!Array.isArray(ret)) return [0, 0, 0]
    return [ret[0] ?? 0, ret[1] ?? 0, ret[2] ?? 0]
  },
  set(value: [number, number, number]) {
    props.setter?.(name.value, value)
  },
})

const offsGet = (key: 0 | 1 | 2): ValRetType => {
  let val2 = val.value[key]
  let str = 'Undefined'
  if (val2 === undefined) val2 = 0
  else str = String(val2)
  return [val2, true, str, false]
}

const offsSet: SetterFunc = (k, val2) => {
  const key = parseInt(k)
  if (typeof val2 === 'number') {
    const sli = [...val.value] as typeof val.value
    sli[key] = val2
    val.value = sli // Set directly to .value to trigger setter
  }
}

const name = computed(() => props.vals.name)
const min = computed(() => props.vals.min)
const max = computed(() => props.vals.max)
const float = computed(() => props.vals.float)
const mult = computed(() => (props.vals.mult ? props.vals.mult : 1))

const data0 = computed<DynamicVal>(() => ({
  name: '0',
  neg: true,
  label: 'Horizontal',
  max: max.value,
  min: min.value,
  float: float.value,
  mult: mult.value * -1,
}))

const data1 = computed<DynamicVal>(() => ({
  name: '1',
  neg: true,
  label: 'Vertical',
  max: max.value,
  min: min.value,
  float: float.value,
  mult: mult.value,
}))

const data2 = computed<DynamicVal>(() => ({
  name: '2',
  neg: true,
  label: 'Depth',
  max: max.value,
  min: min.value,
  float: float.value,
  mult: mult.value,
}))
</script>
