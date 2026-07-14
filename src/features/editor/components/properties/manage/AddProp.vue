<template>
  <div class="addprp-container">
    <AppTooltip>
      <template #activator="{ props: tooltipProps }">
        <a v-bind="tooltipProps" href="#" @click.prevent="clickAddProp">Add Prop</a>
      </template>
      <template #html>
        <strong>Add Prop</strong><br />
        Adds a new prop with an empty starting animation and selects it for editing.<br />
        Any previously selected props are deselected.
      </template>
    </AppTooltip>
  </div>
</template>

<script setup lang="ts">
import AppTooltip from '@/components/AppTooltip.vue'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useProperties } from '@/features/editor/composables/useProperties'

const store = inject('store', ref('main'))

const playerStore = usePlayerStore(store.value)
const { ROOT } = playerStore.raw()
const { PLAYING } = storeToRefs(playerStore)

const { pSELECTED } = useProperties(store.value)

const clickAddProp = () => {
  if (PLAYING.value) return

  ROOT.value.props.push({ anim: [{}] })

  // Select the prop
  for (const i in pSELECTED.value) pSELECTED.value[i] = false
  pSELECTED.value[ROOT.value.props.length - 1] = true

  triggerRef(ROOT)
}
</script>

<style scoped>
.addprp-container {
  padding: 5px;
}
</style>
