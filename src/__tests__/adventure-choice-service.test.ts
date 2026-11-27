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
    heroItem: { createMany: vi.fn(), deleteMany: vi.fn() },
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
  buildHeroData: vi.fn(async (hero: {
    id: string
    attrs: Record<string, number>
    equipStats?: Record<string, number>
    items?: Array<{ id: string; item: { id: number; category: string; stats?: Record<string, number> } }>
  }, profile?: { position?: string; prelimRules?: unknown[]; roundRules?: unknown[]; defenseSkills?: Record<string, number | null> } | null) => ({
    attrs: hero.attrs,
    equipStats: hero.equipStats ?? {},
    skills: [],
    combatProfile: {
      position: profile?.position ?? 'front',
      prelimRules: profile?.prelimRules ?? [],
      roundRules: profile?.roundRules ?? [],
      defenseSkills: profile?.defenseSkills ?? {},
    },
    consumables: (hero.items ?? []).flatMap(entry => {
      if (entry.item.category !== 'consumable') return []
      const stats = entry.item.stats ?? {}
      const healHp = stats.healHp ?? stats.heal
      const healMp = stats.healMp ?? stats.mana
      return [{
        heroItemId: entry.id,
        itemId: entry.item.id,
        ...(typeof healHp === 'number' && healHp > 0 ? { healHp } : {}),
        ...(typeof healMp === 'number' && healMp > 0 ? { healMp } : {}),
      }]
    }),
  })),
  mergeHeroAttrs: vi.fn((hero: { attrs: Record<string, number>; equipStats?: Record<string, number> }) =>
    Object.fromEntries(Object.entries({ ...hero.attrs }).map(([key, value]) => [key, value + (hero.equipStats?.[key] ?? 0)])),
  ),
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
    attrs: { pe: 10, co: 2, wi: 2, in: 2 },
    equipStats: { co: 2, in: 3 },
    level: 1,
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

  it("grants reward-step items immediately so they are available before the next encounter", async () => {
    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      ...makeRun(1),
      currentStep: 1,
      totalSteps: 3,
      adventure: {
        steps: [
          { type: "narrative", name: "El altar", description: "Un altar." },
          {
            type: "reward",
            name: "Tesoro del Explorador",
            rewards: { gold: 30, ep: 10, items: [{ itemId: 17, qty: 1 }] },
          },
          { type: "combat", name: "La Corrupción Primigenia", enemies: [] },
        ],
        rewards: { goldMin: 30, goldMax: 30, ep: 10, fame: 2 },
      },
    } as never)

    const result = await executeStep("hero-1", "run-1", 1)

    expect(result.stepResult).toMatchObject({
      type: "reward",
      itemsGranted: true,
      rewards: { items: [{ itemId: 17, qty: 1 }] },
    })
    expect(mocks.tx.heroItem.createMany).toHaveBeenCalledWith({
      data: [{ heroId: "hero-1", itemId: 17, equipped: false }],
    })
    expect(mocks.tx.heroAdventure.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        result: expect.objectContaining({
          steps: [expect.objectContaining({ type: "reward", itemsGranted: true })],
        }),
      }),
    }))
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

  it("charges the selected HP cost only to the expedition and persists it in the choice history", async () => {
    const result = await makeChoice("hero-1", "run-1", 1, 0)

    expect(mocks.tx.hero.updateMany).not.toHaveBeenCalled()
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
          expeditionHp: 54,
        }),
      }),
    }))
    expect(result.heroResources).toEqual({ hpCurrent: 54, hpMax: 60, mpCurrent: 12, mpMax: 32 })
    expect(result.stepResult.costs).toEqual({ hp: 6, mp: 0 })
  })

  it("rejects a choice that would defeat the hero without attempting to charge it", async () => {
    mocks.tx.hero.findUnique.mockResolvedValue(makeHero(6) as never)
    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      ...makeRun(),
      result: { steps: [], rewards: null, expeditionHp: 6 },
    } as never)

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

    expect(mocks.tx.hero.updateMany).not.toHaveBeenCalled()
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

  it("passes a newly earned adventure potion into the next boss fight and removes the consumed inventory row", async () => {
    const steps = [
      { type: "narrative", name: "El sendero", description: "Un sendero." },
      {
        type: "reward",
        name: "Tesoro del Explorador",
        rewards: { gold: 30, ep: 10, items: [{ itemId: 17, qty: 1 }] },
      },
      {
        type: "combat",
        name: "La Corrupción Primigenia",
        enemies: [{ name: "Corrupción Primigenia", icon: "👾", hp: 80, mp: 40, atk: 14, def: 5, dx: 8, ag: 6, level: 4 }],
      },
    ]
    const inventory: Array<{ id: string; itemId: number; equipped: boolean; item: { id: number; category: string; stats: Record<string, number> } }> = []

    mocks.tx.hero.findUnique.mockImplementation(async () => ({
      ...makeHero(14),
      combatProfiles: [{
        id: "profile-general",
        dungeonLevel: null,
        position: "front",
        prelimRules: [],
        roundRules: [{
          priority: 1,
          condition: { type: "hp_self_lt", value: 30 },
          action: { skillId: 0, itemId: 17, targetPos: "self", targetType: "self" },
        }],
        defenseSkills: {},
      }],
      items: [...inventory],
    }) as never)
    mocks.tx.heroItem.createMany.mockImplementation(async ({ data }: { data: Array<{ heroId: string; itemId: number; equipped: boolean }> }) => {
      data.forEach((entry, index) => inventory.push({
        id: `earned-item-${inventory.length + index + 1}`,
        itemId: entry.itemId,
        equipped: entry.equipped,
        item: { id: entry.itemId, category: "consumable", stats: { heal: 50 } },
      }))
      return { count: data.length } as never
    })
    mocks.tx.heroItem.deleteMany.mockImplementation(async ({ where }: { where: { id: { in: string[] }; heroId: string } }) => {
      const before = inventory.length
      for (let index = inventory.length - 1; index >= 0; index--) {
        if (where.id.in.includes(inventory[index].id)) inventory.splice(index, 1)
      }
      return { count: before - inventory.length } as never
    })

    mocks.tx.heroAdventure.findUnique
      .mockResolvedValueOnce({
        ...makeRun(1),
        result: { steps: [], rewards: null, expeditionHp: 14 },
        currentStep: 1,
        totalSteps: steps.length,
        adventure: { steps, rewards: { goldMin: 30, goldMax: 30, ep: 10, fame: 2 } },
      } as never)
      .mockResolvedValueOnce({
        ...makeRun(2),
        result: { steps: [], rewards: null, expeditionHp: 14 },
        currentStep: 2,
        totalSteps: steps.length,
        adventure: { steps, rewards: { goldMin: 30, goldMax: 30, ep: 10, fame: 2 } },
      } as never)

    const reward = await executeStep("hero-1", "run-1", 1)
    expect(reward.stepResult).toMatchObject({ type: "reward", itemsGranted: true })
    expect(inventory).toHaveLength(1)

    vi.mocked(runDungeon).mockResolvedValueOnce({
      victory: true,
      heroesFinalState: [{ id: "hero-1", hp: 28, mp: 8 }],
      levelReports: [{
        rounds: [{
          stateBefore: {
            heroes: [{ id: "hero-1", name: "Héroe", level: 1, position: "front", hp: 14, maxHp: 60, mp: 12, maxMp: 32, condition: "normal", isHero: true }],
            enemies: [{ id: "enemy-1", name: "Corrupción Primigenia", level: 4, position: "front", hp: 80, maxHp: 80, mp: 40, maxMp: 40, condition: "normal", isHero: false }],
          },
          stateAfter: {
            heroes: [{ id: "hero-1", name: "Héroe", level: 1, position: "front", hp: 28, maxHp: 60, mp: 8, maxMp: 32, condition: "normal", isHero: true }],
            enemies: [{ id: "enemy-1", name: "Corrupción Primigenia", level: 4, position: "front", hp: 0, maxHp: 80, mp: 40, maxMp: 40, condition: "defeated", isHero: false }],
          },
          actions: [{
            actorId: "hero-1",
            itemName: "Poción de Vida",
            healAmount: 50,
            healType: "hp",
            message: "El héroe usa Poción de Vida y recupera 50 HP.",
          }],
        }],
      }],
      log: [{ message: "El héroe usa Poción de Vida y recupera 50 HP." }],
      totalRounds: 1,
      epGained: 0,
      goldGained: 0,
      loot: [],
      consumedConsumables: [{ heroId: "hero-1", heroItemId: "earned-item-1" }],
    } as never)

    const combat = await executeStep("hero-1", "run-1", 2)
    const [combatParty] = vi.mocked(runDungeon).mock.calls[0]
    expect(combatParty[0].consumables).toEqual([
      { heroItemId: "earned-item-1", itemId: 17, healHp: 50 },
    ])
    expect(combatParty[0].combatProfile.prelimRules).toEqual([])
    expect(combatParty[0].combatProfile.roundRules).toEqual([{
      priority: 1,
      condition: { type: "hp_self_lt", value: 30 },
      action: { skillId: 0, itemId: 17, targetPos: "self", targetType: "self" },
    }])
    expect(mocks.tx.heroItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["earned-item-1"] }, heroId: "hero-1" },
    })
    expect(inventory).toHaveLength(0)
    expect(combat.stepResult).toMatchObject({
      type: "combat",
      victory: true,
      enemiesDefeated: 1,
      replay: {
        levelReports: [{
          rounds: [{
            actions: [expect.objectContaining({
              itemName: "Poción de Vida",
              healAmount: 50,
              healType: "hp",
            })],
          }],
        }],
      },
    })
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
      data: { hpCurrent: 60, mpCurrent: 3 },
    })
    expect(result).toMatchObject({
      completed: true,
      victory: false,
      rewards: null,
      stepResult: { type: "combat", victory: false, heroHpRemaining: 0 },
      heroResources: { hpCurrent: 0, hpMax: 60, mpCurrent: 3, mpMax: 32 },
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
      data: { hpCurrent: 60, mpCurrent: 7 },
    })
    expect(result).toMatchObject({
      completed: false,
      currentStep: 2,
      nextStep: { type: "narrative", name: "El Precio de la Curiosidad" },
      heroResources: { hpCurrent: 9, hpMax: 60, mpCurrent: 7, mpMax: 32 },
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

  it("does not grant reward-step items twice after they were delivered immediately", async () => {
    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      id: "run-1", heroId: "hero-1", status: "completed",
      result: {
        rewards: { gold: 30, ep: 10, fame: 2, items: [] },
        steps: [{
          type: "reward",
          itemsGranted: true,
          rewards: { gold: 12, ep: 3, items: [{ itemId: 17, qty: 1 }] },
        }],
      },
      adventure: { factionId: null, factionRep: 0 },
    } as never)

    const result = await claimRewards("hero-1", "run-1")

    expect(result.rewards).toMatchObject({ gold: 42, ep: 13 })
    expect(result.rewards.items).toBeUndefined()
    expect(mocks.tx.heroItem.createMany).not.toHaveBeenCalled()
  })

  it("does not offer a failed run whose only step loot was already delivered", async () => {
    mocks.tx.heroAdventure.findUnique.mockResolvedValue({
      id: "run-1", heroId: "hero-1", status: "failed",
      result: {
        outcome: "defeated",
        steps: [{
          type: "reward",
          itemsGranted: true,
          rewards: { items: [{ itemId: 17, qty: 1 }] },
        }],
      },
      adventure: { factionId: null, factionRep: 0 },
    } as never)

    await expect(claimRewards("hero-1", "run-1")).rejects.toThrow("Solo se pueden reclamar")
    expect(mocks.tx.heroItem.createMany).not.toHaveBeenCalled()
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
