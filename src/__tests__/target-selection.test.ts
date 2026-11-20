import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/engine/core/random/random-source'
import { selectCombatTarget, getTargetPositionPriority, type TargetableUnit } from '@/engine/core/skills/target-selection'

type Unit = TargetableUnit & { name: string }
const unit = (id: string, hp: number, position: string, extra: Partial<Unit> = {}): Unit => ({
  id, name: id, hp, maxHp: 100, position, ...extra,
})

const actor = unit('hero', 100, 'center')

describe('pure combat target selection', () => {
  it('prefers traps before positional priority', () => {
    const trap = unit('trap', 5, 'rear', { trap: true })
    const front = unit('front', 1, 'front')
    const result = selectCombatTarget({
      actor, allies: [], enemies: [front, trap],
      targetPosition: 'front', targetType: 'weakest',
    })
    expect(result.target).toBe(trap)
    expect(result.reason).toBe('trap_priority')
  })

  it('selects the requested position and falls back to all living enemies if absent', () => {
    const rear = unit('rear', 30, 'rear')
    const front = unit('front', 20, 'front')
    expect(selectCombatTarget({
      actor, allies: [], enemies: [rear, front],
      targetPosition: 'front', targetType: 'weakest',
    }).target).toBe(front)
    const fallback = selectCombatTarget({
      actor, allies: [], enemies: [rear, front],
      targetPosition: 'left_flank', targetType: 'strongest',
    })
    expect(fallback.target).toBe(rear)
    expect(fallback.reason).toBe('fallback')
  })

  it('uses melee and ranged position priority variants', () => {
    expect(getTargetPositionPriority('center', false)[0]).toBe('front')
    expect(getTargetPositionPriority('center', true)[0]).toBe('center')
    const front = unit('front', 20, 'front')
    const center = unit('center', 10, 'center')
    expect(selectCombatTarget({
      actor, allies: [], enemies: [center, front],
      targetPosition: 'auto', targetType: 'weakest', skillTags: ['melee'],
    }).target).toBe(front)
    expect(selectCombatTarget({
      actor, allies: [], enemies: [center, front],
      targetPosition: 'auto', targetType: 'weakest', skillTags: ['magic'],
    }).target).toBe(center)
  })

  it('selects the most injured living ally, including the acting hero', () => {
    const ally = unit('ally', 20, 'rear')
    const lessInjured = unit('ally2', 50, 'front')
    const result = selectCombatTarget({
      actor: unit('hero', 35, 'center'),
      allies: [ally, lessInjured],
      enemies: [unit('enemy', 10, 'front')],
      targetPosition: 'auto',
      targetType: 'most_injured_ally',
    })
    expect(result.target).toBe(ally)
    expect(result.reason).toBe('most_injured_ally')
  })

  it('chooses strongest, weakest and deterministic random targets', () => {
    const weak = unit('weak', 10, 'front')
    const strong = unit('strong', 90, 'front')
    const common = { actor, allies: [], enemies: [weak, strong], targetPosition: 'front' as const }
    expect(selectCombatTarget({ ...common, targetType: 'weakest' }).target).toBe(weak)
    expect(selectCombatTarget({ ...common, targetType: 'strongest' }).target).toBe(strong)
    const first = selectCombatTarget({ ...common, targetType: 'random', random: createSeededRandom(123) }).target
    const second = selectCombatTarget({ ...common, targetType: 'random', random: createSeededRandom(123) }).target
    expect(first?.id).toBe(second?.id)
  })

  it('supports global target selection without positional bias for enemy AI', () => {
    const front = unit('front-strong', 90, 'front')
    const rear = unit('rear-weak', 5, 'rear')
    const result = selectCombatTarget({
      actor, allies: [], enemies: [front, rear],
      targetPosition: 'auto', targetType: 'weakest', globalTargeting: true,
    })
    expect(result.target).toBe(rear)
    expect(result.reason).toBe('fallback')
  })

  it('returns null when no valid target exists', () => {
    const result = selectCombatTarget({
      actor, allies: [], enemies: [unit('dead', 0, 'front')],
      targetPosition: 'auto', targetType: 'weakest',
    })
    expect(result.target).toBeNull()
    expect(result.reason).toBe('no_valid_target')
  })

  it('preserves the legacy fallback for target type self', () => {
    const enemy = unit('enemy', 10, 'front')
    const result = selectCombatTarget({
      actor, allies: [], enemies: [enemy],
      targetPosition: 'auto', targetType: 'self',
    })
    expect(result.target).toBe(enemy)
  })
})
