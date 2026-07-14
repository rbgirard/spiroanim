<template>
  <div class="delprp-container">
    <AppTooltip>
      <template #activator="{ props: tooltipProps }">
        <a v-bind="tooltipProps" href="#" @click.prevent="clickDeleteProps">Delete Props</a>
      </template>
      <template #html>
        <strong>Delete Props</strong><br />
        Removes every currently selected prop and all animation data owned by those props.<br />
        If any props remain, the first one is selected automatically.
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

const clickDeleteProps = () => {
  if (PLAYING.value) return

  const props = []

  for (const i in ROOT.value.props)
    if (!pSELECTED.value[i]) props.push(toRaw(ROOT.value.props[Number(i)]!))

  ROOT.value.props = props
  pSELECTED.value = {}

  // Select the first prop
  if (ROOT.value.props.length > 0) {
    pSELECTED.value[0] = true
  }

  triggerRef(ROOT)
}
</script>

<style scoped>
.delprp-container {
  padding: 5px;
}
</style>
