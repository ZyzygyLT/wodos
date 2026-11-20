import { runDungeon, DungeonData, EnemyData, HeroData } from "./dungeon-runner"
import { calcEloChange } from "./formulas"
import db from "@/lib/db"
import { buildHeroData } from "@/lib/dungeon-helpers"
import { computeCombatStats } from "@/lib/combat-report-stats"
import { mergeHeroAttrs } from "@/lib/dungeon-helpers"
import { calcDefenseBase, type HeroAttrs } from "@/lib/combat-engine/formulas"

const DUEL_GOLD_COST = 10
const DUEL_COOLDOWN_MS = 5 * 60 * 1000

/** Build the arena opponent from the same resolved attributes and equipment as its hero loadout. */
export function heroDataToArenaOpponent(hero: HeroData, position: string): EnemyData {
  const attrs = mergeHeroAttrs(hero)
  return {
    id: -1,
    name: hero.name,
    icon: "⚔️",
    hp: hero.hpMax,
    mp: hero.mpMax,
    atk: (attrs.st ?? 10) + (attrs.dx ?? 10) / 2,
    def: calcDefenseBase(attrs as HeroAttrs),
    dx: attrs.dx ?? 10,
    ag: attrs.ag ?? 10,
    level: hero.level,
    position,
    attrs,
    skills: hero.skills.map(s => ({
      skillId: s.skillId,
      name: s.name ?? `skill_${s.skillId}`,
      icon: s.icon ?? "⚔️",
      effect: s.effect,
      multiplier: s.multiplier,
      manaCost: s.manaCost,
      cooldownRounds: s.cooldownRounds,
      formula: s.formula,
      ...(['melee', 'ranged', 'magic'] as const).reduce((result, category) => {
        if (hero.combatProfile.defenseSkills[category] === s.skillId && !result.defenseCategory) {
          result.defenseCategory = category
        }
        return result
      }, {} as { defenseCategory?: 'melee' | 'ranged' | 'magic' }),
    })),
  }
}

export async function runArenaDuel(hero1Id: string, hero2Id: string) {
  if (hero1Id === hero2Id) throw new Error("No puedes duelarte a ti mismo")

  return db.$transaction(async tx => {
    // Lock both participants in a stable order to serialize duels and resource writes.
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" IN (${hero1Id}, ${hero2Id}) ORDER BY "id" FOR UPDATE`

    const [h1, h2] = await Promise.all([
      tx.hero.findUnique({
        where: { id: hero1Id },
        include: {
          class: true,
          skills: { include: { skill: true } },
          combatProfiles: { orderBy: { createdAt: "asc" } },
          items: { include: { item: true } },
        },
      }),
      tx.hero.findUnique({
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

    const lastDuel = await tx.duelHistory.findFirst({
      where: { OR: [{ hero1Id: h1.id }, { hero2Id: h1.id }] },
      orderBy: { foughtAt: "desc" },
      select: { foughtAt: true },
    })
    if (lastDuel) {
      const remainingMs = DUEL_COOLDOWN_MS - (Date.now() - lastDuel.foughtAt.getTime())
      if (remainingMs > 0) {
        throw new Error(`DUEL_COOLDOWN:${Math.ceil(remainingMs / 1000)}`)
      }
    }

    if (h1.gold < DUEL_GOLD_COST) {
      throw new Error(`Oro insuficiente. Necesitás ${DUEL_GOLD_COST}💰`)
    }

    const profile1 = h1.combatProfiles.find(p => p.dungeonLevel === null) ?? h1.combatProfiles[0]
    const profile2 = h2.combatProfiles.find(p => p.dungeonLevel === null) ?? h2.combatProfiles[0]

    const heroData1 = await buildHeroData(h1, profile1)
    const heroData2 = await buildHeroData(h2, profile2)

    // Convert hero2 using the same resolved equipment and canonical attributes as hero1.
    const hero2AsEnemy = heroDataToArenaOpponent(heroData2, profile2?.position ?? "front")

    const dungeonData: DungeonData = {
      id: -1,
      name: "Arena",
      levels: [{
        number: 1,
        enemies: [hero2AsEnemy as any],
        epReward: 0,
        goldReward: 0,
      }],
      epReward: 0,
      goldReward: 0,
      fameReward: 0,
      lootTable: [],
    }

    // Arena fights are simulations: consumables must not provide free healing or be consumed.
    heroData1.consumables = []
    const result = await runDungeon([heroData1], dungeonData)
    const hero1Alive = result.heroesFinalState.some(h => h.id === heroData1.id && h.hp > 0)
    const h1Won = hero1Alive

    const eloChange1 = calcEloChange(h1.eloRating, h2.eloRating, h1Won)
    const eloChange2 = calcEloChange(h2.eloRating, h1.eloRating, !h1Won)

    // Do not write HP/MP: arena combat is simulated and must not heal or overwrite
    // resources changed by a consumable or another legitimate operation.
    const charged = await tx.hero.updateMany({
      where: { id: h1.id, gold: { gte: DUEL_GOLD_COST } },
      data: {
        eloRating: { increment: eloChange1 },
        ...(h1Won ? { arenaWins: { increment: 1 } } : { arenaLosses: { increment: 1 } }),
        fame: { increment: h1Won ? 15 : -5 },
        gold: { decrement: DUEL_GOLD_COST },
      },
    })
    if (charged.count !== 1) throw new Error("Oro insuficiente. Necesitás 10💰")

    await tx.hero.update({
      where: { id: h2.id },
      data: {
        eloRating: { increment: eloChange2 },
        ...(h1Won ? { arenaLosses: { increment: 1 } } : { arenaWins: { increment: 1 } }),
        fame: { increment: h1Won ? -5 : 15 },
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
  }, { maxWait: 10_000, timeout: 30_000 })
}
