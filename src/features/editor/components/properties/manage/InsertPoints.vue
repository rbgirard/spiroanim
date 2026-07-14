<template>
  <div class="inspnt-container">
    <AppTooltip>
      <template #activator="{ props: tooltipProps }">
        <a v-bind="tooltipProps" href="#" @click.prevent="activate">Insert Points</a>
      </template>
      <template #html>
        <strong>Insert Points</strong><br />
        Inserts animation points into the selected props before or after the current timeline
        position or selected range.<br />
        Add a blank point directly, or choose reference nodes in the player to build a path.
      </template>
    </AppTooltip>
    <div v-show="pINPUT == inputStr">
      <button v-show="!firstProp" class="action-button" type="button" @click="oneClick">ADD</button>
      <button class="action-button" type="button" @click="click">{{ text }}</button>
      <button v-show="firstProp" class="action-button" type="button" @click="apply">APPLY</button>
      <div>
        <div class="where-options">
          <label><input v-model.number="where" type="radio" value="1" /> Before</label>
          <label><input v-model.number="where" type="radio" value="2" /> After</label>
        </div>
        <div v-show="firstProp">Clicked: {{ pointxt }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppTooltip from '@/components/AppTooltip.vue'
import { useProperties } from '@/features/editor/composables/useProperties'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useManageProperties } from '@/features/editor/composables/useManageProperties'
import { InitialPoint, InitialOrtho, orthoPoint, orthoAngle } from '@/math/animation/OrthogonalFunc'
import { Vector3, MathUtils } from 'three'
import { INDPNT, CMODES, PPOS } from '@/domain/animation/AnimStruct'

import type { AnimData } from '@/types/AnimTypes'
import { type WatchHandle } from 'vue'

const store = inject('store', ref('main'))

const playerStore = usePlayerStore(store.value)
const { ROOT, CURRENT, COMPILED } = playerStore.raw()
const { INDEX, SELECTION, SELECTED, UTIMES, trackClicks, PLAYING } = storeToRefs(playerStore)

const { PROPS, pSELECTED, pINPUT } = useProperties(store.value)

const { propSelection } = useManageProperties(store.value)

let watchers: WatchHandle[] = []
const firstProp = ref()

const where = ref()
const inputStr = 'manage.inspnt'

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

const activate = () => {
  pINPUT.value = pINPUT.value == inputStr ? '' : inputStr
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
          [SELECTION, SELECTION.value ? SELECTED : INDEX, ROOT, pSELECTED, pINPUT],
          () => {
            cancel()
          },
          { deep: true },
        ),
      )
    }
  }
}

const oneClick = () => {
  if (firstProp.value) cancel()
  else {
    if (PLAYING.value) return

    propSelection((ind, start, end) => {
      const prop = ROOT.value.props[ind]!,
        ins = [{} as AnimData],
        before = where.value == 1

      //prop.anim.push({})

      if (start == -1) prop.anim = ins
      else prop.anim.splice(before ? start : end + 1, 0, ...ins)
    })

    triggerRef(ROOT)
  }
}

const Angle90 = Math.PI / 2
const pos = new Vector3()
const plane = new Vector3()
const cross = new Vector3()
const ortho = new Vector3()

const apply = () => {
  if (PLAYING.value) return

  if (!points.value.length) return

  const locs: Vector3[] = []
  for (const sel in points.value) locs.push(PPOS[points.value[Number(sel)]!]!)

  propSelection((ind, start, end) => {
    const before = where.value == 1,
      prop = ROOT.value.props[ind]!,
      cmpd = COMPILED.value.props[ind]!.anim,
      ins: AnimData[] = [],
      at = before ? start - 1 : end

    // Add point from the next animation, if it exists
    // This causes the next item to lock in place rather than holding relation to the previous
    if (cmpd[at + 1] !== undefined) locs.push(new Vector3().fromArray(cmpd[at + 1]!.pos))

    // Determine initial position (pos) and orthogonal point (plane)
    if (at < 0) {
      pos.copy(InitialPoint)
      plane.copy(InitialOrtho)
    } else {
      pos.fromArray(cmpd[at]!.pos)
      cross.fromArray(cmpd[at]!.posx)
      plane.copy(pos).applyAxisAngle(cross, Angle90)
    }

    // Loop through points which user has clicked / selected
    for (const i in locs) {
      const // Point which user has clicked
        cur = locs[i]!,
        // Determine the angle between orthogonal points
        angle = orthoAngle(pos, cur, plane),
        // Plane / Arc is all thats needed
        push: AnimData = {
          plane: Math.round(MathUtils.radToDeg(angle)),
          arc: Math.round(MathUtils.radToDeg(pos.angleTo(cur))),
        }

      // If 0, set to undefined by deleting
      if (push.plane === 0) delete push.plane
      if (push.arc === 0) delete push.arc

      ins.push(push)

      // Calculate Ortho and cross it with Pos to get Direction
      cross.crossVectors(pos, orthoPoint(angle, pos, plane, ortho))

      // Update POS and PLANE for next loop - Apply 90 degrees toward Ortho from POS
      plane.copy(pos.copy(cur)).applyAxisAngle(cross, Angle90)
    }

    // Splice in remaining properties for the next animation
    if (prop.anim[at + 1] !== undefined) {
      ins[ins.length - 1] = {
        ...prop.anim[at + 1],
        ...ins[ins.length - 1]!,
      }
    }

    if (start == -1)
      // && end == -1 )
      prop.anim = ins
    else
      // NOTE: Overwrites 1 item (which gets added in above)
      prop.anim.splice(before ? start : end + 1, 1, ...ins)

    triggerRef(ROOT)
  })

  cancel()
}

const text = computed(() => {
  return firstProp.value ? 'CANCEL' : 'PLAYER'
})

const points = computed(() => {
  const ret = []
  for (const i in trackClicks.value)
    if (trackClicks.value[Number(i)]![0] == CMODES.points)
      ret.push(trackClicks.value[Number(i)]![1])
  return ret
})

const pointxt = computed(() => {
  const ret = []
  for (const i in points.value) ret.push(INDPNT[points.value[Number(i)]!])
  return ret.join(', ')
})

onUnmounted(() => {
  cancel()
})

watch(
  CURRENT,
  () => {
    if (INDEX.value == UTIMES.value.length - 1) where.value = 2
    else where.value = CURRENT.value == UTIMES.value[INDEX.value] ? 1 : 2
  },
  { immediate: true },
)
</script>

<style scoped>
.inspnt-container {
  padding: 5px;
  display: inline-block;
}
.second {
  padding-top: 5px;
}

.action-button {
  margin-inline-end: var(--space-1);
  padding: var(--space-2) var(--space-3);
  color: var(--color-on-action-primary);
  cursor: pointer;
  background: var(--color-action-primary);
  border: 0;
  border-radius: var(--radius-sm);
}

.where-options {
  display: flex;
  gap: var(--space-3);
  padding-block: var(--space-2);
}
</style>
