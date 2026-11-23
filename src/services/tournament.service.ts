import db from '@/lib/db'
import { runDungeon, DungeonData } from '@/lib/combat-engine/dungeon-runner'
import { buildHeroData } from '@/lib/dungeon-helpers'
import { notify } from "@/lib/notifications/emitter"
import logger from "@/lib/logger"
import { distributeRewards } from '@/lib/arena/tournament'

export interface TournamentAdvanceResult {
  advanced: boolean
  status: string
  bracketGenerated?: boolean
  error?: string
}

async function handleRegistrationBracket(tournament: any) {
  if (tournament.participants.length < 2) {
    return { advanced: false, status: 'registration', error: 'Se necesitan al menos 2 participantes' }
  }

  const shuffled = [...tournament.participants].sort(() => Math.random() - 0.5)
  const total = shuffled.length
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(total)))

  await db.$transaction(
    shuffled.map((p: any, i: number) =>
      db.tournamentParticipant.update({ where: { id: p.id }, data: { seed: i + 1 } })
    )
  )

  await createFirstRoundMatches(tournament.id, shuffled, nextPow2)
  await db.tournament.update({ where: { id: tournament.id }, data: { status: 'active' } })
  return { advanced: true, status: 'active', bracketGenerated: true }
}

async function createFirstRoundMatches(tournamentId: string, shuffled: any[], nextPow2: number) {
  for (let i = 0; i < nextPow2; i += 2) {
    const h1 = shuffled[i]
    const h2 = shuffled[i + 1]
    const matchData = {
      tournamentId,
      round: 1,
      matchNumber: Math.floor(i / 2) + 1,
      hero1Id: h1.heroId,
      hero2Id: h2?.heroId ?? null,
    }
    if (matchData.hero2Id === null) {
      await db.tournamentMatch.create({
        data: { ...matchData, hero2Id: matchData.hero1Id, winnerId: matchData.hero1Id, log: [] },
      })
      await db.tournamentParticipant.update({
        where: { tournamentId_heroId: { tournamentId, heroId: matchData.hero1Id } },
        data: { eliminated: false },
      })
    } else {
      await db.tournamentMatch.create({ data: { ...matchData, hero2Id: matchData.hero2Id } })
    }
  }
}

async function executePendingMatches(tournament: any, currentRound: number) {
  const pending = tournament.matches.filter(
    (m: any) => m.round === currentRound && m.winnerId == null && m.hero1Id && m.hero2Id
  )

  for (const match of pending) {
    await executeSingleMatch(tournament.id, match)
  }
}

async function executeSingleMatch(tournamentId: string, match: any) {
  const hero1Id = match.hero1Id!
  const hero2Id = match.hero2Id!

  const outcome = await db.$transaction(async tx => {
    // The match row is the idempotency lock: a second scheduler waits and then
    // observes the committed winner instead of simulating the same fight again.
    await tx.$queryRaw`SELECT "id" FROM "tournament_matches" WHERE "id" = ${match.id} FOR UPDATE`
    const currentMatch = await tx.tournamentMatch.findUnique({ where: { id: match.id } })
    if (!currentMatch || currentMatch.tournamentId !== tournamentId || currentMatch.winnerId) return null
    if (currentMatch.hero1Id !== hero1Id || currentMatch.hero2Id !== hero2Id) return null

    // Lock both heroes in a stable order to serialize against arena and resource operations.
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" IN (${hero1Id}, ${hero2Id}) ORDER BY "id" FOR UPDATE`
    const [h1, h2] = await Promise.all([
      tx.hero.findUnique({
        where: { id: hero1Id },
        include: {
          class: true,
          skills: { include: { skill: true } },
          combatProfiles: { orderBy: { createdAt: 'asc' } },
          items: { include: { item: true } },
        },
      }),
      tx.hero.findUnique({
        where: { id: hero2Id },
        include: {
          class: true,
          skills: { include: { skill: true } },
          combatProfiles: { orderBy: { createdAt: 'asc' } },
          items: { include: { item: true } },
        },
      }),
    ])
    if (!h1 || !h2) return null

    const profile1 = h1.combatProfiles.find((p: any) => p.dungeonLevel === null) ?? h1.combatProfiles[0]
    const profile2 = h2.combatProfiles.find((p: any) => p.dungeonLevel === null) ?? h2.combatProfiles[0]
    const heroData1 = await buildHeroData(h1, profile1)
    const heroData2 = await buildHeroData(h2, profile2)

    const h2Attrs = h2.attrs as Record<string, number>
    const hero2AsEnemy = {
      id: -2,
      name: heroData2.name,
      icon: '⚔️',
      hp: heroData2.hpMax,
      mp: heroData2.mpMax,
      atk: (h2Attrs.fuerza ?? 10) + (h2Attrs.agilidad ?? 5),
      def: (h2Attrs.resistencia ?? 10) + (h2Attrs.agilidad ?? 5),
      dx: h2Attrs.agilidad ?? 10,
      ag: h2Attrs.agilidad ?? 10,
      level: heroData2.level,
      position: profile2?.position ?? 'front',
      skills: heroData2.skills.map(s => ({
        skillId: s.skillId,
        name: s.name ?? `skill_${s.skillId}`,
        icon: s.icon ?? '⚔️',
        effect: s.effect,
        multiplier: s.multiplier,
        manaCost: s.manaCost,
        cooldownRounds: s.cooldownRounds,
        formula: s.formula,
      })),
    }

    const dungeonData: DungeonData = {
      id: -2,
      name: 'Torneo',
      levels: [{ number: 1, enemies: [hero2AsEnemy as any], epReward: 0, goldReward: 0 }],
      epReward: 0,
      goldReward: 0,
      fameReward: 0,
      lootTable: [],
    }

    const result = await runDungeon([heroData1], dungeonData)
    const hero1Alive = result.heroesFinalState.some((h: any) => h.id === heroData1.id && h.hp > 0)
    const winnerId = hero1Alive ? hero1Id : hero2Id
    const loserId = winnerId === hero1Id ? hero2Id : hero1Id

    const updated = await tx.tournamentMatch.updateMany({
      where: { id: match.id, winnerId: null },
      data: { winnerId, log: result.log.slice(-10).map((l: any) => l.message), playedAt: new Date() },
    })
    if (updated.count !== 1) return null

    await tx.tournamentParticipant.updateMany({
      where: { tournamentId, heroId: loserId, eliminated: false },
      data: { eliminated: true },
    })

    return { winnerId, loserId, h1Name: h1.name, h2Name: h2.name, hero1Won: winnerId === hero1Id }
  }, { maxWait: 10_000, timeout: 30_000 })

  if (!outcome) return

  notify({
    heroId: hero1Id,
    type: 'tournament_match',
    title: '⚔️ Combate en torneo',
    body: `${outcome.h1Name} vs ${outcome.h2Name}: ${outcome.hero1Won ? 'Victoria' : 'Derrota'}`,
  }).catch(e => logger.error("tournament", "Background operation failed", e))
  notify({
    heroId: hero2Id,
    type: 'tournament_match',
    title: '⚔️ Combate en torneo',
    body: `${outcome.h1Name} vs ${outcome.h2Name}: ${outcome.hero1Won ? 'Derrota' : 'Victoria'}`,
  }).catch(e => logger.error("tournament", "Background operation failed", e))
}

async function handleTournamentCompletion(tournament: any) {
  await db.tournament.update({ where: { id: tournament.id }, data: { status: 'completed' } })

  const winner = await db.tournamentParticipant.findFirst({
    where: { tournamentId: tournament.id, eliminated: false },
    include: { hero: true },
  })
  if (winner) {
    notify({
      heroId: winner.heroId, type: 'tournament_win',
      title: '🏆 ¡Ganaste el torneo!',
      body: `Felicidades ${winner.hero.name}, sos el campeón del torneo ${tournament.name}`,
    }).catch(e => logger.error("tournament", "Background operation failed", e))
  }

  await distributeRewards(tournament.id).catch(e => logger.error("tournament", "Background operation failed", e))
  return { advanced: true, status: 'completed' }
}

async function createNextRoundMatches(tournament: any, currentRound: number) {
  const winners = await db.tournamentMatch.findMany({
    where: { tournamentId: tournament.id, round: currentRound, winnerId: { not: null } },
    orderBy: { matchNumber: 'asc' },
  })

  const nextRound = currentRound + 1
  const existingNext = tournament.matches.filter((m: any) => m.round === nextRound)
  if (existingNext.length > 0 || winners.length < 2) return

  const nextMatches: { tournamentId: string; round: number; matchNumber: number; hero1Id: string; hero2Id: string }[] = []
  for (let i = 0; i < winners.length; i += 2) {
    const w1 = winners[i].winnerId!
    const w2 = winners[i + 1]?.winnerId
    if (!w2) break
    nextMatches.push({
      tournamentId: tournament.id, round: nextRound,
      matchNumber: nextMatches.length + 1,
      hero1Id: w1, hero2Id: w2,
    })
  }
  if (nextMatches.length > 0) {
    await db.tournamentMatch.createMany({ data: nextMatches })
  }
}

async function fetchHeroForTournament(heroId: string) {
  return db.hero.findFirst({
    where: { id: heroId },
    include: {
      class: true,
      skills: { include: { skill: true } },
      combatProfiles: { orderBy: { createdAt: 'asc' } },
      items: { include: { item: true } },
    },
  })
}

export async function advanceTournament(): Promise<TournamentAdvanceResult> {
  const tournament = await db.tournament.findFirst({
    where: { status: { in: ['registration', 'active'] } },
    include: {
      participants: { include: { hero: { include: { class: true } } }, orderBy: { seed: 'asc' } },
      matches: { orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }] },
    },
  })
  if (!tournament) return { advanced: false, status: 'none', error: 'No hay torneo activo' }

  if (tournament.status === 'registration') {
    return handleRegistrationBracket(tournament)
  }

  const currentRound = tournament.matches.reduce((max, m) => Math.max(max, m.round), 0)
  const allDone = tournament.matches
    .filter(m => m.round === currentRound)
    .every(m => m.winnerId != null)

  if (!allDone) {
    await executePendingMatches(tournament, currentRound)
  }

  const activeParticipants = await db.tournamentParticipant.count({
    where: { tournamentId: tournament.id, eliminated: false },
  })

  if (activeParticipants <= 1) {
    return handleTournamentCompletion(tournament)
  }

  await createNextRoundMatches(tournament, currentRound)
  return { advanced: true, status: 'active' }
}
