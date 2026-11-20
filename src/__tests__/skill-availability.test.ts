import { describe, expect, it } from 'vitest'
import {
  advanceSkillCooldowns,
  calculateSkillManaCost,
  getSkillCooldownRemaining,
  isSkillOnCooldown,
  normalizeSkillCooldown,
  resolveSkillMana,
  setSkillCooldown,
} from '@/engine/core/skills/skill-availability'

const basic = { skillId: 1, name: 'Basic', effect: 'attack', manaCost: 0 }
const costly = { skillId: 2, name: 'Power Strike', effect: 'attack', manaCost: 10 }

describe('skill availability and resource rules', () => {
  it('scales mana cost by 20% of base cost per rank above one', () => {
    expect(calculateSkillManaCost(10, 1)).toBe(10)
    expect(calculateSkillManaCost(10, 2)).toBe(12)
    expect(calculateSkillManaCost(10, 3)).toBe(14)
    expect(calculateSkillManaCost(0, 5)).toBe(0)
  })

  it('normalizes invalid mana costs, ranks and current MP', () => {
    expect(calculateSkillManaCost(Number.NaN, 3)).toBe(0)
    expect(calculateSkillManaCost(10, Number.NaN)).toBe(10)
    expect(calculateSkillManaCost(-5, 3)).toBe(0)
    expect(resolveSkillMana({
      selectedSkill: costly,
      availableSkills: [basic, costly],
      currentMp: Number.NaN,
    })).toEqual({
      skill: basic, mpCost: 0, remainingMp: 0, fallback: 'free_basic',
    })
    expect(resolveSkillMana({
      selectedSkill: costly,
      availableSkills: [costly],
      currentMp: -5,
    })).toEqual({
      skill: costly, mpCost: 0, remainingMp: 0, fallback: 'forced',
    })
  })

  it('deducts the calculated mana cost when the skill is affordable', () => {
    expect(resolveSkillMana({
      selectedSkill: costly,
      availableSkills: [basic, costly],
      currentMp: 20,
      rank: 2,
    })).toEqual({
      skill: costly,
      mpCost: 12,
      remainingMp: 8,
      fallback: null,
    })
  })

  it('prefers a free basic attack when mana is insufficient', () => {
    expect(resolveSkillMana({
      selectedSkill: costly,
      availableSkills: [costly, basic],
      currentMp: 3,
    })).toEqual({
      skill: basic,
      mpCost: 0,
      remainingMp: 3,
      fallback: 'free_basic',
    })
  })

  it('uses a paid basic attack without further MP deduction when no free attack exists', () => {
    const paidBasic = { ...basic, skillId: 3, manaCost: 2 }
    expect(resolveSkillMana({
      selectedSkill: costly,
      availableSkills: [costly, paidBasic],
      currentMp: 3,
    })).toEqual({
      skill: paidBasic,
      mpCost: 0,
      remainingMp: 3,
      fallback: 'basic',
    })
  })

  it('preserves the forced-skill fallback when no basic attack exists', () => {
    const spell = { skillId: 4, effect: 'heal', manaCost: 10 }
    expect(resolveSkillMana({
      selectedSkill: spell,
      availableSkills: [spell],
      currentMp: 2,
    })).toEqual({
      skill: spell,
      mpCost: 0,
      remainingMp: 0,
      fallback: 'forced',
    })
  })

  it('reads cooldowns safely and normalizes invalid durations', () => {
    const cooldowns = { hero_1: { 12: 2, 13: 0, 14: -1 } }
    expect(getSkillCooldownRemaining(cooldowns, 'hero_1', 12)).toBe(2)
    expect(isSkillOnCooldown(cooldowns, 'hero_1', 12)).toBe(true)
    expect(isSkillOnCooldown(cooldowns, 'hero_1', 13)).toBe(false)
    expect(isSkillOnCooldown(cooldowns, 'missing', 12)).toBe(false)
    expect(normalizeSkillCooldown(3)).toBe(3)
    expect(normalizeSkillCooldown(0)).toBe(0)
    expect(normalizeSkillCooldown(-1)).toBe(0)
    expect(normalizeSkillCooldown(Number.NaN)).toBe(0)
    expect(normalizeSkillCooldown(undefined)).toBe(0)
  })
  it('assigns cooldowns immutably for heroes and enemies', () => {
    const initial = { hero_1: { 12: 2 } }
    const next = setSkillCooldown(initial, 'enemy_1', 7, 3)
    expect(next).toEqual({ hero_1: { 12: 2 }, enemy_1: { 7: 3 } })
    expect(initial).toEqual({ hero_1: { 12: 2 } })
  })

  it('advances cooldowns and removes skills that become ready', () => {
    const initial = { hero_1: { 1: 1, 2: 2 }, enemy_1: { 3: 3 } }
    expect(advanceSkillCooldowns(initial)).toEqual({
      hero_1: { 2: 1 },
      enemy_1: { 3: 2 },
    })
    expect(initial).toEqual({ hero_1: { 1: 1, 2: 2 }, enemy_1: { 3: 3 } })
  })

  it('supports advancing by multiple rounds and rejects invalid elapsed values', () => {
    expect(advanceSkillCooldowns({ hero_1: { 1: 4, 2: 1 } }, 3)).toEqual({
      hero_1: { 1: 1 },
    })
    expect(() => advanceSkillCooldowns({}, -1)).toThrow(RangeError)
  })

})
