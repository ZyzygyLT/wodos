import { applyUpgradeStats } from '@/lib/craft/upgrade-stats'
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
   * Translate Wodos override semantics into the final additive delta from
   * item.stats. The result must not be the replacement value itself.
   * No active Wodos consumer for statOverrides was found in the audited paths.
   */
  readonly resolveStatOverrides?: (item: PersistedHeroItem) => NumericStatRecord | null | undefined
  /** Resolve inserted rune item IDs through the Wodos item catalogue. */
  readonly resolveRunes?: (item: PersistedHeroItem) => NumericStatRecord | null | undefined
  /** Resolve the upgrade curve into the additive delta from item.stats. */
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
      id: source === 'base' ? `item:${itemId}:${stat}` : `item:${itemId}:${source}:${stat}`,
      stat,
      operation: 'flat' as const,
      value: value as number,
      source: source === 'base' ? `item:${itemId}` : `item:${itemId}:${source}`,
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
 * Wodos' existing upgrade rule scales every item stat by 20% per level and
 * rounds each resulting stat. Convert that final value to a delta so the
 * engine can add it to the original item.stats exactly once.
 */
export function resolveWodosUpgradeBonus(item: PersistedHeroItem): NumericStatRecord {
  const level = item.upgradeLevel ?? 0
  const base = item.item.stats ?? {}
  if (level <= 0) return {}

  const upgraded = applyUpgradeStats(
    Object.fromEntries(Object.entries(base).filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1])
    )),
    level
  )
  return Object.fromEntries(
    Object.entries(upgraded).map(([stat, value]) => [stat, value - (base[stat] as number)])
  )
}

interface PersistedRuneSlot {
  readonly slotIndex?: unknown
  readonly itemId?: unknown
}

/**
 * Build a rune resolver from the rune catalogue already loaded by the caller.
 * Wodos stores { slotIndex, itemId } on the host HeroItem and consumes the
 * separate rune HeroItem when socketing it; therefore itemId is the lookup key.
 */
export function createWodosRuneResolver(
  runeStatsByItemId: ReadonlyMap<number, NumericStatRecord>
): (item: PersistedHeroItem) => NumericStatRecord {
  return item => {
    if (!Array.isArray(item.runesIn)) return {}
    const totals: Record<string, number> = {}
    for (const rawSlot of item.runesIn as PersistedRuneSlot[]) {
      if (!rawSlot || typeof rawSlot.itemId !== 'number' || !Number.isInteger(rawSlot.itemId)) continue
      const runeStats = runeStatsByItemId.get(rawSlot.itemId)
      if (!runeStats) continue
      for (const [stat, value] of Object.entries(runeStats)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) continue
        totals[stat] = (totals[stat] ?? 0) + value
      }
    }
    return totals
  }
}

/**
 * Collects all explicitly resolved modifiers from equipped inventory rows.
 * The default remains compatible with the legacy combat calculation:
 * item.stats only, excluding healing keys. Overrides and runes require a
 * caller-supplied catalogue/rule resolver; upgrades use the established
 * Wodos curve only when resolveWodosUpgradeBonus is explicitly supplied.
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
