import type { AdventureStepEnemy, CombatStepResult } from '@/lib/adventures/types'
import type { DungeonData, RunResult } from '@/lib/combat-engine/dungeon-runner'
import type { DamageType } from '@/lib/combat-engine/formulas'

/**
 * Adapts a single adventure encounter to the shared dungeon combat engine.
 * Scaling is intentionally disabled: adventure seed data already defines encounter difficulty.
 */
export function createAdventureCombatDungeon(name: string, enemies: AdventureStepEnemy[]): DungeonData {
  return {
    id: 0,
    name,
    levels: [{
      number: 1,
      locationName: name,
      epReward: 0,
      goldReward: 0,
      enemies: enemies.map((enemy, index) => ({
        id: index + 1,
        name: enemy.name,
        icon: enemy.icon,
        hp: enemy.hp,
        mp: enemy.mp,
        atk: enemy.atk,
        def: enemy.def,
        dx: enemy.dx,
        ag: enemy.ag,
        level: enemy.level,
        baseLevel: enemy.level,
        growthFactor: 0,
        position: enemy.position ?? 'front',
        ...(enemy.damageType ? { damageType: enemy.damageType as DamageType } : {}),
        skills: [],
        armorName: '',
      })),
    }],
    epReward: 0,
    goldReward: 0,
    fameReward: 0,
    lootTable: [],
  }
}

export function mapAdventureCombatResult(
  result: RunResult,
  totalEnemies: number,
  startingResources: { hp: number; mp: number },
): CombatStepResult {
  const finalHero = result.heroesFinalState[0]
  if (!finalHero) throw new Error('El motor de combate no devolvió el estado final del héroe')

  const rounds = result.levelReports[0]?.rounds ?? []
  const lastRound = rounds[rounds.length - 1]
  const defeatedInSnapshot = lastRound?.stateAfter.enemies.filter(enemy => enemy.hp <= 0).length
  const enemiesDefeated = defeatedInSnapshot ?? (result.victory ? totalEnemies : 0)

  return {
    type: 'combat',
    victory: result.victory,
    enemiesDefeated,
    totalEnemies,
    heroHpLost: Math.max(0, startingResources.hp - finalHero.hp),
    heroMpLost: Math.max(0, startingResources.mp - finalHero.mp),
    heroHpRemaining: finalHero.hp,
    heroMpRemaining: finalHero.mp,
    log: result.log.slice(-40).map(entry => entry.message),
  }
}
