import { describe, expect, it, vi } from "vitest"
import type { RunResult, HeroData } from "@/lib/combat-engine/dungeon-runner"
import { persistRunResult } from "@/services/dungeon-execution.service"

describe("persistRunResult", () => {
  it("distributes group EP, gold, and fame as integer shares without losing rewards", async () => {
    const heroUpdate = vi.fn(async (_args: any) => ({}))
    const tx = {
      dungeonRun: {
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      hero: { update: heroUpdate },
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

    await persistRunResult(tx as any, {
      runId: "run-1",
      result,
      heroesData: heroesFinalState.map(hero => ({ id: hero.id }) as HeroData),
      totalHeroes: 3,
    })

    expect(heroUpdate.mock.calls.map(([args]) => args.data)).toEqual([
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
})
