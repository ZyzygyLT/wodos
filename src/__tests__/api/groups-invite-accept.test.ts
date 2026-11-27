import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Mock } from "vitest"
import { auth } from "@/auth"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { mockDb } from "../setup"

vi.mock("@/lib/hero-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/hero-utils")>("@/lib/hero-utils")
  return { ...actual, getActiveHeroByUserId: vi.fn() }
})

describe("POST /api/groups/invites/[id]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as Mock).mockResolvedValue({ user: { id: "user-1" } })
    ;(getActiveHeroByUserId as Mock).mockResolvedValue({ id: "hero-1" })
    ;(mockDb.groupInvite.findUnique as Mock).mockResolvedValue({
      id: "invite-1",
      groupId: "group-1",
      heroId: "hero-1",
      status: "pending",
    })
    ;(mockDb.$queryRaw as Mock).mockResolvedValue([{ id: "group-1" }])
    ;(mockDb.clanGroup.findUnique as Mock).mockResolvedValue({
      id: "group-1",
      name: "Exploradores",
      _count: { groupMembers: 9 },
    })
    ;(mockDb.groupMember.findUnique as Mock).mockResolvedValue(null)
    ;(mockDb.groupInvite.updateMany as Mock).mockResolvedValue({ count: 1 })
    ;(mockDb.groupMember.create as Mock).mockResolvedValue({ id: "member-1" })
  })

  it("locks the group before checking capacity and adding the member", async () => {
    const { POST } = await import("@/app/api/groups/invites/[id]/accept/route")
    const response = await POST({} as never, { params: Promise.resolve({ id: "invite-1" }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, groupName: "Exploradores" })
    expect(mockDb.$queryRaw).toHaveBeenCalledOnce()
    expect(mockDb.groupInvite.updateMany).toHaveBeenCalledWith({
      where: { id: "invite-1", heroId: "hero-1", status: "pending" },
      data: { status: "accepted" },
    })
    expect(mockDb.groupMember.create).toHaveBeenCalledWith({
      data: { groupId: "group-1", heroId: "hero-1", role: "member" },
    })
  })

  it("rejects acceptance when the group is already full", async () => {
    ;(mockDb.clanGroup.findUnique as Mock).mockResolvedValue({
      id: "group-1",
      name: "Exploradores",
      _count: { groupMembers: 10 },
    })

    const { POST } = await import("@/app/api/groups/invites/[id]/accept/route")
    const response = await POST({} as never, { params: Promise.resolve({ id: "invite-1" }) })

    expect(response.status).toBe(400)
    expect(mockDb.groupInvite.updateMany).not.toHaveBeenCalled()
    expect(mockDb.groupMember.create).not.toHaveBeenCalled()
  })

  it("does not add a member if the invitation was processed concurrently", async () => {
    ;(mockDb.groupInvite.updateMany as Mock).mockResolvedValue({ count: 0 })

    const { POST } = await import("@/app/api/groups/invites/[id]/accept/route")
    const response = await POST({} as never, { params: Promise.resolve({ id: "invite-1" }) })

    expect(response.status).toBe(409)
    expect(mockDb.groupMember.create).not.toHaveBeenCalled()
  })
})
