/**
 * Represents a basic width/height shape.
 */
type Dimensions = { width: number; height: number; perc: number }

/**
 * Generic keys for identifying panes and views.
 */
type PaneKey = string
type ElementType = string

/**
 * Provides reactive dimensions for a view based on its currently assigned pane.
 *
 * This is useful when views are dynamically reassigned to different panes,
 * and components need to reactively adapt to the pane they are currently rendered in.
 *
 * @param view - The view name (e.g., 'player', 'editor').
 * @param parents - A reactive mapping of each view to its currently assigned pane.
 * @param paneDimensions - A mapping of pane keys to their current dimensions (width & height).
 * @returns A reactive object with the current width and height of the pane this view is assigned to.
 */
export function useViewDimensions(
  view: ElementType,
  parents: Ref<Record<ElementType, PaneKey>>,
  paneDimensions: Record<PaneKey, Ref<Dimensions>>,
) {
  // Tracks which pane this view is currently assigned to
  const currentPane = computed(() => parents.value[view])

  // Reactive dimensions object to be consumed by the component
  const dimensions = reactive({
    width: 0,
    height: 0,
    perc: 0,
  })

  // Updates dimensions whenever the pane assignment or pane size changes
  watchEffect(() => {
    const pane = currentPane.value
    const paneDims = pane === undefined ? undefined : paneDimensions[pane]
    if (paneDims) {
      dimensions.width = paneDims.value.width
      dimensions.height = paneDims.value.height
      dimensions.perc = paneDims.value.perc
    } else {
      // Default to 0 if no matching pane dimensions are found
      dimensions.width = 0
      dimensions.height = 0
      dimensions.perc = 0
    }
  })

  return dimensions
}
