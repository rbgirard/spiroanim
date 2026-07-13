<template>
  <label class="field">
    <span>{{ label }}</span>
    <select v-model.number="val">
      <option v-for="item in items" :key="String(item.value)" :value="item.value">
        {{ item.label }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { VALUE } from '@/features/editor/composables/useProperties'
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

const props = defineProps<{
  data: ValRetType
  vals: DynamicVal
  setter: SetterFunc
}>()

const name = computed(() => props.vals.name ?? '')
const undef = computed(() => props.vals.undef)
const label = computed(() => props.vals?.label ?? 'Manual')

const items = computed(() => {
  const ret = []
  if (undef.value) ret.push({ label: 'Undefined', value: '' })
  const itms = props.vals.items
  for (const key in itms) {
    const ind = parseInt(key)
    ret.push({ label: itms[ind], value: ind })
  }
  return ret
})

const val = computed<ValRetType[0] | ''>({
  get() {
    return props.data[VALUE] ?? ''
  },
  set(val) {
    if (val === '') val = undefined
    props.setter(name.value, val)
  },
})
</script>

<style scoped>
.field {
  display: grid;
  gap: var(--space-1);
  font-size: 0.8rem;
}

select {
  min-height: 2rem;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

select:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
