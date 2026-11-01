import { describe, expect, it } from 'vitest'

import {
  getVtgBuilderMaximumScale,
  toVtgBuilderDisplayAnimation,
  type VtgBuilderDisplaySettings,
} from '@/features/builder/toVtgBuilderDisplayAnimation'
import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import { getVtgDistanceForScale, vtgThickControl } from '@/features/vtg/data/vtgPlayerSettings'
import { applyVtgCustomization } from '@/features/vtg/applyVtgCustomization'

describe('toVtgBuilderDisplayAnimation', () => {
  it('preserves authored Scale and frames the camera from the highest effective value', () => {
    const animation = createDefaultVtgAnimation({
      reference: '1-1',
      speedRatio: '1:5',
      scale: 0.8,
    })
    if (!animation) throw new Error('Expected a supported VTG pattern')
    animation.props[0]!.anim[3] = { ...animation.props[0]!.anim[3], scale: 130 }
    animation.props[1]!.anim[5] = { ...animation.props[1]!.anim[5], scale: 110 }
    const original = structuredClone(animation)

    const display = toVtgBuilderDisplayAnimation(animation)

    expect(getVtgBuilderMaximumScale(animation)).toBe(130)
    expect(display.props).toEqual(animation.props)
    expect(display.camera[0]?.orbit?.distance).toBe(getVtgDistanceForScale(1.3))
    expect(animation).toEqual(original)
  })

  it('preserves every non-Scale Customize setting for Builder visuals', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG pattern')

    const customized = applyVtgCustomization(animation, {
      reference: '1-1',
      speedRatio: '1:3',
      bpm: 91,
      scale: 1.2,
      thick: 9,
      spacing: 7,
      paths: false,
      hands: true,
      arms: false,
      left: false,
      propColors: ['Magenta', 'Yellow'],
    })
    expect(
      customized.props.every((customizedProp, propIndex) =>
        customizedProp.anim
          .slice(1)
          .every(
            (frame, frameIndex) =>
              frame.scale === animation.props[propIndex]?.anim[frameIndex + 1]?.scale,
          ),
      ),
    ).toBe(true)
    const display = toVtgBuilderDisplayAnimation(customized)

    expect(display.bpm).toBe(customized.bpm)
    expect(display.thick).toBe(9)
    expect(display.paths).toBe(false)
    expect(display.hands).toBe(true)
    expect(display.arms).toBe(false)
    expect(display.props.map((prop) => prop.motion)).toEqual(
      customized.props.map((prop) => prop.motion),
    )
    expect(display.props[0]).toMatchObject({
      visible: false,
      paths: false,
      hands: false,
      arms: false,
    })
    expect(display.props.map((prop) => prop.color)).toEqual(
      customized.props.map((prop) => prop.color),
    )
  })

  it('overwrites only Builder display fields and keeps thumbnail visibility and thickness fixed', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG pattern')
    const original = structuredClone(animation)
    const settings = {
      bpm: 91,
      thick: 9,
      spacing: 7,
      paths: false,
      hands: true,
      arms: false,
      leftPropVisible: false,
      rightPropVisible: true,
      propColors: ['Magenta', 'Yellow'],
      prop: 1,
    } as const satisfies VtgBuilderDisplaySettings

    const player = toVtgBuilderDisplayAnimation(animation, settings)
    const thumbnail = toVtgBuilderDisplayAnimation(animation, settings, { thumbnail: true })

    expect(animation).toEqual(original)
    expect(player).toMatchObject({
      bpm: 182,
      prop: 1,
      paths: false,
      hands: true,
      arms: false,
      thick: 9,
    })
    expect(player.props[0]).toMatchObject({
      visible: false,
      paths: false,
      hands: false,
      arms: false,
      thick: 9,
    })
    expect(player.props[1]).toMatchObject({
      paths: false,
      hands: true,
      arms: false,
      thick: 9,
    })
    expect(thumbnail.thick).toBe(vtgThickControl.max)
    expect(thumbnail.props.every((prop) => prop.visible !== false)).toBe(true)
    expect(
      thumbnail.props.every(
        (prop) =>
          prop.paths === false &&
          prop.hands === true &&
          prop.arms === false &&
          prop.thick === vtgThickControl.max,
      ),
    ).toBe(true)
    expect(player.props.map((prop) => prop.motion)).toEqual(
      thumbnail.props.map((prop) => prop.motion),
    )
    expect(player.props.map((prop) => prop.color)).toEqual(
      thumbnail.props.map((prop) => prop.color),
    )
    expect(player.props.map((prop) => prop.anim)).toEqual(animation.props.map((prop) => prop.anim))
  })

  it('uses a supplied whole-pattern maximum to keep portion cameras consistent', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG pattern')

    const display = toVtgBuilderDisplayAnimation(animation, undefined, { maximumScale: 140 })

    expect(display.camera[0]?.orbit?.distance).toBe(getVtgDistanceForScale(1.4))
    expect(display.props).toEqual(animation.props)
  })
})
