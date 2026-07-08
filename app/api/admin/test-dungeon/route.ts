import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { enrichDungeonLevels, loadGroupParticipants } from "@/lib/dungeon-helpers"
import { runDungeon } from "@/lib/combat-engine/dungeon-runner"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })
  if (!user?.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { groupId, dungeonId } = await req.json()
  if (!groupId || !dungeonId) return NextResponse.json({ error: "Faltan groupId o dungeonId" }, { status: 400 })

  const dungeon = await db.dungeon.findUnique({ where: { id: dungeonId } })
  if (!dungeon) return NextResponse.json({ error: "Dungeon no encontrado" }, { status: 404 })

  const group = await db.clanGroup.findUnique({ where: { id: groupId } })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })

  const { heroesData } = await loadGroupParticipants(groupId)
  if (heroesData.length === 0) return NextResponse.json({ error: "El grupo no tiene miembros" }, { status: 400 })

  const frontliners = heroesData.filter(h => h.combatProfile.position === 'front')
  if (frontliners.length === 0) return NextResponse.json({ error: "El grupo necesita al menos un frontliner" }, { status: 400 })

  const dungeonData = await enrichDungeonLevels(dungeon)

  const result = await runDungeon(heroesData, dungeonData)

  const heroesWithFinal = heroesData.map(h => {
    const final = result.heroesFinalState.find(fs => fs.id === h.id)
    return { id: h.id, name: h.name, hpMax: h.hpMax, mpMax: h.mpMax, finalHp: final?.hp, finalMp: final?.mp }
  })

  return NextResponse.json({
    victory: result.victory,
    totalRounds: result.totalRounds,
    epGained: result.epGained,
    goldGained: result.goldGained,
    fameGained: result.fameGained,
    levelsCleared: result.levelsCleared,
    loot: result.loot,
    dungeonName: dungeon.name,
    groupName: group.name,
    heroes: heroesWithFinal,
    levelReports: result.levelReports,
  })
}
