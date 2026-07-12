import { NextResponse } from 'next/server'
import { runDungeon, HeroData, DungeonData } from '@/lib/combat-engine/dungeon-runner'

function evalDefenseFormula(formula: any, attrs: Record<string, number>, rank: number): number {
  if (!formula?.attrCoeffs) return 0
  let base = 0
  for (const [attr, coeff] of Object.entries(formula.attrCoeffs)) {
    base += (attrs[attr] ?? 0) * (coeff as number)
  }
  const rankTerm = (formula.skillRankCoeff ?? 0) * rank
  const flatBonus = formula.flatBonus ?? 0
  return Math.round(base + rankTerm + flatBonus)
}

export async function GET() {
  const attrs = { st:16, co:13, in:5, dx:14, ch:4, ag:8, pe:7, wi:6 }
  const defenseSkills = {
    melee: { name: 'Esquivar golpe', icon: '💨', formula: { attrCoeffs: { dx: 2 }, skillRankCoeff: 1, diceSides: 0, diceCount: 0, flatBonus: 3 } },
    ranged: { name: 'Esquivar proyectil', icon: '💨', formula: { attrCoeffs: { dx: 2 }, skillRankCoeff: 1, diceSides: 0, diceCount: 0, flatBonus: 3 } },
    magic: { name: 'Esquivar magia', icon: '💨', formula: { attrCoeffs: { dx: 2 }, skillRankCoeff: 1, diceSides: 0, diceCount: 0, flatBonus: 3 } },
  }
  const computedDefenseValues: Record<string, number> = {}
  for (const [cat, sk] of Object.entries(defenseSkills)) {
    computedDefenseValues[cat] = evalDefenseFormula(sk.formula, attrs, 1)
  }

  const hero: HeroData = {
    id: 'test-hero',
    name: 'Aldrak',
    level: 1,
    attrs,
    hpMax: 135,
    mpMax: 68,
    gold: 100,
    combatProfile: {
      position: 'front',
      prelimRules: [],
      roundRules: [
        { priority: 1, condition: { type: 'hp_self_lt', value: 30 }, action: { skillId: 3, targetPos: 'auto', targetType: 'most_injured_ally' } },
        { priority: 2, condition: { type: 'always' }, action: { skillId: 1, targetPos: 'front', targetType: 'weakest' } },
      ],
      defenseSkills: { melee: 1, ranged: 2, magic: 3 },
    },
    skills: [
      { skillId: 1, multiplier: 1, manaCost: 5, effect: 'attack', rank: 1, name: 'Golpe básico', icon: '👊', formula: { attrCoeffs: { st: 2, dx: 1 }, skillRankCoeff: 1.5, diceSides: 6, diceCount: 1, flatBonus: 5, damageType: 'physical' }, tags: ['melee'] },
      { skillId: 2, multiplier: 1.8, manaCost: 15, effect: 'attack', rank: 1, name: 'Golpe poderoso', icon: '💥', formula: { attrCoeffs: { st: 3, dx: 1 }, skillRankCoeff: 2, diceSides: 8, diceCount: 1, flatBonus: 10, damageType: 'physical' }, tags: ['melee'] },
      { skillId: 3, multiplier: 0, manaCost: 20, healPct: 30, effect: 'heal', rank: 1, name: 'Curar', icon: '❤️‍🩹', formula: { attrCoeffs: {}, skillRankCoeff: 0, diceSides: 0, diceCount: 0, flatBonus: 0, damageType: 'healing' } },
      { skillId: 101, multiplier: 0, manaCost: 0, effect: 'dodge', rank: 1, name: 'Esquivar golpe', icon: '💨', formula: { attrCoeffs: { dx: 2 }, skillRankCoeff: 1, diceSides: 0, diceCount: 0, flatBonus: 3 } },
      { skillId: 102, multiplier: 0, manaCost: 0, effect: 'dodge', rank: 1, name: 'Esquivar proyectil', icon: '💨', formula: { attrCoeffs: { dx: 2 }, skillRankCoeff: 1, diceSides: 0, diceCount: 0, flatBonus: 3 } },
      { skillId: 103, multiplier: 0, manaCost: 0, effect: 'dodge', rank: 1, name: 'Esquivar magia', icon: '💨', formula: { attrCoeffs: { dx: 2 }, skillRankCoeff: 1, diceSides: 0, diceCount: 0, flatBonus: 3 } },
    ],
  }

  const dungeon: DungeonData = {
    id: 1,
    name: 'Cueva de arañas',
    levels: [
      {
        number: 1,
        enemies: [
          { id:1, name:'Araña pequeña', icon:'🕷️', hp:30, mp:0, atk:8, def:3, dx:8, ag:10, level:1, position:'front', skillName: 'Mordisco', skillIcon: '🦷', defenseSkill: 'Esquivar',  damageType: 'physical' },
          { id:2, name:'Araña venenosa', icon:'🕷️', hp:40, mp:0, atk:10, def:4, dx:9, ag:9, level:2, position:'center', skillName: 'Veneno', skillIcon: '🧪', defenseSkill: 'Esquivar',  damageType: 'poison' },
        ],
        epReward: 15, goldReward: 25,
      }
    ],
    epReward: 30, goldReward: 50, fameReward: 5,
    lootTable: [{ itemId: 1, chance: 0.9, minQty: 1, maxQty: 2 }]
  }

  const result = await runDungeon([hero], dungeon, { firstOfDay: true })

  const summary = result.levelReports.map(lr => ({
    level: lr.levelNumber,
    victory: lr.victory,
    rounds: lr.rounds.map(r => ({
      round: r.roundNumber,
      actions: r.actions.map(a => ({
        initiative: a.initiative,
        actor: a.actorName,
        skill: a.skillName,
        target: a.targetName,
        result: a.resultType,
        damage: a.damageBreakdown,
        heal: a.healAmount ? { amount: a.healAmount, type: a.healType } : undefined,
        defense: a.defenseSkill ? { skill: a.defenseSkill, value: a.defenseValue } : undefined,
      })),
      stateBefore: r.stateBefore,
      stateAfter: r.stateAfter,
    })),
  }))

  return NextResponse.json({
    victory: result.victory,
    rounds: result.totalRounds,
    epGained: result.epGained,
    goldGained: result.goldGained,
    loot: result.loot,
    heroFinalHp: result.heroesFinalState[0]?.hp ?? 0,
    heroFinalMp: result.heroesFinalState[0]?.mp ?? 0,
    logLength: result.log.length,
    lastLogs: result.log.slice(-5).map(l => l.message),
    computedDefenseValues,
    defenseEvents: result.levelReports.flatMap(lr =>
      lr.rounds.flatMap(r => r.actions)
    ).reduce((acc: Record<string, number>, a) => {
      if (a.defenseEffect) acc[a.defenseEffect] = (acc[a.defenseEffect] ?? 0) + 1
      return acc
    }, {}),
    report: summary,
  })
}
