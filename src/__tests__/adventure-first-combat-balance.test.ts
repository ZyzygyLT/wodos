import { afterAll, describe, expect, it } from 'vitest'
import { calcHpMax, calcMpMax, type HeroAttrs, type SkillFormula } from '@/lib/combat-engine/formulas'
import { mergeHeroAttrs, normalizeLegacyCombatFormula } from '@/lib/dungeon-helpers'
import { runDungeon, type HeroData } from '@/lib/combat-engine/dungeon-runner'
import { createSeededRandom } from '@/engine/core/random/random-source'
import { createAdventureCombatDungeon } from '@/lib/adventures/combat-adapter'
import type { AdventureStepEnemy } from '@/lib/adventures/types'

type StarterAttack = {
  skillId: number
  name: string
  icon: string
  multiplier: number
  manaCost: number
  tags: string[]
  damageType: string
  diceSides: number
  diceDivisor: number
}

type StarterClass = {
  slug: string
  name: string
  position: string
  baseAttrs: Record<string, number>
  equipStats: Record<string, number>
  attack: StarterAttack
  fallbackAttacks?: StarterAttack[]
  defense: { skillId: number; name: string; category: 'melee' | 'ranged' | 'magic' }
  heal?: { skillId: number; name: string; icon: string; manaCost: number; healPct: number }
}

const HUMAN_MODIFIERS = { st: 1, co: 1, in: 1, dx: 1, ch: 1, ag: 1, pe: 1, wi: 1 }

const STARTER_CLASSES: StarterClass[] = [
  {
    slug: 'guerrero', name: 'Guerrero', position: 'front',
    baseAttrs: { st: 12, co: 10, dx: 6, ag: 4, in: 3, wi: 3, ch: 3, pe: 4 },
    equipStats: { st: 3, co: 2, atk: 5, armor: 5 },
    attack: { skillId: 1001, name: 'Golpe Básico', icon: '⚔️', multiplier: 1.2, manaCost: 0, tags: ['melee'], damageType: 'physical', diceSides: 6, diceDivisor: 2 },
    defense: { skillId: 1101, name: 'Bloquear', category: 'melee' },
  },
  {
    slug: 'mago', name: 'Mago', position: 'rear',
    baseAttrs: { st: 2, co: 4, dx: 4, ag: 3, in: 12, wi: 8, ch: 3, pe: 5 },
    equipStats: { in: 6, atk: 4, armor: 2 },
    fallbackAttacks: [
      { skillId: 1021, name: 'Bola de Fuego', icon: '🔥', multiplier: 1.5, manaCost: 10, tags: ['magic', 'fire'], damageType: 'fire', diceSides: 8, diceDivisor: 2 },
      { skillId: 1022, name: 'Rayo', icon: '⚡', multiplier: 1.4, manaCost: 8, tags: ['magic', 'lightning'], damageType: 'lightning', diceSides: 8, diceDivisor: 2 },
    ],
    attack: { skillId: 1002, name: 'Misil Arcano', icon: '🔮', multiplier: 1.3, manaCost: 6, tags: ['magic'], damageType: 'arcane', diceSides: 6, diceDivisor: 2 },
    defense: { skillId: 1102, name: 'Escudo Mágico', category: 'magic' },
  },
  {
    slug: 'arquero', name: 'Arquero', position: 'rear',
    baseAttrs: { st: 4, co: 5, dx: 10, ag: 8, in: 3, wi: 3, ch: 3, pe: 6 },
    equipStats: { dx: 3, co: 2, atk: 4, armor: 5 },
    attack: { skillId: 1003, name: 'Disparo Rápido', icon: '🏹', multiplier: 1.3, manaCost: 0, tags: ['ranged'], damageType: 'physical', diceSides: 6, diceDivisor: 2 },
    defense: { skillId: 1103, name: 'Esquivar', category: 'ranged' },
  },
  {
    slug: 'paladin', name: 'Paladín', position: 'front',
    baseAttrs: { st: 10, co: 8, dx: 5, ag: 3, in: 4, wi: 8, ch: 6, pe: 4 },
    equipStats: { st: 3, co: 2, atk: 5, armor: 5 },
    attack: { skillId: 1004, name: 'Golpe Sagrado', icon: '✨', multiplier: 1.4, manaCost: 5, tags: ['melee', 'magic'], damageType: 'light', diceSides: 6, diceDivisor: 2 },
    defense: { skillId: 1104, name: 'Interponerse', category: 'melee' },
  },
  {
    slug: 'asesino', name: 'Asesino', position: 'center',
    baseAttrs: { st: 4, co: 4, dx: 10, ag: 10, in: 3, wi: 2, ch: 4, pe: 6 },
    equipStats: { ag: 3, atk: 3, co: 2, armor: 5 },
    attack: { skillId: 1005, name: 'Navajazo', icon: '🗡️', multiplier: 1.3, manaCost: 0, tags: ['melee'], damageType: 'physical', diceSides: 4, diceDivisor: 2 },
    defense: { skillId: 1105, name: 'Esquivar Sombras', category: 'ranged' },
  },
  {
    slug: 'clerigo', name: 'Clérigo', position: 'rear',
    baseAttrs: { st: 4, co: 6, dx: 4, ag: 3, in: 6, wi: 10, ch: 8, pe: 4 },
    equipStats: { ag: 3, in: 2, atk: 3, armor: 2 },
    attack: { skillId: 1006, name: 'Castigo Sagrado', icon: '⚡', multiplier: 1.3, manaCost: 6, tags: ['magic'], damageType: 'light', diceSides: 6, diceDivisor: 2 },
    defense: { skillId: 1106, name: 'Bendición Protectora', category: 'magic' },
    heal: { skillId: 1206, name: 'Toque Curativo', icon: '💚', manaCost: 10, healPct: 25 },
  },
  {
    slug: 'barbaro', name: 'Bárbaro', position: 'front',
    baseAttrs: { st: 12, co: 10, dx: 5, ag: 5, in: 2, wi: 2, ch: 3, pe: 3 },
    equipStats: { st: 3, co: 2, atk: 5, armor: 5 },
    attack: { skillId: 1007, name: 'Hachazo', icon: '🪓', multiplier: 1.4, manaCost: 0, tags: ['melee'], damageType: 'physical', diceSides: 8, diceDivisor: 2 },
    defense: { skillId: 1107, name: 'Resistir', category: 'melee' },
  },
  {
    slug: 'druida', name: 'Druida', position: 'center',
    baseAttrs: { st: 4, co: 6, dx: 5, ag: 4, in: 8, wi: 8, ch: 4, pe: 6 },
    equipStats: { in: 6, atk: 4, armor: 2 },
    fallbackAttacks: [
      { skillId: 1028, name: 'Zarpa', icon: '🐾', multiplier: 1.2, manaCost: 0, tags: ['melee'], damageType: 'physical', diceSides: 6, diceDivisor: 2 },
    ],
    attack: { skillId: 1008, name: 'Fragmento de Hielo', icon: '❄️', multiplier: 1.3, manaCost: 8, tags: ['magic', 'ice'], damageType: 'ice', diceSides: 6, diceDivisor: 2 },
    defense: { skillId: 1108, name: 'Piel de Corteza', category: 'magic' },
    heal: { skillId: 1208, name: 'Cura Natural', icon: '🌿', manaCost: 8, healPct: 20 },
  },
]

const ENCOUNTERS: Array<{ name: string; enemies: AdventureStepEnemy[] }> = [
  {
    name: 'El Druida Corrupto',
    enemies: [
      { name: 'Eldrin Corrupto', icon: '🧙', hp: 50, mp: 30, atk: 12, def: 4, dx: 10, ag: 8, level: 3, damageType: 'nature' },
      { name: 'Raíz Animada', icon: '🌿', hp: 30, mp: 0, atk: 8, def: 6, dx: 4, ag: 2, level: 2 },
    ],
  },
  {
    name: 'Emboscada en el Camino Ancho',
    enemies: [
      { name: 'Oso de Sombra', icon: '🐻', hp: 70, mp: 10, atk: 15, def: 8, dx: 6, ag: 6, level: 3, damageType: 'dark' },
    ],
  },
  {
    name: 'La Corrupción Primigenia',
    enemies: [
      { name: 'Corrupción Primigenia', icon: '👾', hp: 90, mp: 40, atk: 18, def: 6, dx: 8, ag: 6, level: 4, damageType: 'dark' },
    ],
  },
]

const RUNS_PER_MATCHUP = 20
const simulationSummary: string[] = []

function makeStarterHero(heroClass: StarterClass): HeroData {
  const attrs = Object.fromEntries(
    Object.entries(heroClass.baseAttrs).map(([key, value]) => [
      key,
      value + HUMAN_MODIFIERS[key as keyof typeof HUMAN_MODIFIERS],
    ]),
  ) as HeroAttrs & Record<string, number>
  const hpMax = calcHpMax(attrs, 1)
  const mpMax = calcMpMax(attrs)
  const effectiveAttrs = mergeHeroAttrs({ attrs, equipStats: heroClass.equipStats })
  const attackSkills: HeroData['skills'] = [...(heroClass.fallbackAttacks ?? []), heroClass.attack].map(attack => ({
    skillId: attack.skillId,
    type: 'active',
    name: attack.name,
    icon: attack.icon,
    effect: 'attack',
    multiplier: attack.multiplier,
    manaCost: attack.manaCost,
    rank: 1,
    cooldownRounds: 0,
    formula: normalizeLegacyCombatFormula({
      attrCoeffs: {},
      skillRankCoeff: 0,
      diceSides: attack.diceSides,
      diceCount: 1,
      diceDivisor: attack.diceDivisor,
      flatBonus: 0,
      damageType: attack.damageType,
    }, 'attack', attack.tags, attack.multiplier, effectiveAttrs),
    tags: attack.tags,
  }))
  const skills: HeroData['skills'] = [
    ...attackSkills,
    {
      skillId: heroClass.defense.skillId,
      type: 'passive',
      name: heroClass.defense.name,
      icon: '🛡️',
      effect: 'defense',
      multiplier: 1,
      manaCost: 0,
      rank: 1,
    },
  ]
  const roundRules: HeroData['combatProfile']['roundRules'] = []
  if (heroClass.heal) {
    skills.push({
      skillId: heroClass.heal.skillId,
      type: 'active',
      name: heroClass.heal.name,
      icon: heroClass.heal.icon,
      effect: 'heal',
      multiplier: 1,
      manaCost: heroClass.heal.manaCost,
      rank: 1,
      healPct: heroClass.heal.healPct,
      formula: {
        attrCoeffs: {},
        skillRankCoeff: 0,
        diceSides: 0,
        diceCount: 0,
        flatBonus: 0,
        healPct: heroClass.heal.healPct,
        damageType: 'light',
      } as unknown as SkillFormula,
      tags: ['heal'],
    })
    roundRules.push({
      priority: 1,
      condition: { type: 'hp_ally_lt', value: 30 },
      action: { skillId: heroClass.heal.skillId, targetPos: 'auto', targetType: 'most_injured_ally' },
    })
  }
  roundRules.push({
    priority: heroClass.heal ? 2 : 1,
    condition: { type: 'always' },
    action: { skillId: heroClass.attack.skillId, targetPos: 'front', targetType: 'weakest' },
  })
  return {
    id: `starter-${heroClass.slug}`,
    name: heroClass.name,
    level: 1,
    attrs,
    hpMax,
    mpMax,
    hpCurrent: hpMax,
    mpCurrent: mpMax,
    gold: 0,
    equipStats: heroClass.equipStats,
    combatProfile: {
      position: heroClass.position,
      prelimRules: [],
      roundRules,
      defenseSkills: { [heroClass.defense.category]: heroClass.defense.skillId },
    },
    skills,
  }
}

describe('First adventure — seeded starter class combat simulation', () => {
  afterAll(() => {
    process.stdout.write('\n--- El Bosque Susurrante: 20 simulaciones por clase y encuentro ---\n')
    for (const line of simulationSummary) process.stdout.write(line + '\n')
    process.stdout.write('\n')
  })

  for (const [encounterIndex, encounter] of ENCOUNTERS.entries()) {
    for (const [classIndex, heroClass] of STARTER_CLASSES.entries()) {
      it(`${heroClass.name} vs ${encounter.name}`, async () => {
        const hero = makeStarterHero(heroClass)
        const dungeon = createAdventureCombatDungeon(encounter.name, encounter.enemies)
        const startingHp = hero.hpMax
        let wins = 0
        let remainingHp = 0
        let rounds = 0

        for (let run = 0; run < RUNS_PER_MATCHUP; run += 1) {
          const seed = (encounterIndex + 1) * 100_000 + (classIndex + 1) * 1_000 + run + 1
          const result = await runDungeon(
            [structuredClone(hero)],
            structuredClone(dungeon),
            { random: createSeededRandom(seed) },
          )
          if (result.victory) wins += 1
          remainingHp += result.heroesFinalState[0]?.hp ?? 0
          rounds += result.totalRounds
        }

        const winRate = Math.round((wins / RUNS_PER_MATCHUP) * 100)
        const averageHp = Math.round(remainingHp / RUNS_PER_MATCHUP)
        const averageRounds = (rounds / RUNS_PER_MATCHUP).toFixed(1)
        simulationSummary.push(
          `  ${heroClass.name.padEnd(9)} vs ${encounter.name}: ${wins}/${RUNS_PER_MATCHUP} (${winRate}%), HP medio ${averageHp}/${startingHp}, rondas ${averageRounds}`,
        )
        expect(wins).toBeGreaterThan(0)
      })
    }
  }
})


const cumulativeSummary: string[] = []

describe('First adventure — cumulative combat path simulation', () => {
  afterAll(() => {
    process.stdout.write('\n--- El Bosque Susurrante: primer combate seguido del jefe ---\n')
    for (const line of cumulativeSummary) process.stdout.write(line + '\n')
    process.stdout.write('\n')
  })

  const finalBoss = ENCOUNTERS[2]

  for (const [pathIndex, firstEncounter] of ENCOUNTERS.slice(0, 2).entries()) {
    for (const [classIndex, heroClass] of STARTER_CLASSES.entries()) {
      it(`${heroClass.name} — ${firstEncounter.name} y jefe final`, async () => {
        const initialHero = makeStarterHero(heroClass)
        const firstDungeon = createAdventureCombatDungeon(firstEncounter.name, firstEncounter.enemies)
        const bossDungeon = createAdventureCombatDungeon(finalBoss.name, finalBoss.enemies)
        let fullAdventureWins = 0
        let finalHpTotal = 0
        let totalRounds = 0

        for (let run = 0; run < RUNS_PER_MATCHUP; run += 1) {
          const seed = 5_000_000 + (pathIndex + 1) * 100_000 + (classIndex + 1) * 1_000 + run + 1
          const firstResult = await runDungeon(
            [structuredClone(initialHero)],
            structuredClone(firstDungeon),
            { random: createSeededRandom(seed) },
          )
          totalRounds += firstResult.totalRounds
          if (!firstResult.victory) continue

          const firstState = firstResult.heroesFinalState[0]
          const heroAfterFirstCombat: HeroData = {
            ...initialHero,
            hpCurrent: firstState?.hp ?? 0,
            mpCurrent: firstState?.mp ?? 0,
          }
          const bossResult = await runDungeon(
            [heroAfterFirstCombat],
            structuredClone(bossDungeon),
            { random: createSeededRandom(seed + 1_000_000) },
          )
          totalRounds += bossResult.totalRounds
          if (bossResult.victory) fullAdventureWins += 1
          finalHpTotal += bossResult.heroesFinalState[0]?.hp ?? 0
        }

        const winRate = Math.round((fullAdventureWins / RUNS_PER_MATCHUP) * 100)
        const averageFinalHp = Math.round(finalHpTotal / RUNS_PER_MATCHUP)
        const averageRounds = (totalRounds / RUNS_PER_MATCHUP).toFixed(1)
        cumulativeSummary.push(
          `  ${heroClass.name.padEnd(9)} — ${firstEncounter.name} + jefe: ${fullAdventureWins}/${RUNS_PER_MATCHUP} (${winRate}%), HP final medio ${averageFinalHp}, rondas ${averageRounds}`,
        )
        expect(fullAdventureWins).toBeGreaterThan(0)
      })
    }
  }
})
