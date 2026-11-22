import type { HeroData } from '@/lib/combat-engine/dungeon-runner'
import type {
  AdventureStep, AdventureStepEnemy, AdventureRewardTable, AdventureChoice,
  CombatStepResult, StepRewards,
} from './types'

export function calcEnergyRecharge(lastRechargeAt: Date | null): number {
  if (!lastRechargeAt) return 0
  const elapsedMinutes = (Date.now() - lastRechargeAt.getTime()) / 60000
  const earned = Math.floor(elapsedMinutes / 5)
  return Math.max(0, earned)
}

export function resolveAdventureChoice(
  choice: AdventureChoice,
  attrs: Record<string, number>,
  totalSteps: number,
): { nextStep: number; skillCheck?: { attr: string; dc: number; value: number; passed: boolean } } {
  if (!choice.skillCheck) {
    if (!Number.isInteger(choice.nextStep) || choice.nextStep < 0 || choice.nextStep >= totalSteps) {
      throw new Error("La opción apunta a un paso inválido")
    }
    return { nextStep: choice.nextStep }
  }

  const { attr, dc, passStep, failStep } = choice.skillCheck
  const value = attrs[attr]
  if (!Number.isFinite(dc) || !Number.isFinite(value)) {
    throw new Error("La prueba de atributo está mal configurada")
  }
  const passed = value >= dc
  const nextStep = passed ? passStep : failStep
  if (!Number.isInteger(nextStep) || nextStep < 0 || nextStep >= totalSteps) {
    throw new Error("La prueba apunta a un paso inválido")
  }

  return { nextStep, skillCheck: { attr, dc, value, passed } }
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
  let remainingHp = Math.max(0, heroStats.hpMax)
  let enemiesDefeated = 0

  for (const enemy of enemies) {
    if (remainingHp <= 0) break

    const heroDamage = Math.max(0, heroAtk - enemy.def * 0.5)
    const enemyDamage = Math.max(0, enemy.atk - heroDef * 0.3)
    const roundsToKillEnemy = Math.ceil(enemy.hp / Math.max(1, heroDamage))
    const roundsToKillHero = enemyDamage > 0
      ? Math.ceil(remainingHp / enemyDamage)
      : Number.POSITIVE_INFINITY
    const actualRounds = Math.min(roundsToKillEnemy, roundsToKillHero)
    const hpLost = Math.min(remainingHp, Math.round(enemyDamage * actualRounds))
    const mpLost = Math.round(heroStats.mpMax * 0.02 * actualRounds)
    remainingHp -= hpLost
    totalHpLoss += hpLost
    totalMpLoss += mpLost

    if (roundsToKillEnemy <= roundsToKillHero) {
      enemiesDefeated += 1
      log.push(`⚔️ ${enemy.name} derrotado en ${actualRounds} asaltos`)
    } else {
      log.push(`💀 ${enemy.name} te derrota tras ${actualRounds} asaltos`)
      break
    }
  }

  return {
    type: 'combat',
    victory: enemiesDefeated === enemies.length && remainingHp > 0,
    enemiesDefeated,
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
