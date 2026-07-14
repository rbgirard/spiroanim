<template>
  <span ref="rootEl" class="tooltip-root">
    <slot name="activator" :props="activatorProps" />
    <Teleport to="body">
      <Transition name="tooltip">
        <span
          v-if="visible && !disabled"
          :id="tooltipId"
          ref="contentEl"
          class="tooltip-content"
          :class="`tooltip-content--${effectivePlacement}`"
          :style="contentStyle"
          role="tooltip"
        >
          <slot name="html">
            <span>{{ text }}</span>
          </slot>
        </span>
      </Transition>
    </Teleport>
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
const rootEl = ref<HTMLElement>()
const contentEl = ref<HTMLElement>()
const effectivePlacement = ref<TooltipPlacement>(props.placement)
const position = reactive({ left: 0, top: 0 })
let timeout: ReturnType<typeof setTimeout> | undefined

const contentStyle = computed<CSSProperties>(() => ({
  left: `${position.left}px`,
  top: `${position.top}px`,
}))

const updatePosition = () => {
  if (!visible.value || rootEl.value === undefined || contentEl.value === undefined) return

  const gap = 8
  const viewportPadding = 8
  const anchorRect = rootEl.value.getBoundingClientRect()
  const contentWidth = contentEl.value.offsetWidth
  const contentHeight = contentEl.value.offsetHeight
  const topSpace = anchorRect.top
  const bottomSpace = window.innerHeight - anchorRect.bottom
  let nextPlacement = props.placement

  if (nextPlacement === 'top' && topSpace < contentHeight + gap && bottomSpace > topSpace)
    nextPlacement = 'bottom'
  else if (
    nextPlacement === 'bottom' &&
    bottomSpace < contentHeight + gap &&
    topSpace > bottomSpace
  )
    nextPlacement = 'top'

  effectivePlacement.value = nextPlacement

  const center = anchorRect.left + anchorRect.width / 2
  const halfWidth = Math.min(contentWidth / 2, (window.innerWidth - viewportPadding * 2) / 2)
  const minLeft = viewportPadding + halfWidth
  const maxLeft = window.innerWidth - viewportPadding - halfWidth

  position.left = Math.min(Math.max(center, minLeft), maxLeft)
  position.top = nextPlacement === 'top' ? anchorRect.top - gap : anchorRect.bottom + gap
}

const show = () => {
  if (props.disabled) return
  if (timeout !== undefined) clearTimeout(timeout)
  timeout = setTimeout(() => {
    visible.value = true
    timeout = undefined
    nextTick(updatePosition)
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

useEventListener(window, 'resize', updatePosition)
useEventListener(window, 'scroll', updatePosition, { capture: true })
watch(
  () => props.placement,
  () => nextTick(updatePosition),
)

onBeforeUnmount(hide)

defineExpose({ hide })
</script>

<style scoped>
.tooltip-root {
  position: relative;
  display: inline-flex;
}

.tooltip-content {
  --tooltip-max-width: 40rem;

  position: fixed;
  z-index: var(--z-tooltip);
  box-sizing: border-box;
  width: max-content;
  max-width: min(var(--tooltip-max-width), calc(100vw - var(--space-4)));
  padding: var(--space-2);
  color: var(--color-text);
  font-family: var(--font-family-sans);
  font-size: 0.9375rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  pointer-events: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transform: translateX(-50%);
}

.tooltip-content :deep(strong),
.tooltip-content :deep(b) {
  color: var(--color-action-primary);
  font-weight: 700;
}

.tooltip-content :deep(em),
.tooltip-content :deep(i) {
  color: color-mix(in srgb, var(--color-text) 70%, var(--color-action-primary));
  font-style: italic;
  font-weight: 500;
}

.tooltip-content--top {
  transform: translate(-50%, -100%);
  transform-origin: bottom center;
}

.tooltip-content--bottom {
  transform: translate(-50%, 0);
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
  transform: translate(-50%, calc(-100% + var(--space-1))) scale(0.97);
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
