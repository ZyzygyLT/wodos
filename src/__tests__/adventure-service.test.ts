import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  default: {
    heroAdventure: {
      findFirst: vi.fn(),
    },
    hero: {
      findUnique: vi.fn(),
    },
  },
}))

import db from "@/lib/db"
import { getActiveAdventure } from "@/services/adventure.service"

const findFirst = vi.mocked(db.heroAdventure.findFirst)
const findHero = vi.mocked(db.hero.findUnique)

describe("getActiveAdventure", () => {
  beforeEach(() => {
    findFirst.mockReset()
    findHero.mockReset()
  })

  it("does not resurrect an older failed run after the latest run was claimed", async () => {
    findFirst.mockResolvedValue({ status: "claimed" } as never)

    await expect(getActiveAdventure("hero-1")).resolves.toBeNull()
    expect(findFirst).toHaveBeenCalledWith({
      where: { heroId: "hero-1" },
      orderBy: { startedAt: "desc" },
      include: { adventure: true },
    })
  })

  it("still returns the latest failed run so its defeat result can be displayed", async () => {
    const failedRun = {
      id: "run-2",
      adventureId: 4,
      currentStep: 2,
      totalSteps: 5,
      status: "failed",
      startedAt: new Date("2026-11-22T12:00:00.000Z"),
      result: { steps: [], rewards: null },
      adventure: {
        name: "The Ruins",
        icon: "🏚️",
        description: "A forgotten place",
        lore: "An old story",
        steps: [],
      },
    }
    findFirst.mockResolvedValue(failedRun as never)
    findHero.mockResolvedValue({
      hpCurrent: 42,
      hpMax: 60,
      mpCurrent: 8,
      mpMax: 20,
    } as never)

    await expect(getActiveAdventure("hero-1")).resolves.toMatchObject({
      id: "run-2",
      status: "failed",
      adventureName: "The Ruins",
      heroResources: { hpCurrent: 42, hpMax: 60, mpCurrent: 8, mpMax: 20 },
    })
  })
})
