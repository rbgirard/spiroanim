<template>
  <div class="container">
    <div>
      <DecimalText :data="props.data" :vals="props.vals" :setter="props.setter" />
    </div>
    <div class="slider">
      <input
        v-model.number="val"
        class="range"
        type="range"
        :aria-label="`${name} adjustment`"
        :min="minVal"
        :max="maxVal"
        :step="step"
        @pointerdown="start"
        @pointerup="end"
        @pointercancel="end"
        @keydown="start"
        @keyup="end"
        @blur="end"
        @input="updateInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import DecimalText from './DecimalTextForm.vue'
import { VALUE } from '@/features/editor/composables/useProperties'
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

const props = defineProps<{
  data: ValRetType
  vals: DynamicVal
  setter: SetterFunc
}>()

const vals = props.vals

const name = computed(() => vals.name ?? '')
const min = computed(() => vals.min ?? -10)
const max = computed(() => vals.max ?? 10)
const step = computed(() => vals.step ?? 1)
const mult = computed(() => vals.mult ?? 1)

const float = computed(() => vals.float)
const def = computed(() => vals.def ?? 0)

const val = ref(0)
const from = ref<number | boolean>(false)

const parse = computed(() => {
  const f = float.value
  return f !== undefined ? (val: number) => Math.floor(val * f) / f : (val: number) => val
})

const minFreeze = ref<number | null>()
const minVal = computed(() => {
  const freeze = minFreeze.value
  const val = min.value
  if (freeze) return freeze
  else return val
})

const maxFreeze = ref<number | null>()
const maxVal = computed(() => {
  const freeze = maxFreeze.value
  const val = max.value
  if (freeze) return freeze
  else return val
})

const multFreeze = ref<number | null>()
const multVal = computed(() => {
  const freeze = multFreeze.value
  const val = mult.value
  if (freeze) return freeze
  else return val
})

const start = (/*original: number*/) => {
  minFreeze.value = min.value
  maxFreeze.value = max.value
  multFreeze.value = mult.value

  const val = props.data[VALUE]
  if (typeof val === 'number') {
    let cur = parse.value(val)
    if (isNaN(cur)) cur = def.value
    from.value = cur
  }
}

const update = (val: number) => {
  let calc = (from.value as number) + val * multVal.value
  if (float.value) calc = parse.value(calc)
  props.setter?.(name.value, calc)
}

const updateInput = (event: Event) => {
  update(Number((event.currentTarget as HTMLInputElement).value))
}

const end = (/*final: number*/) => {
  minFreeze.value = maxFreeze.value = multFreeze.value = null

  from.value = false
  val.value = 0
}
</script>

<style scoped>
.container {
  display: grid;
  grid-template-columns: minmax(90px, auto) 1fr;
}
.slider {
  padding-top: 12px;
}

.range {
  width: 100%;
  accent-color: var(--color-action-primary);
}
</style>
