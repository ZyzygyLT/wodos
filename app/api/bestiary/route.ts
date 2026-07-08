import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const enemies = await db.enemy.findMany({ orderBy: { level: "asc" } })
  const dungeons = await db.dungeon.findMany({ where: { clanId: null } })

  const skillIds = [...new Set(enemies.flatMap(e => e.skillIds))]
  const skills = skillIds.length > 0
    ? await db.skill.findMany({ where: { id: { in: skillIds } }, select: { id: true, name: true, icon: true, description: true, manaCost: true, cooldownRounds: true } })
    : []
  const skillMap = new Map(skills.map(s => [s.id, s]))

  const enemyAppearances = buildEnemyAppearances(dungeons)

  const result = enemies.map(e => ({
    id: e.id,
    name: e.name,
    icon: e.icon,
    level: e.level,
    hp: e.hp,
    mp: e.mp,
    atk: e.atk,
    def: e.def,
    dx: e.dx,
    ag: e.ag,
    position: e.position,
    faction: e.faction,
    damageType: e.damageType,
    conditions: e.conditions,
    ai: e.ai,
    skills: (e.skillIds ?? []).map(id => skillMap.get(id)).filter(Boolean),
    appearances: enemyAppearances.get(e.id) ?? [],
    isBoss: isBossInDungeon(e, dungeons, enemyAppearances),
  }))

  const heroKills = await db.dungeonRun.findMany({
    where: { heroId: hero.id, status: "done", result: "victory" },
    select: { levelReports: true },
  })

  const killCounts = computeKillCounts(heroKills)

  return NextResponse.json({ enemies: result, heroKills: Object.fromEntries(killCounts) })
}

function buildEnemyAppearances(dungeons: any[]) {
  const enemyAppearances = new Map<number, { dungeonId: number; dungeonName: string; dungeonIcon: string; levelNumber: number }[]>()
  for (const d of dungeons) {
    const levels = (d.levels ?? []) as any[]
    for (const lv of levels) {
      for (const e of (lv.enemies ?? [])) {
        if (!enemyAppearances.has(e.id)) enemyAppearances.set(e.id, [])
        enemyAppearances.get(e.id)!.push({ dungeonId: d.id, dungeonName: d.name, dungeonIcon: d.icon, levelNumber: lv.number })
      }
    }
  }
  return enemyAppearances
}

function isBossInDungeon(enemy: any, dungeons: any[], appearances: Map<number, any[]>): boolean {
  return (appearances.get(enemy.id) ?? []).some(a => {
    const d = dungeons.find(dd => dd.id === a.dungeonId)
    const lv = ((d?.levels ?? []) as any[]).find((l: any) => l.number === a.levelNumber)
    return (lv?.enemies ?? []).some((en: any) => en.id === enemy.id && en.isBoss)
  })
}

function computeKillCounts(heroKills: any[]) {
  const killCounts = new Map<number, number>()
  for (const run of heroKills) {
    const reports = (run.levelReports ?? []) as any[]
    for (const lv of reports) {
      for (const round of (lv.rounds ?? [])) {
        for (const action of (round.actions ?? [])) {
          countKillsFromAction(action, killCounts)
        }
      }
    }
  }
  return killCounts
}

function countKillsFromAction(action: any, killCounts: Map<number, number>) {
  countKillsFromTargetResults(action.targetResults, killCounts)
  countKillFromDirectHit(action, killCounts)
}

function countKillsFromTargetResults(results: any[] | undefined, killCounts: Map<number, number>) {
  if (!results) return
  for (const tr of results) {
    if (isDeadEnemyTarget(tr)) incrementKillCount(Number.parseInt(tr.targetId), killCounts)
  }
}

function countKillFromDirectHit(action: any, killCounts: Map<number, number>) {
  if (!action.targetId || action.targetId.startsWith("hero") || !action.damageBreakdown) return
  const tr0 = action.targetResults?.[0]
  if (!tr0 || tr0.hpAfter === undefined || tr0.hpAfter > 0) return
  incrementKillCount(Number.parseInt(action.targetId), killCounts)
}

function isDeadEnemyTarget(tr: any): boolean {
  return tr.hpAfter !== undefined && tr.hpAfter <= 0 && tr.targetId && !tr.targetId.startsWith("hero")
}

function incrementKillCount(eid: number, killCounts: Map<number, number>) {
  if (!Number.isNaN(eid)) killCounts.set(eid, (killCounts.get(eid) ?? 0) + 1)
}
