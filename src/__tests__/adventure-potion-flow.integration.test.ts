import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  const inventory: Array<{
    id: string
    itemId: number
    equipped: boolean
    item: { id: number; category: string; stats: Record<string, number> }
  }> = []
  const hero = {
    id: 'hero-potion-flow',
    name: 'Héroe de integración',
    level: 1,
    attrs: { st: 1, co: 1, in: 1, dx: 1, ch: 1, ag: 1, pe: 1, wi: 1 },
    hpMax: 60,
    mpMax: 20,
    hpCurrent: 14,
    mpCurrent: 10,
    gold: 0,
    epTotal: 0,
    adventureEnergy: 5,
    adventureEnergyMax: 5,
    lastEnergyRechargeAt: new Date(),
    combatProfiles: [{
      id: 'potion-profile',
      dungeonLevel: null,
      position: 'front',
      prelimRules: [],
      roundRules: [
        {
          priority: 1,
          condition: { type: 'hp_self_lt', value: 30 },
          action: { skillId: 0, itemId: 17, targetPos: 'self', targetType: 'self' },
        },
        {
          priority: 2,
          condition: { type: 'always' },
          action: { skillId: 7, targetPos: 'front', targetType: 'weakest' },
        },
      ],
      defenseSkills: {},
    }],
    skills: [{
      rank: 1,
      skill: {
        id: 7,
        type: 'basic',
        name: 'Golpe de prueba',
        icon: '⚔️',
        multiplier: 1,
        manaCost: 0,
        effect: 'attack',
        formula: { attrCoeffs: {}, skillRankCoeff: 0, diceSides: 0, diceCount: 0, flatBonus: 3 },
        tags: [],
      },
    }, {
      rank: 1,
      skill: {
        id: 9001,
        type: 'active',
        name: 'Tomar poción',
        icon: '🧪',
        multiplier: 1,
        manaCost: 0,
        effect: 'use_potion',
        formula: { attrCoeffs: { wi: 1 }, skillRankCoeff: 2, diceSides: 0, diceCount: 0, flatBonus: 0 },
        tags: ['consumable', 'healing'],
      },
    }],
    get items() { return inventory },
  }
  const steps = [
    { type: 'narrative', name: 'El sendero', description: 'Un sendero conduce a una cámara.' },
    {
      type: 'reward',
      name: 'Tesoro del Explorador',
      rewards: { gold: 30, ep: 10, items: [{ itemId: 17, qty: 1 }] },
    },
    {
      type: 'combat',
      name: 'La Corrupción Primigenia',
      enemies: [{
        name: 'Corrupción Primigenia',
        icon: '👾',
        hp: 1,
        mp: 0,
        atk: 0,
        def: 0,
        dx: 1,
        ag: 1,
        level: 1,
      }],
    },
  ]
  const adventureRun = {
    id: 'adventure-run-potion-flow',
    heroId: hero.id,
    adventureId: 1,
    currentStep: 1,
    totalSteps: steps.length,
    status: 'active',
    result: { steps: [], rewards: null, expeditionHp: 14 },
    adventure: { steps, rewards: { goldMin: 30, goldMax: 30, ep: 10, fame: 2 } },
  }
  const tx = {
    $queryRaw: vi.fn(async () => []),
    hero: {
      findUnique: vi.fn(async (args: { include?: unknown }) => {
        if (!args.include) {
          return {
            id: hero.id,
            level: hero.level,
            adventureEnergy: hero.adventureEnergy,
            adventureEnergyMax: hero.adventureEnergyMax,
            lastEnergyRechargeAt: hero.lastEnergyRechargeAt,
            gold: hero.gold,
            hpCurrent: hero.hpCurrent,
            hpMax: hero.hpMax,
            mpCurrent: hero.mpCurrent,
            mpMax: hero.mpMax,
            attrs: hero.attrs,
          }
        }
        return { ...hero, items: [...inventory] }
      }),
      update: vi.fn(async ({ data }: { data: { hpCurrent?: number; mpCurrent?: number } }) => {
        if (typeof data.hpCurrent === 'number') hero.hpCurrent = data.hpCurrent
        if (typeof data.mpCurrent === 'number') hero.mpCurrent = data.mpCurrent
        return hero
      }),
    },
    heroAdventure: {
      findUnique: vi.fn(async () => adventureRun),
      updateMany: vi.fn(async ({ data }: { data: { currentStep?: number; status?: string; result?: unknown } }) => {
        if (typeof data.currentStep === 'number') adventureRun.currentStep = data.currentStep
        if (data.status) adventureRun.status = data.status
        if (data.result) adventureRun.result = data.result as typeof adventureRun.result
        return { count: 1 }
      }),
    },
    heroItem: {
      createMany: vi.fn(async ({ data }: { data: Array<{ heroId: string; itemId: number; equipped: boolean }> }) => {
        data.forEach(entry => inventory.push({
          id: `earned-potion-${inventory.length + 1}`,
          itemId: entry.itemId,
          equipped: entry.equipped,
          item: { id: entry.itemId, category: 'consumable', stats: { heal: 50 } },
        }))
        return { count: data.length }
      }),
      deleteMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; heroId: string } }) => {
        const before = inventory.length
        for (let index = inventory.length - 1; index >= 0; index--) {
          if (where.id.in.includes(inventory[index].id)) inventory.splice(index, 1)
        }
        return { count: before - inventory.length }
      }),
    },
  }
  return {
    inventory,
    hero,
    adventureRun,
    tx,
    db: {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
      item: { findMany: vi.fn(async () => []) },
    },
  }
})

vi.mock('@/lib/db', () => ({ default: state.db }))

import { executeStep } from '@/services/adventure.service'

describe('adventure potion end-to-end service integration', () => {
  beforeEach(() => {
    state.inventory.splice(0)
    state.hero.hpCurrent = 14
    state.hero.mpCurrent = 10
    state.adventureRun.currentStep = 1
    state.adventureRun.status = 'active'
    state.adventureRun.result = { steps: [], rewards: null, expeditionHp: 14 }
    vi.clearAllMocks()
  })

  it('delivers a reward potion, uses it in the real combat engine, persists the replay and consumes that inventory row', async () => {
    const reward = await executeStep(state.hero.id, state.adventureRun.id, 1)

    expect(reward.stepResult).toMatchObject({
      type: 'reward',
      stepName: 'Tesoro del Explorador',
      itemsGranted: true,
    })
    expect(state.inventory).toHaveLength(1)
    expect(state.inventory[0]).toMatchObject({
      id: 'earned-potion-1',
      itemId: 17,
      item: { category: 'consumable', stats: { heal: 50 } },
    })

    const combat = await executeStep(state.hero.id, state.adventureRun.id, 2)

    expect(combat.stepResult).toMatchObject({
      type: 'combat',
      victory: true,
      enemiesDefeated: 1,
    })

    type ReplayShape = {
      levelReports: Array<{
        rounds: Array<{ actions: Array<Record<string, unknown>> }>
      }>
    }
    const combatReplay = (combat.stepResult as unknown as { replay: ReplayShape }).replay
    const combatActions = combatReplay.levelReports.flatMap(level =>
      level.rounds.flatMap(round => round.actions),
    )
    const potionAction = combatActions.find(action =>
      action.actorId === state.hero.id && action.itemName === 'item_17',
    )

    expect(potionAction).toBeDefined()
    expect(potionAction).toMatchObject({
      actorId: state.hero.id,
      itemName: 'item_17',
      healType: 'hp',
      tacticRulePriority: 1,
      tacticCondition: { type: 'hp_self_lt', value: 30 },
    })
    expect(potionAction?.healAmount).toEqual(expect.any(Number))
    expect(Number(potionAction?.healAmount)).toBeGreaterThan(0)
    expect(Number(potionAction?.healAmount)).toBeLessThanOrEqual(53)
    expect(potionAction).toMatchObject({
      potionSkillName: 'Tomar poción',
      potionSkillRank: 1,
      potionWisdom: 1,
      potionBaseHeal: 50,
      potionSkillBonus: 3,
    })

    expect(state.tx.heroItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['earned-potion-1'] }, heroId: state.hero.id },
    })
    expect(state.inventory).toHaveLength(0)
    expect(state.hero.hpCurrent).toBe(60)
    expect((state.adventureRun.result as { expeditionHp?: number }).expeditionHp).toBe(combat.heroResources.hpCurrent)

    const persistedSteps = (state.adventureRun.result as { steps: Array<Record<string, unknown>> }).steps
    expect(persistedSteps).toHaveLength(2)
    expect(persistedSteps[1]).toMatchObject({ type: 'combat', victory: true })
    const persistedReplay = (persistedSteps[1] as { replay: ReplayShape }).replay
    const persistedActions = persistedReplay.levelReports.flatMap(level =>
      level.rounds.flatMap(round => round.actions),
    )
    expect(persistedActions).toContainEqual(expect.objectContaining({
      itemName: 'item_17',
      healAmount: potionAction?.healAmount,
      healType: 'hp',
    }))
  })
})
