import { describe, it, expect, afterAll } from 'vitest'
import { runDungeon } from '@/lib/combat-engine/dungeon-runner'
import type { HeroData, DungeonData, EnemyData, EnemySkillRef } from '@/lib/combat-engine/dungeon-runner'

function makeHeroAtLevel(level: number, id: string, name: string, pos: string, role: 'front' | 'heal' | 'ranged'): HeroData {
  const st = Math.round(8 + level * 1.2)
  const co = Math.round(8 + level * 1)
  const dx = Math.round(8 + level * 1.2)
  const ag = 8
  const wi = Math.round(6 + level * 0.8)
  const hpMax = 50 + level * 10 + co * 4
  const mpMax = 15 + level * 3 + wi * 2

  const skills: HeroData['skills'] = []
  skills.push({
    skillId: 10, multiplier: 1, manaCost: 3, effect: 'attack', rank: 1,
    formula: { attrCoeffs: { st: 1, dx: 0.5 }, skillRankCoeff: 0, diceSides: 6, diceCount: 1, flatBonus: Math.round(5 + level * 2.5) },
  })
  if (role === 'heal') {
    skills.push({
      skillId: 20, multiplier: 0, manaCost: 8, effect: 'heal', rank: 1, healPct: Math.round(15 + level * 1.5),
      formula: null as any, tags: ['heal'],
    })
  }
  if (role === 'ranged') {
    skills.push({
      skillId: 30, multiplier: 0.6, manaCost: 10, effect: 'aoe_attack', rank: 1,
      formula: { attrCoeffs: { st: 0.5, dx: 0.7 }, skillRankCoeff: 0, diceSides: 6, diceCount: 1, flatBonus: Math.round(4 + level * 2) },
    })
  }

  return {
    id, name, level,
    attrs: { st, co, in: Math.round(8 + level * 0.6), dx, ch: Math.round(6 + level * 0.5), ag, pe: 5, wi },
    hpMax, mpMax,
    gold: 100 + level * 50,
    combatProfile: {
      position: pos,
      prelimRules: [],
      roundRules: [
        { priority: 1, condition: { type: role === 'heal' ? 'hp_ally_lt' : 'hp_self_lt', value: 50 }, action: { skillId: role === 'heal' ? 20 : 10, targetPos: 'auto', targetType: 'most_injured_ally' } },
        { priority: 2, condition: { type: 'always' }, action: { skillId: role === 'ranged' ? 30 : 10, targetPos: 'front', targetType: 'weakest' } },
      ],
      defenseSkills: {},
    },
    skills,
  }
}

const ENEMY_SKILLS: Record<number, EnemySkillRef[]> = {
  1: [
    { skillId: 120, name: 'Mordida', icon: '🕷️', effect: 'attack', multiplier: 1, manaCost: 0, formula: { attrCoeffs: { st: 0.5, dx: 0.5 }, skillRankCoeff: 0, diceSides: 4, diceCount: 1, flatBonus: 1 }, attackCategory: 'melee', defenseCategory: undefined },
  ],
  2: [
    { skillId: 121, name: 'Mordida venenosa', icon: '🕷️', effect: 'attack', multiplier: 1, manaCost: 2, formula: { attrCoeffs: { st: 0.5, dx: 0.5 }, skillRankCoeff: 0, diceSides: 6, diceCount: 1, flatBonus: 2, damageType: 'poison' }, damageType: 'poison', attackCategory: 'melee', defenseCategory: undefined },
  ],
  3: [
    { skillId: 101, name: 'Escupir veneno', icon: '🤮', effect: 'attack', multiplier: 1.2, manaCost: 5, formula: { attrCoeffs: { dx: 0.8, in: 0.5 }, skillRankCoeff: 1.2, diceSides: 6, diceCount: 1, flatBonus: 0, damageType: 'poison' }, damageType: 'poison', attackCategory: 'ranged', defenseCategory: undefined },
    { skillId: 102, name: 'Vendaje rápido', icon: '🩹', effect: 'heal', multiplier: 0, manaCost: 20, formula: { healPct: 20 } as any, defenseCategory: undefined },
  ],
  4: [
    { skillId: 122, name: 'Golpe de hueso', icon: '💀', effect: 'attack', multiplier: 1, manaCost: 0, formula: { attrCoeffs: { st: 1, dx: 0.5 }, skillRankCoeff: 0, diceSides: 6, diceCount: 1, flatBonus: 3 }, attackCategory: 'melee', defenseCategory: undefined },
  ],
  5: [
    { skillId: 123, name: 'Garrote', icon: '👺', effect: 'attack', multiplier: 1, manaCost: 0, formula: { attrCoeffs: { st: 1, dx: 0.5 }, skillRankCoeff: 0, diceSides: 6, diceCount: 1, flatBonus: 2 }, attackCategory: 'melee', defenseCategory: undefined },
  ],
  6: [
    { skillId: 103, name: 'Golpe básico', icon: '⚔️', effect: 'attack', multiplier: 1, manaCost: 0, formula: { attrCoeffs: { st: 1, dx: 0.5 }, skillRankCoeff: 0, diceSides: 6, diceCount: 1, flatBonus: 5 }, attackCategory: 'melee', defenseCategory: undefined },
    { skillId: 104, name: 'Bloqueo de escudo', icon: '🛡️', effect: 'block', multiplier: 0, manaCost: 0, formula: { attrCoeffs: { st: 1.5, def: 1 }, skillRankCoeff: 2, diceSides: 0, diceCount: 0, flatBonus: 5 }, defenseCategory: 'melee' },
  ],
  7: [
    { skillId: 105, name: 'Toque espectral', icon: '👻', effect: 'attack', multiplier: 1.3, manaCost: 10, formula: { attrCoeffs: { in: 1.2, wi: 0.5 }, skillRankCoeff: 1.5, diceSides: 8, diceCount: 1, flatBonus: 0, damageType: 'dark' }, damageType: 'dark', attackCategory: 'magic', defenseCategory: undefined },
    { skillId: 106, name: 'Evasión ágil', icon: '🏃', effect: 'dodge', multiplier: 0, manaCost: 0, formula: { attrCoeffs: { dx: 1.5, ag: 1 }, skillRankCoeff: 2, diceSides: 0, diceCount: 0, flatBonus: 5 }, defenseCategory: 'ranged' },
  ],
  8: [
    { skillId: 124, name: 'Zarpazo', icon: '🐺', effect: 'attack', multiplier: 1, manaCost: 0, formula: { attrCoeffs: { st: 1, dx: 0.5 }, skillRankCoeff: 0, diceSides: 6, diceCount: 1, flatBonus: 4, damageType: 'dark' }, damageType: 'dark', attackCategory: 'melee', defenseCategory: undefined },
  ],
  9: [
    { skillId: 107, name: 'Bola de fuego', icon: '🔥', effect: 'attack', multiplier: 1.2, manaCost: 5, formula: { attrCoeffs: { in: 1.5, wi: 0.5 }, skillRankCoeff: 1.5, diceSides: 8, diceCount: 1, flatBonus: 0, damageType: 'fire' }, damageType: 'fire', attackCategory: 'magic', defenseCategory: undefined },
    { skillId: 108, name: 'Meteoro', icon: '☄️', effect: 'aoe_attack', multiplier: 2.5, manaCost: 30, formula: { attrCoeffs: { in: 2, wi: 1 }, skillRankCoeff: 2.5, diceSides: 8, diceCount: 2, flatBonus: 0, damageType: 'fire' }, damageType: 'fire', attackCategory: 'magic', defenseCategory: undefined },
  ],
  11: [
    { skillId: 109, name: 'Bola de fuego', icon: '🔥', effect: 'attack', multiplier: 1.2, manaCost: 5, formula: { attrCoeffs: { in: 1.5, wi: 0.5 }, skillRankCoeff: 1.5, diceSides: 8, diceCount: 1, flatBonus: 0, damageType: 'fire' }, damageType: 'fire', attackCategory: 'magic', defenseCategory: undefined },
    { skillId: 110, name: 'Meteoro', icon: '☄️', effect: 'aoe_attack', multiplier: 2.5, manaCost: 30, formula: { attrCoeffs: { in: 2, wi: 1 }, skillRankCoeff: 2.5, diceSides: 8, diceCount: 2, flatBonus: 0, damageType: 'fire' }, damageType: 'fire', attackCategory: 'magic', defenseCategory: undefined },
    { skillId: 111, name: 'Grito de guerra', icon: '📯', effect: 'party_attack_up', multiplier: 1.5, manaCost: 10, formula: { attrCoeffs: {}, skillRankCoeff: 0.5, diceSides: 0, diceCount: 0, flatBonus: 0 }, defenseCategory: undefined },
  ],
  12: [
    { skillId: 112, name: 'Rayo', icon: '⚡', effect: 'attack', multiplier: 1.8, manaCost: 15, formula: { attrCoeffs: { in: 2, wi: 0.5 }, skillRankCoeff: 2, diceSides: 10, diceCount: 1, flatBonus: 0, damageType: 'dark' }, damageType: 'dark', attackCategory: 'magic', defenseCategory: undefined },
    { skillId: 113, name: 'Meteoro', icon: '☄️', effect: 'aoe_attack', multiplier: 2.5, manaCost: 30, formula: { attrCoeffs: { in: 2, wi: 1 }, skillRankCoeff: 2.5, diceSides: 8, diceCount: 2, flatBonus: 0, damageType: 'dark' }, damageType: 'dark', attackCategory: 'magic', defenseCategory: undefined },
    { skillId: 114, name: 'Toque de maná', icon: '💚', effect: 'heal', multiplier: 0, manaCost: 30, formula: { healPct: 30 } as any, defenseCategory: undefined },
    { skillId: 115, name: 'Esquivar golpe', icon: '💨', effect: 'dodge', multiplier: 0, manaCost: 0, formula: { attrCoeffs: { dx: 2 }, skillRankCoeff: 1, diceSides: 0, diceCount: 0, flatBonus: 3 }, defenseCategory: 'melee' },
    { skillId: 116, name: 'Esquivar proyectil', icon: '💨', effect: 'dodge', multiplier: 0, manaCost: 0, formula: { attrCoeffs: { dx: 2 }, skillRankCoeff: 1, diceSides: 0, diceCount: 0, flatBonus: 3 }, defenseCategory: 'ranged' },
    { skillId: 117, name: 'Barrera mágica', icon: '🔮', effect: 'barrier', multiplier: 0, manaCost: 0, formula: { attrCoeffs: { in: 1.5, wi: 1 }, skillRankCoeff: 2, diceSides: 0, diceCount: 0, flatBonus: 5 }, defenseCategory: 'magic' },
  ],
  13: [
    { skillId: 118, name: 'Fragmento de hielo', icon: '❄️', effect: 'attack', multiplier: 1.15, manaCost: 8, formula: { attrCoeffs: { in: 1, wi: 0.5 }, skillRankCoeff: 1.2, diceSides: 6, diceCount: 1, flatBonus: 0, damageType: 'ice' }, damageType: 'ice', attackCategory: 'magic', defenseCategory: undefined },
    { skillId: 119, name: 'Barrera mágica', icon: '🔮', effect: 'barrier', multiplier: 0, manaCost: 0, formula: { attrCoeffs: { in: 1.5, wi: 1 }, skillRankCoeff: 2, diceSides: 0, diceCount: 0, flatBonus: 5 }, defenseCategory: 'magic' },
  ],
}

const ENEMY_DEFS: EnemyData[] = [
  { id: 1, name: 'Araña pequeña', icon: '🕷️', hp: 30, mp: 0, atk: 8, def: 3, dx: 8, ag: 10, level: 1, baseLevel: 1, growthFactor: 10, position: 'front', faction: 'arachnid', damageType: 'physical' },
  { id: 2, name: 'Araña venenosa', icon: '🕷️', hp: 25, mp: 0, atk: 14, def: 4, dx: 9, ag: 9, level: 2, baseLevel: 2, growthFactor: 10, position: 'center', faction: 'arachnid', damageType: 'poison' },
  { id: 3, name: 'Reina araña', icon: '🕷️', hp: 30, mp: 20, atk: 20, def: 8, dx: 10, ag: 8, level: 3, baseLevel: 3, growthFactor: 10, position: 'rear', faction: 'arachnid', damageType: 'poison' },
  { id: 4, name: 'Esqueleto', icon: '💀', hp: 30, mp: 0, atk: 16, def: 5, dx: 7, ag: 6, level: 2, baseLevel: 2, growthFactor: 10, position: 'front', faction: 'undead', damageType: 'physical' },
  { id: 5, name: 'Goblin', icon: '👺', hp: 35, mp: 0, atk: 14, def: 2, dx: 10, ag: 12, level: 2, baseLevel: 2, growthFactor: 10, position: 'front', faction: 'goblin', damageType: 'physical' },
  { id: 6, name: 'Golem de piedra', icon: '🗿', hp: 80, mp: 0, atk: 45, def: 15, dx: 4, ag: 3, level: 4, baseLevel: 4, growthFactor: 10, position: 'front', faction: 'elemental', damageType: 'physical' },
  { id: 7, name: 'Espectro', icon: '👻', hp: 40, mp: 30, atk: 28, def: 4, dx: 9, ag: 10, level: 3, baseLevel: 3, growthFactor: 10, position: 'center', faction: 'undead', damageType: 'dark' },
  { id: 8, name: 'Lobo sombrío', icon: '🐺', hp: 40, mp: 0, atk: 30, def: 6, dx: 12, ag: 14, level: 3, baseLevel: 3, growthFactor: 10, position: 'front', faction: 'darkness', damageType: 'dark' },
  { id: 9, name: 'Dragón joven', icon: '🐉', hp: 120, mp: 50, atk: 65, def: 18, dx: 8, ag: 7, level: 5, baseLevel: 5, growthFactor: 10, position: 'rear', faction: 'fire', damageType: 'fire' },
  { id: 10, name: 'Slime', icon: '🟢', hp: 15, mp: 0, atk: 4, def: 1, dx: 5, ag: 5, level: 1, baseLevel: 1, growthFactor: 10, position: 'front', faction: 'slime', damageType: 'physical' },
  { id: 11, name: 'Titán de lava', icon: '🌋', hp: 200, mp: 80, atk: 100, def: 25, dx: 5, ag: 4, level: 8, baseLevel: 8, growthFactor: 10, position: 'front', faction: 'fire', damageType: 'fire' },
  { id: 12, name: 'Señor oscuro', icon: '👑', hp: 300, mp: 200, atk: 120, def: 20, dx: 12, ag: 10, level: 10, baseLevel: 10, growthFactor: 10, position: 'rear', faction: 'darkness', damageType: 'dark' },
  { id: 13, name: 'Elemental de hielo', icon: '❄️', hp: 180, mp: 60, atk: 45, def: 10, dx: 8, ag: 6, level: 6, baseLevel: 6, growthFactor: 10, position: 'center', faction: 'elemental', damageType: 'ice' },
  { id: 14, name: 'Pinchos', icon: '🗜️', hp: 20, mp: 0, atk: 0, def: 8, dx: 2, ag: 1, level: 3, baseLevel: 3, growthFactor: 10, position: 'front', isTrap: true, passiveEffects: [{ trigger: 'on_damage', effectType: 'damage', targetType: 'attacker', value: { base: 8, coeff: 1 }, damageType: 'piercing', sourceName: 'Pinchos' }] },
  { id: 15, name: 'Suelo explosivo', icon: '💥', hp: 15, mp: 0, atk: 0, def: 4, dx: 1, ag: 1, level: 4, baseLevel: 4, growthFactor: 10, position: 'center', isTrap: true, passiveEffects: [{ trigger: 'on_death', effectType: 'damage', targetType: 'all_heroes', value: { base: 14, coeff: 1 }, damageType: 'fire', sourceName: 'Explosión' }] },
]

function resolveEnemies(entries: Array<{ id: number; name: string; count: number; pos: string; isBoss?: boolean; isTrap?: boolean }>): EnemyData[] {
  const result: EnemyData[] = []
  for (const e of entries) {
    const def = ENEMY_DEFS.find(d => d.id === e.id)
    if (!def) continue
    const skills = ENEMY_SKILLS[e.id] ?? def.skills
    for (let i = 0; i < e.count; i++) {
      result.push({ ...def, id: def.id * 1000 + i, skills, position: e.pos, isTrap: e.isTrap ?? def.isTrap, isBoss: e.isBoss, name: `${def.name}${e.count > 1 ? i + 1 : ''}` })
    }
  }
  return result
}

interface SeedDungeon {
  slug: string
  name: string
  recommendedLevel: number
  levels: Array<{ number: number; locationName?: string; enemies: Array<{ id: number; name: string; count: number; pos: string; isBoss?: boolean; isTrap?: boolean }> }>
}

const SEED_DUNGEONS: SeedDungeon[] = [
  { slug: 'prueba-slimes', name: 'Campo de slimes', recommendedLevel: 1, levels: [
    { number: 1, locationName: 'Claro de los slimes', enemies: [{ id: 10, name: 'Slime', count: 4, pos: 'front' }] },
  ]},
  { slug: 'madriguera-ratas', name: 'Madriguera de Ratas', recommendedLevel: 2, levels: [
    { number: 1, locationName: 'Nido de las arañas', enemies: [{ id: 1, name: 'Araña pequeña', count: 4, pos: 'front' }, { id: 1, name: 'Araña pequeña', count: 2, pos: 'center' }] },
  ]},
  { slug: 'cueva-aranyas', name: 'Cueva de arañas', recommendedLevel: 3, levels: [
    { number: 1, locationName: 'Entrada de la cueva', enemies: [{ id: 1, name: 'Araña pequeña', count: 4, pos: 'front' }, { id: 2, name: 'Araña venenosa', count: 2, pos: 'center' }] },
    { number: 2, locationName: 'Cámara de la reina', enemies: [{ id: 1, name: 'Araña pequeña', count: 2, pos: 'front' }, { id: 3, name: 'Reina araña', count: 1, pos: 'rear', isBoss: true }, { id: 2, name: 'Araña venenosa', count: 2, pos: 'center' }] },
  ]},
  { slug: 'ruinas-abandonadas', name: 'Ruinas Abandonadas', recommendedLevel: 4, levels: [
    { number: 1, locationName: 'Patio en ruinas', enemies: [{ id: 4, name: 'Esqueleto', count: 3, pos: 'front' }, { id: 5, name: 'Goblin', count: 2, pos: 'center' }, { id: 14, name: 'Pinchos', count: 1, pos: 'front', isTrap: true }] },
    { number: 2, locationName: 'Salón del trono quebrado', enemies: [{ id: 5, name: 'Goblin', count: 1, pos: 'center' }, { id: 6, name: 'Golem de piedra', count: 1, pos: 'front', isBoss: true }, { id: 15, name: 'Suelo explosivo', count: 1, pos: 'center', isTrap: true }] },
  ]},
  { slug: 'cripta-olvidada', name: 'Cripta Olvidada', recommendedLevel: 5, levels: [
    { number: 1, locationName: 'Entrada de la cripta', enemies: [{ id: 4, name: 'Esqueleto', count: 3, pos: 'front' }, { id: 7, name: 'Espectro', count: 2, pos: 'center' }] },
    { number: 2, locationName: 'Sarcófago del guardián', enemies: [{ id: 7, name: 'Espectro', count: 1, pos: 'center' }, { id: 6, name: 'Golem de piedra', count: 1, pos: 'front', isBoss: true }, { id: 7, name: 'Espectro', count: 1, pos: 'center' }] },
  ]},
  { slug: 'cienaga-profunda', name: 'Ciénaga Profunda', recommendedLevel: 5, levels: [
    { number: 1, locationName: 'Orillas pantanosas', enemies: [{ id: 8, name: 'Lobo sombrío', count: 3, pos: 'front' }, { id: 2, name: 'Araña venenosa', count: 2, pos: 'center' }] },
    { number: 2, locationName: 'Nido de la reina', enemies: [{ id: 2, name: 'Araña venenosa', count: 2, pos: 'center' }, { id: 3, name: 'Reina araña', count: 2, pos: 'rear', isBoss: true }] },
  ]},
  { slug: 'torre-del-mago', name: 'Torre del Mago', recommendedLevel: 6, levels: [
    { number: 1, locationName: 'Biblioteca en llamas', enemies: [{ id: 7, name: 'Espectro', count: 3, pos: 'center' }] },
    { number: 2, locationName: 'Laboratorio del mago', enemies: [{ id: 6, name: 'Golem de piedra', count: 1, pos: 'front' }, { id: 7, name: 'Espectro', count: 2, pos: 'center' }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center', isBoss: true }] },
  ]},
  { slug: 'templo-del-sol', name: 'Templo del Sol', recommendedLevel: 7, levels: [
    { number: 1, locationName: 'Atrio del sol', enemies: [{ id: 6, name: 'Golem de piedra', count: 1, pos: 'front' }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }, { id: 7, name: 'Espectro', count: 2, pos: 'center' }] },
    { number: 2, locationName: 'Altar del dragón solar', enemies: [{ id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }, { id: 9, name: 'Dragón joven', count: 1, pos: 'rear', isBoss: true }] },
  ]},
  { slug: 'guarida-sierpe', name: 'Guarida de la Sierpe', recommendedLevel: 7, levels: [
    { number: 1, locationName: 'Cueva serpentina', enemies: [{ id: 2, name: 'Araña venenosa', count: 2, pos: 'center' }, { id: 8, name: 'Lobo sombrío', count: 2, pos: 'front' }] },
    { number: 2, locationName: 'Cámara del dragón', enemies: [{ id: 8, name: 'Lobo sombrío', count: 1, pos: 'front' }, { id: 9, name: 'Dragón joven', count: 1, pos: 'rear', isBoss: true }] },
  ]},
  { slug: 'fortaleza-carmesi', name: 'Fortaleza Carmesí', recommendedLevel: 8, levels: [
    { number: 1, locationName: 'Muralla quebrada', enemies: [{ id: 4, name: 'Esqueleto', count: 3, pos: 'front' }, { id: 8, name: 'Lobo sombrío', count: 1, pos: 'center' }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }] },
    { number: 2, locationName: 'Salón del trono carmesí', enemies: [{ id: 6, name: 'Golem de piedra', count: 1, pos: 'front' }, { id: 4, name: 'Esqueleto', count: 2, pos: 'front' }, { id: 9, name: 'Dragón joven', count: 1, pos: 'rear', isBoss: true }] },
  ]},
  { slug: 'pico-dragon', name: 'Pico del Dragón', recommendedLevel: 9, levels: [
    { number: 1, locationName: 'Faldas del volcán', enemies: [{ id: 8, name: 'Lobo sombrío', count: 2, pos: 'front' }, { id: 6, name: 'Golem de piedra', count: 1, pos: 'front' }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }] },
    { number: 2, locationName: 'Cumbre del dragón', enemies: [{ id: 9, name: 'Dragón joven', count: 1, pos: 'rear', isBoss: true }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }] },
  ]},
  { slug: 'abismo-vacio', name: 'Abismo del Vacío', recommendedLevel: 10, levels: [
    { number: 1, locationName: 'Umbral del vacío', enemies: [{ id: 7, name: 'Espectro', count: 2, pos: 'center' }, { id: 8, name: 'Lobo sombrío', count: 2, pos: 'front' }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }] },
    { number: 2, locationName: 'Corazón del abismo', enemies: [{ id: 9, name: 'Dragón joven', count: 1, pos: 'rear' }, { id: 11, name: 'Titán de lava', count: 1, pos: 'front', isBoss: true }, { id: 7, name: 'Espectro', count: 1, pos: 'center' }] },
  ]},
  { slug: 'bosque-sombrio', name: 'Bosque Sombrío', recommendedLevel: 11, levels: [
    { number: 1, locationName: 'Sendero de niebla', enemies: [{ id: 8, name: 'Lobo sombrío', count: 2, pos: 'front' }, { id: 7, name: 'Espectro', count: 2, pos: 'center' }] },
    { number: 2, locationName: 'Claro del dragón', enemies: [{ id: 8, name: 'Lobo sombrío', count: 1, pos: 'front' }, { id: 9, name: 'Dragón joven', count: 1, pos: 'rear', isBoss: true }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }] },
  ]},
  { slug: 'santuario-olvidado', name: 'Santuario Olvidado', recommendedLevel: 12, levels: [
    { number: 1, locationName: 'Vestíbulo sagrado', enemies: [{ id: 6, name: 'Golem de piedra', count: 1, pos: 'front' }, { id: 13, name: 'Elemental de hielo', count: 2, pos: 'center' }, { id: 8, name: 'Lobo sombrío', count: 1, pos: 'front' }] },
    { number: 2, locationName: 'Sancta sanctorum', enemies: [{ id: 9, name: 'Dragón joven', count: 1, pos: 'rear' }, { id: 12, name: 'Señor oscuro', count: 1, pos: 'rear', isBoss: true }] },
  ]},
  { slug: 'catacumbas-malditas', name: 'Catacumbas Malditas', recommendedLevel: 13, levels: [
    { number: 1, locationName: 'Osario profanado', enemies: [{ id: 4, name: 'Esqueleto', count: 3, pos: 'front' }, { id: 7, name: 'Espectro', count: 2, pos: 'center' }] },
    { number: 2, locationName: 'Cripta del señor oscuro', enemies: [{ id: 6, name: 'Golem de piedra', count: 1, pos: 'front' }, { id: 12, name: 'Señor oscuro', count: 1, pos: 'rear', isBoss: true }, { id: 7, name: 'Espectro', count: 1, pos: 'center' }] },
  ]},
  { slug: 'corazon-del-volcan', name: 'Corazón del Volcán', recommendedLevel: 14, levels: [
    { number: 1, locationName: 'Caverna de magma', enemies: [{ id: 11, name: 'Titán de lava', count: 1, pos: 'front' }, { id: 13, name: 'Elemental de hielo', count: 2, pos: 'center' }] },
    { number: 2, locationName: 'Forja del titán', enemies: [{ id: 12, name: 'Señor oscuro', count: 1, pos: 'rear', isBoss: true }, { id: 9, name: 'Dragón joven', count: 1, pos: 'rear' }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }] },
  ]},
  { slug: 'meseta-dragon', name: 'Meseta del Dragón', recommendedLevel: 15, levels: [
    { number: 1, locationName: 'Altiplano ventoso', enemies: [{ id: 8, name: 'Lobo sombrío', count: 2, pos: 'front' }, { id: 9, name: 'Dragón joven', count: 1, pos: 'rear' }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }] },
    { number: 2, locationName: 'Nido del titán', enemies: [{ id: 11, name: 'Titán de lava', count: 1, pos: 'front', isBoss: true }, { id: 9, name: 'Dragón joven', count: 1, pos: 'rear' }, { id: 13, name: 'Elemental de hielo', count: 1, pos: 'center' }] },
  ]},
  { slug: 'trono-del-vacio', name: 'Trono del Vacío', recommendedLevel: 16, levels: [
    { number: 1, locationName: 'Antesala de las pesadillas', enemies: [{ id: 12, name: 'Señor oscuro', count: 1, pos: 'rear' }, { id: 13, name: 'Elemental de hielo', count: 2, pos: 'center' }] },
    { number: 2, locationName: 'El trono mismo', enemies: [{ id: 12, name: 'Señor oscuro', count: 1, pos: 'rear', isBoss: true }, { id: 11, name: 'Titán de lava', count: 1, pos: 'front' }, { id: 9, name: 'Dragón joven', count: 1, pos: 'rear' }] },
  ]},
]

function makeParty(level: number): HeroData[] {
  return [
    makeHeroAtLevel(level, 'tank-1', 'Tanque', 'front', 'front'),
    makeHeroAtLevel(level, 'heal-1', 'Curandero', 'rear', 'heal'),
    makeHeroAtLevel(level, 'dps-1', 'DPS cuerpo', 'front', 'front'),
    makeHeroAtLevel(level, 'dps-2', 'DPS rango', 'center', 'ranged'),
  ]
}

function toDungeonData(sd: SeedDungeon): DungeonData {
  return {
    id: SEED_DUNGEONS.findIndex(d => d.slug === sd.slug) + 1,
    name: sd.name,
    recommendedLevel: sd.recommendedLevel,
    difficulty: 3,
    levels: sd.levels.map(l => ({
      number: l.number,
      enemies: resolveEnemies(l.enemies),
      epReward: 50 + sd.recommendedLevel * 10,
      goldReward: 30 + sd.recommendedLevel * 8,
      locationName: l.locationName,
    })),
    epReward: 100 + sd.recommendedLevel * 20,
    goldReward: 60 + sd.recommendedLevel * 15,
    fameReward: 5 + sd.recommendedLevel * 2,
    lootTable: [],
  }
}

const RUNS = 30
const results4: string[] = []

describe('Seed dungeon balance — 4 héroes al nivel recomendado', () => {
  afterAll(() => {
    process.stdout.write('\n--- Resumen de balance ---\n')
    for (const r of results4) process.stdout.write(r + '\n')
    process.stdout.write('\n')
  })
  for (const sd of SEED_DUNGEONS) {
    it(`${sd.name} (rec ${sd.recommendedLevel}) — ${RUNS} simulaciones`, async () => {
      const heroes = makeParty(sd.recommendedLevel)
      const dungeon = toDungeonData(sd)
      const wins: boolean[] = []
      for (let run = 0; run < RUNS; run++) {
        const result = await runDungeon(structuredClone(heroes), structuredClone(dungeon))
        wins.push(result.victory)
      }
      const wr = Math.round(wins.filter(Boolean).length / wins.length * 100)
      results4.push(`  rec ${String(sd.recommendedLevel).padStart(2)} → ${sd.name}: ${wins.filter(Boolean).length}/${RUNS} (${wr}%)`)
      expect(wins.filter(Boolean).length).toBeGreaterThan(0)
      expect(wr).toBeGreaterThanOrEqual(5)
    })
  }
})
