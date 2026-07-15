// src\stores\panes\createPaneStore.ts

/**
 * Creates a reactive pane management store for dynamically assigning views to panes.
 *
 * This utility is designed to support flexible UI layouts where each "view" (e.g., editor, player, timeline)
 * can be dynamically assigned to a "pane" (e.g., left, right, hidden), and DOM elements are moved accordingly.
 *
 * Key Features:
 * - Dynamically binds views to panes via a `parents` record
 * - Accepts a `defaults` map to specify initial pane assignments (e.g., `{ left: 'player', right: 'timeline' }`)
 * - Maintains element and pane refs (`ePlayer`, `eLeft`, etc.)
 * - Automatically inserts elements into the correct container when rendered
 * - Reactively repositions elements on `parents` changes
 * - Supports rotating visible views within a pane (`rotatePane`)
 * - Supports direct view-to-pane assignment and swapping (`setViewInPane`)
 * - Compatible with persistent layouts using Pinia's `persist` plugin
 *
 * @template Views - Tuple of valid view keys (e.g., ['player', 'editor'])
 * @template Panes - Tuple of pane keys (e.g., ['left', 'right', 'hidden'])
 *
 * @param id - Unique ID used for store naming (`pa-panes-${id}`)
 * @param viewKeys - List of valid view identifiers
 * @param paneKeys - List of valid pane identifiers
 * @param hiddenPane - The name of the pane used to "hide" views not currently shown
 * @param defaults - Mapping of visible panes to their initially assigned views
 *                   (e.g., `{ left: 'player', right: 'timeline' }`). All other views default to hidden.
 *
 * @returns A Pinia store instance with:
 *   - `parents`: A reactive map of each view's assigned pane
 *   - `rotatePane(pane)`: Cycles views assigned to a visible pane
 *   - `setViewInPane(view, pane)`: Assigns or swaps views to panes
 *   - Refs for each view and pane DOM element (e.g. `ePlayer`, `eLeft`)
 *
 * Example usage:
 *   const useMainPaneStore = createPaneStore(
 *     'main',
 *     ['player', 'editor', 'timeline'],
 *     ['left', 'right', 'hidden'],
 *     'hidden',
 *     { left: 'player', right: 'timeline' }
 *   )
 *
 *   useMainPaneStore().setViewInPane('editor', 'right')
 *   useMainPaneStore().rotatePane('left')
 */
export function createPaneStore<
  const Views extends readonly string[],
  const Panes extends readonly string[],
  Hidden extends Panes[number],
>(
  id: string,
  viewKeys: Views,
  paneKeys: Panes,
  hiddenPane: Hidden,
  defaults?: Partial<Record<Exclude<Panes[number], Hidden>, Views[number]>>,
) {
  // Type of individual view name (e.g. 'player' | 'editor')
  type ElementType = Views[number]
  // Type of individual pane name (e.g. 'left' | 'right' | 'hidden')
  type PaneKey = Panes[number]
  // Type of panes that are not the hidden pane
  type VisiblePaneKey = Exclude<PaneKey, Hidden>
  // Maps each view (e.g. 'player', 'editor') to the pane it's currently assigned to (e.g. 'left', 'right', 'hidden')
  type ViewToPaneMap = Record<ElementType, PaneKey>

  // Capitalize a string at runtime (e.g. 'player' → 'Player')
  const capitalize = <T extends string>(str: T): Capitalize<T> =>
    (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>

  // Get a typed view ref key (e.g. 'player' → 'ePlayer')
  const getElementRefKey = (key: ElementType) => `e${capitalize(key)}` as const
  // Get a typed pane ref key (e.g. 'left' → 'eLeft')
  const getPaneRefKey = (key: PaneKey) => `e${capitalize(key)}` as const

  return defineStore(
    `sa-panes-${id}`,
    () => {
      // Create initial parents with Defaults set
      const assignedViews = new Set<ElementType>()
      const initial: ViewToPaneMap = {} as ViewToPaneMap
      for (const view of viewKeys) {
        const pane = Object.entries(defaults ?? {}).find(([, v]) => v === view)?.[0] as
          | PaneKey
          | undefined
        if (pane) assignedViews.add(view)
        initial[view as ElementType] = pane ?? hiddenPane
      }
      const parents = ref<ViewToPaneMap>(initial)

      // Create refs for each view's DOM element (e.g. ePlayer, eEditor)
      const elementRefs = Object.fromEntries(
        viewKeys.map((v) => [`e${capitalize(v)}`, ref<HTMLElement>()]),
      ) as Record<`e${Capitalize<ElementType>}`, Ref<HTMLElementUndef>>

      // Create refs for each pane container element (e.g. eLeft, eRight)
      const paneRefs = Object.fromEntries(
        paneKeys.map((p) => [`e${capitalize(p)}`, ref<HTMLElement>()]),
      ) as Record<`e${Capitalize<PaneKey>}`, Ref<HTMLElementUndef>>

      // Computed mapping of pane name to DOM element
      const panes = computed(() => {
        const map: Record<PaneKey, HTMLElementUndef> = {} as Record<PaneKey, HTMLElementUndef>
        for (const p of paneKeys) {
          map[p as PaneKey] = paneRefs[getPaneRefKey(p)].value
        }
        return map
      })

      // Core function to move a DOM element to the pane it's assigned to
      const insertIntoPane = (el: HTMLElementUndef) => {
        if (!el) return
        const type = el.dataset.type as ElementType
        if (!viewKeys.includes(type)) return

        const targetPane = parents.value[type] as PaneKey

        // DEBUG: Log when we're about to hide something
        for (const view of viewKeys) {
          if (view !== type && parents.value[view as ElementType] === targetPane) {
            console.warn(`insertIntoPane: Hiding ${view} because ${type} is taking ${targetPane}`)
            console.trace() // Shows call stack
          }
        }

        // Hide any other view currently assigned to the same pane
        for (const view of viewKeys) {
          if (view !== type && parents.value[view as ElementType] === targetPane) {
            parents.value[view as ElementType] = hiddenPane
          }
        }

        // Append the element to the correct pane container
        panes.value[targetPane]?.appendChild(el)
      }

      // Rotate the visible view in a pane to the next eligible one
      const rotatePane = (pane: VisiblePaneKey) => {
        const currentView = viewKeys.find(
          (v: ElementType) => parents.value[v] === pane,
        ) as ElementType
        const currentIndex = currentView ? viewKeys.indexOf(currentView) : -1

        // Find views already visible in other panes
        const used = new Set(
          viewKeys.filter((v: ElementType) => {
            const p = parents.value[v]
            return p !== hiddenPane && p !== pane
          }),
        )

        // Rotate through the queue to find the next valid view
        for (let i = 1; i <= viewKeys.length; i++) {
          const next = viewKeys[(currentIndex + i) % viewKeys.length] as ElementType
          if (!used.has(next)) {
            if (currentView) parents.value[currentView] = hiddenPane
            parents.value[next] = pane
            parents.value = { ...parents.value } // Trigger shallow watchers
            return
          }
        }
      }

      // Assign a specific view to a pane, swapping if necessary
      const setViewInPane = (view: ElementType, pane: VisiblePaneKey) => {
        const currentPane = parents.value[view]
        if (currentPane === pane) return

        // Check if another view is occupying the target pane
        const occupied = viewKeys.find(
          (v: ElementType) => v !== view && parents.value[v] === pane,
        ) as ElementType
        if (occupied) parents.value[occupied] = currentPane

        // Assign desired view to the target pane
        parents.value[view] = pane
        parents.value = { ...parents.value } // Trigger shallow watchers
      }

      // Watch for when a DOM element ref changes (initial render or re-render)
      watch(Object.values(elementRefs) as Ref<HTMLElementUndef>[], (n, o) => {
        for (let i = 0; i < n.length; i++) {
          if (n[i] !== o[i]) insertIntoPane(n[i])
        }
      })

      // Watch for changes in the view-to-pane mapping and reassign DOM accordingly
      watch(
        () => ({ ...parents.value }),
        (n, o) => {
          for (const view of viewKeys) {
            if (n[view as ElementType] !== o[view as ElementType]) {
              const el = elementRefs[getElementRefKey(view)]?.value
              if (el) insertIntoPane(el)
            }
          }
        },
      )

      const paneVisible = ref<Record<VisiblePaneKey, boolean>>(
        Object.fromEntries(paneKeys.map((key) => [key, true])) as Record<VisiblePaneKey, boolean>,
      )

      // Track visibility in the store scope so it survives component unmounts and remounts.
      const viewVisible = computed<Record<ElementType, boolean>>(() => {
        const visibility = {} as Record<ElementType, boolean>
        for (const view of viewKeys) {
          const key = view as ElementType
          const pane = parents.value[key]
          visibility[key] = pane !== hiddenPane && paneVisible.value[pane as VisiblePaneKey]
        }
        return visibility
      })

      return {
        parents,
        ...elementRefs,
        ...paneRefs,
        paneVisible,
        viewVisible: readonly(viewVisible),
        rotatePane,
        setViewInPane,
        registerComponentEl,
      }
    },
    {
      persist: {
        pick: ['parents'], // Persist the view-to-pane mapping
      },
    },
  )
}

function registerComponentEl(
  cRef: Ref<ComponentPublicInstance | undefined>,
  eRef: Ref<HTMLElementUndef>,
) {
  watch(
    () => cRef.value?.$el,
    (el) => (eRef.value = el as HTMLElementUndef),
  )
}
