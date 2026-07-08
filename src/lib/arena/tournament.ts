import db from "@/lib/db"
import { runArenaDuel } from "@/lib/combat-engine/arena-runner"

export async function createWeeklyTournament() {
  const startsAt = new Date()
  const endsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)

  return db.tournament.create({
    data: {
      name: `Torneo de Hierro #${Math.floor(Date.now() / (7 * 24 * 3600000))}`,
      startsAt,
      endsAt,
      status: "registration",
      minElo: 0,
      maxPlayers: 8,
      rewards: [
        { position: 1, fame: 300, gold: 500, title: "Campeón del Torneo" },
        { position: 2, fame: 150, gold: 200 },
        { position: 3, fame: 80, gold: 100 },
        { position: 4, fame: 30, gold: 50 },
      ],
    },
  })
}

export async function generateBracket(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: { participants: { include: { hero: true }, orderBy: { hero: { eloRating: "desc" } } } },
  })
  if (!tournament) throw new Error("Torneo no encontrado")

  const participants = tournament.participants
  if (participants.length < 2) throw new Error("Insuficientes participantes")

  for (let i = 0; i < participants.length; i++) {
    await db.tournamentParticipant.update({
      where: { id: participants[i].id },
      data: { seed: i + 1 },
    })
  }

  const matches = []
  for (let i = 0; i < Math.floor(participants.length / 2); i++) {
    matches.push(
      db.tournamentMatch.create({
        data: {
          tournamentId,
          round: 1,
          matchNumber: i + 1,
          hero1Id: participants[i].heroId,
          hero2Id: participants[participants.length - 1 - i].heroId,
        },
      })
    )
  }

  await db.$transaction([
    ...matches,
    db.tournament.update({ where: { id: tournamentId }, data: { status: "active" } }),
  ])
}

export async function executeRound(tournamentId: string, round: number) {
  const matches = await db.tournamentMatch.findMany({
    where: { tournamentId, round, winnerId: null, hero1Id: { not: null }, hero2Id: { not: null } },
  })

  const results = []
  for (const match of matches) {
    if (!match.hero1Id || !match.hero2Id) continue
    const result = await runArenaDuel(match.hero1Id, match.hero2Id)
    const winnerId = result.winner === match.hero1Id ? match.hero1Id : match.hero2Id

    await db.tournamentMatch.update({
      where: { id: match.id },
      data: { winnerId, log: result.log as any, playedAt: new Date() },
    })

    const loserId = winnerId === match.hero1Id ? match.hero2Id : match.hero1Id
    await db.tournamentParticipant.updateMany({
      where: { tournamentId, heroId: loserId },
      data: { eliminated: true },
    })

    results.push({ matchId: match.id, winnerId, loserId })
  }

  const winners = results.map(r => r.winnerId)
  if (winners.length > 1) {
    const nextRound = round + 1
    for (let i = 0; i < Math.floor(winners.length / 2); i++) {
      await db.tournamentMatch.create({
        data: {
          tournamentId,
          round: nextRound,
          matchNumber: i + 1,
          hero1Id: winners[i * 2],
          hero2Id: winners[i * 2 + 1],
        },
      })
    }
  } else if (winners.length === 1) {
    await db.tournament.update({
      where: { id: tournamentId },
      data: { status: "completed" },
    })
    await distributeRewards(tournamentId)
  }

  return results
}

export async function distributeRewards(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: { matches: { orderBy: [{ round: "desc" }, { matchNumber: "asc" }] } },
  })
  if (!tournament) return

  const rewards = tournament.rewards as { position: number; fame: number; gold: number }[]
  const matches = tournament.matches
  if (matches.length === 0) return

  const maxRound = matches[0].round

  // Final match (highest round)
  const finalMatch = matches.find(m => m.round === maxRound)
  if (!finalMatch?.winnerId) return
  const championId = finalMatch.winnerId
  const runnerUpId = finalMatch.hero1Id === championId ? finalMatch.hero2Id : finalMatch.hero1Id

  const semiLosers = findSemiFinalLosers(matches, maxRound)

  const heroUpdates = buildRewardUpdates(rewards, championId, runnerUpId, semiLosers)

  for (const u of heroUpdates) {
    if (!u.heroId) continue
    await db.hero.update({
      where: { id: u.heroId },
      data: { fame: { increment: u.fame }, gold: { increment: u.gold } },
    })
  }
}

function findSemiFinalLosers(matches: any[], maxRound: number): string[] {
  const semiRound = maxRound - 1
  if (semiRound < 1) return []
  const semiMatches = matches.filter(m => m.round === semiRound)
  const losers: string[] = []
  for (const sm of semiMatches) {
    if (sm.winnerId) {
      const loser = sm.hero1Id === sm.winnerId ? sm.hero2Id : sm.hero1Id
      if (loser) losers.push(loser)
    }
  }
  return losers
}

function buildRewardUpdates(rewards: any[], championId: string | null, runnerUpId: string | null, semiLosers: string[]) {
  const updates: { heroId: string; fame: number; gold: number }[] = []
  const r1 = rewards.find(r => r.position === 1)
  if (r1 && championId) updates.push({ heroId: championId, fame: r1.fame, gold: r1.gold })
  const r2 = rewards.find(r => r.position === 2)
  if (r2 && runnerUpId) updates.push({ heroId: runnerUpId, fame: r2.fame, gold: r2.gold })
  const r3 = rewards.find(r => r.position === 3)
  const r4 = rewards.find(r => r.position === 4)
  if (semiLosers.length >= 1 && r3) updates.push({ heroId: semiLosers[0], fame: r3.fame, gold: r3.gold })
  if (semiLosers.length >= 2 && r4) updates.push({ heroId: semiLosers[1], fame: r4.fame, gold: r4.gold })
  return updates
}
