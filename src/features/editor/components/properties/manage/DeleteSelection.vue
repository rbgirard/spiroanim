<template>
  <div class="delsel-container">
    <AppTooltip>
      <template #activator="{ props: tooltipProps }">
        <a v-bind="tooltipProps" href="#" @click.prevent="clickDeleteSel">Delete Selection</a>
      </template>
      <template #html>
        <strong>Delete Selection</strong><br />
        Removes animation points from the selected props at the current timeline position.<br />
        When a timeline range is selected, every point within that range is removed.
      </template>
    </AppTooltip>
  </div>
</template>

<script setup lang="ts">
import AppTooltip from '@/components/AppTooltip.vue'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useManageProperties } from '@/features/editor/composables/useManageProperties'

const store = inject('store', ref('main'))

const playerStore = usePlayerStore(store.value)
const { ROOT } = playerStore.raw()
const { PLAYING } = storeToRefs(playerStore)

const { propSelection } = useManageProperties(store.value)

const clickDeleteSel = () => {
  if (PLAYING.value) return

  // TODO: Bug when using this, causing selection to get messed up (have to click another thumbnail to refresh it)

  propSelection((ind, start, end) => {
    const prop = ROOT.value.props[ind]!

    if (start != -1 && end != -1)
      if (prop.anim.length == 0) prop.anim = []
      else prop.anim.splice(start, end - start + 1)

    triggerRef(ROOT)
  })
}
</script>

<style scoped>
.delsel-container {
  padding: 5px;
}
</style>
