import { describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"

import { applyLevelUpInTransaction, totalEpForLevel } from "@/lib/level-up"

describe("applyLevelUpInTransaction", () => {
  it("updates level, resources and attribute points in the caller transaction", async () => {
    const hero = {
      id: "hero-1",
      level: 1,
      epTotal: totalEpForLevel(2),
      hpMax: 20,
      mpMax: 10,
      attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
    }
    const tx = {
      hero: {
        findFirst: vi.fn().mockResolvedValue(hero),
        update: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Prisma.TransactionClient

    const result = await applyLevelUpInTransaction(tx, "hero-1")

    expect(result).toMatchObject({
      leveledUp: true,
      levelsGained: 1,
      newLevel: 2,
      pointsAwarded: 5,
    })
    expect(tx.hero.update).toHaveBeenCalledWith({
      where: { id: "hero-1" },
      data: {
        level: 2,
        hpMax: result.newHpMax,
        mpMax: result.newMpMax,
        hpCurrent: result.newHpMax,
        mpCurrent: result.newMpMax,
        freeAttrPoints: { increment: 5 },
      },
    })
  })

  it("does not write when the hero has not reached the next threshold", async () => {
    const tx = {
      hero: {
        findFirst: vi.fn().mockResolvedValue({
          id: "hero-1",
          level: 1,
          epTotal: totalEpForLevel(2) - 1,
          hpMax: 20,
          mpMax: 10,
          attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
        }),
        update: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient

    await expect(applyLevelUpInTransaction(tx, "hero-1")).resolves.toMatchObject({
      leveledUp: false,
      newLevel: 1,
      pointsAwarded: 0,
    })
    expect(tx.hero.update).not.toHaveBeenCalled()
  })
})
