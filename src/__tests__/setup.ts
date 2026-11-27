import { vi } from 'vitest'

// ─── Mock Prisma DB ────────────────────────────────────────────────────────────
const createMock = () => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
})

const mockDb = {
  $queryRaw: vi.fn(),
  $transaction: vi.fn(async (arg: any) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg.map((p: any) => Promise.resolve(p)))
    }
    return arg(mockDb)
  }),
  user: createMock(),
  hero: createMock(),
  heroSkill: createMock(),
  heroItem: createMock(),
  heroMaterial: createMock(),
  heroQuest: createMock(),
  bazarListing: createMock(),
  bazarPurchase: createMock(),
  clan: createMock(),
  clanMember: createMock(),
  clanGroup: createMock(),
  clanUpgrade: createMock(),
  quest: createMock(),
  item: createMock(),
  material: createMock(),
  notification: createMock(),
  achievement: createMock(),
  heroAchievement: createMock(),
  class: createMock(),
  race: createMock(),
  skill: createMock(),
  dungeon: createMock(),
  enemy: createMock(),
  dungeonRun: createMock(),
  dungeonRunRewardGrant: createMock(),
  combatProfile: createMock(),
  forumTopic: createMock(),
  forumReply: createMock(),
  forumCategory: createMock(),
  weeklyEvent: createMock(),
  heroEventParticipation: createMock(),
  clanEventParticipation: createMock(),
  tournament: createMock(),
  tournamentParticipant: createMock(),
  tournamentMatch: createMock(),
  duelHistory: createMock(),
  attributeDefinition: createMock(),
}

vi.mock('@/lib/db', () => ({ default: mockDb }))

// ─── Mock NextAuth ─────────────────────────────────────────────────────────────
vi.mock('@/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

// ─── Mock notifications (fire-and-forget, no-op) ──────────────────────────────
vi.mock('@/lib/notifications/emitter', () => ({
  notify: vi.fn(() => Promise.resolve()),
}))

// ─── Mock analytics ────────────────────────────────────────────────────────────
vi.mock('@/lib/analytics/events', () => ({
  trackHeroCreated: vi.fn(),
  trackDungeonEntered: vi.fn(),
  trackDungeonCompleted: vi.fn(),
  trackItemListed: vi.fn(),
  trackItemPurchased: vi.fn(),
  trackDuelCompleted: vi.fn(),
  trackClanCreated: vi.fn(),
  trackClanUpgrade: vi.fn(),
  trackQuestCompleted: vi.fn(),
}))



// ─── Mock quest progress ───────────────────────────────────────────────────────
vi.mock('@/lib/quests/progress', () => ({
  updateQuestProgress: vi.fn(() => Promise.resolve()),
}))

// ─── Mock achievements ─────────────────────────────────────────────────────────
vi.mock('@/lib/achievements/checker', () => ({
  checkAchievements: vi.fn(() => Promise.resolve([])),
}))

// ─── Mock hero-utils ───────────────────────────────────────────────────────────
vi.mock('@/lib/hero-utils', async () => {
  const actual = await vi.importActual('@/lib/hero-utils')
  return {
    ...(actual as any),
    getHeroByUserId: vi.fn(),
    createHero: vi.fn(),
    mergeAttrs: (actual as any).mergeAttrs,
  }
})

// ─── Mock dungeon-cron ─────────────────────────────────────────────────────────
vi.mock('@/lib/dungeon-cron', () => ({
  tick: vi.fn(),
  resetDailyQuests: vi.fn(),
}))

export { mockDb }
