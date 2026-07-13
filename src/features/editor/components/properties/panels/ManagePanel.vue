<script setup lang="ts">
import PropertyPanel from '../PropertyPanel.vue'
import InsertPoints from '../manage/InsertPoints.vue'
import DeleteSelection from '../manage/DeleteSelection.vue'
import AddProp from '../manage/AddProp.vue'
import DeleteProps from '../manage/DeleteProps.vue'

import { useProperties } from '@/features/editor/composables/useProperties'

const store = inject('store', ref('main'))
const { ANIMS, PROPS } = useProperties(store.value)
</script>

<template>
  <PropertyPanel panel="manage" title="Manage">
    <InsertPoints v-show="PROPS.length" />
    <DeleteSelection v-show="ANIMS.length" />
    <AddProp />
    <DeleteProps v-show="PROPS.length" />
  </PropertyPanel>
</template>

<style scoped></style>
