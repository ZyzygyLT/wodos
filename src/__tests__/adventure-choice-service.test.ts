import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    heroAdventure: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    hero: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  }

  return {
    tx,
    transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx)),
  }
})

vi.mock("@/lib/db", () => ({
  default: { $transaction: mocks.transaction },
}))

vi.mock("@/lib/dungeon-helpers", () => ({
  buildHeroData: vi.fn(async (hero: { attrs: Record<string, number> }) => ({
    attrs: hero.attrs,
    equipStats: {},
  })),
  mergeHeroAttrs: vi.fn((hero: { attrs: Record<string, number> }) => hero.attrs),
}))

import { executeStep, makeChoice } from "@/services/adventure.service"

const adventureSteps = [
  {
    type: "choice",
    name: "El Libro del Obispo",
    description: "Dos objetos reposan sobre el altar.",
    choices: [
      { text: "Realizar el rito", nextStep: 1 },
      {
        text: "Tomar el cuchillo de obsidiana",
        nextStep: 2,
        costs: { hp: 6 },
        flavor: "El filo te abre la palma.",
      },
    ],
  },
  { type: "narrative", name: "El Sello Restaurado", description: "El sello vuelve a cerrarse." },
  { type: "combat", name: "Lo Que Despierta Abajo", description: "Algo emerge." },
]

function makeHero(hpCurrent: number) {
  return {
    id: "hero-1",
    attrs: { pe: 10 },
    hpCurrent,
    hpMax: 40,
    mpCurrent: 12,
    mpMax: 20,
    combatProfiles: [],
    skills: [],
    items: [],
  }
}

function makeRun(currentStep = 0) {
  return {
    id: "run-1",
    heroId: "hero-1",
    adventureId: 1,
    currentStep,
    totalSteps: adventureSteps.length,
    status: "active",
    result: { steps: [], rewards: null },
    adventure: { steps: adventureSteps },
  }
}

describe("executeStep terminal adventure rewards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async callback => callback(mocks.tx))
    mocks.tx.$queryRaw.mockResolvedValue([])
    mocks.tx.hero.findUnique.mockResolvedValue(makeHero(20) as never)
    mocks.tx.heroAdventure.updateMany.mockResolvedValue({ count: 1 } as never)
  })

  it("completes an explicitly terminal reward step without entering the next branch", async () => {
    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      ...makeRun(1),
      currentStep: 1,
      totalSteps: 3,
      adventure: {
        steps: [
          { type: "narrative", name: "El altar", description: "Un altar." },
          {
            type: "reward",
            name: "Recompensa del Obispo",
            rewards: { gold: 80, ep: 15, fame: 5 },
            endsAdventure: true,
          },
          { type: "combat", name: "Lo Que Despierta Abajo", enemies: [] },
        ],
        rewards: { goldMin: 50, goldMax: 50, ep: 10, fame: 2 },
      },
    } as never)

    const result = await executeStep("hero-1", "run-1", 1)

    expect(result).toMatchObject({
      completed: true,
      victory: true,
      totalSteps: 3,
      stepResult: {
        type: "reward",
        stepName: "Recompensa del Obispo",
        rewards: { gold: 80, ep: 15, fame: 5 },
      },
      rewards: { gold: 50, ep: 10, fame: 2, items: [], materials: [] },
    })
    expect(mocks.tx.heroAdventure.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1", heroId: "hero-1", status: "active", currentStep: 1 },
      data: expect.objectContaining({
        status: "completed",
        currentStep: 2,
        result: expect.objectContaining({
          steps: [expect.objectContaining({ type: "reward", stepName: "Recompensa del Obispo" })],
          rewards: { gold: 50, ep: 10, fame: 2, items: [], materials: [] },
        }),
      }),
    }))
  })
})

describe("makeChoice resource costs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async callback => callback(mocks.tx))
    mocks.tx.$queryRaw.mockResolvedValue([])
    mocks.tx.heroAdventure.findUnique.mockResolvedValue(makeRun() as never)
    mocks.tx.heroAdventure.updateMany.mockResolvedValue({ count: 1 } as never)
    mocks.tx.hero.findUnique.mockResolvedValue(makeHero(20) as never)
    mocks.tx.hero.updateMany.mockResolvedValue({ count: 1 } as never)
  })

  it("charges the selected HP cost and persists it in the choice history", async () => {
    const result = await makeChoice("hero-1", "run-1", 1, 0)

    expect(mocks.tx.hero.updateMany).toHaveBeenCalledWith({
      where: { id: "hero-1", hpCurrent: { gt: 6 }, mpCurrent: { gte: 0 } },
      data: { hpCurrent: { decrement: 6 }, mpCurrent: { decrement: 0 } },
    })
    expect(mocks.tx.heroAdventure.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1", heroId: "hero-1", status: "active", currentStep: 0 },
      data: expect.objectContaining({
        currentStep: 2,
        result: expect.objectContaining({
          steps: [expect.objectContaining({
            type: "choice",
            chosen: "Tomar el cuchillo de obsidiana",
            costs: { hp: 6, mp: 0 },
            nextStep: 2,
          })],
        }),
      }),
    }))
    expect(result.heroResources).toEqual({ hpCurrent: 14, hpMax: 40, mpCurrent: 12, mpMax: 20 })
    expect(result.stepResult.costs).toEqual({ hp: 6, mp: 0 })
  })

  it("rejects a choice that would defeat the hero without attempting to charge it", async () => {
    mocks.tx.hero.findUnique.mockResolvedValue(makeHero(6) as never)

    await expect(makeChoice("hero-1", "run-1", 1, 0))
      .rejects.toThrow("No tienes suficiente salud o maná")

    expect(mocks.tx.hero.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.heroAdventure.updateMany).not.toHaveBeenCalled()
  })

  it("rejects a repeated submission after the adventure has advanced", async () => {
    mocks.tx.heroAdventure.findUnique
      .mockResolvedValueOnce(makeRun() as never)
      .mockResolvedValueOnce(makeRun(2) as never)

    await makeChoice("hero-1", "run-1", 1, 0)
    await expect(makeChoice("hero-1", "run-1", 1, 0))
      .rejects.toThrow("AVENTURA_CHOICE_STALE")

    expect(mocks.tx.hero.updateMany).toHaveBeenCalledTimes(1)
  })
})
