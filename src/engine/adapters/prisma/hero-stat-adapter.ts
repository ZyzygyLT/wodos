import type { EntityId } from '../../core/entities/entity'
import type { GameEffect } from '../../core/effects/effect'
import { calculateStats, type StatPipelineResult } from '../../core/stats/stat-pipeline'
import { equippedItemsToModifiers, type EquippedItemModifierResolvers, type PersistedHeroItem } from './item-stat-adapter'

export interface PersistedHeroStatInput {
  readonly heroId: EntityId
  readonly baseStats: Readonly<Record<string, number>>
  readonly items?: readonly PersistedHeroItem[]
  readonly effects?: readonly GameEffect[]
  readonly itemResolvers?: EquippedItemModifierResolvers
}

/** Compatibility entry point for read models that already load hero.items and item.stats. */
export function calculateHeroStatsFromPersistedItems(
  input: PersistedHeroStatInput
): StatPipelineResult {
  return calculateStats({
    entityId: input.heroId,
    baseStats: input.baseStats,
    modifiers: equippedItemsToModifiers(input.items, input.itemResolvers),
    effects: input.effects,
  })
}
