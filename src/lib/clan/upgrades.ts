export type UpgradeId =
  | "library" | "storage"
  | "training" | "infirmary" | "cartography"
  | "smithy" | "exclusive_dungeon"

export interface UpgradeTier {
  tier: number
  goldCost: number
  effect: string
  bonus: Record<string, number>
}

export const CLAN_UPGRADES: Record<UpgradeId, { name: string; tiers: UpgradeTier[] }> = {
  library: {
    name: "Biblioteca del clan",
    tiers: [
      { tier: 1, goldCost: 500,  effect: "+5% EP en dungeons",  bonus: { ep_bonus_pct: 5 } },
      { tier: 2, goldCost: 1200, effect: "+10% EP en dungeons", bonus: { ep_bonus_pct: 10 } },
      { tier: 3, goldCost: 3000, effect: "+15% EP en dungeons", bonus: { ep_bonus_pct: 15 } },
    ],
  },
  storage: {
    name: "Almacén compartido",
    tiers: [
      { tier: 1, goldCost: 400,  effect: "500 slots compartidos",  bonus: { storage_slots: 500 } },
      { tier: 2, goldCost: 1000, effect: "1500 slots compartidos", bonus: { storage_slots: 1500 } },
      { tier: 3, goldCost: 2500, effect: "5000 slots compartidos", bonus: { storage_slots: 5000 } },
    ],
  },
  training: {
    name: "Sala de entrenamiento",
    tiers: [
      { tier: 1, goldCost: 1000, effect: "+5% ATK grupal",          bonus: { atk_bonus_pct: 5 } },
      { tier: 2, goldCost: 2500, effect: "+10% ATK + DEF grupal",   bonus: { atk_bonus_pct: 10, def_bonus_pct: 10 } },
      { tier: 3, goldCost: 6000, effect: "+20% todos los stats",    bonus: { all_stats_pct: 20 } },
    ],
  },
  infirmary: {
    name: "Enfermería",
    tiers: [
      { tier: 1, goldCost: 600,  effect: "Curar héroe caído 1x/semana",    bonus: { free_heals: 1 } },
      { tier: 2, goldCost: 1500, effect: "3 curas/semana",                 bonus: { free_heals: 3 } },
      { tier: 3, goldCost: 4000, effect: "Ilimitado + resurrección",       bonus: { free_heals: -1, can_resurrect: 1 } },
    ],
  },
  cartography: {
    name: "Sala de cartografía",
    tiers: [
      { tier: 1, goldCost: 700,  effect: "+10% oro en dungeons",           bonus: { gold_bonus_pct: 10 } },
      { tier: 2, goldCost: 1800, effect: "+15% oro + preview de loot",     bonus: { gold_bonus_pct: 15, loot_preview: 1 } },
      { tier: 3, goldCost: 4500, effect: "Reveal del boss + loot garantizado", bonus: { gold_bonus_pct: 20, boss_reveal: 1 } },
    ],
  },
  smithy: {
    name: "Herrería del clan",
    tiers: [
      { tier: 1, goldCost: 1200, effect: "Reparar items gratis",           bonus: { free_repairs: 1 } },
      { tier: 2, goldCost: 3000, effect: "Craft básico disponible",        bonus: { clan_craft: 1 } },
      { tier: 3, goldCost: 7000, effect: "Craft de items únicos del clan", bonus: { clan_craft: 2 } },
    ],
  },
  exclusive_dungeon: {
    name: "Dungeon exclusivo",
    tiers: [
      { tier: 1, goldCost: 5000,  effect: "Dungeon del clan nivel 1-5",    bonus: { exclusive_dungeon_level: 5 } },
      { tier: 2, goldCost: 10000, effect: "Dungeon del clan nivel 6-10",   bonus: { exclusive_dungeon_level: 10 } },
      { tier: 3, goldCost: 20000, effect: "Dungeon legendario del clan",   bonus: { exclusive_dungeon_level: 15 } },
    ],
  },
}

export function calcClanBonuses(upgrades: { upgradeId: string; tier: number }[]): Record<string, number> {
  const bonuses: Record<string, number> = {}
  for (const upgrade of upgrades) {
    const def = CLAN_UPGRADES[upgrade.upgradeId as UpgradeId]
    if (!def) continue
    const tier = def.tiers.find(t => t.tier === upgrade.tier)
    if (!tier) continue
    for (const [key, val] of Object.entries(tier.bonus)) {
      bonuses[key] = (bonuses[key] || 0) + val
    }
  }
  return bonuses
}
