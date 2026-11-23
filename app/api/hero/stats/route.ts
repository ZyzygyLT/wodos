import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const runs = await db.dungeonRun.findMany({
    where: { heroId: hero.id, status: { in: ["done", "failed"] } },
    include: { dungeon: { select: { id: true, name: true, icon: true, difficulty: true, difficultyLabel: true } } },
    orderBy: { createdAt: "asc" },
  })

  const totalRuns = runs.length
  const victories = runs.filter(r => r.result === "victory").length
  const defeats = runs.filter(r => r.result === "defeat").length
  const totalEp = runs.reduce((s, r) => s + (r.epGained ?? 0), 0)
  const totalGold = runs.reduce((s, r) => s + (r.goldGained ?? 0), 0)
  const totalFame = runs.reduce((s, r) => s + (r.fameGained ?? 0), 0)
  const totalLevelsCleared = runs.reduce((s, r) => s + (r.levelsCleared ?? 0), 0)

  const dungeonStats = buildDungeonStats(runs)
  const combatCounters = computeCombatCounters(runs)
  const firstRun = runs.length > 0 ? runs[0].createdAt : null
  const lastRun = runs.length > 0 ? runs.at(-1)!.createdAt : null

  return buildStatsResponse(totalRuns, victories, defeats, totalEp, totalGold, totalFame, totalLevelsCleared, firstRun, lastRun, dungeonStats, combatCounters)
}

interface CombatCounters {
  killByEnemy: Record<string, { name: string; icon: string; count: number }>
  damageByType: Record<string, number>
  totalDamageDealt: number
  totalDamageTaken: number
  totalHealingDone: number
  totalActions: number
  criticalHits: number
  dodges: number
  blocks: number
}

function buildDungeonStats(runs: any[]) {
  const stats: Record<number, { name: string; icon: string; runs: number; wins: number; totalEp: number; totalGold: number; difficulty: number; difficultyLabel: string }> = {}
  for (const r of runs) {
    mergeDungeonRunIntoStats(r, stats)
  }
  return Object.values(stats).sort((a, b) => b.runs - a.runs)
}

function mergeDungeonRunIntoStats(r: any, stats: Record<number, any>) {
  const d = stats[r.dungeonId]
  if (d) {
    d.runs++
    if (r.result === "victory") d.wins++
    d.totalEp += r.epGained ?? 0
    d.totalGold += r.goldGained ?? 0
  } else {
    stats[r.dungeonId] = {
      name: r.dungeon.name, icon: r.dungeon.icon,
      runs: 1, wins: r.result === "victory" ? 1 : 0,
      totalEp: r.epGained ?? 0, totalGold: r.goldGained ?? 0,
      difficulty: r.dungeon.difficulty, difficultyLabel: r.dungeon.difficultyLabel,
    }
  }
}

function buildStatsResponse(totalRuns: number, victories: number, defeats: number, totalEp: number, totalGold: number, totalFame: number, totalLevelsCleared: number, firstRun: Date | null, lastRun: Date | null, dungeonStats: any[], combatCounters: CombatCounters) {
  return NextResponse.json({
    summary: {
      totalRuns, victories, defeats,
      winRate: totalRuns > 0 ? Math.round((victories / totalRuns) * 100) : 0,
      totalEp, totalGold, totalFame,
      totalLevelsCleared,
      firstRun, lastRun,
    },
    dungeonStats,
    topEnemies: Object.values(combatCounters.killByEnemy).sort((a, b) => b.count - a.count).slice(0, 10),
    combatStats: {
      totalDamageDealt: combatCounters.totalDamageDealt,
      totalDamageTaken: combatCounters.totalDamageTaken,
      totalHealingDone: combatCounters.totalHealingDone,
      totalActions: combatCounters.totalActions,
      criticalHits: combatCounters.criticalHits,
      dodges: combatCounters.dodges,
      blocks: combatCounters.blocks,
      avgDamagePerAction: combatCounters.totalActions > 0 ? Math.round(combatCounters.totalDamageDealt / combatCounters.totalActions) : 0,
    },
  })
}

function computeCombatCounters(runs: any[]): CombatCounters {
  const killByEnemy: Record<string, { name: string; icon: string; count: number }> = {}
  const counters = { totalDamageDealt: 0, totalDamageTaken: 0, totalHealingDone: 0, totalActions: 0, criticalHits: 0, dodges: 0, blocks: 0 }

  for (const r of runs) {
    const reports = (r.levelReports ?? []) as any[]
    for (const lv of reports) {
      for (const round of (lv.rounds ?? [])) {
        for (const action of (round.actions ?? [])) {
          processCombatAction(action, killByEnemy, counters)
        }
      }
    }
  }

  const { totalDamageDealt, totalDamageTaken, totalHealingDone, totalActions, criticalHits, dodges, blocks } = counters
  return { killByEnemy, damageByType: {}, totalDamageDealt, totalDamageTaken, totalHealingDone, totalActions, criticalHits, dodges, blocks }
}

function processCombatAction(action: any, killByEnemy: Record<string, any>, counters: Record<string, number>) {
  counters.totalActions++
  if (action.criticalHits) counters.criticalHits += action.criticalHits
  counters.totalDamageDealt += processEnemyDamage(action, killByEnemy)
  counters.totalDamageTaken += processHeroDamageTaken(action)
  if (action.healAmount) counters.totalHealingDone += action.healAmount
  if (action.defenseEffect === "dodge") counters.dodges++
  if (action.defenseEffect === "block") counters.blocks++
}

function processEnemyDamage(action: any, killByEnemy: Record<string, any>): number {
  if (!action.targetResults) return 0
  let totalDmg = 0
  for (const tr of action.targetResults) {
    if (!tr.targetId || tr.targetId.startsWith("hero")) continue
    const dmg = action.damageBreakdown?.reduce((s: number, d: any) => s + d.value, 0) ?? 0
    totalDmg += dmg
    if (dmg > 0 && tr.hpAfter !== undefined && tr.hpAfter <= 0) {
      const eid = tr.targetId
      if (!killByEnemy[eid]) killByEnemy[eid] = { name: tr.targetName ?? eid, icon: tr.targetIcon ?? "❓", count: 0 }
      killByEnemy[eid].count++
    }
  }
  return totalDmg
}

function processHeroDamageTaken(action: any): number {
  if (!action.targetResults) return 0
  let totalDmg = 0
  for (const tr of action.targetResults) {
    if (!tr.targetId?.startsWith("hero")) continue
    totalDmg += action.damageBreakdown?.reduce((s: number, d: any) => s + d.value, 0) ?? 0
  }
  return totalDmg
}
