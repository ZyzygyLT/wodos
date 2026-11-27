import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

const MAX_GROUP_SIZE = 10

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const result = await db.$transaction(async (tx) => {
    const initialInvite = await tx.groupInvite.findUnique({ where: { id } })
    if (!initialInvite) return { error: "Invitación no encontrada", status: 404 }
    if (initialInvite.heroId !== hero.id) return { error: "No es tu invitación", status: 403 }

    // Serialize joins for this group so concurrent acceptances cannot exceed its capacity.
    const lockedGroups = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM clan_groups WHERE id = ${initialInvite.groupId} FOR UPDATE`
    if (lockedGroups.length === 0) return { error: "Grupo no encontrado", status: 404 }

    // Re-read after acquiring the group lock; another request may have processed this invite.
    const invite = await tx.groupInvite.findUnique({ where: { id } })
    if (!invite) return { error: "Invitación no encontrada", status: 404 }
    if (invite.heroId !== hero.id) return { error: "No es tu invitación", status: 403 }
    if (invite.status !== "pending") return { error: "Invitación ya procesada", status: 400 }

    const group = await tx.clanGroup.findUnique({
      where: { id: invite.groupId },
      include: { _count: { select: { groupMembers: true } } },
    })
    if (!group) return { error: "Grupo no encontrado", status: 404 }
    if (group._count.groupMembers >= MAX_GROUP_SIZE) {
      return { error: "Grupo completo (máx 10)", status: 400 }
    }

    const alreadyMember = await tx.groupMember.findUnique({
      where: { groupId_heroId: { groupId: invite.groupId, heroId: hero.id } },
    })
    if (alreadyMember) return { error: "Ya estás en el grupo", status: 400 }

    const claimedInvite = await tx.groupInvite.updateMany({
      where: { id, heroId: hero.id, status: "pending" },
      data: { status: "accepted" },
    })
    if (claimedInvite.count !== 1) {
      return { error: "La invitación ya fue procesada", status: 409 }
    }

    await tx.groupMember.create({
      data: { groupId: invite.groupId, heroId: hero.id, role: "member" },
    })

    return { success: true, groupName: group.name }
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
