<template>
  <label class="checkbox"><input v-model="val" type="checkbox" /> {{ label }}</label>
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

const val = computed({
  get() {
    return props.data[VALUE] ?? false
  },
  set(val) {
    props.setter(name.value, val)
  },
})

const label = computed(() => {
  return props.data[VALUE] ? 'Enabled' : 'Disabled'
})
</script>

<style scoped>
.checkbox {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
}
</style>
