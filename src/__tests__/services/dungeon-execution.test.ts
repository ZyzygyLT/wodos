import { describe, expect, it, vi } from "vitest"
import type { RunResult, HeroData } from "@/lib/combat-engine/dungeon-runner"
import { persistRunResult } from "@/services/dungeon-execution.service"

describe("persistRunResult", () => {
  it("distributes group EP, gold, and fame as integer shares without losing rewards", async () => {
    const heroUpdateData: unknown[] = []
    const heroUpdate = vi.fn(async (args: { data: Record<string, unknown> }) => {
      heroUpdateData.push(args.data)
      return {}
    })
    const tx = {
      dungeonRun: {
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      hero: {
        update: heroUpdate,
        findFirst: vi.fn(async () => ({
          id: "hero-1", epTotal: 0, level: 1, hpMax: 100, mpMax: 40,
          attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
        })),
      },
      heroItem: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async () => ({ count: 0 })),
      },
    }

    const heroesFinalState = [
      { id: "hero-1", hp: 10, mp: 4 },
      { id: "hero-2", hp: 8, mp: 3 },
      { id: "hero-3", hp: 6, mp: 2 },
    ]
    const result = {
      victory: true,
      levelsCleared: 1,
      totalRounds: 3,
      epGained: 10,
      goldGained: 5,
      fameGained: 2,
      loot: [],
      heroesFinalState,
      consumedConsumables: [],
      log: [],
      levelResults: [],
      levelReports: [],
      eventJournal: { schemaVersion: 1, events: [] },
    } as unknown as RunResult

    await persistRunResult(tx as unknown as Parameters<typeof persistRunResult>[0], {
      runId: "run-1",
      result,
      heroesData: heroesFinalState.map(hero => ({ id: hero.id }) as HeroData),
      totalHeroes: 3,
    })

    expect(tx.hero.findFirst).toHaveBeenCalledTimes(3)
    expect(heroUpdateData).toEqual([
      {
        epTotal: { increment: 4 },
        gold: { increment: 2 },
        fame: { increment: 1 },
        hpCurrent: 10,
        mpCurrent: 4,
        dungeonRegisteredId: null,
      },
      {
        epTotal: { increment: 3 },
        gold: { increment: 2 },
        fame: { increment: 1 },
        hpCurrent: 8,
        mpCurrent: 3,
        dungeonRegisteredId: null,
      },
      {
        epTotal: { increment: 3 },
        gold: { increment: 1 },
        fame: { increment: 0 },
        hpCurrent: 6,
        mpCurrent: 2,
        dungeonRegisteredId: null,
      },
    ])
  })

  it("settles a defeated group run with partial rewards, final resources, and exact consumable ownership", async () => {
    const heroUpdates: Array<{ where: { id: string }; data: Record<string, unknown> }> = []
    const deleteMany = vi.fn(async () => ({ count: 1 }))
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const tx = {
      dungeonRun: { updateMany },
      hero: {
        update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          heroUpdates.push(args)
          return {}
        }),
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          epTotal: 0,
          level: 1,
          hpMax: 100,
          mpMax: 40,
          attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
        })),
      },
      heroItem: {
        deleteMany,
        createMany: vi.fn(async () => ({ count: 0 })),
      },
    }
    const result = {
      victory: false,
      levelsCleared: 1,
      totalRounds: 4,
      epGained: 15,
      goldGained: 9,
      fameGained: 3,
      loot: [],
      heroesFinalState: [
        { id: "hero-1", hp: 0, mp: 3 },
        { id: "hero-2", hp: 12, mp: 7 },
      ],
      consumedConsumables: [
        { heroId: "hero-1", heroItemId: "hero-item-potion-1" },
      ],
      log: [{ type: "heal", message: "Hero 1 uses a potion" }],
      levelReports: [{ level: 1, result: "defeat" }],
    } as unknown as RunResult

    await persistRunResult(tx as unknown as Parameters<typeof persistRunResult>[0], {
      runId: "run-group-defeat",
      result,
      heroesData: [{ id: "hero-1" }, { id: "hero-2" }] as HeroData[],
      totalHeroes: 2,
    })

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-group-defeat", status: "running" },
      data: expect.objectContaining({ status: "failed", result: "defeat", epGained: 15, goldGained: 9, fameGained: 3 }),
    }))
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["hero-item-potion-1"] }, heroId: "hero-1" },
    })
    expect(heroUpdates).toEqual([
      {
        where: { id: "hero-1" },
        data: {
          epTotal: { increment: 8 },
          gold: { increment: 5 },
          fame: { increment: 2 },
          hpCurrent: 0,
          mpCurrent: 3,
          dungeonRegisteredId: null,
        },
      },
      {
        where: { id: "hero-2" },
        data: {
          epTotal: { increment: 7 },
          gold: { increment: 4 },
          fame: { increment: 1 },
          hpCurrent: 12,
          mpCurrent: 7,
          dungeonRegisteredId: null,
        },
      },
    ])
  })

  it("applies level progression inside the reward transaction", async () => {
    const updates: Record<string, unknown>[] = []
    const tx = {
      dungeonRun: { updateMany: vi.fn(async () => ({ count: 1 })) },
      hero: {
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { updates.push(args.data); return {} }),
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id, epTotal: 200, level: 1, hpMax: 100, mpMax: 40,
          attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
        })),
      },
      heroItem: { deleteMany: vi.fn(async () => ({ count: 0 })), createMany: vi.fn(async () => ({ count: 0 })) },
    }
    const heroesFinalState = [{ id: "hero-1", hp: 10, mp: 4 }]
    const result = {
      victory: true, levelsCleared: 1, totalRounds: 1, epGained: 200,
      goldGained: 0, fameGained: 0, loot: [], heroesFinalState,
      consumedConsumables: [], log: [], levelResults: [], levelReports: [],
      eventJournal: { schemaVersion: 1, events: [] },
    } as unknown as RunResult

    const settlement = await persistRunResult(tx as unknown as Parameters<typeof persistRunResult>[0], {
      runId: "run-level-up", result, heroesData: [{ id: "hero-1" } as HeroData], totalHeroes: 1,
    })

    expect(settlement.levelUps).toEqual([{
      heroId: "hero-1",
      result: expect.objectContaining({ leveledUp: true, newLevel: 2, pointsAwarded: 5 }),
    }])
    expect(updates).toHaveLength(2)
    expect(updates[1]).toEqual(expect.objectContaining({ level: 2, freeAttrPoints: { increment: 5 } }))
  })
})
