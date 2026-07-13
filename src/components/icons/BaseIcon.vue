<template>
  <svg aria-hidden="true" class="base-icon" viewBox="0 0 24 24" :width="size" :height="size">
    <path :d="path" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    path: string
    size?: number | string
  }>(),
  {
    size: 28,
  },
)
</script>

<style scoped>
.base-icon {
  display: block;
  fill: currentColor;
}
</style>
