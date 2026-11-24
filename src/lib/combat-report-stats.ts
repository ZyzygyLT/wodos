import type { LevelReport, RoundReport, DetailedAction } from "@/lib/combat-engine/dungeon-runner"

export interface HeroStats {
  heroId: string
  heroName: string
  totalDamageDealt: number
  damageByType: Record<string, number>
  totalDamageTaken: number
  totalHealingDone: number
  kills: number
  totalActions: number
  successfulAttacks: number
  totalAttacks: number
  dodged: number
  blocked: number
  barriered: number
  totalManaSpent: number
  buffsUsed: number
  itemsUsed: number
  totalDamageAbsorbed: number
}

export function computeCombatStats(levelReports: LevelReport[]): HeroStats[] {
  const statsMap = new Map<string, HeroStats>()

  for (const level of levelReports) {
    for (const round of level.rounds) {
      const hpMap = buildHpMap(round)
      // Register the whole party before processing actions: a hero can be hit
      // before their first turn, and must still receive defensive statistics.
      for (const hero of round.stateBefore.heroes) {
        ensureStats(statsMap, hero.id, hero.name)
      }

      for (const action of round.actions) {
        const actor = statsMap.get(action.actorId)
        if (actor) {
          actor.totalActions++
          trackHealing(action, actor, hpMap)
          actor.totalManaSpent += action.mpCost ?? 0
          if (action.buffName) actor.buffsUsed++
          if (action.itemName) actor.itemsUsed++
        }
        trackActionTargets(action, actor, statsMap, hpMap)
      }
    }
  }

  return Array.from(statsMap.values())
}

function createStats(id: string, name: string): HeroStats {
  return {
    heroId: id,
    heroName: name,
    totalDamageDealt: 0,
    damageByType: {},
    totalDamageTaken: 0,
    totalHealingDone: 0,
    kills: 0,
    totalActions: 0,
    successfulAttacks: 0,
    totalAttacks: 0,
    dodged: 0,
    blocked: 0,
    barriered: 0,
    totalManaSpent: 0,
    buffsUsed: 0,
    itemsUsed: 0,
    totalDamageAbsorbed: 0,
  }
}

function ensureStats(map: Map<string, HeroStats>, id: string, name: string): HeroStats {
  let stats = map.get(id)
  if (!stats) {
    stats = createStats(id, name)
    map.set(id, stats)
  }
  return stats
}

function buildHpMap(round: RoundReport): Map<string, number> {
  const hpMap = new Map<string, number>()
  for (const unit of round.stateBefore.heroes) hpMap.set(unit.id, unit.hp)
  for (const unit of round.stateBefore.enemies) hpMap.set(unit.id, unit.hp)
  return hpMap
}

function damageTotal(breakdown: DetailedAction["damageBreakdown"]): number {
  return breakdown?.reduce((total, entry) => total + entry.value, 0) ?? 0
}

function trackActionTargets(
  action: DetailedAction,
  actor: HeroStats | undefined,
  statsMap: Map<string, HeroStats>,
  hpMap: Map<string, number>,
): void {
  const targets = action.targetResults?.length
    ? action.targetResults
    : action.targetId
      ? [{
          targetId: action.targetId,
          targetName: action.targetName ?? action.targetId,
          resultType: action.resultType,
          defenseEffect: action.defenseEffect,
          damageBreakdown: action.damageBreakdown,
          absorbed: action.absorbed,
        }]
      : []

  for (const target of targets) {
    const damage = damageTotal(target.damageBreakdown)
    if (actor && damage > 0) {
      actor.totalDamageDealt += damage
      for (const entry of target.damageBreakdown ?? []) {
        actor.damageByType[entry.type] = (actor.damageByType[entry.type] ?? 0) + entry.value
      }
    }

    if (target.resultType != null) {
      if (actor) {
        actor.totalAttacks++
        if (target.resultType !== "failed") actor.successfulAttacks++
      }
    }

    const previousHp = hpMap.get(target.targetId)
    if (previousHp !== undefined && damage > 0) {
      const nextHp = Math.max(0, previousHp - damage)
      hpMap.set(target.targetId, nextHp)
      if (actor && previousHp > 0 && nextHp === 0) actor.kills++
    }

    const defender = statsMap.get(target.targetId)
    if (defender) {
      defender.totalDamageTaken += damage
      defender.totalDamageAbsorbed += target.absorbed ?? 0
      if (target.resultType === "failed") {
        if (target.defenseEffect === "dodge") defender.dodged++
        else if (target.defenseEffect === "block") defender.blocked++
        else if (target.defenseEffect === "barrier") defender.barriered++
      }
    }
  }
}

function trackHealing(action: DetailedAction, actor: HeroStats, hpMap: Map<string, number>): void {
  if (!action.healAmount || action.healAmount <= 0 || action.healType === "mp") return
  actor.totalHealingDone += action.healAmount
  if (action.targetId) {
    const previousHp = hpMap.get(action.targetId)
    if (previousHp !== undefined) hpMap.set(action.targetId, previousHp + action.healAmount)
  }
}
