import { describe, expect, it } from 'vitest'
import {
  canUnlockSkill,
  evaluateSkillRequirements,
  validateSkillPrerequisiteGraph,
  type SkillDefinition,
} from '@/engine/core'

const skill = (id: number, requiresSkills: number[] = []): SkillDefinition => ({
  id,
  name: `Skill ${id}`,
  effect: 'attack',
  timing: 'round',
  manaCost: 0,
  multiplier: 1,
  requiresSkills,
})

describe('skill prerequisites', () => {
  it('reports missing prerequisites and unlocks when all are owned', () => {
    expect(evaluateSkillRequirements(skill(10, [2, 3]), [2])).toEqual({
      available: false,
      requiredSkillIds: [2, 3],
      missingSkillIds: [3],
    })
    expect(evaluateSkillRequirements(skill(10, [2, 3]), [3, 2, 2])).toEqual({
      available: true,
      requiredSkillIds: [2, 3],
      missingSkillIds: [],
    })
  })

  it('treats skills without prerequisites as immediately available', () => {
    expect(canUnlockSkill(skill(1), [])).toBe(true)
    expect(evaluateSkillRequirements(skill(1), [])).toEqual({
      available: true,
      requiredSkillIds: [],
      missingSkillIds: [],
    })
  })

  it('validates a valid prerequisite chain', () => {
    expect(validateSkillPrerequisiteGraph([
      skill(1),
      skill(2, [1]),
      skill(3, [1, 2]),
    ])).toEqual({ valid: true, errors: [] })
  })

  it('detects missing references, self-dependencies, duplicates and cycles', () => {
    const result = validateSkillPrerequisiteGraph([
      skill(1, [1, 99]),
      skill(2, [3]),
      skill(3, [2, 2]),
      skill(2),
    ])
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'duplicate skill id: 2',
      'skill 1 cannot require itself',
      'skill 1 requires missing skill 99',
      'skill 3 repeats prerequisite 2',
    ]))
    expect(result.errors.some(error => error.startsWith('skill prerequisite cycle:'))).toBe(true)
  })
})
