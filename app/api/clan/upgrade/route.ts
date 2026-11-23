import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { CLAN_UPGRADES } from "@/lib/clan/upgrades"
import { generateClanDungeon } from "@/lib/clan/generate-clan-dungeon"
import { trackClanUpgrade } from "@/lib/analytics/events"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { include: { clanMember: { include: { clan: { include: { upgrades: true } } } } } })

  if (!hero?.clanMember) return NextResponse.json({ error: "No perteneces a un clan" }, { status: 400 })
  if (!["leader", "officer"].includes(hero.clanMember.role)) {
    return NextResponse.json({ error: "Solo líderes y oficiales pueden mejorar la guarida" }, { status: 403 })
  }

  const { upgradeId } = await req.json()
  const clan = hero.clanMember.clan
  const upgradeDef = CLAN_UPGRADES[upgradeId as keyof typeof CLAN_UPGRADES]
  if (!upgradeDef) return NextResponse.json({ error: "Mejora inválida" }, { status: 400 })

  const existing = clan.upgrades.find(u => u.upgradeId === upgradeId)
  const currentTier = existing?.tier || 0
  const nextTier = currentTier + 1

  if (nextTier > upgradeDef.tiers.length) {
    return NextResponse.json({ error: "Mejora al máximo" }, { status: 400 })
  }

  const tierDef = upgradeDef.tiers[nextTier - 1]
  if (clan.gold < tierDef.goldCost) {
    return NextResponse.json({
      error: `Oro insuficiente. Necesitas ${tierDef.goldCost}, el clan tiene ${clan.gold}`,
    }, { status: 400 })
  }

  const ops: any[] = [
    db.clan.update({ where: { id: clan.id }, data: { gold: { decrement: tierDef.goldCost } } }),
    existing
      ? db.clanUpgrade.update({ where: { id: existing.id }, data: { tier: nextTier } })
      : db.clanUpgrade.create({ data: { clanId: clan.id, upgradeId, tier: 1 } }),
  ]

  // Generate exclusive dungeon when this upgrade is purchased
  if (upgradeId === "exclusive_dungeon") {
    const bonusLevel = tierDef.bonus.exclusive_dungeon_level ?? 5
    const dungeonData = await generateClanDungeon(clan.id, bonusLevel)

    const existingDungeon = await db.dungeon.findUnique({ where: { clanId: clan.id } })

    if (existingDungeon) {
      ops.push(
        db.dungeon.update({
          where: { id: existingDungeon.id },
          data: {
            ...dungeonData,
            levelReq: Math.max(1, bonusLevel - 3),
            recommendedLevel: bonusLevel,
            epReward: 300 + bonusLevel * 30,
            goldReward: 500 + bonusLevel * 50,
            fameReward: 30 + bonusLevel * 5,
            levels: dungeonData.levels,
            lootTable: dungeonData.lootTable,
            difficultyLabel: dungeonData.difficultyLabel,
          },
        })
      )
    } else {
      ops.push(
        db.dungeon.create({
          data: {
            ...dungeonData,
            clanId: clan.id,
          },
        })
      )
    }
  }

  await db.$transaction(ops)

  trackClanUpgrade(session.user.id, { upgradeId, tier: nextTier, goldSpent: tierDef.goldCost })

  return NextResponse.json({ upgradeId, newTier: nextTier, effect: tierDef.effect })
}
