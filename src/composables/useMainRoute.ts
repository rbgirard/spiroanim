// src\composables\SpiroAnim\useMainRoute.ts

import { useQSMainStore } from '@/stores/useQSMainStore'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useSplitterStore } from '@/stores/useSplitterStore'
import { useMainPaneStore } from '@/stores/useMainPaneStore'

import { findKeyByValue } from '@/utils/UtilFunc'
import { rootFinal } from '@/math/animation/PlayerFunc'
import { tmpProp } from '@/domain/animation/tmpProp'
//import { encodeReadable } from '@/func/AnimReadableFunc'

const possib = ['play', 'time', 'edit'] as const

// Build all combo's for the two panes (also used in router/index.ts)
export const paneSplits: string[] = possib.flatMap((a) =>
  possib.filter((b) => a !== b).map((b) => `/${a}-${b}`),
)

const shortTo = {
  play: 'player',
  edit: 'editor',
  time: 'timeline',
} as const

type shortKey = keyof typeof shortTo
type PageNames = (typeof shortTo)[shortKey]

export function useMainRoute() {
  const qsStore = useQSMainStore()
  const { encodeQS, decodeVer } = qsStore
  const { qsPause } = storeToRefs(qsStore)

  const playerStore = usePlayerStore('main')
  const { ROOT } = playerStore.raw()
  const { leftPerc } = storeToRefs(useSplitterStore('main'))

  const paneStore = useMainPaneStore()
  const { rotatePane, setViewInPane } = paneStore
  const { parents } = storeToRefs(paneStore)

  const router = useRouter()
  const route = useRoute()

  const page = route.path.substring(1) as PageNames

  // Just in case something funky happened in the local storage
  if (!findKeyByValue(parents.value, 'left')) rotatePane('left')
  if (!findKeyByValue(parents.value, 'right')) rotatePane('right')

  // Update panes and splitter for the requested page
  if (page && (page as string) != 'app')
    if (page.includes('-')) {
      // '-' splits short versions of the views
      const parts = page.split('-')
      const left = shortTo[parts[0] as shortKey]
      const right = shortTo[parts[1] as shortKey]

      if (left in parents.value) setViewInPane(left, 'left')
      if (right in parents.value) setViewInPane(right, 'right')

      if (leftPerc.value == 0 || leftPerc.value == 100) leftPerc.value = 50
    } else if (parents.value[page]) {
      // assume its the full view name
      switch (parents.value[page]) {
        case 'hidden':
          setViewInPane(page, 'left')
        // fall through to apply leftPerc = 100
        case 'left':
          leftPerc.value = 100
          break
        case 'right':
          leftPerc.value = 0
          break
      }
    }

  // Snapshot route state to avoid race conditions from simultaneous watcher updates
  let path = route.path
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

  const updatePath = () => {
    let newPath
    const left = findKeyByValue(parents.value, 'left')
    const right = findKeyByValue(parents.value, 'right')

    //console.log('change', left, right)

    if (leftPerc.value == 100) newPath = left
    else if (leftPerc.value == 0) newPath = right
    else newPath = findKeyByValue(shortTo, left) + '-' + findKeyByValue(shortTo, right)

    if (newPath)
      router.replace({
        path: (path = `/${String(newPath)}`),
        query: /*route.*/ query,
        hash: route.hash,
        force: true,
      })
  }

  // Update path if page is / or app
  if (!page || (page as string) == 'app') updatePath()

  // Watch for view/pane changes
  watch(parents, updatePath)

  // Watch for "snap" values from the splitter
  watch(leftPerc, (nval, oval) => {
    const wasEdge = oval === 0 || oval === 100
    const isEdge = nval === 0 || nval === 100
    if (wasEdge !== isEdge) updatePath()
  })

  // Update query string when data changes
  watch(ROOT, (val) => {
    if (!qsPause.value)
      router.replace({
        path: /*route.*/ path,
        query: (query = encodeQS(val)),
        hash: route.hash,
        force: true,
      })
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

  // Load data from query string
  let loaded = false
  if (route.query.r !== undefined) {
    decodeVer(route.query).then((data) => (ROOT.value = data))
    loaded = true
  }

  // Load the default animation
  if (!loaded) ROOT.value = rootFinal(tmpProp)
}
