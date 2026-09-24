import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useProperties } from '@/features/editor/composables/useProperties'
import { usePropertiesStore } from '@/features/editor/stores/usePropertiesStore'
import { useEditorAccessStore } from '@/features/editor/stores/useEditorAccessStore'
import { cartesianToMotionAngles, createMotionDirectionState } from '@/math/animation/MotionFunc'
import { usePlayerStore } from '@/stores/usePlayerStore'

const activatePersistedPinia = () => {
  const pinia = createPinia().use(piniaPluginPersistedstate)
  createApp({}).use(pinia)
  setActivePinia(pinia)
}

describe('usePropertiesStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    useEditorAccessStore().editorLoaded = true
  })

  async function createPopulatedStore(id: string) {
    const player = usePlayerStore(id)
    const runtime = player.raw()
    runtime.ROOT.value = {
      ...runtime.ROOT.value,
      bpm: 60,
      props: [{ anim: [{ arc: 45, beats: 1 }, { beats: 1 }], motion: [] }],
    }
    await nextTick()
    return { player, properties: usePropertiesStore(id) }
  }

  it('shows every prop time until Editor has loaded in the session', async () => {
    setActivePinia(createPinia())
    const player = usePlayerStore('timeline-before-editor')
    player.raw().ROOT.value = {
      ...player.raw().ROOT.value,
      bpm: 60,
      props: [
        { anim: [{ beats: 1 }, {}], motion: [] },
        { anim: [{ beats: 0.5 }, { beats: 1.5 }, {}], motion: [] },
      ],
    }
    const properties = usePropertiesStore('timeline-before-editor')
    properties.pSELECTED = { 0: true, 1: false }
    await nextTick()

    expect(player.ETIMES).toEqual([0, 500, 1000, 2000])

    useEditorAccessStore().editorLoaded = true
    await nextTick()

    expect(player.ETIMES).toEqual([0, 1000, 2000])
  })

  it('derives the active property and animation from the player selection', async () => {
    const { properties } = await createPopulatedStore('editor-selection')

    expect(properties.ACTIVE).toEqual([0])
    expect(properties.PROPS).toHaveLength(1)
    expect(properties.ANIMS).toHaveLength(1)
    expect(properties.IDENT).toEqual([{ prop: 0, index: 0 }])
    expect(properties.ARCDENOM).toBe(45)

    properties.pBOUND = false
    usePlayerStore('editor-selection').SELECTION = true
    usePlayerStore('editor-selection').SELECTED = [0, 1]
    await nextTick()

    expect(properties.ANIMS).toHaveLength(2)
    expect(properties.IDENT).toEqual([
      { prop: 0, index: 0 },
      { prop: 0, index: 1 },
    ])
  })

  it('updates the selected animation through the editor composable', async () => {
    const { player } = await createPopulatedStore('editor-update')
    const editor = useProperties('editor-update')
    player.PLAYING = false

    editor.animSet('beats', 2)

    expect(player.raw().ROOT.value.props[0]!.anim[0]!.beats).toBe(2)
    expect(editor.animGet('beats')).toEqual([2, true, '2', false])

    editor.animSet('twist', 100)
    await nextTick()

    expect(player.raw().ROOT.value.props[0]!.anim[0]!.twist).toBe(100)
    expect(player.raw().COMPILED.value.props[0]!.anim[0]).toMatchObject({
      twist: 100,
      twistRoll: 100,
    })
    expect(editor.animGet('twist')).toEqual([100, true, '100°', false])
  })

  it('retains Editor Scale edits as manual VTG intent', async () => {
    const { player } = await createPopulatedStore('editor-vtg-scale')
    player.raw().ROOT.value.vtgScale = { auto: true, base: 0.9, mode: 'simple' }
    player.PLAYING = false
    useProperties('editor-vtg-scale').animSet('scale', 65)
    expect(player.raw().ROOT.value.vtgScale).toEqual({ auto: false, base: 0.9, mode: 'advanced' })
    expect(player.raw().ROOT.value.props[0]!.anim[0]!.scale).toBe(65)
  })

  it('uses independent Motion timing and edits Motion without changing Animation', async () => {
    const player = usePlayerStore('editor-motion')
    const runtime = player.raw()
    runtime.ROOT.value = {
      ...runtime.ROOT.value,
      bpm: 60,
      props: [
        {
          anim: [{ beats: 1 }, { beats: 1 }, { beats: 1 }],
          motion: [{ beats: 1, plane: 0, arc: 90, distance: 2 }],
        },
      ],
    }
    await nextTick()

    const properties = usePropertiesStore('editor-motion')
    properties.pFRAMES = 'motion'
    await nextTick()

    expect(player.ETIMES).toEqual([0, 2000])
    expect(properties.MOTIONS).toEqual([{ beats: 1, plane: 0, arc: 90, distance: 2 }])

    player.PLAYING = false
    useProperties('editor-motion').motionSet('movexyz', [4, 0, 0])
    expect(runtime.ROOT.value.props[0]!.motion[0]).toEqual({
      beats: 1,
      plane: 0,
      arc: 90,
      distance: 4,
    })
    expect(runtime.ROOT.value.props[0]!.anim).toEqual([{ beats: 1 }, { beats: 1 }, { beats: 1 }])
  })

  it('edits inherited Precision for Motion and Camera paths', async () => {
    const storeId = 'editor-motion-precision'
    const player = usePlayerStore(storeId)
    const runtime = player.raw()
    runtime.ROOT.value = {
      ...runtime.ROOT.value,
      camera: [{ orbit: { beats: 1, distance: 20 }, center: { distance: 10 } }],
      props: [{ anim: [{}], motion: [{ distance: 10 }, { distance: 20 }] }],
    }
    const properties = usePropertiesStore(storeId)
    const editor = useProperties(storeId)
    player.PLAYING = false

    properties.pFRAMES = 'motion'
    await nextTick()
    editor.motionSet('precision', true)
    await nextTick()

    expect(runtime.ROOT.value.props[0]!.motion[0]!.precision).toBe(true)
    expect(runtime.COMPILED.value.props[0]!.motion[0]).toMatchObject({
      precision: true,
      distance: 10,
      offset: [0, -1, 0],
    })
    expect(editor.motionGet('precision')).toEqual([true, true, 'true', false])

    properties.pFRAMES = 'camera'
    await nextTick()
    editor.cameraPathSet('orbit', 'precision', true)
    editor.cameraPathSet('center', 'precision', true)
    await nextTick()

    expect(runtime.ROOT.value.camera[0]).toMatchObject({
      orbit: { precision: true },
      center: { precision: true },
    })
    expect(runtime.COMPILED.value.camera[0]).toMatchObject({
      orbit: { precision: true, distance: 20, offset: [0, -2, 0] },
      center: { precision: true, distance: 10, offset: [0, -1, 0] },
    })
  })

  it('derives displayed Motion times from selected props and can show every prop', async () => {
    const storeId = 'editor-selected-motion-times'
    const player = usePlayerStore(storeId)
    player.raw().ROOT.value = {
      ...player.raw().ROOT.value,
      bpm: 60,
      props: [
        {
          anim: [{ beats: 1 }, { beats: 1 }, { beats: 2 }, {}],
          motion: [{ beats: 1 }, {}],
        },
        {
          anim: [{ beats: 0.5 }, { beats: 3.5 }, {}],
          motion: [{ beats: 2 }, {}],
        },
      ],
    }
    await nextTick()

    const properties = usePropertiesStore(storeId)
    properties.pFRAMES = 'motion'
    properties.pMULTI = true
    properties.pSELECTED = { 0: true, 1: false }
    await nextTick()

    expect(player.ETIMES).toEqual([0, 1000, 4000])

    properties.pSELECTED[0] = false
    properties.pSELECTED[1] = true
    await nextTick()

    expect(player.ETIMES).toEqual([0, 2000, 4000])

    properties.showFullTimeline = true
    await nextTick()

    expect(player.ETIMES).toEqual([0, 500, 1000, 2000, 4000])
    expect(properties.pFRAMES).toBe('motion')
  })

  it('shows the full animation timeline when Camera is selected', async () => {
    const storeId = 'editor-camera-full-timeline'
    const player = usePlayerStore(storeId)
    player.raw().ROOT.value = {
      ...player.raw().ROOT.value,
      bpm: 60,
      camera: [
        { orbit: { ...player.raw().ROOT.value.camera[0]!.orbit, beats: 1 }, center: {} },
        { orbit: {}, center: {} },
      ],
      props: [{ anim: [{ beats: 0.5 }, { beats: 1.5 }, {}], motion: [] }],
    }
    await nextTick()

    const properties = usePropertiesStore(storeId)
    properties.pFRAMES = 'camera'
    await nextTick()

    expect(player.ETIMES).toEqual([0, 1000, 2000])

    properties.showFullTimeline = true
    await nextTick()

    expect(player.ETIMES).toEqual([0, 500, 2000])
    expect(properties.pFRAMES).toBe('camera')
  })

  it('displays an unauthored Move as the inherited zero vector', async () => {
    const storeId = 'editor-motion-zero'
    const player = usePlayerStore(storeId)
    player.raw().ROOT.value = {
      ...player.raw().ROOT.value,
      props: [{ anim: [{}], motion: [{}] }],
    }
    await nextTick()

    const properties = usePropertiesStore(storeId)
    properties.pFRAMES = 'motion'
    await nextTick()

    expect(useProperties(storeId).motionGet('move')).toEqual([
      [0, 0, 0],
      true,
      '0.0, 0.0, 0.0',
      true,
    ])
  })

  it('preserves the next authored Cartesian movement across empty downstream frames', async () => {
    const storeId = 'editor-motion-preserve'
    const player = usePlayerStore(storeId)
    const runtime = player.raw()
    const directionState = createMotionDirectionState()
    const first = cartesianToMotionAngles([2, 0, 0], directionState)
    const next = cartesianToMotionAngles([0, 3, 0], directionState)
    runtime.ROOT.value = {
      ...runtime.ROOT.value,
      bpm: 60,
      props: [
        {
          anim: [{ beats: 1 }, { beats: 1 }, { beats: 1 }],
          motion: [
            { beats: 1, plane: first[0], arc: first[1], distance: first[2] },
            { beats: 1 },
            { plane: next[0], arc: next[1], distance: next[2] },
          ],
        },
      ],
    }
    await nextTick()

    const properties = usePropertiesStore(storeId)
    properties.pFRAMES = 'motion'
    properties.pMOVENEXT = true
    player.PLAYING = false
    await nextTick()

    const nextBefore = [...runtime.COMPILED.value.props[0]!.motion[2]!.move]
    useProperties(storeId).motionSet('movexyzpreserve', [0, 0, -4])
    await nextTick()

    const compiled = runtime.COMPILED.value.props[0]!.motion
    expect(compiled[0]!.move).toEqual([0, 0, -4])
    expect(compiled[1]).toMatchObject({ distance: 0, active: false })
    compiled[2]!.move.forEach((coordinate, index) =>
      expect(coordinate).toBeCloseTo(nextBefore[index]!, 6),
    )
  })

  it('edits the root Camera independently of props through shared Motion controls', async () => {
    const storeId = 'editor-camera'
    const player = usePlayerStore(storeId)
    const runtime = player.raw()
    runtime.ROOT.value = {
      ...runtime.ROOT.value,
      bpm: 60,
      camera: [
        { orbit: { ...runtime.ROOT.value.camera[0]!.orbit, beats: 1 }, center: {} },
        { orbit: {}, center: {} },
      ],
      props: [{ anim: [{ beats: 2 }, {}], motion: [] }],
    }
    await nextTick()

    const properties = usePropertiesStore(storeId)
    properties.pFRAMES = 'camera'
    properties.pSELECTED = { 0: false }
    player.PLAYING = false
    await nextTick()

    expect(player.ETIMES).toEqual([0, 1000, 2000])
    expect(properties.CAMERA_IDENT).toEqual([0])
    expect(properties.CAMERAS).toHaveLength(1)

    const editor = useProperties(storeId)
    editor.cameraPathSet('orbit', 'beats', 3)
    editor.cameraPathSet('center', 'movexyz', [4, 0, 0])
    editor.cameraPathSet('orbit', 'movexyz', [0, 0, -30])
    await nextTick()

    expect(runtime.ROOT.value.camera[0]!.orbit?.beats).toBe(3)
    expect(runtime.COMPILED.value.camera[0]!.orbit.beats).toBe(3)
    expect(runtime.COMPILED.value.camera[0]!.center.move).toEqual([4, 0, 0])
    expect(runtime.COMPILED.value.camera[0]!.orbit.move).toEqual([0, 0, -30])
    expect(runtime.ROOT.value.props[0]!.anim).toEqual([{ beats: 2 }, {}])

    editor.cameraPathSet('orbit', 'move', undefined)
    await nextTick()

    expect(runtime.ROOT.value.camera[0]!.orbit).toEqual({ beats: 3 })
    expect(runtime.COMPILED.value.camera[0]!.orbit.offset).toEqual([0, 0, -22])
    expect(editor.cameraPathGet('orbit', 'move')).toEqual([[0, 0, -22], true, '0, 0, -22', true])

    editor.matchCameraFrameToPose(0, { position: [4, 2, -10], target: [4, 2, 0] })
    await nextTick()

    expect(
      Math.hypot(
        runtime.COMPILED.value.camera[0]!.center.offset[0] - 4,
        runtime.COMPILED.value.camera[0]!.center.offset[1] - 2,
        runtime.COMPILED.value.camera[0]!.center.offset[2],
      ),
    ).toBeLessThan(1)
    expect(runtime.COMPILED.value.camera[0]!.orbit.offset).toEqual([0, 0, -10])

    editor.matchCameraFrameToPose(0, { position: [0, 0, -22], target: [0, 0, 0] })
    await nextTick()
    expect(runtime.ROOT.value.camera[0]).toEqual({ orbit: { beats: 3 }, center: {} })
  })

  it('hydrates only the documented editor preferences', () => {
    localStorage.setItem(
      'sa-properties-editor-persisted',
      JSON.stringify({
        pBOUND: false,
        pMULTI: true,
        pDESKTOP: { root: [] },
        pFRAMES: 'motion',
        pSELECTED: { 4: true },
        pMOVENEXT: true,
        pSHIFT: 2,
      }),
    )
    activatePersistedPinia()

    const store = usePropertiesStore('editor-persisted')

    expect(store.pBOUND).toBe(false)
    expect(store.pMULTI).toBe(true)
    expect(store.pDESKTOP.root).toEqual([])
    expect(store.pDESKTOP.anim).toEqual(['anim'])
    expect(store.pDESKTOP.settings).toEqual(['settings'])
    expect(store.pSELECTED).toEqual({ 0: true })
    expect(store.pFRAMES).toBe('animation')
    expect(store.pMOVENEXT).toBe(true)
    expect(store.pSHIFT).toBe(1)
  })
})
