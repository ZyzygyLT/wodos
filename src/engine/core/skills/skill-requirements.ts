import type { SkillDefinition } from './skill-definition'

export interface SkillRequirementDefinition {
  readonly id: number
  readonly requiresSkills?: readonly number[]
}

export interface SkillRequirementResult {
  readonly available: boolean
  readonly requiredSkillIds: readonly number[]
  readonly missingSkillIds: readonly number[]
}

export interface SkillPrerequisiteValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

/** Evaluates direct prerequisites against the skills already unlocked by an entity. */
export function evaluateSkillRequirements(
  skill: SkillRequirementDefinition,
  unlockedSkillIds: readonly number[],
): SkillRequirementResult {
  const requiredSkillIds = [...new Set(skill.requiresSkills ?? [])]
  const unlocked = new Set(unlockedSkillIds)
  const missingSkillIds = requiredSkillIds.filter(id => !unlocked.has(id))
  return {
    available: missingSkillIds.length === 0,
    requiredSkillIds,
    missingSkillIds,
  }
}

/**
 * Validates a complete skill catalogue: duplicate IDs, missing prerequisite
 * references, self-dependencies and prerequisite cycles.
 */
export function validateSkillPrerequisiteGraph(
  skills: readonly SkillRequirementDefinition[],
): SkillPrerequisiteValidationResult {
  const errors: string[] = []
  const byId = new Map<number, SkillRequirementDefinition>()

  for (const skill of skills) {
    if (byId.has(skill.id)) {
      errors.push(`duplicate skill id: ${skill.id}`)
    } else {
      byId.set(skill.id, skill)
    }
  }

  for (const skill of skills) {
    const seen = new Set<number>()
    for (const requiredId of skill.requiresSkills ?? []) {
      if (seen.has(requiredId)) errors.push(`skill ${skill.id} repeats prerequisite ${requiredId}`)
      seen.add(requiredId)
      if (requiredId === skill.id) {
        errors.push(`skill ${skill.id} cannot require itself`)
      } else if (!byId.has(requiredId)) {
        errors.push(`skill ${skill.id} requires missing skill ${requiredId}`)
      }
    }
  }

  const visiting = new Set<number>()
  const visited = new Set<number>()
  const reportedCycles = new Set<string>()
  const visit = (id: number, path: number[]): void => {
    if (visiting.has(id)) {
      const start = path.indexOf(id)
      const cycle = [...path.slice(start), id]
      const cycleKey = [...cycle.slice(0, -1)].sort((a, b) => a - b).join(',')
      if (!reportedCycles.has(cycleKey)) {
        reportedCycles.add(cycleKey)
        errors.push(`skill prerequisite cycle: ${cycle.join(' -> ')}`)
      }
      return
    }
    if (visited.has(id)) return
    const skill = byId.get(id)
    if (!skill) return
    visiting.add(id)
    for (const requiredId of skill.requiresSkills ?? []) {
      if (byId.has(requiredId)) visit(requiredId, [...path, id])
    }
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of byId.keys()) visit(id, [])
  return { valid: errors.length === 0, errors }
}

/** Convenience guard for unlock flows; it does not mutate the catalogue or entity. */
export function canUnlockSkill(
  skill: SkillDefinition,
  unlockedSkillIds: readonly number[],
): boolean {
  return evaluateSkillRequirements(skill, unlockedSkillIds).available
}
