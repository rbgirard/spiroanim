<template>
  <PropertyPanel panel="advanced" title="Advanced" :data="data" :vals="vals" :setter="animSet">
    <template #arc>
      <strong>Arc</strong><br />
      Defines the primary rotational division of your pattern.<br />
      Each step represents a slice of the full circle.<br />
      Changing Arc sets the base step size that other sliders (such as <strong>Plane</strong> and
      <strong>Axis</strong>) build upon.<br />
      <br /><i>When undefined, this property inherits from the previous frame.</i>
    </template>

    <template #plane>
      <strong>Plane</strong><br />
      Controls the orientation of the orthogonal reference point relative to
      <strong>Arc</strong>.<br />
      Adjusting Plane effectively shifts the rotation plane on which your pattern is drawn.
    </template>

    <template #axis>
      <strong>Axis</strong><br />
      Rotates the object’s own axis, independent of <strong>Plane</strong>.<br />
      <br /><i>When undefined, this property mirrors Plane, keeping them aligned.</i>
    </template>

    <template #adjust>
      <strong>Adjust</strong><br />
      Applies an offset on top of the current <strong>Axis</strong> intended for fine-tuning 3D
      transitions.<br />
      This does not redefine <strong>Plane</strong> or <strong>Arc</strong>; instead, it adds or
      subtracts degrees from the established axis and smoothly interpolates toward that new
      orientation.<br />
      <br /><i>When undefined, this property inherits from the previous frame.</i>
    </template>

    <template #scale>
      <strong>Scale</strong><br />
      Controls the size or center of the movement or shape.<br />
      A higher Scale increases the radius or distance of the pattern, while a lower Scale shrinks
      it.<br />
      <br /><i>When undefined, this property inherits from the previous frame.</i>
    </template>

    <template #depth>
      <strong>Depth</strong><br />
      Moves the pattern forward or backward along its perpendicular axis.<br />
      Increasing Depth pushes the motion outward or inward in 3D space, modifying the center of
      rotation.<br />
      <strong>Note:</strong> A value of <em>-0.5</em> can create an “isolation” effect with poi.<br />
      <br /><i>When undefined, this property inherits from the previous frame.</i>
    </template>
  </PropertyPanel>
</template>

<script setup lang="ts">
import PropertyPanel from '../PropertyPanel.vue'
import { useProperties } from '@/features/editor/composables/useProperties'

const store = inject('store', ref('main'))
const { animGet, animSet, ANIMS, panelWatcher, ARCDENOM } = useProperties(store.value)

const data = ref({})

const arc = reactive({
  name: 'arc',
  text: 'Arc',
  component: 'Arc',
  undef: true,
  mult: 15,
  min: -24,
  max: 24,
  neg: true,
})

const plane = reactive({
  name: 'plane',
  text: 'Plane',
  component: 'Yaw',
  undef: true,
  mult: 45,
  min: -8,
  max: 8,
  neg: true,
})

const axis = reactive({
  name: 'axis',
  text: 'Axis',
  component: 'Yaw',
  undef: true,
  mult: 45,
  min: -8,
  max: 8,
  neg: true,
})

const vals = [
  arc,
  plane,
  axis,
  {
    name: 'adjust',
    text: 'Adjust',
    component: 'Decimal', // Yaw - Don't think this is necessary
    undef: true,
    mult: 5,
    min: -18,
    max: 18,
    neg: true,
  },
  { name: 'scale', text: 'Scale', component: 'Decimal', undef: true, mult: 1 },
  { name: 'depth', text: 'Depth', component: 'Decimal', undef: true, mult: 1 },
]

watchEffect(() => {
  const arcd = ARCDENOM.value // step size (degrees per snap)
  const max = 360 / arcd // how many steps fit in ±360
  const maxhalf = Math.ceil(max / 2) // how many steps fit in ±180 (rounded UP)

  arc.mult = plane.mult = axis.mult = arcd // each step = arcd degrees
  arc.max = max // steps allowed in + direction for ARC
  arc.min = -max // steps allowed in - direction for ARC

  plane.max = axis.max = maxhalf // steps allowed in + direction for PLANE and AXIS
  plane.min = axis.min = -maxhalf // steps allowed in - direction for PLANE and AXIS
})

panelWatcher(ANIMS, data, vals, animGet)
</script>
