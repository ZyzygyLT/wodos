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
vi.mock("@/lib/dungeon-helpers", () => ({
  buildHeroData: vi.fn(async (hero: { attrs: { pe: number } }) => ({
    attrs: hero.attrs,
    equipStats: { pe: 4 },
  })),
  mergeHeroAttrs: vi.fn((hero: { attrs: { pe: number }; equipStats: { pe: number } }) => ({
    pe: hero.attrs.pe + hero.equipStats.pe,
  })),
}))

import { canClaimAdventureRewards, combineAdventureRewards, isAdventureBlockingNewStart, markAdventureAbandoned, withAdventureChoicePreviews } from "@/lib/adventures/adventure-helpers"
import { getActiveAdventure } from "@/services/adventure.service"
import { buildHeroData } from "@/lib/dungeon-helpers"

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
    expect(canClaimAdventureRewards("failed", {
      outcome: "defeated",
      steps: [{ type: "choice", rewards: { gold: 8 } }],
    })).toBe(true)
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
      where: { heroId: "hero-1", status: { in: ["active", "completed", "failed"] } },
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

  it("restores the destination of past choices in the adventure history", async () => {
    findMany.mockResolvedValue([{
      id: "run-choice",
      adventureId: 4,
      currentStep: 2,
      totalSteps: 4,
      status: "active",
      startedAt: new Date("2026-11-23T12:00:00.000Z"),
      result: {
        steps: [{ type: "choice", chosen: "Cruzar el puente", nextStep: 2 }],
      },
      adventure: {
        name: "The Ruins",
        icon: "🏚️",
        description: "A forgotten place",
        lore: "An old story",
        steps: [
          { type: "choice", name: "El cruce", description: "Debes decidir." },
          { type: "narrative", name: "El sendero", description: "Un sendero estrecho." },
          { type: "combat", name: "La emboscada", description: "Enemigos bloquean el paso." },
          { type: "reward", name: "El tesoro", description: "Un cofre espera." },
        ],
      },
    }] as never)
    findHero.mockResolvedValue({
      attrs: { pe: 10 },
      hpCurrent: 42,
      hpMax: 60,
      mpCurrent: 8,
      mpMax: 20,
    } as never)

    await expect(getActiveAdventure("hero-1")).resolves.toMatchObject({
      result: {
        steps: [{
          type: "choice",
          nextStep: 2,
          nextStepName: "La emboscada",
          nextStepDescription: "Enemigos bloquean el paso.",
        }],
      },
    })
  })

  it("previews the destination of each available choice", async () => {
    findMany.mockResolvedValue([{
      id: "run-preview",
      adventureId: 4,
      currentStep: 0,
      totalSteps: 3,
      status: "active",
      startedAt: new Date("2026-11-23T12:00:00.000Z"),
      result: { steps: [] },
      adventure: {
        name: "The Ruins",
        icon: "🏚️",
        description: "A forgotten place",
        lore: "An old story",
        steps: [
          {
            type: "choice",
            name: "El cruce",
            description: "Debes decidir.",
            choices: [
              { text: "Cruzar el puente", nextStep: 1 },
              { text: "Convencer al guardia", nextStep: 1, skillCheck: { attr: "ch", dc: 8, passStep: 2, failStep: 1 } },
            ],
          },
          { type: "narrative", name: "El sendero oscuro", description: "Un sendero." },
          { type: "combat", name: "La emboscada", description: "Enemigos." },
        ],
      },
    }] as never)
    findHero.mockResolvedValue({
      attrs: { pe: 10 },
      hpCurrent: 42,
      hpMax: 60,
      mpCurrent: 8,
      mpMax: 20,
    } as never)

    await expect(getActiveAdventure("hero-1")).resolves.toMatchObject({
      currentStepData: {
        choices: [
          {
            nextStepName: "El sendero oscuro",
            nextStepDescription: "Un sendero.",
          },
          {
            passStepName: "La emboscada",
            passStepDescription: "Enemigos.",
            failStepName: "El sendero oscuro",
            failStepDescription: "Un sendero.",
          },
        ],
      },
    })
  })

  it("returns effective hero attributes including equipped bonuses", async () => {
    const run = {
      id: "run-equipped",
      adventureId: 4,
      currentStep: 0,
      totalSteps: 1,
      status: "active",
      startedAt: new Date("2026-11-23T12:00:00.000Z"),
      result: { steps: [], rewards: null },
      adventure: {
        name: "The Ruins",
        icon: "🏚️",
        description: "A forgotten place",
        lore: "An old story",
        steps: [{ type: "narrative", description: "The gate opens" }],
      },
    }
    const hero = {
      attrs: { pe: 10 },
      skills: [],
      items: [{ id: "equipped-item" }],
      combatProfiles: [],
      hpCurrent: 42,
      hpMax: 60,
      mpCurrent: 8,
      mpMax: 20,
    }
    findMany.mockResolvedValue([run] as never)
    findHero.mockResolvedValue(hero as never)

    await expect(getActiveAdventure("hero-1")).resolves.toMatchObject({
      heroAttributes: { pe: 14 },
    })
    expect(buildHeroData).toHaveBeenCalledWith(hero, null)
  })

  it("still returns the latest failed run so its defeat result can be displayed", async () => {
    const failedRun = {
      id: "run-2",
      adventureId: 4,
      currentStep: 2,
      totalSteps: 5,
      status: "failed",
      startedAt: new Date("2026-11-22T12:00:00.000Z"),
      result: { outcome: "defeated", steps: [{ type: "reward", rewards: { gold: 12 } }], rewards: null },
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
      { type: "choice", rewards: { gold: 8, ep: 2 } },
    ])).toEqual({
      gold: 28,
      ep: 6,
      fame: 3,
      items: [{ itemId: 7, qty: 2 }],
      materials: [{ materialId: 9, qty: 4 }],
    })
  })

  it("combines global and step rewards without dropping either source", () => {
    expect(combineAdventureRewards(
      { gold: 10, ep: 2, items: [{ itemId: 1, qty: 1 }] },
      [
        { type: "reward", rewards: { gold: 5, ep: 3, items: [{ itemId: 2, qty: 2 }] } },
        { type: "choice", rewards: { gold: 8, fame: 1 } },
      ],
    )).toEqual({
      gold: 23,
      ep: 5,
      fame: 1,
      items: [{ itemId: 1, qty: 1 }, { itemId: 2, qty: 2 }],
    })
  })
})


describe("withAdventureChoicePreviews", () => {
  it("adds normal and skill-check destinations to a choice reached during an expedition", () => {
    const steps = [
      { type: "choice" as const, name: "El cruce", description: "Debes decidir.", choices: [
        { text: "Seguir el camino", nextStep: 1 },
        { text: "Convencer al guardia", nextStep: 1, skillCheck: { attr: "ch", dc: 8, passStep: 2, failStep: 1 } },
      ] },
      { type: "narrative" as const, name: "El sendero", description: "Un sendero estrecho." },
      { type: "combat" as const, name: "La emboscada", description: "Enemigos bloquean el paso." },
    ]

    expect(withAdventureChoicePreviews(steps[0], steps)).toMatchObject({
      choices: [
        { nextStepName: "El sendero", nextStepDescription: "Un sendero estrecho." },
        {
          passStepName: "La emboscada",
          passStepDescription: "Enemigos bloquean el paso.",
          failStepName: "El sendero",
          failStepDescription: "Un sendero estrecho.",
        },
      ],
    })
  })

  it("leaves non-choice scenes unchanged and safely handles missing scenes", () => {
    const narrative = { type: "narrative" as const, name: "El umbral", description: "Una puerta." }
    expect(withAdventureChoicePreviews(narrative, [narrative])).toBe(narrative)
    expect(withAdventureChoicePreviews(undefined, [])).toBeNull()
  })
})
