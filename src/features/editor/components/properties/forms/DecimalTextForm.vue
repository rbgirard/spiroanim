<template>
  <label class="field">
    <span>{{ label }}</span>
    <input
      v-model="val"
      :inputmode="allowsDecimal ? 'decimal' : 'numeric'"
      @focus="beginEditing"
      @blur="endEditing"
      @input="handleInput"
    />
  </label>
</template>

<script setup lang="ts">
// TODO: The old version of this was a NIGHTMARE! Can't believe it was functioning. So there's gotta be some unforseen bugs in here.

import { VALUE } from '@/features/editor/composables/useProperties'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useQSMainStore } from '@/stores/useQSMainStore'
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

let neg2 = false
let per = false

const props = defineProps<{
  data: ValRetType
  vals: DynamicVal
  setter: SetterFunc
}>()

const vals = props.vals
const store = inject('store', ref('main'))
const { ROOT } = usePlayerStore(store.value).raw()
const { beginHistoryGroup, endHistoryGroup } = useQSMainStore()

const name = computed(() => vals.name ?? false)
const neg = computed(() => vals.neg ?? false)
const float = computed(() => vals.float ?? false)
const posi = computed(() => vals.posi ?? false)
const label = computed(() => vals.label ?? 'Manual')
const displayDivisor = computed(() => vals.displayDivisor ?? 1)
const displayMinimumFractionDigits = computed(() => vals.displayMinimumFractionDigits ?? 0)
const displayMaximumFractionDigits = computed(
  () => vals.displayMaximumFractionDigits ?? displayMinimumFractionDigits.value,
)
const allowsDecimal = computed(() => Boolean(float.value) || displayDivisor.value !== 1)

const formatDisplayValue = (value: number): string => {
  const maximumDigits = displayMaximumFractionDigits.value
  const minimumDigits = displayMinimumFractionDigits.value
  if (maximumDigits === 0) return String(value)

  const [whole, fraction = ''] = value.toFixed(maximumDigits).split('.')
  const retainedFraction = fraction.replace(/0+$/, '').padEnd(minimumDigits, '0')
  return retainedFraction === '' ? whole! : `${whole}.${retainedFraction}`
}

const get = (): string => {
  const raw = props.data[VALUE]
  const ret =
    typeof raw === 'number'
      ? formatDisplayValue(raw / displayDivisor.value)
      : raw === undefined
        ? ''
        : String(raw)
  // Allows a negative sign without updating the value
  if (neg.value && neg2)
    if (ret) neg2 = false
    else return '-'
  if (per) {
    per = false
    return ret + '.'
  }
  return ret
}

const parse = computed(() => {
  const f = float.value
  return f ? (val: number) => Math.round(val * f) / f : (val: number) => val
})

const val = computed({
  get: get,
  set(str) {
    let val = Number(str)

    // Value must be positive?
    if (posi.value && val < 1) val = 1

    if (allowsDecimal.value && str[str.length - 1] == '.') per = true

    if (neg.value && str == '-') neg2 = true // Enter negative mode

    if (neg.value && str == '') val = 0
    else {
      val = parse.value(val)
      if (isNaN(val)) val = 0
    }
    if (!neg.value && val < 0) val *= -1

    props.setter?.(
      name.value,
      displayDivisor.value === 1 ? val : Math.round(val * displayDivisor.value),
    )
  },
})

// Getter doesn't execute if value doesn't change, leaving trailing letters etc.
const regex = computed(() => {
  const n = neg.value
  const f = allowsDecimal.value
  return f ? (n ? /^-?\d*(?:\.\d*)?$/ : /^\d*(?:\.\d*)?$/) : n ? /^-?\d*$/ : /^\d*$/
})

const handleInput = (event: InputEvent) => {
  const target = event.target as HTMLInputElement
  if (!regex.value.test(target.value)) target.value = get()
}

const beginEditing = () => {
  beginHistoryGroup(ROOT.value)
}

const endEditing = () => {
  endHistoryGroup()
}
</script>

<style scoped>
.field {
  display: grid;
  gap: var(--space-1);
  font-size: 0.8rem;
}

input {
  box-sizing: border-box;
  width: 100%;
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
