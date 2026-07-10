// Gets loaded into vite.config.ts for unplugin-auto-import, making these available globally
// There is zero overhead from adding these

export const AutoImports: Record<string, string[]> = {
  pinia: ['storeToRefs', 'defineStore'],
  vue: [
    'ref',
    'computed',
    'reactive',
    'readonly',
    'watch',
    'watchEffect',
    'onMounted',
    'onUnmounted',
    'onBeforeMount',
    'onBeforeUnmount',
    'shallowRef',
    'triggerRef',
    'nextTick',
    'toRef',
    'toRefs',
    'toRaw',
    'provide',
    'inject',
    'defineComponent',
    'useAttrs',
  ],
  'vue-router': ['useRoute', 'useRouter', 'onBeforeRouteLeave', 'onBeforeRouteUpdate'],
  '@vueuse/core': [
    'watchImmediate',
    'watchThrottled',
    'useEventListener',
    'useElementSize',
    'toReactive',
    'useElementBounding',
  ],
}
