<template>
  <div class="addprp-container">
    <a href="#" @click.prevent="clickAddProp">Add Prop</a>
  </div>
</template>

<script setup lang="ts">
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
