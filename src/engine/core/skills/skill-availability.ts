export interface SkillManaCandidate {
  readonly skillId: number
  readonly manaCost?: number
  readonly effect?: string
  readonly type?: 'basic' | 'active' | 'passive'
}

export interface SkillManaResolution<T extends SkillManaCandidate> {
  readonly skill: T
  readonly mpCost: number
  readonly remainingMp: number
  readonly fallback: 'free_basic' | 'basic' | 'forced' | null
}

/** Explicit database skill type is authoritative; effect-only legacy records keep their old behavior. */
export function isBasicSkill(skill: SkillManaCandidate): boolean {
  if (skill.type !== undefined) return skill.type === 'basic'
  return skill.effect === 'attack' || !skill.effect
}

/** Preserves Wodos' current rank-based MP scaling. */
export function calculateSkillManaCost(baseMana: number, rank = 1): number {
  const safeBaseMana = Number.isFinite(baseMana) ? Math.max(0, baseMana) : 0
  const safeRank = Number.isFinite(rank) && rank > 0 ? rank : 1
  if (safeBaseMana <= 0) return 0
  return safeBaseMana + Math.round(safeBaseMana * 0.2 * (safeRank - 1))
}

/**
 * Resolves the legacy low-mana fallback without mutating the actor.
 * A free basic attack is preferred; otherwise the first basic attack is used
 * without spending additional MP; if none exists, the selected skill is forced and MP is depleted.
 */
export function resolveSkillMana<T extends SkillManaCandidate>(input: {
  readonly selectedSkill: T
  readonly availableSkills: readonly T[]
  readonly currentMp: number
  readonly rank?: number
}): SkillManaResolution<T> {
  const { selectedSkill, availableSkills } = input
  const currentMp = Number.isFinite(input.currentMp) ? Math.max(0, input.currentMp) : 0
  const baseMana = selectedSkill.manaCost ?? 0
  const mpCost = calculateSkillManaCost(baseMana, input.rank ?? 1)

  if (mpCost <= 0 || currentMp >= mpCost) {
    return {
      skill: selectedSkill,
      mpCost,
      remainingMp: Math.max(0, currentMp - mpCost),
      fallback: null,
    }
  }

  const freeSkill = availableSkills.find(skill => (skill.manaCost ?? 0) === 0 && isBasicSkill(skill))
  if (freeSkill) {
    return { skill: freeSkill, mpCost: 0, remainingMp: currentMp, fallback: 'free_basic' }
  }

  const basicSkill = availableSkills.find(isBasicSkill)
  if (basicSkill) {
    return { skill: basicSkill, mpCost: 0, remainingMp: currentMp, fallback: 'basic' }
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


/** Returns a new cooldown map with the selected skill assigned a finite cooldown. */
export function setSkillCooldown(
  current: Readonly<Record<string, Readonly<Record<number, number>>>> | undefined,
  actorId: string,
  skillId: number,
  rounds: number | null | undefined,
): Record<string, Record<number, number>> {
  const normalized = normalizeSkillCooldown(rounds)
  if (normalized <= 0) {
    return Object.fromEntries(
      Object.entries(current ?? {}).map(([id, skills]) => [id, { ...skills }]),
    )
  }
  const next = Object.fromEntries(
    Object.entries(current ?? {}).map(([id, skills]) => [id, { ...skills }]),
  ) as Record<string, Record<number, number>>
  next[actorId] ??= {}
  next[actorId][skillId] = normalized
  return next
}

/** Advances all actor cooldowns by whole rounds and removes ready entries. */
export function advanceSkillCooldowns(
  current: Readonly<Record<string, Readonly<Record<number, number>>>> | undefined,
  elapsed = 1,
): Record<string, Record<number, number>> {
  if (!Number.isSafeInteger(elapsed) || elapsed < 0) {
    throw new RangeError('Elapsed cooldown duration must be a non-negative safe integer')
  }
  const next: Record<string, Record<number, number>> = {}
  for (const [actorId, skills] of Object.entries(current ?? {})) {
    const remaining = Object.entries(skills)
      .map(([skillId, rounds]) => [Number(skillId), Math.max(0, Math.floor(rounds) - elapsed)] as const)
      .filter(([, rounds]) => Number.isFinite(rounds) && rounds > 0)
    if (remaining.length > 0) next[actorId] = Object.fromEntries(remaining)
  }
  return next
}