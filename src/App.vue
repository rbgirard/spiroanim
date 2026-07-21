<template>
  <RouterView />
  <PwaUpdatePrompt v-if="hasMounted && PwaUpdatePrompt" />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { RouterView } from 'vue-router'

const PwaUpdatePrompt = import.meta.env.SSR
  ? null
  : defineAsyncComponent(() => import('@/components/layout/PwaUpdatePrompt.vue'))
const hasMounted = ref(false)

onMounted(() => {
  hasMounted.value = true
})
</script>
