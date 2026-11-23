import { nextRandom, randomIntInclusive, type RandomSource } from '../random/random-source'

export type TargetPosition = 'front' | 'center' | 'rear' | 'left_flank' | 'right_flank' | 'auto'
export type TargetType = 'weakest' | 'strongest' | 'most_injured_ally' | 'random' | 'enemy_ai' | 'auto' | 'self'

export interface TargetableUnit {
  readonly id: string
  readonly hp: number
  readonly maxHp: number
  readonly position: string
  readonly trap?: boolean
}

export interface TargetSelectionInput<T extends TargetableUnit> {
  readonly actor: T
  readonly allies: readonly T[]
  readonly enemies: readonly T[]
  readonly targetPosition: TargetPosition
  readonly targetType: TargetType
  readonly skillTags?: readonly string[]
  readonly random?: RandomSource
  /** Select across all living opponents without positional priority. */
  readonly globalTargeting?: boolean
}

export interface TargetSelectionResult<T> {
  readonly target: T | null
  readonly candidates: readonly T[]
  readonly reason: 'most_injured_ally' | 'trap_priority' | 'exact_position' | 'position_priority' | 'fallback' | 'no_valid_target'
}

export function getTargetPositionPriority(actorPosition: string, isRanged: boolean): string[] {
  const base: Record<string, string[][]> = {
    front: [['front', 'center', 'rear', 'left_flank', 'right_flank']],
    left_flank: [['left_flank', 'right_flank', 'front', 'center', 'rear']],
    right_flank: [['left_flank', 'right_flank', 'front', 'center', 'rear']],
    center: [
      ['center', 'rear', 'front', 'left_flank', 'right_flank'],
      ['front', 'center', 'rear', 'left_flank', 'right_flank'],
    ],
    rear: [
      ['rear', 'center', 'front', 'left_flank', 'right_flank'],
      ['front', 'center', 'rear', 'left_flank', 'right_flank'],
    ],
  }
  const variants = base[actorPosition]
  if (!variants) return ['front', 'center', 'rear', 'left_flank', 'right_flank']
  const index = actorPosition === 'center' || actorPosition === 'rear' ? (isRanged ? 0 : 1) : 0
  return variants[index] ?? variants[0]
}

function chooseByType<T extends TargetableUnit>(
  pool: readonly T[],
  targetType: TargetType,
  random?: RandomSource,
): T | null {
  if (pool.length === 0) return null
  if (targetType === 'strongest') {
    return pool.reduce((best, unit) => !best || unit.hp > best.hp ? unit : best, null as T | null)
  }
  if (targetType === 'random') {
    if (!random) throw new Error('A RandomSource is required for random target selection')
    return pool[randomIntInclusive(random, 0, pool.length - 1)] ?? null
  }
  return pool.reduce((best, unit) => !best || unit.hp < best.hp ? unit : best, null as T | null)
}

function mostInjured<T extends TargetableUnit>(units: readonly T[]): T | null {
  return units.reduce((best, unit) => {
    if (!Number.isFinite(unit.hp) || !Number.isFinite(unit.maxHp) || unit.hp <= 0 || unit.maxHp <= 0 || unit.hp >= unit.maxHp) return best
    if (!best) return unit
    return unit.hp / unit.maxHp < best.hp / best.maxHp ? unit : best
  }, null as T | null)
}

/** Pure target resolution preserving Wodos' current positional and trap priorities. */
export function selectCombatTarget<T extends TargetableUnit>(
  input: TargetSelectionInput<T>,
): TargetSelectionResult<T> {
  const { actor, allies, enemies, targetPosition, targetType, skillTags, random, globalTargeting } = input
  if (targetType === 'most_injured_ally') {
    const candidates = [actor, ...allies].filter(unit => Number.isFinite(unit.hp) && unit.hp > 0)
    const target = mostInjured(candidates)
    return { target, candidates, reason: target ? 'most_injured_ally' : 'no_valid_target' }
  }

  const aliveEnemies = enemies.filter(unit => Number.isFinite(unit.hp) && unit.hp > 0)
  if (aliveEnemies.length === 0) {
    return { target: null, candidates: [], reason: 'no_valid_target' }
  }

  // Preserve the legacy enemy AI heuristic: 40% weakest-target preference,
  // otherwise a 70/30 front/rear preference followed by a random pick.
  if (targetType === 'enemy_ai') {
    if (!random) throw new Error('A RandomSource is required for enemy AI target selection')
    if (nextRandom(random) < 0.4) {
      const target = aliveEnemies.reduce((best, unit) => !best || unit.hp < best.hp ? unit : best, null as T | null)
      return { target, candidates: aliveEnemies, reason: 'fallback' }
    }
    const front = aliveEnemies.filter(unit => unit.position === 'front')
    const rear = aliveEnemies.filter(unit => unit.position === 'rear')
    const pool = nextRandom(random) < 0.7
      ? (front.length > 0 ? front : rear)
      : (rear.length > 0 ? rear : front)
    const candidates = pool.length > 0 ? pool : aliveEnemies
    return {
      target: candidates[randomIntInclusive(random, 0, candidates.length - 1)] ?? null,
      candidates,
      reason: 'fallback',
    }
  }

  const traps = aliveEnemies.filter(unit => unit.trap)
  if (traps.length > 0) {
    return { target: chooseByType(traps, targetType, random), candidates: traps, reason: 'trap_priority' }
  }

  if (globalTargeting) {
    return { target: chooseByType(aliveEnemies, targetType, random), candidates: aliveEnemies, reason: 'fallback' }
  }

  if (targetPosition !== 'auto') {
    const positioned = aliveEnemies.filter(unit => unit.position === targetPosition)
    const candidates = positioned.length > 0 ? positioned : aliveEnemies
    return {
      target: chooseByType(candidates, targetType, random),
      candidates,
      reason: positioned.length > 0 ? 'exact_position' : 'fallback',
    }
  }

  const ranged = !!skillTags?.some(tag => tag === 'magic' || tag === 'ranged')
  const priorities = getTargetPositionPriority(actor.position, ranged)
  for (const position of priorities) {
    const candidates = aliveEnemies.filter(unit => unit.position === position)
    if (candidates.length > 0) {
      return { target: chooseByType(candidates, targetType, random), candidates, reason: 'position_priority' }
    }
  }

  return {
    target: chooseByType(aliveEnemies, targetType, random),
    candidates: aliveEnemies,
    reason: 'fallback',
  }
}
