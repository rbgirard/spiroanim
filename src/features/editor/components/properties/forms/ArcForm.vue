<template>
  <SelectInt :data="sliceGet()" :vals="sliceVals" :setter="sliceSet" />
  <Decimal :data="props.data" :vals="props.vals" :setter="props.setter" />
</template>

<script setup lang="ts">
import Decimal from './DecimalForm.vue'
import SelectInt from './SelectIntForm.vue'
import { VALUE } from '@/features/editor/composables/useProperties'
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

const props = defineProps<{
  data: ValRetType
  vals: DynamicVal
  setter: SetterFunc
}>()

const sliceGet = (): ValRetType => {
  const val = findArcIndex(Number(props.data[VALUE]))
  return [val, true, '', false]
}

const sliceSet: SetterFunc = (k, index) => {
  props.setter(props.vals.name, arcPresets[index as number]?.[2])
}

const arcPresets: [number, string, number][] = [
  [3, 'Trifold', 120],
  [4, 'Quadrant', 90],
  [5, 'Pentad', 72],
  [6, 'Hexad', 60],
  [8, 'Octant', 45],
  [9, 'Ennead', 40],
  [10, 'Decad', 36],
  [12, 'Dodecad', 30],
]

const arcLabels = arcPresets.map(([points, name, degrees]) => {
  return `${points} - ${name}, ${degrees}°`
})

const sliceVals = {
  name: '0',
  text: 'Type',
  component: 'SelectInt',
  undef: true,
  items: arcLabels,
  label: 'Rotational Segment',
}

// function to find the best matching index
function findArcIndex(arcValue: number): number | undefined {
  let bestIndex = undefined
  let bestDegrees = 0

  if (arcValue == 0 || arcValue == 360) return bestIndex

  for (let i = 0; i < arcPresets.length; i++) {
    const [, , degrees] = arcPresets[i]!
    if (arcValue % degrees === 0 && degrees > bestDegrees) {
      bestDegrees = degrees
      bestIndex = i
    }
  }

  return bestIndex
}
</script>
