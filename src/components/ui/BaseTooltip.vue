<template>
  <span class="tooltip-root">
    <slot name="activator" :props="activatorProps" />
    <span
      v-if="visible && !disabled"
      :id="tooltipId"
      class="tooltip-content"
      :class="`tooltip-content--${placement}`"
      role="tooltip"
    >
      <slot name="html">
        <span>{{ text }}</span>
      </slot>
    </span>
  </span>
</template>

<script setup lang="ts">
import { useId } from 'vue'

const props = withDefaults(
  defineProps<{
    text?: string
    disabled?: boolean
    delay?: number
    placement?: 'top' | 'bottom'
  }>(),
  {
    text: '',
    disabled: false,
    delay: 1000,
    placement: 'top',
  },
)

const visible = ref(false)
const tooltipId = useId()
let timeout: ReturnType<typeof setTimeout> | undefined

const show = () => {
  if (props.disabled) return
  if (timeout !== undefined) clearTimeout(timeout)
  timeout = setTimeout(() => {
    visible.value = true
    timeout = undefined
  }, props.delay)
}

const hide = () => {
  if (timeout !== undefined) clearTimeout(timeout)
  timeout = undefined
  visible.value = false
}

const activatorProps = {
  'aria-describedby': tooltipId,
  onMouseenter: show,
  onMouseleave: hide,
  onFocus: show,
  onBlur: hide,
}

onBeforeUnmount(hide)

defineExpose({ hide })
</script>

<style scoped>
.tooltip-root {
  position: relative;
  display: inline-flex;
}

.tooltip-content {
  position: absolute;
  left: 50%;
  z-index: 1100;
  width: max-content;
  max-width: min(20rem, 80vw);
  padding: var(--space-2);
  color: var(--color-text);
  pointer-events: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transform: translateX(-50%);
}

.tooltip-content--top {
  bottom: calc(100% + var(--space-2));
}

.tooltip-content--bottom {
  top: calc(100% + var(--space-2));
}
</style>
