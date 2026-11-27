import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findHero: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  default: {
    heroAdventure: { findMany: mocks.findMany },
    hero: { findUnique: mocks.findHero },
  },
}))

vi.mock("@/lib/dungeon-helpers", () => ({
  buildHeroData: vi.fn(async (hero: { attrs: Record<string, number> }) => ({
    attrs: hero.attrs,
    equipStats: {},
  })),
  mergeHeroAttrs: vi.fn((hero: { attrs: Record<string, number> }) => hero.attrs),
}))

import { getActiveAdventure } from "@/services/adventure.service"

describe("adventure choice history restoration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findMany.mockResolvedValue([{
      id: "run-choice-cost",
      adventureId: 4,
      currentStep: 2,
      totalSteps: 3,
      status: "active",
      startedAt: new Date("2026-11-23T12:00:00.000Z"),
      result: {
        steps: [{
          type: "choice",
          stepName: "El Libro del Obispo",
          chosen: "Tomar el cuchillo de obsidiana",
          chosenIndex: 1,
          costs: { hp: 6, mp: 0 },
          nextStep: 2,
        }],
        rewards: null,
      },
      adventure: {
        name: "Las Catacumbas",
        icon: "🏚️",
        description: "Una capilla olvidada.",
        lore: "El obispo guardaba un secreto.",
        steps: [
          {
            type: "choice",
            name: "El Libro del Obispo",
            description: "Dos objetos reposan sobre el altar.",
            choices: [
              { text: "Realizar el rito", nextStep: 1 },
              { text: "Tomar el cuchillo de obsidiana", nextStep: 2, costs: { hp: 6 } },
            ],
          },
          { type: "narrative", name: "El Sello Restaurado", description: "El sello vuelve a cerrarse." },
          { type: "combat", name: "Lo Que Despierta Abajo", description: "Algo emerge." },
        ],
      },
    }])
    mocks.findHero.mockResolvedValue({
      level: 1,
      attrs: { st: 0, co: 0, in: 0, dx: 0, ch: 0, ag: 0, pe: 10, wi: 0 },
      skills: [],
      items: [],
      combatProfiles: [],
      hpCurrent: 14,
      hpMax: 40,
      mpCurrent: 12,
      mpMax: 20,
    })
  })

  it("restores the paid cost, chosen route and current resources after reloading", async () => {
    const active = await getActiveAdventure("hero-1")

    expect(active).toMatchObject({
      currentStep: 2,
      currentStepData: {
        name: "Lo Que Despierta Abajo",
        description: "Algo emerge.",
      },
      heroResources: {
        hpCurrent: 14,
        hpMax: 40,
        mpCurrent: 12,
        mpMax: 20,
      },
      result: {
        steps: [{
          type: "choice",
          stepName: "El Libro del Obispo",
          chosen: "Tomar el cuchillo de obsidiana",
          costs: { hp: 6, mp: 0 },
          nextStep: 2,
          nextStepName: "Lo Que Despierta Abajo",
          nextStepDescription: "Algo emerge.",
        }],
      },
    })
  })
})
