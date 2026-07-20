<template>
  <RouterView />
  <PwaUpdatePrompt v-if="PwaUpdatePrompt" />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { RouterView } from 'vue-router'

const PwaUpdatePrompt =
  typeof window === 'undefined'
    ? undefined
    : defineAsyncComponent(() => import('@/components/layout/PwaUpdatePrompt.vue'))
</script>
