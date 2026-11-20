export type CombatActionKind = 'attack' | 'heal' | 'buff' | 'item' | 'other'
export type CombatActionOutcome = 'hit' | 'miss' | 'critical' | 'support' | 'unknown'

export interface CombatActionTargetResult {
  readonly targetId: string
  readonly targetName?: string
  readonly outcome: CombatActionOutcome
  readonly damageBreakdown?: readonly { readonly type: string; readonly value: number }[]
  readonly absorbed?: number
  readonly statusEffect?: string
}

export interface CombatActionResult {
  readonly actorId: string
  readonly skillId: number
  readonly kind: CombatActionKind
  readonly outcome: CombatActionOutcome
  readonly targets: readonly CombatActionTargetResult[]
  readonly damageBreakdown?: readonly { readonly type: string; readonly value: number }[]
  readonly healing?: { readonly amount: number; readonly resource: 'hp' | 'mp' }
  readonly buff?: { readonly name: string; readonly value?: number }
  readonly itemName?: string
  readonly mpCost?: number
}

export interface CombatActionResultInput {
  actorId: string
  skillId: number
  kind: CombatActionKind
  outcome: CombatActionOutcome
  targets?: readonly CombatActionTargetResult[]
  damageBreakdown?: readonly { type: string; value: number }[]
  healing?: { amount: number; resource: 'hp' | 'mp' }
  buff?: { name: string; value?: number }
  itemName?: string
  mpCost?: number
}

/** Creates an immutable, normalized result without changing legacy report payloads. */
export function createCombatActionResult(input: CombatActionResultInput): CombatActionResult {
  if (!input.actorId.trim()) throw new TypeError('Combat action actorId is required')
  if (!Number.isSafeInteger(input.skillId)) throw new RangeError('Combat action skillId must be a safe integer')
  if (input.mpCost !== undefined && (!Number.isFinite(input.mpCost) || input.mpCost < 0)) {
    throw new RangeError('Combat action mpCost must be a non-negative finite number')
  }
  if (input.healing && (!Number.isFinite(input.healing.amount) || input.healing.amount < 0)) {
    throw new RangeError('Combat action healing must be a non-negative finite number')
  }
  const targets = (input.targets ?? []).map(target => {
    if (!target.targetId.trim()) throw new TypeError('Combat action targetId is required')
    if (target.absorbed !== undefined && (!Number.isFinite(target.absorbed) || target.absorbed < 0)) {
      throw new RangeError('Combat action absorbed must be a non-negative finite number')
    }
    return Object.freeze({
      ...target,
      ...(target.damageBreakdown ? { damageBreakdown: Object.freeze(target.damageBreakdown.map(part => Object.freeze({ ...part }))) } : {}),
    })
  })
  return Object.freeze({
    actorId: input.actorId,
    skillId: input.skillId,
    kind: input.kind,
    outcome: input.outcome,
    targets: Object.freeze(targets),
    ...(input.damageBreakdown ? { damageBreakdown: Object.freeze(input.damageBreakdown.map(part => Object.freeze({ ...part }))) } : {}),
    ...(input.healing ? { healing: Object.freeze({ ...input.healing }) } : {}),
    ...(input.buff ? { buff: Object.freeze({ ...input.buff }) } : {}),
    ...(input.itemName ? { itemName: input.itemName } : {}),
    ...(input.mpCost !== undefined ? { mpCost: input.mpCost } : {}),
  })
}
