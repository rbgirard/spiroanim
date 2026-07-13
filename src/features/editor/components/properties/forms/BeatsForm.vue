<template>
  <div class="container">
    <div>
      <span class="val">{{ display }}</span
      ><br />
      <button class="action-button" type="button" @click="click">APPLY</button>
    </div>
    <div class="slider">
      <input
        v-model.number="val"
        class="range"
        type="range"
        aria-label="Beat adjustment"
        :min="min"
        :max="max"
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
import { VALUE, useProperties } from '@/features/editor/composables/useProperties'

const store = inject('store', ref('main'))
const { constraints } = useProperties(store.value)
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

const props = defineProps<{
  data: ValRetType
  vals: DynamicVal
  setter: SetterFunc
}>()

const name = computed(() => props.vals.name ?? '')
const min = computed(() => props.vals.min ?? -10)
const max = computed(() => props.vals.max ?? 10)
const step = computed(() => props.vals.step ?? 1)
const mult = computed(() => props.vals.mult ?? 1)
const float = computed(() => props.vals.float ?? 1)
const def = computed(() => props.vals.def ?? 1)

const apply = ref()
const val = ref(0)
const from = ref<number | boolean>(false)

const parse = computed(() => {
  return float.value
    ? (val: string) => Math.floor(parseFloat(val) * float.value) / float.value
    : (val: string) => parseInt(val, 10)
})

const start = (/*original: number*/) => {
  let cur = parse.value(apply.value)
  if (isNaN(cur)) cur = def.value ? def.value : 0
  from.value = cur
}

const update = (val: number) => {
  let calc = constraints(name.value, (from.value as number) + val * mult.value)
  if (float.value) calc = parse.value(calc + '')
  apply.value = calc
}

const updateInput = (event: Event) => {
  update(Number((event.currentTarget as HTMLInputElement).value))
}

const end = (/*final: number*/) => {
  from.value = false
  val.value = 0
}

const click = () => {
  props.setter?.(name.value, apply.value)
}

const display = computed(() => {
  return apply.value === undefined ? 'Undef' : apply.value
})

watch(
  () => props.data?.[VALUE],
  (val) => {
    apply.value = val
  },
  { immediate: true, deep: true },
)
</script>

<style scoped>
.container {
  display: grid;
  grid-template-columns: minmax(auto, min-content) 1fr;
  text-align: center;
}
.slider {
  padding-top: 12px;
}
.val {
  color: var(--color-action-primary);
}

.range {
  width: 100%;
  accent-color: var(--color-action-primary);
}

.action-button {
  padding: var(--space-1) var(--space-2);
  color: var(--color-on-action-primary);
  cursor: pointer;
  background: var(--color-action-primary);
  border: 0;
  border-radius: var(--radius-sm);
}
</style>
