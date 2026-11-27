import { describe, expect, it, vi } from "vitest"
import { mockDb } from "@/__tests__/setup"
import { persistRunResult, processDungeonRunPostProcessing } from "@/services/dungeon-execution.service"

vi.mock("@/lib/craft/material-drops", () => ({ grantMaterialDrops: vi.fn(async () => true) }))
vi.mock("@/services/event.service", () => ({ trackHeroEventProgress: vi.fn(async () => {}) }))
vi.mock("@/services/faction.service", () => ({ adjustRep: vi.fn(async () => ({ rep: 1 })) }))

describe("dungeon post-processing outbox", () => {
  it("creates the post-run task using the settlement transaction", async () => {
    const create = vi.fn(async () => ({}))
    const tx = {
      dungeonRun: { updateMany: vi.fn(async () => ({ count: 1 })) },
      hero: {
        update: vi.fn(async () => ({})),
        findFirst: vi.fn(async () => ({
          id: "hero-1", epTotal: 0, level: 1, hpMax: 100, mpMax: 20,
          attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
        })),
      },
      dungeonRunPostProcessing: { create },
    }
    const result = {
      victory: true,
      log: [],
      levelReports: [],
      levelsCleared: 1,
      epGained: 0,
      goldGained: 0,
      fameGained: 0,
      loot: [],
      heroesFinalState: [{ id: "hero-1", hp: 10, mp: 2 }],
      consumedConsumables: [],
    } as any

    await persistRunResult(tx as any, {
      runId: "run-outbox",
      result,
      heroesData: [{ id: "hero-1" }] as any,
      totalHeroes: 1,
      dungeon: { id: 1, name: "Test Dungeon", slug: "test-dungeon" },
      clanMemberRec: null,
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        runId: "run-outbox",
        payload: expect.objectContaining({
          heroIds: [],
          dungeon: { id: 1, name: "Test Dungeon", slug: "test-dungeon" },
        }),
      }),
    }))
  })

  it("claims and completes a pending task exactly once", async () => {
    const payload = {
      result: {
        victory: true, log: [], epGained: 0, goldGained: 0, fameGained: 0,
        levelsCleared: 1, loot: [], heroesFinalState: [{ id: "hero-1", hp: 10, mp: 2 }],
      },
      heroIds: ["hero-1"],
      totalHeroes: 1,
      dungeon: { id: 1, name: "Test Dungeon", slug: "test-dungeon" },
      clanMemberRec: null,
      levelUps: [],
    }
    mockDb.dungeonRunPostProcessing.updateMany.mockResolvedValue({ count: 1 })
    mockDb.dungeonRunPostProcessing.findUnique.mockResolvedValue({
      runId: "run-outbox", payload, attempts: 1,
    })
    mockDb.weeklyEvent.findFirst.mockResolvedValue(null)

    await expect(processDungeonRunPostProcessing("run-outbox")).resolves.toBe(true)

    expect(mockDb.dungeonRunPostProcessing.updateMany).toHaveBeenCalledTimes(2)
    expect(mockDb.dungeonRunPostProcessing.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { runId: "run-outbox", status: "processing" },
      data: expect.objectContaining({ status: "completed" }),
    }))
  })
})
