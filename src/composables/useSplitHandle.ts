/*
  Drag / Drop for resizing the left (or top in portrait) element within a parent element.
  This allows us to resize two objects inside a parent.
  emit sends a new percentage for adjustments to be made.
*/

import { useViewportStore } from '@/stores/useViewportStore'

type Dimensions = { width: number; height: number }

type EmitFn = (event: 'perc', value: number) => void

type IconMap = {
  vertical: string
  horizontal: string
  close: string
}

const { isVisible } = storeToRefs(useViewportStore())

export function useSplitHandle({
  parent,
  object,
  landscape,
  emit,
  element,
  iconMap,
  offset = 15,
  snapBack = 5,
  zIndex = 1010,
  //str = 'main',
}: {
  parent: Ref<Dimensions>
  object: Ref<Dimensions>
  landscape: Ref<boolean>
  emit: EmitFn
  element: Ref<HTMLElement | undefined>
  iconMap: IconMap
  offset?: number
  snapBack?: number
  zIndex?: number
  //str?: string
}) {
  const snap = Math.max(5, Math.min(snapBack, 50))

  const perc = ref(0)
  const pos = reactive({ left: 0, top: 0 })

  let dragging = false
  let IX = 0
  let IY = 0
  let animationFrameId: number | null = null

  const resize = () => {
    const width = object.value.width
    const height = object.value.height
    if (landscape.value) {
      pos.top = 0
      pos.left = width
    } else {
      pos.left = 0
      pos.top = height
    }
    setPerc()
  }

  const setPerc = () => {
    const width = parent.value.width
    const height = parent.value.height
    const left = pos.left
    const top = pos.top
    perc.value = Math.round((landscape.value ? left / width : top / height) * 100)
  }

  const dragStart = (e: MouseEvent | TouchEvent) => {
    if (perc.value == 100) {
      emit('perc', 100 - snap)
      return
    } else if (perc.value == 0) {
      emit('perc', snap)
      return
    }

    dragging = true
    IX = e instanceof TouchEvent ? e.touches[0]!.clientX : e.clientX
    IY = e instanceof TouchEvent ? e.touches[0]!.clientY : e.clientY

    document.addEventListener('mousemove', dragMove)
    document.addEventListener('touchmove', dragMove, { passive: false })
    document.addEventListener('mouseup', dragEnd)
    document.addEventListener('touchend', dragEnd, { passive: false })
  }

  const dragCancel = () => {
    dragging = false
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    document.removeEventListener('mousemove', dragMove)
    document.removeEventListener('touchmove', dragMove)
    document.removeEventListener('mouseup', dragEnd)
    document.removeEventListener('touchend', dragEnd)
  }

  const dragMove = (e: MouseEvent | TouchEvent) => {
    if (!dragging) return

    const cX = e instanceof TouchEvent ? e.touches[0]!.clientX : e.clientX
    const cY = e instanceof TouchEvent ? e.touches[0]!.clientY : e.clientY
    const dX = cX - IX
    const dY = cY - IY

    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(() => {
        if (landscape.value) pos.left += dX
        else pos.top += dY

        IX = cX
        IY = cY
        animationFrameId = null
      })
    }
  }

  const dragEnd = () => {
    setPerc()
    perc.value = Math.max(0, Math.min(perc.value, 100))
    dragCancel()
    emit('perc', perc.value)
    resize()
  }

  const icon = computed(() => {
    return perc.value <= 0 || perc.value >= 100
      ? iconMap.close
      : landscape.value
        ? iconMap.vertical
        : iconMap.horizontal
  })

  const updateStyle = () => {
    const halfWidth = element.value?.offsetWidth ? element.value.offsetWidth / 2 : offset
    const halfHeight = element.value?.offsetHeight ? element.value.offsetHeight / 2 : offset
    const horizontalInset = Math.min(halfWidth, parent.value.width / 2)
    const verticalInset = Math.min(halfHeight, parent.value.height / 2)

    if (landscape.value) {
      iconStyle.top = '50%'
      iconStyle.left =
        Math.min(Math.max(pos.left, horizontalInset), parent.value.width - horizontalInset) + 'px'
    } else {
      iconStyle.left = '50%'
      iconStyle.top =
        Math.min(Math.max(pos.top, verticalInset), parent.value.height - verticalInset) + 'px'
    }
  }

  const iconStyle = reactive<CSSProperties>({
    left: '50%',
    top: '50%',
    transition: 'none',
    transform: 'translateY(-50%) translateX(-50%)',
    position: 'absolute',
    zIndex: zIndex,
  })

  // Did it this way because @mousedown without .passive throws a warning in Chrome and will drive me nuts
  // Keeping .passive doesn't allow .prevent to work, and elements under the button were otherwise being clicked
  onMounted(() => {
    useEventListener(element, 'touchstart', handleTouchStart, { passive: false })
    updateStyle()
  })

  onBeforeUnmount(() => {
    if (dragging) dragCancel()
  })

  // See onMounted comment
  const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    dragStart(e)
  }

  watchImmediate([object, parent], resize)
  watchImmediate(pos, updateStyle)

  watch(isVisible, (val) => {
    if (!val && dragging) dragEnd()
  })

  return {
    dragStart,
    iconStyle,
    icon,
  }
}
