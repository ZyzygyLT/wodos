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

  const [h1, h2] = await Promise.all([
    fetchHeroForTournament(hero1Id),
    fetchHeroForTournament(hero2Id),
  ])
  if (!h1 || !h2) return

  const profile1 = h1.combatProfiles.find((p: any) => p.dungeonLevel === null) ?? h1.combatProfiles[0]
  const profile2 = h2.combatProfiles.find((p: any) => p.dungeonLevel === null) ?? h2.combatProfiles[0]
  const heroData1 = await buildHeroData(h1, profile1)
  const heroData2 = await buildHeroData(h2, profile2)

  const dungeonData: DungeonData = {
    id: -2, name: 'Torneo',
    levels: [{ number: 1, enemies: [], epReward: 0, goldReward: 0 }],
    epReward: 0, goldReward: 0, fameReward: 0, lootTable: [],
  }

  const result = await runDungeon([heroData1, heroData2], dungeonData)
  const hero1Alive = result.heroesFinalState.some((h: any) => h.id === heroData1.id && h.hp > 0)
  const winnerId = hero1Alive ? hero1Id : hero2Id
  const loserId = result.victory ? hero2Id : hero1Id

  await db.$transaction([
    db.tournamentMatch.update({
      where: { id: match.id },
      data: { winnerId, log: result.log.slice(-10).map((l: any) => l.message) },
    }),
    db.tournamentParticipant.update({
      where: { tournamentId_heroId: { tournamentId, heroId: loserId } },
      data: { eliminated: true },
    }),
  ])

  const h1Name = h1.name
  const h2Name = h2.name
  notify({ heroId: hero1Id, type: 'tournament_match', title: '⚔️ Combate en torneo', body: `${h1Name} vs ${h2Name}: ${result.victory ? 'Victoria' : 'Derrota'}` }).catch(e => logger.error("tournament", "Background operation failed", e))
  if (loserId !== hero1Id) {
    notify({ heroId: loserId, type: 'tournament_match', title: '⚔️ Combate en torneo', body: `${h1Name} vs ${h2Name}: Derrota` }).catch(e => logger.error("tournament", "Background operation failed", e))
  }
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
