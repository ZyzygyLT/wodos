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
      update: vi.fn(),
    },
    heroItem: { createMany: vi.fn() },
    heroMaterial: { upsert: vi.fn() },
    heroFactionRep: { upsert: vi.fn() },
  }

  return {
    tx,
    transaction: vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx)),
  }
})

vi.mock("@/lib/db", () => ({
  default: { $transaction: mocks.transaction },
}))

vi.mock("@/lib/combat-engine/dungeon-runner", () => ({ runDungeon: vi.fn() }))

vi.mock("@/lib/level-up", () => ({
  applyLevelUpInTransaction: vi.fn(async () => null),
  publishLevelUpEffects: vi.fn(),
}))

vi.mock("@/lib/dungeon-helpers", () => ({
  buildHeroData: vi.fn(async (hero: { attrs: Record<string, number> }) => ({
    attrs: hero.attrs,
    equipStats: {},
  })),
  mergeHeroAttrs: vi.fn((hero: { attrs: Record<string, number> }) => hero.attrs),
}))

import { runDungeon } from "@/lib/combat-engine/dungeon-runner"
import { executeStep, makeChoice, claimRewards } from "@/services/adventure.service"
import { applyLevelUpInTransaction } from "@/lib/level-up"

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


describe("executeStep adventure combat branch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async callback => callback(mocks.tx))
    mocks.tx.$queryRaw.mockResolvedValue([])
    mocks.tx.heroAdventure.updateMany.mockResolvedValue({ count: 1 } as never)
    mocks.tx.hero.findUnique.mockResolvedValue(makeHero(14) as never)
    mocks.tx.hero.update.mockResolvedValue({} as never)
  })


  it("marks the run defeated and withholds completion rewards when the hero loses", async () => {
    vi.mocked(runDungeon).mockResolvedValue({
      victory: false,
      heroesFinalState: [{ id: "hero-1", hp: 0, mp: 3 }],
      levelReports: [],
      log: [{ message: "El Vestigio derriba al héroe." }],
      totalRounds: 3,
      epGained: 0,
      goldGained: 0,
      loot: [],
      consumedConsumables: [],
    } as never)

    const steps = [
      {
        type: "combat",
        name: "Lo Que Despierta Abajo",
        description: "El Vestigio emerge.",
        enemies: [{
          name: "Vestigio del Rey Brujo", icon: "👑", hp: 120, mp: 60,
          atk: 22, def: 10, dx: 10, ag: 8, level: 9,
        }],
      },
      {
        type: "reward",
        name: "Trofeo de Guerra",
        description: "El fragmento de sombra queda en la cámara.",
        rewards: { gold: 60, ep: 20, fame: 8, materials: [{ materialId: 7, qty: 1 }] },
      },
    ]

    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      ...makeRun(0),
      currentStep: 0,
      totalSteps: steps.length,
      adventure: { steps, rewards: { goldMin: 50, goldMax: 120, ep: 45, fame: 6 } },
    } as never)

    const result = await executeStep("hero-1", "run-1", 0)

    expect(mocks.tx.hero.update).toHaveBeenCalledWith({
      where: { id: "hero-1" },
      data: { hpCurrent: 0, mpCurrent: 3 },
    })
    expect(result).toMatchObject({
      completed: true,
      victory: false,
      rewards: null,
      stepResult: { type: "combat", victory: false, heroHpRemaining: 0 },
      heroResources: { hpCurrent: 0, hpMax: 40, mpCurrent: 3, mpMax: 20 },
    })
    expect(mocks.tx.heroAdventure.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1", heroId: "hero-1", status: "active", currentStep: 0 },
      data: expect.objectContaining({
        status: "failed",
        result: expect.objectContaining({
          outcome: "defeated",
          steps: [expect.objectContaining({ type: "combat", victory: false })],
        }),
      }),
    }))
    expect(result.rewards).toBeNull()
  })

  it("persists the shared combat result and advances to the post-boss narrative without completing early", async () => {
    vi.mocked(runDungeon).mockResolvedValue({
      victory: true,
      heroesFinalState: [{ id: "hero-1", hp: 9, mp: 7 }],
      levelReports: [],
      log: [{ message: "El Vestigio del Rey Brujo cae." }],
      totalRounds: 2,
      epGained: 0,
      goldGained: 0,
      loot: [],
      consumedConsumables: [],
    } as never)

    const steps = [
      adventureSteps[0],
      {
        type: "combat",
        name: "Lo Que Despierta Abajo",
        description: "El Vestigio emerge.",
        enemies: [{
          name: "Vestigio del Rey Brujo", icon: "👑", hp: 120, mp: 60,
          atk: 22, def: 10, dx: 10, ag: 8, level: 9,
        }],
      },
      { type: "narrative", name: "El Precio de la Curiosidad", description: "La amenaza queda contenida." },
      {
        type: "reward",
        name: "Trofeo de Guerra",
        description: "Recoges un fragmento de sombra.",
        rewards: { gold: 60, ep: 20, fame: 8, materials: [{ materialId: 7, qty: 1 }] },
      },
    ]

    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      ...makeRun(1),
      currentStep: 1,
      totalSteps: steps.length,
      adventure: { steps, rewards: { goldMin: 50, goldMax: 120, ep: 45, fame: 6 } },
    } as never)

    const result = await executeStep("hero-1", "run-1", 1)

    expect(runDungeon).toHaveBeenCalledTimes(1)
    expect(mocks.tx.hero.update).toHaveBeenCalledWith({
      where: { id: "hero-1" },
      data: { hpCurrent: 9, mpCurrent: 7 },
    })
    expect(result).toMatchObject({
      completed: false,
      currentStep: 2,
      nextStep: { type: "narrative", name: "El Precio de la Curiosidad" },
      heroResources: { hpCurrent: 9, hpMax: 40, mpCurrent: 7, mpMax: 20 },
      stepResult: {
        type: "combat",
        victory: true,
        stepName: "Lo Que Despierta Abajo",
        heroHpRemaining: 9,
        heroMpRemaining: 7,
      },
    })
    expect(mocks.tx.heroAdventure.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-1", heroId: "hero-1", status: "active", currentStep: 1 },
      data: expect.objectContaining({
        currentStep: 2,
        result: expect.objectContaining({
          steps: [expect.objectContaining({ type: "combat", victory: true })],
        }),
      }),
    }))
  })
})

describe("claimRewards transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async callback => callback(mocks.tx))
    mocks.tx.$queryRaw.mockResolvedValue([])
    mocks.tx.heroAdventure.updateMany.mockResolvedValue({ count: 1 } as never)
    mocks.tx.hero.update.mockResolvedValue({} as never)
    mocks.tx.heroItem.createMany.mockResolvedValue({ count: 1 } as never)
    mocks.tx.heroMaterial.upsert.mockResolvedValue({} as never)
    mocks.tx.heroFactionRep.upsert.mockResolvedValue({} as never)
    vi.mocked(applyLevelUpInTransaction).mockResolvedValue({
      leveledUp: false,
      levelsGained: 0,
      newLevel: 1,
      newHpMax: 40,
      newMpMax: 20,
      pointsAwarded: 0,
    })
  })

  it("claims only previously collected loot after defeat and excludes completion rewards and faction reputation", async () => {
    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      id: "run-1", heroId: "hero-1", status: "failed",
      result: {
        outcome: "defeated",
        rewards: { gold: 100, ep: 80, fame: 40, items: [{ itemId: 99, qty: 1 }] },
        steps: [
          { type: "reward", rewards: { gold: 12, ep: 3, fame: 2, items: [{ itemId: 7, qty: 2 }], materials: [{ materialId: 4, qty: 3 }] } },
          { type: "combat", victory: false },
        ],
      },
      adventure: { factionId: 5, factionRep: 25 },
    } as never)

    const result = await claimRewards("hero-1", "run-1")

    const lockStatements = mocks.tx.$queryRaw.mock.calls
      .slice(0, 2)
      .map(([query]) => query[0])
    expect(lockStatements[0]).toContain('FROM "heroes"')
    expect(lockStatements[1]).toContain('FROM "hero_adventures"')

    expect(result).toMatchObject({
      claimed: true, partial: true,
      factionRep: 0,
      rewards: { gold: 12, ep: 3, fame: 2, items: [{ itemId: 7, qty: 2 }], materials: [{ materialId: 4, qty: 3 }] },
    })
    expect(mocks.tx.hero.update).toHaveBeenCalledWith({
      where: { id: "hero-1" },
      data: { gold: { increment: 12 }, epTotal: { increment: 3 }, fame: { increment: 2 } },
    })
    expect(mocks.tx.heroItem.createMany).toHaveBeenCalledWith({
      data: [{ heroId: "hero-1", itemId: 7, equipped: false }, { heroId: "hero-1", itemId: 7, equipped: false }],
    })
    expect(mocks.tx.heroMaterial.upsert).toHaveBeenCalledWith({
      where: { heroId_materialId: { heroId: "hero-1", materialId: 4 } },
      create: { heroId: "hero-1", materialId: 4, quantity: 3 },
      update: { quantity: { increment: 3 } },
    })
    expect(mocks.tx.heroFactionRep.upsert).not.toHaveBeenCalled()
    expect(mocks.tx.heroAdventure.updateMany).toHaveBeenCalledWith({
      where: { id: "run-1", heroId: "hero-1", status: "failed" },
      data: { status: "claimed" },
    })
    expect(applyLevelUpInTransaction).toHaveBeenCalledWith(mocks.tx, "hero-1")
  })

  it("claims completion and step rewards together and grants faction reputation after victory", async () => {
    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      id: "run-1", heroId: "hero-1", status: "completed",
      result: {
        rewards: { gold: 40, ep: 10, fame: 5, items: [{ itemId: 2, qty: 1 }] },
        steps: [{ type: "reward", rewards: { gold: 8, ep: 2, fame: 1, materials: [{ materialId: 6, qty: 2 }] } }],
      },
      adventure: { factionId: 5, factionRep: 25 },
    } as never)

    const result = await claimRewards("hero-1", "run-1")

    expect(result).toMatchObject({
      claimed: true, partial: false,
      factionRep: 25,
      rewards: { gold: 48, ep: 12, fame: 6, items: [{ itemId: 2, qty: 1 }], materials: [{ materialId: 6, qty: 2 }] },
    })
    expect(mocks.tx.hero.update).toHaveBeenCalledWith({
      where: { id: "hero-1" },
      data: { gold: { increment: 48 }, epTotal: { increment: 12 }, fame: { increment: 6 } },
    })
    expect(mocks.tx.heroItem.createMany).toHaveBeenCalledWith({
      data: [{ heroId: "hero-1", itemId: 2, equipped: false }],
    })
    expect(mocks.tx.heroMaterial.upsert).toHaveBeenCalledWith({
      where: { heroId_materialId: { heroId: "hero-1", materialId: 6 } },
      create: { heroId: "hero-1", materialId: 6, quantity: 2 },
      update: { quantity: { increment: 2 } },
    })
    expect(mocks.tx.heroFactionRep.upsert).toHaveBeenCalledWith({
      where: { heroId_factionId: { heroId: "hero-1", factionId: 5 } },
      create: { heroId: "hero-1", factionId: 5, rep: 25 },
      update: { rep: { increment: 25 } },
    })
    expect(mocks.tx.heroAdventure.updateMany).toHaveBeenCalledWith({
      where: { id: "run-1", heroId: "hero-1", status: "completed" },
      data: { status: "claimed" },
    })
    expect(applyLevelUpInTransaction).toHaveBeenCalledWith(mocks.tx, "hero-1")
  })

  it("rejects a second claim before crediting any reward", async () => {
    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      id: "run-1", heroId: "hero-1", status: "claimed",
      result: { rewards: { gold: 50 }, steps: [] },
      adventure: { factionId: 5, factionRep: 25 },
    } as never)

    await expect(claimRewards("hero-1", "run-1")).rejects.toThrow("Recompensas ya reclamadas")

    expect(mocks.tx.hero.update).not.toHaveBeenCalled()
    expect(mocks.tx.heroItem.createMany).not.toHaveBeenCalled()
    expect(mocks.tx.heroMaterial.upsert).not.toHaveBeenCalled()
    expect(mocks.tx.heroFactionRep.upsert).not.toHaveBeenCalled()
    expect(mocks.tx.heroAdventure.updateMany).not.toHaveBeenCalled()
  })
})
