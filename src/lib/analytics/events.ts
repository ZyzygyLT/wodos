import { posthog } from "./posthog"

function capture(userId: string, event: string, props?: Record<string, unknown>) {
  if (!posthog) return
  posthog.capture({ distinctId: userId, event, properties: props })
}

export const trackHeroCreated = (userId: string, props: { className: string; raceName: string }) =>
  capture(userId, "hero_created", props)

export const trackDungeonEntered = (userId: string, props: { dungeonName: string; heroLevel: number }) =>
  capture(userId, "dungeon_entered", props)

export const trackDungeonCompleted = (userId: string, props: {
  dungeonName: string; victory: boolean; epGained: number; goldGained: number; lootCount: number
}) => capture(userId, "dungeon_completed", props)

export const trackItemListed = (userId: string, props: { itemName: string; price: number; type: string }) =>
  capture(userId, "item_listed", props)

export const trackItemPurchased = (userId: string, props: { itemName: string; price: number }) =>
  capture(userId, "item_purchased", props)

export const trackDuelCompleted = (userId: string, props: { won: boolean; eloChange: number; opponentLevel: number }) =>
  capture(userId, "duel_completed", props)

export const trackClanCreated = (userId: string, props: { clanName: string }) =>
  capture(userId, "clan_created", props)

export const trackClanUpgrade = (userId: string, props: { upgradeId: string; tier: number; goldSpent: number }) =>
  capture(userId, "clan_upgrade", props)

export const trackQuestCompleted = (userId: string, props: { questName: string; questType: string }) =>
  capture(userId, "quest_completed", props)
