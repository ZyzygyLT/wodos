import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  default: {
    heroAdventure: {
      findMany: vi.fn(),
    },
    hero: {
      findUnique: vi.fn(),
    },
  },
}))

import db from "@/lib/db"
import { canClaimAdventureRewards, combineAdventureRewards, isAdventureBlockingNewStart, markAdventureAbandoned } from "@/lib/adventures/adventure-helpers"
import { getActiveAdventure } from "@/services/adventure.service"

const findMany = vi.mocked(db.heroAdventure.findMany)
const findHero = vi.mocked(db.hero.findUnique)

describe("adventure start lifecycle", () => {
  it.each([
    ["active", true],
    ["completed", true],
    ["failed", false],
    ["claimed", false],
  ])("treats %s runs as blocking=%s without recoverable loot", (status, expected) => {
    expect(isAdventureBlockingNewStart(status)).toBe(expected)
  })

  it("blocks a new start while defeat loot remains unclaimed", () => {
    expect(isAdventureBlockingNewStart('failed', {
      outcome: 'defeated',
      steps: [{ type: 'reward', rewards: { gold: 12 } }],
    })).toBe(true)
    expect(isAdventureBlockingNewStart('failed', {
      outcome: 'defeated',
      steps: [{ type: 'narrative' }],
    })).toBe(false)
    expect(isAdventureBlockingNewStart('failed', {
      outcome: 'abandoned',
      steps: [{ type: 'reward', rewards: { gold: 12 } }],
    })).toBe(false)
  })
})

describe("canClaimAdventureRewards", () => {
  it("allows a completed adventure to claim its final and step rewards", () => {
    expect(canClaimAdventureRewards("completed", { rewards: { gold: 10 } })).toBe(true)
  })

  it("allows only earned step rewards after defeat", () => {
    expect(canClaimAdventureRewards("failed", {
      outcome: "defeated",
      steps: [{ type: "reward", rewards: { gold: 30 } }],
    })).toBe(true)
    expect(canClaimAdventureRewards("failed", {
      outcome: "defeated",
      steps: [{ type: "narrative" }],
    })).toBe(false)
  })

  it("never allows abandoned adventures to claim rewards", () => {
    expect(canClaimAdventureRewards("failed", {
      outcome: "abandoned",
      steps: [{ type: "reward", rewards: { gold: 30 } }],
    })).toBe(false)
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
    findMany.mockReset()
    findHero.mockReset()
  })

  it("does not resurrect an older abandoned run after newer runs were claimed", async () => {
    findMany.mockResolvedValue([{
      status: "failed",
      result: { outcome: "abandoned", steps: [] },
    }] as never)

    await expect(getActiveAdventure("hero-1")).resolves.toBeNull()
    expect(findMany).toHaveBeenCalledWith({
      where: { heroId: "hero-1", status: { in: [...ADVENTURE_STATUSES_BLOCKING_NEW_START] } },
      orderBy: { startedAt: "desc" },
      include: { adventure: true },
    })
  })

  it("recovers older unclaimed defeat loot even when a newer run was already claimed", async () => {
    findMany.mockResolvedValue([{
      id: "run-1",
      adventureId: 4,
      currentStep: 2,
      totalSteps: 5,
      status: "failed",
      startedAt: new Date("2026-11-22T12:00:00.000Z"),
      result: {
        outcome: "defeated",
        steps: [{ type: "reward", rewards: { gold: 12 } }],
      },
      adventure: {
        name: "The Ruins",
        icon: "🏚️",
        description: "A forgotten place",
        lore: "An old story",
        steps: [],
      },
    }] as never)
    findHero.mockResolvedValue({
      hpCurrent: 42,
      hpMax: 60,
      mpCurrent: 8,
      mpMax: 20,
    } as never)

    await expect(getActiveAdventure("hero-1")).resolves.toMatchObject({
      id: "run-1",
      status: "failed",
      result: { outcome: "defeated" },
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
    findMany.mockResolvedValue([failedRun] as never)
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
