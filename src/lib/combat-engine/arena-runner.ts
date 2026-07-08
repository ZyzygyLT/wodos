import { runDungeon, DungeonData } from "./dungeon-runner"
import { calcEloChange } from "./formulas"
import db from "@/lib/db"
import { buildHeroData } from "@/lib/dungeon-helpers"
import { computeCombatStats } from "@/lib/combat-report-stats"

const DUEL_GOLD_COST = 10

export async function runArenaDuel(hero1Id: string, hero2Id: string) {
  const [h1, h2] = await Promise.all([
    db.hero.findFirst({
      where: { id: hero1Id },
      include: {
        class: true,
        skills: { include: { skill: true } },
        combatProfiles: { orderBy: { createdAt: "asc" } },
        items: { include: { item: true } },
      },
    }),
    db.hero.findFirst({
      where: { id: hero2Id },
      include: {
        class: true,
        skills: { include: { skill: true } },
        combatProfiles: { orderBy: { createdAt: "asc" } },
        items: { include: { item: true } },
      },
    }),
  ])

  if (!h1 || !h2) throw new Error("Héroe no encontrado")

  if (h1.gold < DUEL_GOLD_COST) {
    throw new Error(`Oro insuficiente. Necesitás ${DUEL_GOLD_COST}💰`)
  }

  const profile1 = h1.combatProfiles.find(p => p.dungeonLevel === null) ?? h1.combatProfiles[0]
  const profile2 = h2.combatProfiles.find(p => p.dungeonLevel === null) ?? h2.combatProfiles[0]

  const heroData1 = await buildHeroData(h1, profile1)
  const heroData2 = await buildHeroData(h2, profile2)

  const dungeonData: DungeonData = {
    id: -1,
    name: "Arena",
    levels: [
      {
        number: 1,
        enemies: [],
        epReward: 0,
        goldReward: 0,
      },
    ],
    epReward: 0,
    goldReward: 0,
    fameReward: 0,
    lootTable: [],
  }

  const result = await runDungeon([heroData1, heroData2], dungeonData)

  const hero1Alive = result.heroesFinalState.some(h => h.id === heroData1.id && h.hp > 0)
  const h1Won = hero1Alive

  const eloChange1 = calcEloChange(h1.eloRating, h2.eloRating, h1Won)
  const eloChange2 = calcEloChange(h2.eloRating, h1.eloRating, !h1Won)

  await db.$transaction(async (tx) => {
    await tx.hero.update({
      where: { id: h1.id },
      data: {
        eloRating: { increment: eloChange1 },
        arenaWins: h1Won ? { increment: 1 } : undefined,
        arenaLosses: h1Won ? undefined : { increment: 1 },
        fame: { increment: h1Won ? 15 : -5 },
        gold: { decrement: DUEL_GOLD_COST },
        hpCurrent: h1.hpMax,
        mpCurrent: h1.mpMax,
      },
    })
    await tx.hero.update({
      where: { id: h2.id },
      data: {
        eloRating: { increment: eloChange2 },
        arenaWins: h1Won ? undefined : { increment: 1 },
        arenaLosses: h1Won ? { increment: 1 } : undefined,
        fame: { increment: h1Won ? -5 : 15 },
        hpCurrent: h2.hpMax,
        mpCurrent: h2.mpMax,
      },
    })

    await tx.duelHistory.create({
      data: {
        hero1Id: h1.id,
        hero2Id: h2.id,
        winnerId: h1Won ? h1.id : h2.id,
        eloChange1,
        eloChange2,
        rounds: result.totalRounds,
        log: result.log.slice(-10).map(l => l.message) as any,
        goldCost: DUEL_GOLD_COST,
      },
    })
  })

  const allStats = computeCombatStats(result.levelReports)
  const hero1Stats = allStats.find(s => s.heroId === heroData1.id)
  const hero2Stats = allStats.find(s => s.heroId === heroData2.id)
  const defenseStats = {
    hero: { dodged: hero1Stats?.dodged ?? 0, blocked: hero1Stats?.blocked ?? 0, barriered: hero1Stats?.barriered ?? 0 },
    enemy: { dodged: hero2Stats?.dodged ?? 0, blocked: hero2Stats?.blocked ?? 0, barriered: hero2Stats?.barriered ?? 0 },
  }

  return {
    winner: h1Won ? h1.name : h2.name,
    loser: h1Won ? h2.name : h1.name,
    won: h1Won,
    eloChange: eloChange1,
    opponentLevel: h2.level,
    rounds: result.totalRounds,
    log: result.log.slice(-5).map(l => l.message),
    defenseStats,
  }
}
