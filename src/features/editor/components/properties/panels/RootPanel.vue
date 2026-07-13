<template>
  <PropertyPanel panel="root" title="Root" :data="data" :vals="vals" :setter="rootSet">
    <template #paths>
      <strong>Paths</strong><br />
      Toggles the display of all motion paths traced throughout the animation.<br />
      When enabled, you can visually follow every route each prop travels, frame by frame, across
      the entire sequence.<br />
      <br /><i>This is a global setting that applies as the default for all props.</i>
    </template>

    <template #hands>
      <strong>Hands</strong><br />
      Toggles the display of all motion hand paths traced throughout the animation.<br />
      When enabled, you can visually follow every route each hand travels, frame by frame, across
      the entire sequence.<br />
      <br /><i>This is a global setting that applies as the default for all props.</i>
    </template>

    <template #visible>
      <strong>Visible</strong><br />
      Toggles visual display of the object.<br />
      <br /><i>This is a global setting that applies as the default for all props.</i>
    </template>

    <template #nodes>
      <strong>Nodes</strong><br />
      Toggles the display of the system’s reference nodes.<br />
      <em>Note:</em> Node positions dynamically adjust based on the current <strong>Scale</strong>,
      giving an accurate sense of spacing at different sizes.<br />
      <br /><i>This is a global setting that applies as the default for all props.</i>
    </template>

    <template #anchors>
      <strong>Anchors</strong><br />
      Toggles the display of anchor points — the precise positions where each frame lands on the
      prop.<br />
      Useful for reviewing precision placement or timing across the animation.<br />
      <br /><i>This is a global setting that applies as the default for all props.</i>
    </template>

    <template #guides>
      <strong>Guides</strong><br />
      Toggles the display of guide paths connecting all nodes.<br />
      These guides were part of the original layout system and remain available as a visual aid and
      for historical reference.<br />
      <br /><i>This is a global setting that applies as the default for all props.</i>
    </template>

    <template #prop>
      <strong>Prop</strong><br />
      Selects the default type of prop used throughout the animation.<br />
      Different prop types can influence how paths, nodes, and rotations are interpreted for every
      frame.<br />
      <br /><i>This is a global setting that applies as the default for all props.</i>
    </template>

    <template #color>
      <strong>Color</strong><br />
      Sets the default color for props and their paths.<br />
      Adjust this to distinguish between multiple props, highlight certain elements, or style the
      overall workspace.<br />
      <br /><i>This is a global setting that applies as the default for all props.</i>
    </template>

    <template #bpm>
      <strong>BPM</strong><br />
      Stands for <em>Beats Per Minute</em> — controls the global timing and tempo of your
      animation.<br />
      Increasing BPM makes the animation progress faster, while decreasing BPM slows it down.<br />
      <br /><i>This value serves as the root timing reference for all frames and props.</i>
    </template>
  </PropertyPanel>
</template>

<script setup lang="ts">
import PropertyPanel from '../PropertyPanel.vue'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useProperties } from '@/features/editor/composables/useProperties'
import { COLORS, PTEXT } from '@/domain/animation/AnimStruct'

const store = inject('store', ref('main'))

const playerStore = usePlayerStore(store.value)
const { ROOT } = playerStore.raw()

const { rootGet, rootSet, panelWatcher } = useProperties(store.value)

const data = ref({})
const vals = [
  { name: 'paths', text: 'Paths', component: 'Boolean' },
  { name: 'hands', text: 'Hands', component: 'Boolean' },
  { name: 'visible', text: 'Visible', component: 'Boolean' },
  { name: 'nodes', text: 'Nodes', component: 'Boolean' },
  { name: 'anchors', text: 'Anchors', component: 'Boolean' },
  { name: 'guides', text: 'Guides', component: 'Boolean' },
  ////{name: 'smooth',  text: 'Smooth',  component: 'Boolean'    },
  { name: 'prop', text: 'Prop', component: 'SelectInt', items: PTEXT, label: 'Prop Type' },
  { name: 'color', text: 'Color', component: 'SelectInt', items: COLORS, label: 'Prop Color' },
  { name: 'bpm', text: 'BPM', component: 'BPM', mult: 20 },
  { name: 'aspectx', text: 'AspectX', component: 'Decimal' },
  { name: 'aspecty', text: 'AspectY', component: 'Decimal' },
  { name: 'distance', text: 'Distance', component: 'Decimal' },
  { name: 'thick', text: 'Thick', component: 'Decimal' },
]

panelWatcher(ROOT, data, vals, rootGet)
</script>
