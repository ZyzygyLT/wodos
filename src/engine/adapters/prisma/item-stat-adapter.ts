import type { StatModifier } from '../../core/stats/stat-modifier'

type NumericStatRecord = Readonly<Record<string, unknown>>

export interface PersistedHeroItem {
  readonly id: string
  readonly itemId?: number
  readonly equipped: boolean
  readonly upgradeLevel?: number
  readonly statOverrides?: unknown
  readonly runesIn?: unknown
  readonly item: {
    readonly id?: number
    readonly stats: NumericStatRecord | null
  }
}

export interface EquippedItemModifierResolvers {
  /**
   * Interpret the persisted override JSON according to Wodos' item rules.
   * No default interpretation is assumed by the engine adapter.
   */
  readonly resolveStatOverrides?: (item: PersistedHeroItem) => NumericStatRecord | null | undefined
  /** Resolve inserted rune effects using the game's rune catalogue/rules. */
  readonly resolveRunes?: (item: PersistedHeroItem) => NumericStatRecord | null | undefined
  /** Resolve upgrade bonuses using the game's actual upgrade curve. */
  readonly resolveUpgrade?: (item: PersistedHeroItem) => NumericStatRecord | null | undefined
  readonly excludedStats?: readonly string[]
}

function statsToModifiers(
  itemId: string,
  source: string,
  stats: NumericStatRecord | null | undefined,
  excludedStats: ReadonlySet<string>
): StatModifier[] {
  if (!stats) return []
  return Object.entries(stats)
    .filter(([stat, value]) => !excludedStats.has(stat) && typeof value === 'number' && Number.isFinite(value))
    .map(([stat, value]) => ({
      id: `item:${itemId}:${source}:${stat}`,
      stat,
      operation: 'flat' as const,
      value: value as number,
      source: `item:${itemId}:${source}`,
    }))
}

/** Converts persisted item JSON stats into engine modifiers without importing Prisma types. */
export function itemStatsToModifiers(
  itemId: string,
  stats: NumericStatRecord | null | undefined,
  options: { excludedStats?: readonly string[] } = {}
): StatModifier[] {
  const excluded = new Set(options.excludedStats ?? ['healHp', 'healMp'])
  return statsToModifiers(itemId, 'base', stats, excluded)
}

/**
 * Collects all explicitly resolved modifiers from equipped inventory rows.
 * By default this preserves legacy behavior: only item.stats are applied.
 * Overrides, runes and upgrades are opt-in until their persisted semantics are
 * connected to authoritative Wodos domain rules.
 */
export function equippedItemsToModifiers(
  items: readonly PersistedHeroItem[] | null | undefined,
  options: EquippedItemModifierResolvers = {}
): StatModifier[] {
  const excluded = new Set(options.excludedStats ?? ['healHp', 'healMp'])
  return (items ?? [])
    .filter(heroItem => heroItem.equipped)
    .flatMap(heroItem => {
      const itemId = heroItem.id
      return [
        ...statsToModifiers(itemId, 'base', heroItem.item.stats, excluded),
        ...statsToModifiers(itemId, 'override', options.resolveStatOverrides?.(heroItem), excluded),
        ...statsToModifiers(itemId, 'rune', options.resolveRunes?.(heroItem), excluded),
        ...statsToModifiers(itemId, 'upgrade', options.resolveUpgrade?.(heroItem), excluded),
      ]
    })
}
