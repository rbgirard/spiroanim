<template>
  <span class="tooltip-root">
    <slot name="activator" :props="activatorProps" />
    <Transition name="tooltip">
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
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { DEFAULT_TOOLTIP_DELAY, type TooltipPlacement } from '@/components/ui/tooltip'

const props = withDefaults(
  defineProps<{
    text?: string
    disabled?: boolean
    delay?: number
    placement?: TooltipPlacement
  }>(),
  {
    text: '',
    disabled: false,
    delay: DEFAULT_TOOLTIP_DELAY,
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
  transform-origin: bottom center;
}

.tooltip-content--bottom {
  top: calc(100% + var(--space-2));
  transform-origin: top center;
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}

.tooltip-enter-from.tooltip-content--top,
.tooltip-leave-to.tooltip-content--top {
  transform: translate(-50%, var(--space-1)) scale(0.97);
}

.tooltip-enter-from.tooltip-content--bottom,
.tooltip-leave-to.tooltip-content--bottom {
  transform: translate(-50%, calc(0rem - var(--space-1))) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .tooltip-enter-active,
  .tooltip-leave-active {
    transition: none;
  }
}
</style>
