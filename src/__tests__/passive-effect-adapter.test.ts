import { describe, expect, it } from 'vitest'
import { resolveLegacyPassiveEffects, type LegacyPassiveEffect } from '@/engine/adapters/combat/passive-effect-adapter'

const effect = (overrides: Partial<LegacyPassiveEffect> = {}): LegacyPassiveEffect => ({
  trigger: 'on_damage',
  effectType: 'damage',
  targetType: 'attacker',
  value: 10,
  sourceName: 'Thorns',
  ...overrides,
})

describe('legacy passive effect resolver', () => {
  it('filters passive effects by event trigger', () => {
    const passives = [effect(), effect({ trigger: 'on_death', sourceName: 'Explosion' })]
    expect(resolveLegacyPassiveEffects('on_damage', { id: 'e1', name: 'Bramble', passiveEffects: passives }))
      .toMatchObject([{ trigger: 'on_damage', value: 10, sourceName: 'Thorns' }])
  })

  it('resolves numeric and attribute-scaled values with legacy rounding', () => {
    const passives = [
      effect({ value: 12 }),
      effect({ value: { base: 10, coeff: 0.5, attrScale: 'st' } }),
      effect({ value: { base: 10, coeff: 0.25 } }),
    ]
    expect(resolveLegacyPassiveEffects('on_damage', { id: 'e1', name: 'Ogre', attrs: { st: 7 }, passiveEffects: passives })
      .map(x => x.value)).toEqual([12, 14, 3])
  })

  it('uses the legacy coefficient fallback when the scaled attribute is absent or zero', () => {
    const passives = [effect({ value: { base: 9, coeff: 0.5, attrScale: 'st' } })]
    expect(resolveLegacyPassiveEffects('on_damage', { id: 'e1', name: 'Ogre', attrs: { st: 0 }, passiveEffects: passives })[0].value).toBe(5)
  })

  it('preserves the legacy truthiness filter for zero and NaN values', () => {
    const passives = [effect({ value: 0 }), effect({ value: Number.NaN })]
    expect(resolveLegacyPassiveEffects('on_damage', { id: 'e1', name: 'Ogre', passiveEffects: passives })).toEqual([])
  })

  it('rejects infinite numeric and formula-derived passive values', () => {
    const passives = [
      effect({ value: Number.POSITIVE_INFINITY }),
      effect({ value: { base: Number.POSITIVE_INFINITY } }),
      effect({ value: { base: 10, coeff: Number.POSITIVE_INFINITY } }),
      effect({ value: { base: 10, attrScale: 'st' } }),
    ]
    expect(resolveLegacyPassiveEffects('on_damage', {
      id: 'e1', name: 'Ogre', attrs: { st: Number.NaN }, passiveEffects: passives,
    })).toEqual([])
  })

  it('keeps finite attribute-scaled passive formulas unchanged', () => {
    const passives = [effect({ value: { base: 10, coeff: 0.5, attrScale: 'st' } })]
    expect(resolveLegacyPassiveEffects('on_damage', {
      id: 'e1', name: 'Ogre', attrs: { st: 8 }, passiveEffects: passives,
    }).map(command => command.value)).toEqual([14])
  })

  it('preserves target, damage type and buff metadata', () => {
    const passives = [
      effect({ targetType: 'all_heroes', damageType: 'fire' }),
      effect({ effectType: 'buff', targetType: 'self', buffType: 'def', sourceName: 'Iron Skin' }),
    ]
    expect(resolveLegacyPassiveEffects('on_damage', { id: 'e1', name: 'Ogre', passiveEffects: passives }))
      .toMatchObject([
        { targetType: 'all_heroes', damageType: 'fire' },
        { effectType: 'buff', targetType: 'self', buffType: 'def', sourceName: 'Iron Skin' },
      ])
  })
})
