import db from "@/lib/db"

export function fameForLevel(level: number): number {
  return level * level * 50 + 50
}

export function getMaxMembers(clanLevel: number): number {
  return 20 + (clanLevel - 1) * 2
}

export async function checkClanLevelUp(clanId: string): Promise<number> {
  const clan = await db.clan.findUnique({
    where: { id: clanId },
    select: { level: true, fame: true },
  })
  if (!clan) return 0

  let newLevel = clan.level
  while (clan.fame >= fameForLevel(newLevel + 1)) {
    newLevel++
  }

  if (newLevel > clan.level) {
    await db.clan.update({
      where: { id: clanId },
      data: { level: newLevel },
    })
  }

  return newLevel
}
