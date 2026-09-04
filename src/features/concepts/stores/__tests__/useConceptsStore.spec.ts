import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp, defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useConceptsStore } from '@/features/concepts/stores/useConceptsStore'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { applyVtgThirdOrderSettings, createVtgThirdOrderWarp } from '@/features/vtg/thirdOrder'
import { resolveAnimationFrames } from '@/math/animation/frameSemantics'

const mountStore = () => {
  const pinia = createPinia().use(piniaPluginPersistedstate)
  setActivePinia(pinia)

  let store: ReturnType<typeof useConceptsStore> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        store = useConceptsStore()
        return () => h('div')
      },
    }),
  )
  app.use(pinia)
  app.mount(document.createElement('div'))

  if (!store) throw new Error('Concepts store was not created')
  return { app, store }
}

describe('useConceptsStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to VTG with shared pattern controls', () => {
    const { app, store } = mountStore()

    expect(store.selectedConcept).toBe('vtg')
    expect(store.quickSlotCount).toBe(0)
    expect(store.selectedQuickSlot).toBeNull()
    expect(store.quickSlotPaths).toEqual([])
    expect(store.vtgAdvanced).toBe(false)
    expect(store.qtrEnabled).toBe(false)
    expect(store.speedRatio).toBe('1:3')
    expect(store.swapProps).toBe(false)
    expect(store.reversePlane).toBe(false)
    expect(store.orientation).toBe(0)
    expect(store.bpm).toBe(40)
    expect(store.scale).toBe(0.8)
    expect(store.thick).toBe(5)
    expect(store.spacing).toBe(1)
    expect(store.paths).toBe(true)
    expect(store.hands).toBe(false)
    expect(store.arms).toBe(true)
    expect(store.leftPropVisible).toBe(true)
    expect(store.rightPropVisible).toBe(true)
    expect(store.leftPropColor).toBe('Cyan')
    expect(store.rightPropColor).toBe('Green')
    expect(store.prop).toBe(2)
    expect(store.sliders).toBe(true)
    expect(store.customizeExpanded).toBe(false)
    expect(store.classicLayout).toBe(true)
    expect(store.elementalLayout).toBe(false)
    expect(store.vtgTwistMode).toBe('simple')
    expect(store.vtgTwistValues).toEqual([{}, {}])
    expect(store.vtgThirdOrderSettings).toEqual([{}, {}])
    expect(store.vtgThirdOrderMirror).toBe(true)
    expect(store.vtgThirdOrderOpposed).toBe(false)
    expect(store.vtgFoldValues).toEqual([{}, {}])
    expect(store.vtgFoldValuesMaterialized).toBe(false)
    expect(store.vtgFoldMode).toBe('simple')
    expect(store.vtgFoldBeat).toEqual([2, 2])
    expect(store.vtgFoldRepeat).toEqual([true, true])
    expect(store.vtgFoldEvery).toEqual([2, 2])
    expect(store.vtgFoldAlternate).toEqual([false, false])
    expect(store.vtgFoldSpan).toBe('eighth')
    expect(store.vtgFoldMirror).toBe(true)
    expect(store.vtgActiveProperty).toBeNull()
    app.unmount()
  })

  it('applies the current Twist and Fold controls to a newly selected VTG pattern', () => {
    const { app, store } = mountStore()
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '2:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    store.vtgTwistValues = [{ 0.5: 90, 3: 180 }, {}]
    store.vtgTwistMode = 'advanced'
    store.vtgFoldValues = [{ 2: { yaw: 90, rotate: 180 } }, {}]
    store.vtgFoldMode = 'simple'
    store.vtgFoldSpan = 'quarter'
    store.vtgFoldValuesMaterialized = false

    const applied = store.applyVtgPropertyControls(animation)

    expect(applied.props[0]?.anim[1]?.twist).toBe(90)
    expect(applied.props[0]?.anim[6]?.twist).toBe(180)
    expect(applied.props[0]?.anim[3]).toMatchObject({ yaw: 90, rotate: 90 })
    expect(applied.props[1]?.anim[3]).toMatchObject({ yaw: -90, rotate: -90 })
    expect(store.vtgTwistValues[0]['3']).toBe(180)
    app.unmount()
  })

  it('keeps Third Order settings while applying them to different VTG cells', () => {
    const { app, store } = mountStore()
    const first = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    const second = createDefaultVtgAnimation({ reference: '2-2', speedRatio: '2:3' })
    if (!first || !second) throw new Error('Expected supported VTG animations')
    store.setVtgThirdOrderInitial(0, '1:3-anti')
    store.setVtgThirdOrderStrength(0, 60)
    store.setVtgThirdOrderTiming(0, '2:3-pro')
    store.vtgThirdOrderOpposed = true

    const appliedFirst = store.applyVtgPropertyControls(first)
    const appliedSecond = store.applyVtgPropertyControls(second)
    const resolvedFirst = resolveAnimationFrames(first.props[0]!.anim)
    const resolvedSecond = resolveAnimationFrames(second.props[0]!.anim)

    expect(store.vtgThirdOrderSettings[0]).toEqual({
      initial: '1:3-anti',
      strength: 60,
      timing: '2:3-pro',
    })
    expect(appliedFirst.props[0]?.anim[0]?.strength).toBe(600)
    expect(appliedSecond.props[0]?.anim[0]?.strength).toBe(600)
    expect(appliedFirst.props[1]?.anim[0]?.strength).toBe(600)
    expect(appliedFirst.props[0]?.anim[1]?.warp).toBe(
      createVtgThirdOrderWarp(resolvedFirst[1]!.arc, '2:3-pro'),
    )
    expect(appliedSecond.props[0]?.anim[1]?.warp).toBe(
      createVtgThirdOrderWarp(resolvedSecond[1]!.arc, '2:3-pro'),
    )
    expect(appliedFirst.props[1]?.anim[1]?.warp).toBe(
      createVtgThirdOrderWarp(resolveAnimationFrames(first.props[1]!.anim)[1]!.arc, '2:3-anti'),
    )
    app.unmount()
  })

  it('hydrates Third Order authored values from a loaded animation', () => {
    const { app, store } = mountStore()
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const authored = structuredClone(animation)
    const resolved = resolveAnimationFrames(authored.props[0]!.anim)
    authored.props[0]!.anim[0]!.warp = 135
    authored.props[0]!.anim[0]!.strength = 450
    for (let frameIndex = 1; frameIndex < authored.props[0]!.anim.length; frameIndex += 1) {
      authored.props[0]!.anim[frameIndex]!.warp = createVtgThirdOrderWarp(
        resolved[frameIndex]!.arc,
        '1:2-pro',
      )
    }

    store.hydrateVtgPropertyControls(authored)

    expect(store.vtgThirdOrderSettings[0]).toEqual({
      initial: 135,
      strength: 45,
      timing: '1:2-pro',
    })
    expect(store.vtgThirdOrderMirror).toBe(false)
    expect(store.vtgThirdOrderOpposed).toBe(false)
    app.unmount()
  })

  it('detects an opposed Third Order relationship from loaded animation data', () => {
    const { app, store } = mountStore()
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const opposed = applyVtgThirdOrderSettings(
      animation,
      [{ initial: '1:4-anti', strength: 70, timing: '2:5-pro' }, {}],
      { mirror: true, opposed: true },
    )

    store.hydrateVtgPropertyControls(opposed)

    expect(store.vtgThirdOrderMirror).toBe(true)
    expect(store.vtgThirdOrderOpposed).toBe(true)
    app.unmount()
  })

  it('does not persist pattern-derived Twist, Fold, or Third Order controls', () => {
    const first = mountStore()
    first.store.vtgTwistMode = 'advanced'
    first.store.setVtgTwistValue(0, 0.5, 45)
    first.store.setVtgTwistValue(0, 2.5, 90)
    first.store.setVtgTwistValue(1, 3, -45)
    first.store.setVtgFoldValue(0, 2.5, 'yaw', 45)
    first.store.setVtgFoldValue(0, 2.5, 'rotate', 90)
    first.store.setVtgThirdOrderInitial(0, '1:3-anti')
    first.store.setVtgThirdOrderStrength(0, 50)
    first.store.setVtgThirdOrderTiming(0, '2:3-pro')
    first.store.vtgThirdOrderMirror = false
    first.store.vtgThirdOrderOpposed = true
    first.store.vtgFoldMode = 'simple'
    first.store.vtgFoldBeat = [2, 3]
    first.store.vtgFoldRepeat = [true, false]
    first.store.vtgFoldEvery = [2, 4]
    first.store.vtgFoldAlternate = [true, false]
    first.store.vtgFoldSpan = 'quarter'
    first.store.vtgFoldValuesMaterialized = true
    first.store.vtgActiveProperty = 'offset'
    first.app.unmount()

    const second = mountStore()
    expect(second.store.vtgTwistMode).toBe('simple')
    expect(second.store.vtgTwistValues).toEqual([{}, {}])
    expect(second.store.vtgFoldValues).toEqual([{}, {}])
    expect(second.store.vtgThirdOrderSettings).toEqual([{}, {}])
    expect(second.store.vtgThirdOrderMirror).toBe(true)
    expect(second.store.vtgThirdOrderOpposed).toBe(false)
    expect(second.store.vtgFoldBeat).toEqual([2, 2])
    expect(second.store.vtgFoldRepeat).toEqual([true, true])
    expect(second.store.vtgFoldEvery).toEqual([2, 2])
    expect(second.store.vtgFoldAlternate).toEqual([false, false])
    expect(second.store.vtgFoldSpan).toBe('eighth')
    expect(second.store.vtgFoldValuesMaterialized).toBe(false)
    expect(second.store.vtgActiveProperty).toBe('offset')
    second.app.unmount()
  })

  it('persists the Classic and Elemental table layout preferences', () => {
    const first = mountStore()
    first.store.classicLayout = false
    first.store.elementalLayout = true
    first.app.unmount()

    const second = mountStore()
    expect(second.store.classicLayout).toBe(false)
    expect(second.store.elementalLayout).toBe(true)
    second.app.unmount()
  })

  it('persists the VTG Advanced preference', () => {
    const first = mountStore()
    first.store.vtgAdvanced = true
    first.app.unmount()

    const second = mountStore()
    expect(second.store.vtgAdvanced).toBe(true)
    second.app.unmount()
  })

  it('defaults Sliders off for an iPad using a desktop-class user agent', () => {
    const userAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
    const maxTouchPoints = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints')
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
    })
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })

    try {
      const { app, store } = mountStore()
      expect(store.sliders).toBe(false)
      app.unmount()
    } finally {
      if (userAgent) Object.defineProperty(navigator, 'userAgent', userAgent)
      else Reflect.deleteProperty(navigator, 'userAgent')
      if (maxTouchPoints) Object.defineProperty(navigator, 'maxTouchPoints', maxTouchPoints)
      else Reflect.deleteProperty(navigator, 'maxTouchPoints')
    }
  })

  it('persists the selected pattern orientation', () => {
    const first = mountStore()
    first.store.orientation = -45
    first.app.unmount()

    const second = mountStore()
    expect(second.store.orientation).toBe(-45)
    second.app.unmount()
  })

  it('persists every shared Customize setting', () => {
    const first = mountStore()
    Object.assign(first.store, {
      bpm: 91,
      scale: 1.2,
      thick: 9,
      spacing: 6,
      paths: false,
      hands: true,
      arms: false,
      leftPropVisible: false,
      rightPropVisible: true,
      leftPropColor: 'Blue',
      rightPropColor: 'Magenta',
      prop: 3,
      sliders: false,
    })
    first.app.unmount()

    const second = mountStore()
    expect({
      bpm: second.store.bpm,
      scale: second.store.scale,
      thick: second.store.thick,
      spacing: second.store.spacing,
      paths: second.store.paths,
      hands: second.store.hands,
      arms: second.store.arms,
      leftPropVisible: second.store.leftPropVisible,
      rightPropVisible: second.store.rightPropVisible,
      leftPropColor: second.store.leftPropColor,
      rightPropColor: second.store.rightPropColor,
      prop: second.store.prop,
      sliders: second.store.sliders,
    }).toEqual({
      bpm: 91,
      scale: 1.2,
      thick: 9,
      spacing: 6,
      paths: false,
      hands: true,
      arms: false,
      leftPropVisible: false,
      rightPropVisible: true,
      leftPropColor: 'Blue',
      rightPropColor: 'Magenta',
      prop: 3,
      sliders: false,
    })
    second.app.unmount()
  })

  it('restores four Quick Slots and allows removing all of them', () => {
    const { app, store } = mountStore()

    store.restoreQuickSlots()
    expect(store.quickSlotCount).toBe(4)
    expect(store.quickSlotPaths).toEqual([null, null, null, null])

    store.addQuickSlot()
    expect(store.quickSlotCount).toBe(5)
    expect(store.quickSlotPaths).toEqual([null, null, null, null, null])

    store.selectedQuickSlot = 5
    store.removeQuickSlot()
    expect(store.quickSlotCount).toBe(4)
    expect(store.selectedQuickSlot).toBe(4)
    expect(store.quickSlotPaths).toEqual([null, null, null, null])

    store.removeQuickSlot()
    store.removeQuickSlot()
    store.removeQuickSlot()
    store.removeQuickSlot()
    expect(store.quickSlotCount).toBe(0)
    expect(store.selectedQuickSlot).toBeNull()
    expect(store.quickSlotPaths).toEqual([])

    app.unmount()
  })

  it('saves a path only in the selected Quick Slot', () => {
    const { app, store } = mountStore()

    store.restoreQuickSlots()
    store.selectedQuickSlot = 3
    store.saveCurrentQuickSlot('/play-vtg?r=pattern&v=6')

    expect(store.quickSlotPaths).toEqual([null, null, '/play-vtg?r=pattern&v=6', null])

    store.clearQuickSlot(3)
    expect(store.quickSlotPaths).toEqual([null, null, null, null])
    app.unmount()
  })

  it('replaces the current Quick Slots with an empty unselected set', () => {
    const { app, store } = mountStore()
    store.restoreQuickSlots()
    store.quickSlotPaths[1] = '/play-vtg?r=stored&v=6'
    store.selectedQuickSlot = 2

    expect(store.replaceQuickSlotsWithEmpty(5)).toBe(true)
    expect(store.quickSlotCount).toBe(5)
    expect(store.quickSlotPaths).toEqual([null, null, null, null, null])
    expect(store.selectedQuickSlot).toBeNull()
    expect(store.replaceQuickSlotsWithEmpty(-1)).toBe(false)
    expect(store.quickSlotCount).toBe(5)

    const replacement = ['/play-vtg?r=one&v=6', null, '/play-edit?r=three&v=6']
    store.selectedQuickSlot = 1
    expect(store.replaceQuickSlots(replacement)).toBe(true)
    expect(store.quickSlotCount).toBe(3)
    expect(store.quickSlotPaths).toEqual(replacement)
    expect(store.quickSlotPaths).not.toBe(replacement)
    expect(store.selectedQuickSlot).toBeNull()
    app.unmount()
  })

  it('saves, overwrites, and loads named Quick Slot sets by stable ID', () => {
    const { app, store } = mountStore()
    store.restoreQuickSlots()
    store.quickSlotPaths = ['/play-vtg?r=one&v=6', null, '/play-time?r=three&v=6', null]
    store.selectedQuickSlot = 3

    const firstId = store.saveNewQuickSlotSet('Practice')
    expect(firstId).toBe('quick-slot-set-1')
    expect(store.selectedQuickSlotSetId).toBe(firstId)
    expect(store.quickSlotSets).toEqual([
      {
        id: firstId,
        name: 'Practice',
        paths: ['/play-vtg?r=one&v=6', null, '/play-time?r=three&v=6', null],
        selectedSlot: 3,
      },
    ])

    store.quickSlotPaths[0] = '/play-vtg?r=updated&v=6'
    expect(store.quickSlotSets[0]?.paths[0]).toBe('/play-vtg?r=one&v=6')
    expect(store.overwriteQuickSlotSet(firstId, 'Practice Updated')).toBe(true)

    store.quickSlotPaths = []
    store.quickSlotCount = 0
    store.selectedQuickSlot = null
    expect(store.loadQuickSlotSet(firstId)).toBe(true)
    expect(store.quickSlotCount).toBe(4)
    expect(store.quickSlotPaths[0]).toBe('/play-vtg?r=updated&v=6')
    expect(store.selectedQuickSlot).toBe(3)
    expect(store.quickSlotSets[0]?.name).toBe('Practice Updated')

    expect(store.deleteQuickSlotSet(firstId)).toBe(true)
    expect(store.quickSlotSets).toEqual([])
    expect(store.selectedQuickSlotSetId).toBeNull()
    app.unmount()
  })

  it('uses the first available default name and remembers the last saved set after hydration', () => {
    localStorage.setItem(
      'sa-concepts',
      JSON.stringify({
        quickSlotSets: [
          {
            id: 'quick-slot-set-4',
            name: 'Quick Slot Set #1',
            paths: ['/play-vtg?r=saved&v=6'],
            selectedSlot: 1,
          },
          {
            id: 'quick-slot-set-7',
            name: 'Quick Slot Set #2',
            paths: ['/play-time?r=second&v=6'],
            selectedSlot: null,
          },
        ],
        selectedQuickSlotSetId: 'quick-slot-set-4',
      }),
    )
    const { app, store } = mountStore()

    expect(store.selectedQuickSlotSetId).toBe('quick-slot-set-4')
    expect(store.nextQuickSlotSetName()).toBe('Quick Slot Set #3')
    app.unmount()
  })

  it('matches Quick Slots by query string without considering the page', () => {
    const { app, store } = mountStore()
    store.restoreQuickSlots()
    store.quickSlotPaths = ['/play-vtg?r=first&v=6', '/8stp-time?r=matching&v=6', null, null]

    store.selectQuickSlotForPath('/qst-play?r=matching&v=6')
    expect(store.selectedQuickSlot).toBe(2)

    store.selectQuickSlotForPath('/8stp-time?r=different&v=6')
    expect(store.selectedQuickSlot).toBeNull()

    app.unmount()
  })

  it('keeps the selected Quick Slot when more than one slot has the same animation', () => {
    const { app, store } = mountStore()
    store.restoreQuickSlots()
    store.quickSlotPaths = [
      '/play-vtg?r=duplicate&v=6',
      '/play-vtg?r=unique&v=6',
      '/play-vtg?r=duplicate&v=6',
      null,
    ]
    store.selectedQuickSlot = 3

    store.selectQuickSlotForPath('/play-time?r=duplicate&v=6')

    expect(store.selectedQuickSlot).toBe(3)
    app.unmount()
  })

  it('hydrates the Quick Slot count and selected slot', () => {
    localStorage.setItem(
      'sa-concepts',
      JSON.stringify({
        quickSlotCount: 6,
        selectedQuickSlot: 5,
        quickSlotPaths: ['/play-vtg?r=one&v=6', null],
      }),
    )

    const { app, store } = mountStore()

    expect(store.quickSlotCount).toBe(6)
    expect(store.selectedQuickSlot).toBe(5)
    expect(store.quickSlotPaths).toEqual(['/play-vtg?r=one&v=6', null, null, null, null, null])
    app.unmount()
  })

  it('accepts zero persisted Quick Slots and clears the selection', () => {
    localStorage.setItem('sa-concepts', JSON.stringify({ quickSlotCount: 0, selectedQuickSlot: 9 }))

    const { app, store } = mountStore()

    expect(store.quickSlotCount).toBe(0)
    expect(store.selectedQuickSlot).toBeNull()
    expect(store.quickSlotPaths).toEqual([])
    app.unmount()
  })

  it('resets every shared pattern control', () => {
    const { app, store } = mountStore()
    store.speedRatio = '1:5'
    store.swapProps = true
    store.reversePlane = true
    store.bpm = 90
    store.scale = 1.2
    store.thick = 12
    store.spacing = 17
    store.paths = false
    store.hands = true
    store.arms = false
    store.leftPropVisible = false
    store.rightPropVisible = false
    store.leftPropColor = 'Blue'
    store.rightPropColor = 'Magenta'
    store.prop = 3
    store.sliders = false

    store.resetPatternControls()

    expect({
      speedRatio: store.speedRatio,
      swapProps: store.swapProps,
      reversePlane: store.reversePlane,
      bpm: store.bpm,
      scale: store.scale,
      thick: store.thick,
      spacing: store.spacing,
      paths: store.paths,
      hands: store.hands,
      arms: store.arms,
      leftPropVisible: store.leftPropVisible,
      rightPropVisible: store.rightPropVisible,
      leftPropColor: store.leftPropColor,
      rightPropColor: store.rightPropColor,
      prop: store.prop,
      sliders: store.sliders,
    }).toEqual({
      speedRatio: '1:3',
      swapProps: false,
      reversePlane: false,
      bpm: 40,
      scale: 0.8,
      thick: 5,
      spacing: 1,
      paths: true,
      hands: false,
      arms: true,
      leftPropVisible: true,
      rightPropVisible: true,
      leftPropColor: 'Cyan',
      rightPropColor: 'Green',
      prop: 3,
      sliders: true,
    })
    app.unmount()
  })

  it('persists whether Customize is expanded', () => {
    localStorage.setItem('sa-concepts', JSON.stringify({ customizeExpanded: true }))

    const { app, store } = mountStore()

    expect(store.customizeExpanded).toBe(true)
    app.unmount()
  })

  it('resets an unsupported persisted concept to VTG', () => {
    localStorage.setItem('sa-concepts', JSON.stringify({ selectedConcept: 'unknown' }))

    const { app, store } = mountStore()

    expect(store.selectedConcept).toBe('vtg')
    app.unmount()
  })

  it('migrates a persisted Quarter Spacing selection into VTG with QTR enabled', () => {
    localStorage.setItem(
      'sa-concepts',
      JSON.stringify({
        selectedConcept: 'qtr',
        speedRatio: '1:5',
        swapProps: true,
        reversePlane: true,
        spacing: 7,
      }),
    )

    const { app, store } = mountStore()

    expect(store.selectedConcept).toBe('vtg')
    expect(store.qtrEnabled).toBe(true)
    expect(store.speedRatio).toBe('1:5')
    expect(store.swapProps).toBe(true)
    expect(store.reversePlane).toBe(true)
    expect(store.spacing).toBe(7)
    app.unmount()
  })

  it.each(['1:2', '1:4'] as const)('hydrates the supported %s speed ratio', (speedRatio) => {
    localStorage.setItem('sa-concepts', JSON.stringify({ speedRatio }))

    const { app, store } = mountStore()

    expect(store.speedRatio).toBe(speedRatio)
    app.unmount()
  })

  it('hydrates Eight Step as the selected concept', () => {
    localStorage.setItem('sa-concepts', JSON.stringify({ selectedConcept: '8stp' }))

    const { app, store } = mountStore()

    expect(store.selectedConcept).toBe('8stp')
    app.unmount()
  })

  it('hydrates The Kinetic Alphabet as the selected concept', () => {
    localStorage.setItem('sa-concepts', JSON.stringify({ selectedConcept: 'tka' }))

    const { app, store } = mountStore()

    expect(store.selectedConcept).toBe('tka')
    app.unmount()
  })

  it('hydrates Third Order as the selected concept', () => {
    localStorage.setItem('sa-concepts', JSON.stringify({ selectedConcept: 'to' }))

    const { app, store } = mountStore()

    expect(store.selectedConcept).toBe('to')
    app.unmount()
  })

  it('hydrates Quarter Space Tech as the selected concept', () => {
    localStorage.setItem('sa-concepts', JSON.stringify({ selectedConcept: 'qst' }))

    const { app, store } = mountStore()

    expect(store.selectedConcept).toBe('qst')
    app.unmount()
  })
})
