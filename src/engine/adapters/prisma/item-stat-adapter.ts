import type { StatModifier } from '../../core/stats/stat-modifier'

/** Converts persisted item JSON stats into engine modifiers without importing Prisma types. */
export function itemStatsToModifiers(
  itemId: string,
  stats: Readonly<Record<string, unknown>> | null | undefined,
  options: { excludedStats?: readonly string[] } = {}
): StatModifier[] {
  if (!stats) return []
  const excluded = new Set(options.excludedStats ?? ['healHp', 'healMp'])
  return Object.entries(stats)
    .filter(([stat, value]) => !excluded.has(stat) && typeof value === 'number' && Number.isFinite(value))
    .map(([stat, value]) => ({
      id: `item:${itemId}:${stat}`,
      stat,
      operation: 'flat' as const,
      value: value as number,
      source: `item:${itemId}`,
    }))
}


export interface PersistedHeroItem {
  readonly id: string
  readonly equipped: boolean
  readonly item: { readonly stats: Readonly<Record<string, unknown>> | null }
}

/** Collects modifiers from equipped inventory rows; unequipped items never affect stats. */
export function equippedItemsToModifiers(
  items: readonly PersistedHeroItem[] | null | undefined,
  options: { excludedStats?: readonly string[] } = {}
): StatModifier[] {
  return (items ?? [])
    .filter(heroItem => heroItem.equipped)
    .flatMap(heroItem => itemStatsToModifiers(heroItem.id, heroItem.item.stats, options))
}
