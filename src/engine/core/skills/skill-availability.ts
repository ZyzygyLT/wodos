export interface SkillManaCandidate {
  readonly skillId: number
  readonly manaCost?: number
  readonly effect?: string
}

export interface SkillManaResolution<T extends SkillManaCandidate> {
  readonly skill: T
  readonly mpCost: number
  readonly remainingMp: number
  readonly fallback: 'free_basic' | 'basic' | 'forced' | null
}

/** Preserves Wodos' current rank-based MP scaling. */
export function calculateSkillManaCost(baseMana: number, rank = 1): number {
  if (baseMana <= 0) return 0
  return baseMana + Math.round(baseMana * 0.2 * (rank - 1))
}

/**
 * Resolves the legacy low-mana fallback without mutating the actor.
 * A free basic attack is preferred; otherwise the first basic attack is used
 * with MP depleted; if none exists, the selected skill is forced with MP depleted.
 */
export function resolveSkillMana<T extends SkillManaCandidate>(input: {
  readonly selectedSkill: T
  readonly availableSkills: readonly T[]
  readonly currentMp: number
  readonly rank?: number
}): SkillManaResolution<T> {
  const { selectedSkill, availableSkills, currentMp } = input
  const baseMana = selectedSkill.manaCost ?? 0
  const mpCost = calculateSkillManaCost(baseMana, input.rank ?? 1)

  if (baseMana <= 0 || currentMp >= mpCost) {
    return {
      skill: selectedSkill,
      mpCost,
      remainingMp: Math.max(0, currentMp - mpCost),
      fallback: null,
    }
  }

  const isBasicAttack = (skill: T) => skill.effect === 'attack' || !skill.effect
  const freeSkill = availableSkills.find(skill => (skill.manaCost ?? 0) === 0 && isBasicAttack(skill))
  if (freeSkill) {
    return { skill: freeSkill, mpCost: 0, remainingMp: currentMp, fallback: 'free_basic' }
  }

  const basicSkill = availableSkills.find(isBasicAttack)
  if (basicSkill) {
    return { skill: basicSkill, mpCost: 0, remainingMp: 0, fallback: 'basic' }
  }

  return { skill: selectedSkill, mpCost: 0, remainingMp: 0, fallback: 'forced' }
}

/** Returns a positive remaining cooldown, or zero when the skill is ready. */
export function getSkillCooldownRemaining(
  cooldowns: Readonly<Record<string, Readonly<Record<number, number>>>> | undefined,
  actorId: string,
  skillId: number,
): number {
  const remaining = cooldowns?.[actorId]?.[skillId] ?? 0
  return Number.isFinite(remaining) && remaining > 0 ? remaining : 0
}

export function isSkillOnCooldown(
  cooldowns: Readonly<Record<string, Readonly<Record<number, number>>>> | undefined,
  actorId: string,
  skillId: number,
): boolean {
  return getSkillCooldownRemaining(cooldowns, actorId, skillId) > 0
}

/** Normalizes absent, zero, negative or non-finite cooldowns to no cooldown. */
export function normalizeSkillCooldown(rounds: number | null | undefined): number {
  return typeof rounds === 'number' && Number.isFinite(rounds) && rounds > 0
    ? Math.floor(rounds)
    : 0
}
