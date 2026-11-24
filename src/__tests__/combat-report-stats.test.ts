import { describe, expect, it } from "vitest"
import { computeCombatStats } from "@/lib/combat-report-stats"
import type { DetailedAction, LevelReport, RoundReport } from "@/lib/combat-engine/dungeon-runner"

function makeRound(actions: Partial<DetailedAction>[]): RoundReport {
  return {
    roundNumber: 1,
    stateBefore: {
      heroes: [{ id: "hero-1", name: "Aventurera", level: 5, position: "front", hp: 20, maxHp: 20, mp: 5, maxMp: 5, condition: "normal", isHero: true }],
      enemies: [
        { id: "enemy-1", name: "Limo", level: 2, position: "front", hp: 7, maxHp: 7, mp: 0, maxMp: 0, condition: "normal", isHero: false },
        { id: "enemy-2", name: "Goblin", level: 2, position: "front", hp: 11, maxHp: 11, mp: 0, maxMp: 0, condition: "normal", isHero: false },
      ],
    },
    stateAfter: { heroes: [], enemies: [] },
    actions: actions as DetailedAction[],
  } as RoundReport
}

function reports(...rounds: RoundReport[]): LevelReport[] {
  return [{ levelNumber: 1, victory: true, rounds, epGained: 0, goldGained: 0 }]
}

describe("computeCombatStats", () => {
  it("registers heroes before their turn and does not expose enemies as heroes", () => {
    const round = makeRound([{
      actorId: "enemy-1",
      actorName: "Limo",
      actionNumber: 1,
      totalActions: 1,
      initiative: 10,
      skillId: 1,
      skillName: "Golpe",
      message: "El limo ataca",
      targetId: "hero-1",
      targetName: "Aventurera",
      resultType: "failed",
      defenseEffect: "dodge",
    }])

    expect(computeCombatStats(reports(round))).toEqual([
      expect.objectContaining({
        heroId: "hero-1",
        heroName: "Aventurera",
        totalActions: 0,
        totalDamageTaken: 0,
        dodged: 1,
      }),
    ])
  })

  it("counts every target in area attacks, including damage types and kills", () => {
    const round = makeRound([{
      actorId: "hero-1",
      actorName: "Aventurera",
      actionNumber: 1,
      totalActions: 1,
      initiative: 20,
      skillId: 2,
      skillName: "Lluvia elemental",
      message: "Ataca a todos",
      targetResults: [
        { targetId: "enemy-1", targetName: "Limo", resultType: "success", damageBreakdown: [{ type: "fire", value: 7 }] },
        { targetId: "enemy-2", targetName: "Goblin", resultType: "critical_success", damageBreakdown: [{ type: "ice", value: 11 }] },
      ],
    }])

    expect(computeCombatStats(reports(round))).toEqual([
      expect.objectContaining({
        heroId: "hero-1",
        totalActions: 1,
        totalDamageDealt: 18,
        damageByType: { fire: 7, ice: 11 },
        kills: 2,
        totalAttacks: 2,
        successfulAttacks: 2,
      }),
    ])
  })

  it("tracks mana, support actions, consumables and absorbed damage", () => {
    const round = makeRound([
      { actorId: "hero-1", actorName: "Aventurera", actionNumber: 1, totalActions: 2, initiative: 20, skillId: 4, skillName: "Canción de valor", message: "Buff", mpCost: 6, buffName: "valor", buffValue: 15, targetId: "hero-1" },
      { actorId: "enemy-1", actorName: "Limo", actionNumber: 1, totalActions: 1, initiative: 10, skillId: 5, skillName: "Golpe", message: "Ataca", targetId: "hero-1", resultType: "success", damageBreakdown: [{ type: "physical", value: 5 }], absorbed: 3 },
      { actorId: "hero-1", actorName: "Aventurera", actionNumber: 2, totalActions: 2, initiative: 20, skillId: 6, skillName: "Poción", message: "Usa objeto", itemName: "Poción de maná", mpCost: 2 },
    ])
    expect(computeCombatStats(reports(round))[0]).toMatchObject({
      totalManaSpent: 8, buffsUsed: 1, itemsUsed: 1, totalDamageAbsorbed: 3,
    })
  })

  it("attributes single-target damage received to the defender", () => {
    const round = makeRound([{
      actorId: "enemy-1",
      actorName: "Limo",
      actionNumber: 1,
      totalActions: 1,
      initiative: 10,
      skillId: 3,
      skillName: "Salpicadura",
      message: "Ataca",
      targetId: "hero-1",
      targetName: "Aventurera",
      resultType: "success",
      damageBreakdown: [{ type: "poison", value: 4 }],
    }])

    expect(computeCombatStats(reports(round))[0]).toMatchObject({
      heroId: "hero-1",
      totalDamageTaken: 4,
    })
  })
})
