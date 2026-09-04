// src\composables\SpiroAnim\useMainRoute.ts

import { useQSMainStore } from '@/stores/useQSMainStore'
import { useQueryVersionStore } from '@/stores/useQueryVersionStore'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useSplitterStore } from '@/stores/useSplitterStore'
import { useMainPaneStore, viewKeysMain } from '@/stores/useMainPaneStore'
import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { findConceptForPath, fullPathByConcept } from '@/features/concepts/conceptRoutes'
import type { RootDataFinal } from '@/types/AnimTypes'

import { findKeyByValue } from '@/utils/UtilFunc'
import { UnsupportedSpiroAnimQSVersionError } from '@/services/query/versions'
//import { encodeReadable } from '@/func/AnimReadableFunc'

const routeKeys = ['play', 'time', 'edit', 'cnc', 'vtg', 'qtr', '8stp', 'qst', 'tka'] as const

const shortToView = {
  play: 'player',
  edit: 'editor',
  time: 'timeline',
  cnc: 'concepts',
  vtg: 'concepts',
  qtr: 'concepts',
  '8stp': 'concepts',
  qst: 'concepts',
  tka: 'concepts',
} as const

type MainView = (typeof viewKeysMain)[number]
type ShortKey = keyof typeof shortToView

const fullToView = {
  player: 'player',
  editor: 'editor',
  timeline: 'timeline',
  concepts: 'concepts',
  'vulcan-tech-gospel': 'concepts',
  quarterspacing: 'concepts',
  'eight-step': 'concepts',
  'quarter-space-tech': 'concepts',
  'the-kinetic-alphabet': 'concepts',
} as const satisfies Record<string, MainView>

type FullKey = keyof typeof fullToView

const isShortKey = (value: string): value is ShortKey => value in shortToView
const isFullKey = (value: string): value is FullKey => value in fullToView
// Build all combo's for the two panes (also used in router/index.ts)
export const paneSplits: string[] = routeKeys.flatMap((a) =>
  routeKeys.filter((b) => shortToView[a] !== shortToView[b]).map((b) => `/${a}-${b}`),
)

export function useMainRoute() {
  const qsStore = useQSMainStore()
  const queryVersionStore = useQueryVersionStore()
  const { encodeQS, decodeVer } = qsStore
  const { qsPause } = storeToRefs(qsStore)

  const playerStore = usePlayerStore('main')
  const { ROOT } = playerStore.raw()
  const { leftPerc } = storeToRefs(useSplitterStore('main'))

  const paneStore = useMainPaneStore()
  const { rotatePane, setViewInPane } = paneStore
  const { parents, isPaneHijacked } = storeToRefs(paneStore)
  const conceptsStore = useConceptsStore()
  const { selectedConcept, qtrEnabled, selectedQuickSlot, quickSlotPaths } =
    storeToRefs(conceptsStore)
  const { unsupportedVersion } = storeToRefs(queryVersionStore)

  const router = useRouter()
  const route = useRoute()
  const selectedQuickSlotPath =
    selectedQuickSlot.value === null
      ? undefined
      : (quickSlotPaths.value[selectedQuickSlot.value - 1] ?? undefined)
  const selectedQuickSlotQuery = selectedQuickSlotPath
    ? Object.fromEntries(new URLSearchParams(selectedQuickSlotPath.split('?', 2)[1] ?? ''))
    : undefined
  const startupQuickSlot =
    route.query.r === undefined &&
    ROOT.value.props.length === 0 &&
    selectedQuickSlot.value !== null &&
    selectedQuickSlotPath !== undefined &&
    selectedQuickSlotQuery?.r !== undefined
      ? {
          slot: selectedQuickSlot.value,
          path: selectedQuickSlotPath,
          query: selectedQuickSlotQuery,
        }
      : undefined
  const animationReady = ref(route.query.r === undefined && startupQuickSlot === undefined)

  const createQuickSlotPath = (sourcePath: string): string => {
    const pageParts = sourcePath.substring(1).split('-')
    if (pageParts.includes('time')) return sourcePath

    const editorIndex = pageParts.indexOf('edit')
    if (editorIndex !== -1) {
      pageParts[editorIndex] = 'time'
      return `/${pageParts.join('-')}`
    }

    return sourcePath === '/editor' ? '/timeline' : sourcePath
  }

  const startupQuickSlotPath = startupQuickSlot?.path.split(/[?#]/, 1)[0]
  const requestedPath =
    startupQuickSlotPath && (route.path === '/' || route.path === '/app')
      ? startupQuickSlotPath
      : route.path
  const page = requestedPath.substring(1)

  // Just in case something funky happened in the local storage
  if (!findKeyByValue(parents.value, 'left')) rotatePane('left')
  if (!findKeyByValue(parents.value, 'right')) rotatePane('right')

  let shouldCanonicalizeConceptRoute = false

  // Update panes, selected concept, and splitter for the requested page.
  if (page && page !== 'app')
    if (isFullKey(page)) {
      const view = fullToView[page]
      const conceptRoute = findConceptForPath(page)
      if (conceptRoute) {
        selectedConcept.value = conceptRoute.concept
        qtrEnabled.value = conceptRoute.qtrEnabled
      }
      shouldCanonicalizeConceptRoute = page === 'concepts' || page === 'quarterspacing'

      switch (parents.value[view]) {
        case 'hidden':
          setViewInPane(view, 'left')
        // fall through to apply leftPerc = 100
        case 'left':
          leftPerc.value = 100
          break
        case 'right':
          leftPerc.value = 0
          break
      }
    } else if (page.includes('-')) {
      // '-' splits short versions of the views
      const parts = page.split('-')
      const leftKey = parts[0]
      const rightKey = parts[1]

      if (leftKey && rightKey && isShortKey(leftKey) && isShortKey(rightKey)) {
        const left = shortToView[leftKey]
        const right = shortToView[rightKey]

        const conceptRoute = findConceptForPath(page)
        if (conceptRoute) {
          selectedConcept.value = conceptRoute.concept
          qtrEnabled.value = conceptRoute.qtrEnabled
        }
        shouldCanonicalizeConceptRoute =
          leftKey === 'cnc' || rightKey === 'cnc' || leftKey === 'qtr' || rightKey === 'qtr'

        setViewInPane(left, 'left')
        setViewInPane(right, 'right')

        if (leftPerc.value == 0 || leftPerc.value == 100) leftPerc.value = 50
      }
    }

  // Snapshot route state to avoid race conditions from simultaneous watcher updates
  let path = requestedPath
  let query = route.query

  // These are unnecessary, but just in case they're updated elsewhere
  watch(
    () => route.path,
    (val) => (path = val),
  )
  watch(
    () => route.query,
    (val) => (query = val),
  )

  const shortForView = (view: MainView) => {
    switch (view) {
      case 'player':
        return 'play'
      case 'editor':
        return 'edit'
      case 'timeline':
        return 'time'
      case 'concepts':
        return selectedConcept.value
    }
  }

  const createQuickSlotAnimationPath = (animation: RootDataFinal): string =>
    router.resolve({
      path: createQuickSlotPath(path),
      query: encodeQS(animation, false),
    }).fullPath

  const saveCurrentPatternToQuickSlot = (slot: number) => {
    if (
      selectedQuickSlot.value !== slot ||
      slot < 1 ||
      slot > quickSlotPaths.value.length ||
      quickSlotPaths.value[slot - 1] !== null
    )
      return

    conceptsStore.saveCurrentQuickSlot(createQuickSlotAnimationPath(ROOT.value))
  }

  const saveAnimationsToQuickSlots = (animations: readonly RootDataFinal[]) =>
    conceptsStore.replaceQuickSlots(animations.map(createQuickSlotAnimationPath))

  const animationQueryFromPath = (animationPath: string | null | undefined) =>
    animationPath?.split('?', 2)[1]?.split('#', 1)[0]
  let lastObservedAnimationQuery = animationQueryFromPath(createQuickSlotAnimationPath(ROOT.value))

  const updatePath = (allowWhilePaneHijacked = false) => {
    if (isPaneHijacked.value && !allowWhilePaneHijacked) return

    let newPath: string | null = null
    const left = findKeyByValue(parents.value, 'left')
    const right = findKeyByValue(parents.value, 'right')

    //console.log('change', left, right)

    const fullConceptPath = fullPathByConcept[selectedConcept.value]

    if (leftPerc.value == 100 && left) newPath = left === 'concepts' ? fullConceptPath : left
    else if (leftPerc.value == 0 && right) newPath = right === 'concepts' ? fullConceptPath : right
    else if (left && right) newPath = `${shortForView(left)}-${shortForView(right)}`

    if (newPath)
      router.replace({
        path: (path = `/${String(newPath)}`),
        query: /*route.*/ query,
        hash: route.hash,
        force: true,
      })
  }

  const showConceptsForEmptyAnimation = () => {
    if (
      !animationReady.value ||
      unsupportedVersion.value !== undefined ||
      ROOT.value.props.length > 0
    )
      return false

    setViewInPane('player', 'left')
    setViewInPane('concepts', 'right')
    leftPerc.value = 50
    return true
  }

  const switchedToConcepts = showConceptsForEmptyAnimation()

  // Update generic concept routes to the selected child and keep startup routes canonical.
  if (!page || page === 'app' || switchedToConcepts || shouldCanonicalizeConceptRoute) updatePath()

  // Watch for view/pane changes
  watch(parents, () => updatePath())

  // The selected child is part of the shareable pane layout path.
  // A Builder/Viewer pane is only a temporary overlay, so concept switches can still derive their
  // route from the unchanged underlying pane layout while that overlay is active.
  watch(selectedConcept, () => updatePath(true))

  // The route owns Quick Slot reconciliation, and slot identity depends only on the serialized
  // animation query. Path-only changes such as switching concepts or rearranging panes must not
  // clear an intentionally selected empty slot.
  watch(
    () => route.fullPath.split('?', 2)[1]?.split('#', 1)[0],
    (animationQuery) => {
      if (animationQuery && new URLSearchParams(animationQuery).has('r')) {
        conceptsStore.selectQuickSlotForPath(`?${animationQuery}`)
      }
    },
    { immediate: true },
  )

  // Watch for "snap" values from the splitter
  watch(leftPerc, (nval, oval) => {
    const wasEdge = oval === 0 || oval === 100
    const isEdge = nval === 0 || nval === 100
    if (wasEdge !== isEdge) updatePath()
  })

  // Update query string when data changes
  watch(ROOT, (val) => {
    if (!qsPause.value) {
      router.replace({
        path: /*route.*/ path,
        query: (query = encodeQS(val)),
        hash: route.hash,
        force: true,
      })
      const quickSlotAnimationPath = createQuickSlotAnimationPath(val)
      const quickSlotAnimationQuery = animationQueryFromPath(quickSlotAnimationPath)
      const animationChanged = quickSlotAnimationQuery !== lastObservedAnimationQuery
      lastObservedAnimationQuery = quickSlotAnimationQuery
      const currentQuickSlotPath =
        selectedQuickSlot.value === null
          ? undefined
          : quickSlotPaths.value[selectedQuickSlot.value - 1]
      if (
        animationChanged &&
        animationQueryFromPath(currentQuickSlotPath) !== quickSlotAnimationQuery
      ) {
        conceptsStore.saveCurrentQuickSlot(quickSlotAnimationPath)
      }
    }
  })

  /*
  // Dump the data to console in JSON
  watch(
    () => route.query,
    () => {
      console.log(JSON.stringify(encodeReadable(toRaw(ROOT.value)), null, 2))
    }
  )
  */

  // A persisted Quick Slot gets the same startup priority as animation data in the URL. Keeping
  // animationReady false until it loads prevents an empty concept pane from selecting a random
  // pattern and overwriting the slot before restoration finishes.
  const initialAnimationQuery =
    route.query.r !== undefined
      ? { query: route.query, source: 'route' as const }
      : startupQuickSlot
        ? { query: startupQuickSlot.query, source: 'quick-slot' as const }
        : undefined

  if (initialAnimationQuery) {
    decodeVer(initialAnimationQuery.query)
      .then((data) => {
        if (startupQuickSlot) {
          const conceptRoute = findConceptForPath(startupQuickSlot.path)
          if (conceptRoute) {
            selectedConcept.value = conceptRoute.concept
            qtrEnabled.value = conceptRoute.qtrEnabled
          }
          selectedQuickSlot.value = startupQuickSlot.slot
        }
        ROOT.value = data
      })
      .catch((error: unknown) => {
        if (error instanceof UnsupportedSpiroAnimQSVersionError) {
          queryVersionStore.reportUnsupportedVersion(error.version)
        }
        if (initialAnimationQuery.source === 'quick-slot') selectedQuickSlot.value = null
        console.warn(
          initialAnimationQuery.source === 'route'
            ? 'Failed to load animation data from the route.'
            : 'Failed to load animation data from the selected Quick Slot.',
          error,
        )
      })
      .finally(() => {
        if (unsupportedVersion.value !== undefined) return

        animationReady.value = true
        if (showConceptsForEmptyAnimation()) updatePath()
      })
  }

  return {
    animationReady: readonly(animationReady),
    saveCurrentPatternToQuickSlot,
    saveAnimationsToQuickSlots,
  }
}
