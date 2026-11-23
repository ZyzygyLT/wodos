import type { HeroData } from '@/lib/combat-engine/dungeon-runner'
import type { Prisma } from '@/generated/prisma'
import { ENERGY_RECHARGE_INTERVAL_MINUTES } from './types'

export const ADVENTURE_STATUSES_BLOCKING_NEW_START = ['active', 'completed'] as const

export function isAdventureBlockingNewStart(status: string): boolean {
  return (ADVENTURE_STATUSES_BLOCKING_NEW_START as readonly string[]).includes(status)
}
import type {
  AdventureStep, AdventureStepEnemy, AdventureRewardTable, AdventureChoice,
  CombatStepResult, StepRewards,
} from './types'

export function calcEnergyRecharge(lastRechargeAt: Date | null): number {
  if (!lastRechargeAt) return 0
  const elapsedMinutes = (Date.now() - lastRechargeAt.getTime()) / 60000
  const earned = Math.floor(elapsedMinutes / ENERGY_RECHARGE_INTERVAL_MINUTES)
  return Math.max(0, earned)
}

/** Preserve partial recharge time unless the energy cap has been reached. */
export function getNextEnergyRechargeAt(
  lastRechargeAt: Date | null,
  earned: number,
  energyAfterRecharge: number,
  energyMax: number,
  now: Date = new Date(),
): Date {
  if (!lastRechargeAt || energyAfterRecharge >= energyMax) return now
  return new Date(lastRechargeAt.getTime() + earned * ENERGY_RECHARGE_INTERVAL_MINUTES * 60_000)
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
  heroStats: { hpMax: number; mpMax: number; hpCurrent?: number; mpCurrent?: number; attrs: Record<string, number>; level: number },
  enemies: AdventureStepEnemy[],
): CombatStepResult {
  const heroAtk = (heroStats.attrs.st ?? 10) + Math.floor((heroStats.attrs.dx ?? 10) / 2)
  const heroDef = 2 * (heroStats.attrs.ag ?? 10) + (heroStats.attrs.pe ?? 10)
  const log: string[] = []
  let totalHpLoss = 0
  let totalMpLoss = 0
  let remainingHp = Math.max(0, Math.min(heroStats.hpMax, heroStats.hpCurrent ?? heroStats.hpMax))
  let remainingMp = Math.max(0, Math.min(heroStats.mpMax, heroStats.mpCurrent ?? heroStats.mpMax))
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
    const mpLost = Math.min(remainingMp, Math.round(heroStats.mpMax * 0.02 * actualRounds))
    remainingHp -= hpLost
    remainingMp -= mpLost
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
    heroHpRemaining: remainingHp,
    heroMpRemaining: remainingMp,
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


/** Mark a voluntary exit without discarding the adventure's recorded progress or rewards. */
export function markAdventureAbandoned(result: unknown): Prisma.InputJsonObject {
  const preserved = result !== null && typeof result === 'object' && !Array.isArray(result)
    ? result as Record<string, unknown>
    : {}
  return { ...preserved, outcome: 'abandoned' } as Prisma.InputJsonObject
}


/** Combine adventure-wide rewards with every reward granted by an individual step. */
export function combineAdventureRewards(
  globalRewards: StepRewards | null | undefined,
  steps: Array<{ type?: string; rewards?: StepRewards | null }> = [],
): StepRewards {
  const combined: StepRewards = { ...globalRewards }

  for (const step of steps) {
    if (step.type !== 'reward' || !step.rewards) continue
    const rewards = step.rewards

    if (typeof rewards.gold === 'number') combined.gold = (combined.gold ?? 0) + rewards.gold
    if (typeof rewards.ep === 'number') combined.ep = (combined.ep ?? 0) + rewards.ep
    if (typeof rewards.fame === 'number') combined.fame = (combined.fame ?? 0) + rewards.fame
    if (rewards.items?.length) combined.items = [...(combined.items ?? []), ...rewards.items]
    if (rewards.materials?.length) combined.materials = [...(combined.materials ?? []), ...rewards.materials]
  }

  return combined
}


/** Combine adventure-wide rewards with every reward granted by an individual step. */
export function combineAdventureRewards(
  globalRewards: StepRewards | null | undefined,
  steps: Array<{ type?: string; rewards?: StepRewards | null }> = [],
): StepRewards {
  const combined: StepRewards = { ...globalRewards }
  for (const step of steps) {
    if (step.type !== 'reward' || !step.rewards) continue
    const rewards = step.rewards
    if (typeof rewards.gold === 'number') combined.gold = (combined.gold ?? 0) + rewards.gold
    if (typeof rewards.ep === 'number') combined.ep = (combined.ep ?? 0) + rewards.ep
    if (typeof rewards.fame === 'number') combined.fame = (combined.fame ?? 0) + rewards.fame
    if (rewards.items?.length) combined.items = [...(combined.items ?? []), ...rewards.items]
    if (rewards.materials?.length) combined.materials = [...(combined.materials ?? []), ...rewards.materials]
  }
  return combined
}
