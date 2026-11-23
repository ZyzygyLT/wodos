import type { HeroData } from '@/lib/combat-engine/dungeon-runner'
import type { Prisma } from '@/generated/prisma'
import { ENERGY_RECHARGE_INTERVAL_MINUTES } from './types'

/** Attach destination details to every choice so previews stay available after each transition. */
export function withAdventureChoicePreviews(
  step: AdventureStep | undefined,
  steps: AdventureStep[],
): AdventureStep | null {
  if (!step) return null
  if (step.type !== 'choice') return step

  return {
    ...step,
    choices: step.choices?.map(choice => ({
      ...choice,
      nextStepName: choice.skillCheck ? undefined : steps[choice.nextStep]?.name ?? null,
      nextStepDescription: choice.skillCheck ? undefined : steps[choice.nextStep]?.description ?? null,
      passStepName: choice.skillCheck ? steps[choice.skillCheck.passStep]?.name ?? null : undefined,
      passStepDescription: choice.skillCheck ? steps[choice.skillCheck.passStep]?.description ?? null : undefined,
      failStepName: choice.skillCheck ? steps[choice.skillCheck.failStep]?.name ?? null : undefined,
      failStepDescription: choice.skillCheck ? steps[choice.skillCheck.failStep]?.description ?? null : undefined,
    })),
  }
}

export const ADVENTURE_STATUSES_BLOCKING_NEW_START = ['active', 'completed', 'failed'] as const

export function isAdventureBlockingNewStart(status: string, result?: unknown): boolean {
  if (status === 'active' || status === 'completed') return true
  return status === 'failed' && canClaimAdventureRewards(status, result)
}

/** Defeat preserves only rewards explicitly earned in completed reward steps. */
export function canClaimAdventureRewards(status: string, result: unknown): boolean {
  if (status === 'completed') return true
  if (status !== 'failed' || result === null || typeof result !== 'object' || Array.isArray(result)) return false
  const data = result as { outcome?: unknown; steps?: unknown }
  return data.outcome === 'defeated' && Array.isArray(data.steps) &&
    data.steps.some(step => step !== null && typeof step === 'object' &&
      !Array.isArray(step) && (['reward', 'choice'].includes(String((step as { type?: unknown }).type))) &&
      (step as { rewards?: unknown }).rewards !== null &&
      typeof (step as { rewards?: unknown }).rewards === 'object')
}
import type {
  AdventureStep, AdventureStepEnemy, AdventureRewardTable, AdventureChoice,
  CombatStepResult, StepRewards,
} from './types'

/** True when an adventure contains an encounter that requires a living hero. */
export function adventureRequiresCombat(steps: AdventureStep[]): boolean {
  return steps.some(step => step.type === 'combat')
}

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
    if ((step.type !== 'reward' && step.type !== 'choice') || !step.rewards) continue
    const rewards = step.rewards

    if (typeof rewards.gold === 'number') combined.gold = (combined.gold ?? 0) + rewards.gold
    if (typeof rewards.ep === 'number') combined.ep = (combined.ep ?? 0) + rewards.ep
    if (typeof rewards.fame === 'number') combined.fame = (combined.fame ?? 0) + rewards.fame
    if (rewards.items?.length) combined.items = [...(combined.items ?? []), ...rewards.items]
    if (rewards.materials?.length) combined.materials = [...(combined.materials ?? []), ...rewards.materials]
  }

  return combined
}
