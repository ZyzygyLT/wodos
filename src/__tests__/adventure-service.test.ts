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
import { combineAdventureRewards, isAdventureBlockingNewStart, markAdventureAbandoned } from "@/lib/adventures/adventure-helpers"
import { getActiveAdventure } from "@/services/adventure.service"

const findFirst = vi.mocked(db.heroAdventure.findFirst)
const findHero = vi.mocked(db.hero.findUnique)

describe("adventure start lifecycle", () => {
  it.each([
    ["active", true],
    ["completed", true],
    ["failed", false],
    ["claimed", false],
  ])("treats %s runs as blocking=%s", (status, expected) => {
    expect(isAdventureBlockingNewStart(status)).toBe(expected)
  })
})

describe("markAdventureAbandoned", () => {
  it("preserves existing progress and rewards while recording a voluntary exit", () => {
    const result = {
      steps: [{ type: "narrative", description: "A gate opens" }],
      rewards: { gold: 12 },
    }

    expect(markAdventureAbandoned(result)).toEqual({
      steps: result.steps,
      rewards: result.rewards,
      outcome: "abandoned",
    })
  })

  it("handles an empty result safely", () => {
    expect(markAdventureAbandoned(null)).toEqual({ outcome: "abandoned" })
  })
})

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


describe("combineAdventureRewards", () => {
  it("grants step rewards even when there is no global reward roll", () => {
    expect(combineAdventureRewards(undefined, [
      { type: "narrative" },
      { type: "reward", rewards: { gold: 15, ep: 4, items: [{ itemId: 7, qty: 2 }] } },
      { type: "reward", rewards: { gold: 5, fame: 3, materials: [{ materialId: 9, qty: 4 }] } },
    ])).toEqual({
      gold: 20,
      ep: 4,
      fame: 3,
      items: [{ itemId: 7, qty: 2 }],
      materials: [{ materialId: 9, qty: 4 }],
    })
  })

  it("combines global and step rewards without dropping either source", () => {
    expect(combineAdventureRewards(
      { gold: 10, ep: 2, items: [{ itemId: 1, qty: 1 }] },
      [{ type: "reward", rewards: { gold: 5, ep: 3, items: [{ itemId: 2, qty: 2 }] } }],
    )).toEqual({
      gold: 15,
      ep: 5,
      items: [{ itemId: 1, qty: 1 }, { itemId: 2, qty: 2 }],
    })
  })
})
