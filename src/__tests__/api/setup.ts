import { vi } from 'vitest'


// Extend db mock for all models used in API routes
const mockDb = {
  $transaction: vi.fn(async (cb: any) => cb(mockDb)),
  $queryRaw: vi.fn(),
  user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  hero: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  heroItem: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), createMany: vi.fn() },
  heroSkill: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
  heroMaterial: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), create: vi.fn() },
  heroQuest: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), create: vi.fn(), update: vi.fn() },
  bazarListing: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  bazarPurchase: { create: vi.fn(), findMany: vi.fn() },
  clan: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  clanMember: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  clanGroup: { findUnique: vi.fn() },
  groupInvite: { findUnique: vi.fn(), updateMany: vi.fn() },
  groupMember: { findUnique: vi.fn(), create: vi.fn() },
  quest: { findUnique: vi.fn(), findMany: vi.fn() },
  item: { findUnique: vi.fn(), findMany: vi.fn() },
  material: { findMany: vi.fn() },
  notification: { create: vi.fn() },
  duelHistory: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  attributeDefinition: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}

vi.mock('@/lib/db', () => ({ default: mockDb }))

// Mock auth to return a fake session by default
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock notifications
vi.mock('@/lib/notifications/emitter', () => ({
  notify: vi.fn(() => Promise.resolve()),
}))

// Mock analytics
vi.mock('@/lib/analytics/events', () => ({
  trackItemListed: vi.fn(),
  trackItemPurchased: vi.fn(),
  trackClanCreated: vi.fn(),
  trackQuestCompleted: vi.fn(),
  trackDuelCompleted: vi.fn(),
}))

// Mock arena runner
vi.mock('@/lib/combat-engine/arena-runner', () => ({
  runArenaDuel: vi.fn(),
}))

// Mock quest progress
vi.mock('@/lib/quests/progress', () => ({
  updateQuestProgress: vi.fn(() => Promise.resolve()),
}))

// Mock achievements
vi.mock('@/lib/achievements/checker', () => ({
  checkAchievements: vi.fn(() => Promise.resolve([])),
}))

export { mockDb }
