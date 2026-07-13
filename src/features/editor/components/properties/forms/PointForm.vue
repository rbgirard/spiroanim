<template>
  <div class="container">
    <div class="btn">
      <button class="action-button" type="button" @click="click">{{ text }}</button>
    </div>
    <div>
      <SelectInt :data="data" :vals="vals" :setter="setter" label="Manual Selection" />
    </div>
  </div>
</template>

<script setup lang="ts">
import SelectInt from './SelectIntForm.vue'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useProperties } from '@/features/editor/composables/useProperties'
import { CMODES } from '@/domain/animation/AnimStruct'
import type { DynamicVal, ValRetType, SetterFunc } from '@/types/AnimTypes'

// TODO: Add to globals?
import { type WatchHandle } from 'vue'

const props = defineProps<{
  data: ValRetType
  vals: DynamicVal
  setter: SetterFunc
}>()

const store = inject('store', ref('main'))

const { PROPS, pSELECTED } = useProperties(store.value)

const playerStore = usePlayerStore(store.value)
const { ROOT } = playerStore.raw()
const { SELECTION, SELECTED, INDEX, PLAYING, trackClicks } = storeToRefs(playerStore)

const firstProp = ref()
let watchers: WatchHandle[] = []

const name = computed(() => props.vals.name ?? '')

const cancel = (w = true) => {
  if (firstProp.value) {
    // Stop watchers
    if (w) {
      for (const i in watchers) watchers[i]!()
      watchers = []
    }

    // Clear
    delete firstProp.value.click
    firstProp.value = undefined
    triggerRef(ROOT)
  }
}

const click = () => {
  if (firstProp.value) cancel()
  else {
    if (PLAYING.value) return

    if (PROPS.value.length > 0) {
      firstProp.value = PROPS.value[0] // Only target the first selected prop
      firstProp.value.click = CMODES.points // Flag it to show all points and register clicks
      triggerRef(ROOT)

      trackClicks.value = [] // clear

      watchers.push(
        watch(
          trackClicks,
          () => {
            if (PLAYING.value) return

            if (trackClicks.value.length > 0) {
              const e = trackClicks.value[trackClicks.value.length - 1]!
              if (e[0] == CMODES.points) {
                props.setter?.(name.value, e[1])
                cancel()
              }
            }
          },
          { deep: true },
        ),
      )

      watchers.push(
        watch(
          [SELECTION, SELECTION.value ? SELECTED : INDEX, ROOT, pSELECTED],
          () => {
            cancel()
          },
          { deep: true },
        ),
      )
    }
  }
}

const text = computed(() => {
  return firstProp.value ? 'CANCEL' : 'PLAYER'
})

onUnmounted(() => {
  cancel()
})
</script>

<style scoped>
.container {
  display: grid;
  grid-template-columns: minmax(auto, min-content) 1fr;
}
.btn {
  padding: 5px;
}

.action-button {
  padding: var(--space-2) var(--space-3);
  color: var(--color-on-action-primary);
  cursor: pointer;
  background: var(--color-action-primary);
  border: 0;
  border-radius: var(--radius-sm);
}
</style>
