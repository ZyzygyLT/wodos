import type { LevelReport } from "@/lib/combat-engine/dungeon-runner"

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
}

export function computeCombatStats(levelReports: LevelReport[]): HeroStats[] {
  const statsMap = new Map<string, HeroStats>()

  for (const level of levelReports) {
    for (const round of level.rounds) {
      const hpMap = buildHpMap(round)
      for (const action of round.actions) {
        const actor = ensureStats(statsMap, action.actorId, action.actorName)
        actor.totalActions++
        trackDamageOnActor(action, actor, hpMap)
        trackHealing(action, actor, hpMap)
        trackDefenseEffectsOnTargets(action, statsMap)
      }
    }
  }

  return Array.from(statsMap.values())
}

function ensureStats(map: Map<string, HeroStats>, id: string, name: string): HeroStats {
  let s = map.get(id)
  if (!s) {
    s = { heroId: id, heroName: name, totalDamageDealt: 0, damageByType: {}, totalDamageTaken: 0, totalHealingDone: 0, kills: 0, totalActions: 0, successfulAttacks: 0, totalAttacks: 0, dodged: 0, blocked: 0, barriered: 0 }
    map.set(id, s)
  }
  return s
}

function buildHpMap(round: any): Map<string, number> {
  const hpMap = new Map<string, number>()
  for (const h of round.stateBefore.heroes) hpMap.set(h.id, h.hp)
  for (const e of round.stateBefore.enemies) hpMap.set(e.id, e.hp)
  return hpMap
}

function trackDamageOnActor(action: any, actor: HeroStats, hpMap: Map<string, number>) {
  if (!action.damageBreakdown || action.damageBreakdown.length === 0) return
  const totalDmg = action.damageBreakdown.reduce((s: number, d: any) => s + d.value, 0)
  actor.totalDamageDealt += totalDmg
  for (const d of action.damageBreakdown) {
    actor.damageByType[d.type] = (actor.damageByType[d.type] ?? 0) + d.value
  }
  const isAttack = action.resultType != null
  if (isAttack) {
    actor.totalAttacks++
    if (action.resultType !== 'failed') actor.successfulAttacks++
  }
  if (action.targetId) {
    const prevHp = hpMap.get(action.targetId) ?? 0
    const newHp = Math.max(0, prevHp - totalDmg)
    hpMap.set(action.targetId, newHp)
    if (prevHp > 0 && newHp <= 0) actor.kills++
  }
}

function trackHealing(action: any, actor: HeroStats, hpMap: Map<string, number>) {
  if (!action.healAmount || action.healAmount <= 0) return
  actor.totalHealingDone += action.healAmount
  if (action.targetId) {
    const prev = hpMap.get(action.targetId) ?? 0
    hpMap.set(action.targetId, prev + action.healAmount)
  }
}

function trackDefenseEffectsOnTargets(action: any, statsMap: Map<string, HeroStats>) {
  for (const s of statsMap.values()) {
    if (s.heroId === action.actorId) continue
    if (action.targetId === s.heroId && action.damageBreakdown) {
      const dmg = action.damageBreakdown.reduce((sum: number, d: any) => sum + d.value, 0)
      s.totalDamageTaken += dmg
    }
    if (action.targetId === s.heroId && action.resultType === 'failed' && action.defenseEffect) {
      if (action.defenseEffect === 'dodge') s.dodged++
      else if (action.defenseEffect === 'block') s.blocked++
      else if (action.defenseEffect === 'barrier') s.barriered++
    }
  }
}
