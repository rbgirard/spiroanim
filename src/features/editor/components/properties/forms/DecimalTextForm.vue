<template>
  <label class="field">
    <span>{{ label }}</span>
    <input v-model="val" inputmode="numeric" @input="handleInput" />
  </label>
</template>

<script setup lang="ts">
// TODO: The old version of this was a NIGHTMARE! Can't believe it was functioning. So there's gotta be some unforseen bugs in here.

import { VALUE } from '@/features/editor/composables/useProperties'
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

let neg2 = false
let per = false

const props = defineProps<{
  data: ValRetType
  vals: DynamicVal
  setter: SetterFunc
}>()

const vals = props.vals

const name = computed(() => vals.name ?? false)
const neg = computed(() => vals.neg ?? false)
const float = computed(() => vals.float ?? false)
const posi = computed(() => vals.posi ?? false)
const label = computed(() => vals.label ?? 'Manual')

const get = (): string => {
  const ret = String(props.data[VALUE])
  // Allows a negative sign without updating the value
  if (neg.value && neg2)
    if (ret) neg2 = false
    else return '-'
  if (per) {
    per = false
    return ret + '.'
  }
  return ret === undefined ? '' : ret
}

const parse = computed(() => {
  const f = float.value
  return f ? (val: number) => Math.floor(val * f) / f : (val: number) => val
})

const val = computed({
  get: get,
  set(str) {
    let val = Number(str)

    // Value must be positive?
    if (posi.value && val < 1) val = 1

    if (float.value && str[str.length - 1] == '.') per = true

    if (neg.value && str == '-') neg2 = true // Enter negative mode

    if (neg.value && str == '') val = 0
    else {
      val = parse.value(val)
      if (isNaN(val)) val = 0
    }
    if (!neg.value && val < 0) val *= -1

    props.setter?.(name.value, val)
  },
})

// Getter doesn't execute if value doesn't change, leaving trailing letters etc.
const regex = computed(() => {
  const n = neg.value
  const f = float.value
  return f ? (n ? /^[-.]?[0-9]*$/ : /^[.]?[0-9]*$/) : n ? /^[-]?[0-9]*$/ : /^[0-9]*$/
})

const handleInput = (event: InputEvent) => {
  const target = event.target as HTMLInputElement
  if (!regex.value.test(target.value)) target.value = get()
}
</script>

<style scoped>
.field {
  display: grid;
  gap: var(--space-1);
  font-size: 0.8rem;
}

input {
  min-width: 0;
  min-height: 2rem;
  padding-inline: var(--space-2);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

input:focus-visible {
  outline: 2px solid var(--color-action-primary);
  outline-offset: 2px;
}
</style>
