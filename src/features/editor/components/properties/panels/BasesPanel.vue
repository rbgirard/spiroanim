<template>
  <PropertyPanel panel="base" title="Prop" :data="data" :vals="vals" :setter="propSet">
    <template #paths>
      <strong>Paths</strong><br />
      Toggles the display of the full motion paths traced throughout the animation.<br />
      When enabled, you can visually follow every route the prop travels, frame by frame, across the
      entire sequence.<br />
      <br /><i>When undefined, this property inherits from <strong>ROOT</strong>.</i>
    </template>

    <template #hands>
      <strong>Hands</strong><br />
      Toggles the display of the full motion hand paths traced throughout the animation.<br />
      When enabled, you can visually follow every route the hand travels, frame by frame, across the
      entire sequence.<br />
      <br /><i>When undefined, this property inherits from <strong>ROOT</strong>.</i>
    </template>

    <template #visible>
      <strong>Visible</strong><br />
      Toggles visual display of the object.<br />
      <br /><i>When undefined, this property inherits from <strong>ROOT</strong>.</i>
    </template>

    <template #nodes>
      <strong>Nodes</strong><br />
      Toggles the display of key reference nodes within the scene.<br />
      <em>Note:</em> Node positions dynamically adjust based on the current <strong>Scale</strong>,
      providing an accurate sense of spacing at different sizes.<br />
      <br /><i>When undefined, this property inherits from <strong>ROOT</strong>.</i>
    </template>

    <template #anchors>
      <strong>Anchors</strong><br />
      Toggles the display of anchor points — the exact positions where each frame of the prop lands
      or aligns.<br />
      This is especially useful for analyzing precision placement or timing within the animation.<br />
      <br /><i>When undefined, this property inherits from <strong>ROOT</strong>.</i>
    </template>

    <template #guides>
      <strong>Guides</strong><br />
      Toggles the display of guide paths that connect all nodes.<br />
      These guides originated in the system’s earliest design for navigation and alignment and are
      retained as a visual aid and for historical reference.<br />
      <br /><i>When undefined, this property inherits from <strong>ROOT</strong>.</i>
    </template>

    <template #prop>
      <strong>Prop</strong><br />
      Selects the type of prop being animated.<br />
      Different prop types can influence how paths, nodes, and rotations are interpreted, letting
      you adapt the system for various flow tools.<br />
      <br /><i>When undefined, this property inherits from <strong>ROOT</strong>.</i>
    </template>

    <template #color>
      <strong>Color</strong><br />
      Defines the color of both the prop and its associated paths.<br />
      Adjusting this can help distinguish multiple props, emphasize specific elements, or customize
      the overall look of your workspace.<br />
      <br /><i>When undefined, this property inherits from <strong>ROOT</strong>.</i>
    </template>
  </PropertyPanel>
</template>

<script setup lang="ts">
import PropertyPanel from '../PropertyPanel.vue'
import { useProperties } from '@/features/editor/composables/useProperties'
import { COLORS, PTEXT } from '@/domain/animation/AnimStruct'

const store = inject('store', ref('main'))
const { propGet, propSet, PROPS, panelWatcher } = useProperties(store.value)

const data = ref({}),
  vals = [
    { name: 'paths', text: 'Paths', component: 'Boolean', undef: true },
    { name: 'hands', text: 'Hands', component: 'Boolean', undef: true },
    { name: 'visible', text: 'Visible', component: 'Boolean', undef: true },
    { name: 'nodes', text: 'Nodes', component: 'Boolean', undef: true },
    { name: 'anchors', text: 'Anchors', component: 'Boolean', undef: true },
    { name: 'guides', text: 'Guides', component: 'Boolean', undef: true },
    {
      name: 'prop',
      text: 'Prop',
      component: 'SelectInt',
      undef: true,
      items: PTEXT,
      label: 'Prop Type',
    },
    {
      name: 'color',
      text: 'Color',
      component: 'SelectInt',
      undef: true,
      items: COLORS,
      label: 'Prop Color',
    },
  ]

panelWatcher(PROPS, data, vals, propGet)
</script>
