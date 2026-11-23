import { describe, expect, it } from 'vitest'
import { asEntityId } from '@/engine/core/entities/entity'
import type { GameEffect } from '@/engine/core/effects/effect'
import { advanceEffects, applyEffect, removeEffects } from '@/engine/core/effects/effect-lifecycle'

const heroId = asEntityId('hero-1')
const attack = (id: string, remaining: number, stacking: GameEffect['stacking'] = 'stack', value = 5): GameEffect => ({
  id,
  kind: 'might',
  targetId: heroId,
  duration: { type: 'rounds', remaining },
  stacking,
  modifiers: [{ id: `${id}:attack`, stat: 'attack', operation: 'flat', value }],
})

describe('effect lifecycle', () => {
  it('stacks independent instances when policy is stack', () => {
    const first = attack('might-1', 2)
    const second = attack('might-2', 3)
    const result = applyEffect([first], second)
    expect(result.effects.map(effect => effect.id)).toEqual(['might-1', 'might-2'])
    expect(result.removedEffectIds).toEqual([])
  })

  it('rejects duplicate IDs when stacking independent instances', () => {
    expect(() => applyEffect([attack('same-id', 2)], attack('same-id', 3))).toThrow('Duplicate effect id')
  })

  it('refreshes the existing instance duration without duplicating its modifiers', () => {
    const first = attack('might-1', 1, 'stack', 5)
    const refresh = attack('might-2', 4, 'refresh', 99)
    const result = applyEffect([first], refresh)
    expect(result.effects).toEqual([{ ...first, duration: { type: 'rounds', remaining: 4 } }])
    expect(result.appliedEffectId).toBe('might-1')
    expect(result.removedEffectIds).toEqual([])
  })

  it('replaces all same-kind effects on the same target', () => {
    const first = attack('might-1', 2)
    const second = attack('might-2', 3)
    const replacement = attack('might-3', 5, 'replace', 8)
    const result = applyEffect([first, second], replacement)
    expect(result.effects).toEqual([replacement])
    expect(result.removedEffectIds).toEqual(['might-1', 'might-2'])
  })

  it('does not combine effects belonging to another target or kind', () => {
    const otherTarget: GameEffect = { ...attack('other', 2), targetId: asEntityId('hero-2') }
    const otherKind: GameEffect = { ...attack('other-kind', 2), kind: 'weakness' }
    const incoming = attack('incoming', 4, 'replace')
    const result = applyEffect([otherTarget, otherKind], incoming)
    expect(result.effects).toEqual([otherTarget, otherKind, incoming])
  })

  it('decrements finite durations and removes effects at zero', () => {
    const permanent: GameEffect = { ...attack('permanent', 1), duration: { type: 'permanent' } }
    const result = advanceEffects([attack('short', 1), attack('long', 3), permanent], 1)
    expect(result.effects).toEqual([
      { ...attack('long', 3), duration: { type: 'rounds', remaining: 2 } },
      permanent,
    ])
    expect(result.expiredEffectIds).toEqual(['short'])
  })

  it('supports advancing multiple rounds and zero elapsed time', () => {
    expect(advanceEffects([attack('a', 4)], 2).effects[0].duration).toEqual({ type: 'rounds', remaining: 2 })
    expect(advanceEffects([attack('a', 4)], 0).effects[0].duration).toEqual({ type: 'rounds', remaining: 4 })
  })

  it('removes selected effects without mutating the original list', () => {
    const effects = [attack('a', 2), attack('b', 2)]
    expect(removeEffects(effects, ['a'])).toEqual([effects[1]])
    expect(effects).toHaveLength(2)
  })

  it('rejects invalid durations, elapsed values and duplicate IDs', () => {
    expect(() => applyEffect([], attack('bad', -1))).toThrow(RangeError)
    expect(() => advanceEffects([attack('a', 1)], -1)).toThrow(RangeError)
    expect(() => advanceEffects([attack('a', 1), attack('a', 2)])).toThrow('Duplicate effect id')
  })
})
