import { useViewportStore } from '@/stores/useViewportStore'

export function useScrollSelectScale() {
  const viewportStore = useViewportStore()

  // Disables scrollbars and text selection while parent component is mounted

  // The following is in main.css:
  //
  //    .disable-scroll {
  //      overflow: hidden !important; /* Force this to override any existing styles */
  //    }
  //
  //    /* Define class to disable selecting text */
  //    .disable-text-select {
  //      -webkit-touch-callout: none; /* iOS Safari */
  //      -webkit-user-select: none; /* Safari */
  //      -khtml-user-select: none; /* Konqueror HTML */
  //        -moz-user-select: none; /* Firefox */
  //          -ms-user-select: none; /* Internet Explorer/Edge */
  //              user-select: none; /* Non-prefixed version, currently
  //                                    supported by Chrome and Opera */
  //    }

  // Function to update the viewport meta tag and disable scaling
  const updateViewportContent = (add: boolean) => {
    const viewport = document.querySelector('meta[name="viewport"]')
    if (!viewport) return

    const content = viewport.getAttribute('content') || ''
    const suffix = ', maximum-scale=1.0, user-scalable=no'

    // Toggle the suffix based on the `add` parameter
    const newContent = add
      ? content.includes(suffix)
        ? content
        : `${content}${suffix}` // Add suffix if not present
      : content.replace(suffix, '') // Remove suffix if present

    viewport.setAttribute('content', newContent)
  }

  onMounted(() => {
    document.documentElement.classList.add('disable-scroll', 'disable-text-select')
    updateViewportContent(true)

    // Refresh viewport, as the dimensions change without the scrollbar
    requestAnimationFrame(() => viewportStore.updateViewSize())
  })

  onBeforeUnmount(() => {
    document.documentElement.classList.remove('disable-scroll', 'disable-text-select')
    updateViewportContent(false)

    // Same here at unmount
    requestAnimationFrame(() => viewportStore.updateViewSize())
  })
}
