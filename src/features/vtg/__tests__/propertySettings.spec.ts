import { describe, expect, it } from 'vitest'

import { createDefaultVtgAnimation } from '@/features/vtg/createVtgAnimation'
import {
  applyVtgPropertySettings,
  cloneVtgPropertySettings,
  createDefaultVtgPropertySettings,
  hasVtgPropertySettings,
} from '@/features/vtg/propertySettings'

describe('VTG property settings', () => {
  it('creates independent empty defaults', () => {
    const first = createDefaultVtgPropertySettings()
    const second = createDefaultVtgPropertySettings()
    first.twist.values[0]['0.5'] = 90

    expect(hasVtgPropertySettings(first)).toBe(true)
    expect(hasVtgPropertySettings(second)).toBe(false)
  })

  it('clones property settings as independent worker-safe data', () => {
    const settings = createDefaultVtgPropertySettings()
    settings.twist.values[0]['0.5'] = 90
    settings.fold.values[1]['2'] = { yaw: 45 }

    const cloned = cloneVtgPropertySettings(settings)
    settings.twist.values[0]['0.5'] = 180
    settings.fold.values[1]['2']!.yaw = 90

    expect(cloned.twist.values[0]['0.5']).toBe(90)
    expect(cloned.fold.values[1]['2']?.yaw).toBe(45)
    expect(() => structuredClone(cloned)).not.toThrow()
  })

  it('applies Twist, Fold, and Third Order through one pipeline', () => {
    const animation = createDefaultVtgAnimation({ reference: '1-1', speedRatio: '1:3' })
    if (!animation) throw new Error('Expected a supported VTG animation')
    const settings = createDefaultVtgPropertySettings()
    settings.twist.values[0]['0.5'] = 90
    settings.fold.values[0]['2'] = { yaw: 45 }
    settings.thirdOrder.settings[0].strength = 55

    const applied = applyVtgPropertySettings(animation, settings)

    expect(applied.props[0]?.anim[1]?.twist).toBe(90)
    expect(applied.props[0]?.anim[4]?.yaw).toBe(45)
    expect(applied.props[0]?.anim[0]?.strength).toBe(550)
  })
})
