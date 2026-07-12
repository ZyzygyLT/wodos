import type { HeroData } from '@/lib/combat-engine/dungeon-runner'
import type {
  AdventureStep, AdventureStepEnemy, AdventureRewardTable,
  CombatStepResult, StepRewards,
} from './types'

export function calcEnergyRecharge(lastRechargeAt: Date | null): number {
  if (!lastRechargeAt) return 0
  const elapsedMinutes = (Date.now() - lastRechargeAt.getTime()) / 60000
  const earned = Math.floor(elapsedMinutes / 5)
  return Math.max(0, earned)
}

export function resolveCombatStep(
  heroStats: { hpMax: number; mpMax: number; attrs: Record<string, number>; level: number },
  enemies: AdventureStepEnemy[],
): CombatStepResult {
  const heroAtk = (heroStats.attrs.st ?? 10) + Math.floor((heroStats.attrs.dx ?? 10) / 2)
  const heroDef = 2 * (heroStats.attrs.ag ?? 10) + (heroStats.attrs.pe ?? 10)
  const log: string[] = []
  let totalHpLoss = 0
  let totalMpLoss = 0
  let victory = true

  for (const enemy of enemies) {
    const heroDamage = Math.max(0, heroAtk - enemy.def * 0.5)
    const enemyDamage = Math.max(0, enemy.atk - heroDef * 0.3)
    const roundsToKillEnemy = Math.ceil(enemy.hp / Math.max(1, heroDamage))
    const roundsToKillHero = Math.ceil(heroStats.hpMax / Math.max(1, enemyDamage))
    const actualRounds = Math.min(roundsToKillEnemy, roundsToKillHero)
    const hpLost = Math.round(enemyDamage * actualRounds)
    const mpLost = Math.round(heroStats.mpMax * 0.02 * actualRounds)
    totalHpLoss += hpLost
    totalMpLoss += mpLost

    if (roundsToKillEnemy <= roundsToKillHero) {
      log.push(`⚔️ ${enemy.name} derrotado en ${actualRounds} asaltos`)
    } else {
      log.push(`💀 ${enemy.name} causa ${hpLost} de daño antes de caer`)
      victory = false
    }
  }

  return {
    type: 'combat',
    victory: victory && totalHpLoss < heroStats.hpMax,
    enemiesDefeated: enemies.length,
    totalEnemies: enemies.length,
    heroHpLost: totalHpLoss,
    heroMpLost: totalMpLoss,
    log,
  }
}

export function rollAdventureRewards(rewards: AdventureRewardTable): {
  gold: number; ep: number; fame: number; items: Array<{ itemId: number; qty: number }>; materials: Array<{ materialId: number; qty: number }>
} {
  const gold = rewards.goldMin + Math.floor(Math.random() * (rewards.goldMax - rewards.goldMin + 1))
  const items: Array<{ itemId: number; qty: number }> = []
  const materials: Array<{ materialId: number; qty: number }> = []

  for (const entry of rewards.items ?? []) {
    if (Math.random() * 100 < entry.chance) {
      items.push({ itemId: entry.itemId, qty: entry.qty })
    }
  }

  for (const entry of rewards.materials ?? []) {
    if (Math.random() * 100 < entry.chance) {
      materials.push({ materialId: entry.materialId, qty: entry.qty })
    }
  }

  return { gold, ep: rewards.ep, fame: rewards.fame, items, materials }
}
