import { describe, it, expect, vi, beforeEach } from 'vitest'

const { activeHeroMock } = vi.hoisted(() => ({ activeHeroMock: vi.fn() }))

vi.mock('@/lib/combat-engine/arena-runner', () => ({
  runArenaDuel: vi.fn(),
}))
vi.mock('@/lib/hero-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hero-utils')>('@/lib/hero-utils')
  return { ...actual, getHeroByUserId: vi.fn(), getActiveHeroByUserId: activeHeroMock }
})
vi.mock('@/lib/dungeon-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dungeon-helpers')>('@/lib/dungeon-helpers')
  return { ...actual, buildHeroData: vi.fn(async () => ({ equipStats: {}, skills: [] })) }
})
vi.mock('@/lib/combat-engine/hero-stats', async () => {
  const actual = await vi.importActual<typeof import('@/lib/combat-engine/hero-stats')>('@/lib/combat-engine/hero-stats')
  return { ...actual, computeDefenseForHero: vi.fn(() => ({ values: {}, breakdown: {} })) }
})
vi.mock('@/engine/core/stats/derived-stats', async () => {
  const actual = await vi.importActual<typeof import('@/engine/core/stats/derived-stats')>('@/engine/core/stats/derived-stats')
  return { ...actual, calculateEffectiveResourceMaxima: vi.fn(() => ({ hpMax: 10, mpMax: 10 })) }
})
import { mockDb } from '../setup'
import { auth } from '@/auth'
import type { Mock } from 'vitest'

const FAKE_USER_ID = 'user-1'
const FAKE_HERO_ID = 'hero-1'


function mockSession() {
  ;(auth as Mock).mockResolvedValue({ user: { id: FAKE_USER_ID } })
}

function mockNoSession() {
  ;(auth as Mock).mockResolvedValue(null)
}

function jsonResponse(res: Response): Promise<any> {
  return res.json()
}

function mockActiveHeroDefault() {
  activeHeroMock.mockImplementation(async (userId: string, options: { include?: unknown; select?: unknown } = {}) => {
    const hero = await mockDb.hero.findFirst({
      where: { userId },
      ...(options.include ? { include: options.include } : {}),
      ...(options.select ? { select: options.select } : {}),
    })
    if (!hero) return null
    return {
      ...hero,
      items: hero.items ?? [],
      materials: hero.materials ?? [],
      heroQuests: hero.heroQuests ?? [],
      skills: hero.skills ?? [],
      combatProfiles: hero.combatProfiles ?? [],
      clanMember: hero.clanMember ?? null,
    }
  })
  ;(mockDb.user.findUnique as Mock).mockResolvedValue({ currentHeroId: null })
  ;(mockDb.user.updateMany as Mock).mockResolvedValue({ count: 1 })
  ;(mockDb.hero.updateMany as Mock).mockResolvedValue({ count: 1 })
}

// ─── GET /api/hero ─────────────────────────────────────────────────────────────
describe('GET /api/hero', () => {
  beforeEach(() => { vi.clearAllMocks(); mockActiveHeroDefault() })

  it('returns 401 without auth', async () => {
    mockNoSession()
    const { GET } = await import('@/app/api/hero/route')
    const res = await GET()
    expect(res.status).toBe(401)
    expect((await jsonResponse(res)).error).toBe('No autenticado')
  })

  it('returns 404 if no hero exists', async () => {
    mockSession()
    const { getActiveHeroByUserId } = await import('@/lib/hero-utils')
    ;(getActiveHeroByUserId as Mock).mockResolvedValue(null)
    const { GET } = await import('@/app/api/hero/route')
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns hero when found', async () => {
    mockSession()
    const fakeHero = { id: FAKE_HERO_ID, name: 'TestHero', level: 5, hpMax: 10, mpMax: 10, attrs: {}, skills: [], items: [], combatProfiles: [] }
    const { getActiveHeroByUserId } = await import('@/lib/hero-utils')
    ;(getActiveHeroByUserId as Mock).mockResolvedValue(fakeHero)
    const { GET } = await import('@/app/api/hero/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await jsonResponse(res)
    expect(data.id).toBe(FAKE_HERO_ID)
    expect(data.name).toBe('TestHero')
  })
})

// ─── POST /api/bazar ───────────────────────────────────────────────────────────
describe('POST /api/bazar', () => {
  beforeEach(() => { vi.clearAllMocks(); mockActiveHeroDefault() })

  it('returns 401 without auth', async () => {
    mockNoSession()
    const { POST } = await import('@/app/api/bazar/route')
    const req = new Request('http://localhost/api/bazar', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 if missing required fields', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, items: [] })
    const { POST } = await import('@/app/api/bazar/route')
    const req = new Request('http://localhost/api/bazar', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const data = await jsonResponse(res)
    expect(data.error.fieldErrors.heroItemId).toBeDefined()
    expect(data.error.fieldErrors.price).toBeDefined()
  })

  it('creates a fixed listing', async () => {
    mockSession()
    const heroItem = { id: 'hi-1', itemId: 1, equipped: false, item: { name: 'Espada', category: 'weapon' } }
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, items: [heroItem] })
    ;(mockDb.bazarListing.findUnique as Mock).mockResolvedValue(null)
    ;(mockDb.bazarListing.create as Mock).mockResolvedValue({ id: 'listing-1', listingType: 'fixed', price: 500 })

    const { POST } = await import('@/app/api/bazar/route')
    const req = new Request('http://localhost/api/bazar', {
      method: 'POST',
      body: JSON.stringify({ heroItemId: 'hi-1', price: 500, listingType: 'fixed' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const data = await jsonResponse(res)
    expect(data.price).toBe(500)
  })

  it('rejects listing an equipped item', async () => {
    mockSession()
    const heroItem = { id: 'hi-1', itemId: 1, equipped: true, item: { name: 'Espada' } }
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, items: [heroItem] })
    const { POST } = await import('@/app/api/bazar/route')
    const req = new Request('http://localhost/api/bazar', {
      method: 'POST',
      body: JSON.stringify({ heroItemId: 'hi-1', price: 500 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect((await jsonResponse(res)).error).toContain('Deequipá')
  })

  it('rejects duplicate listing', async () => {
    mockSession()
    const heroItem = { id: 'hi-1', itemId: 1, equipped: false, item: { name: 'Espada' } }
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, items: [heroItem] })
    ;(mockDb.bazarListing.findUnique as Mock).mockResolvedValue({ id: 'existing', status: 'active' })
    const { POST } = await import('@/app/api/bazar/route')
    const req = new Request('http://localhost/api/bazar', {
      method: 'POST',
      body: JSON.stringify({ heroItemId: 'hi-1', price: 500 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect((await jsonResponse(res)).error).toContain('ya está en venta')
  })
})

// ─── POST /api/bazar/bid ──────────────────────────────────────────────────────
describe('POST /api/bazar/bid', () => {
  beforeEach(() => { vi.clearAllMocks(); mockActiveHeroDefault() })

  it('returns 401 without auth', async () => {
    mockNoSession()
    const { POST } = await import('@/app/api/bazar/bid/route')
    const req = new Request('http://localhost/api/bazar/bid', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it('rejects bid on own item', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, gold: 1000 })
    ;(mockDb.bazarListing.findUnique as Mock).mockResolvedValue({
      id: 'listing-1', status: 'active', sellerId: FAKE_HERO_ID,
      listingType: 'auction', startPrice: 100, price: 100, purchases: [],
      heroItem: { item: { name: 'Test Item' } },
    })
    const { POST } = await import('@/app/api/bazar/bid/route')
    const req = new Request('http://localhost/api/bazar/bid', {
      method: 'POST', body: JSON.stringify({ listingId: 'listing-1', amount: 150 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('accepts valid bid', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, gold: 1000 })
    ;(mockDb.bazarListing.findUnique as Mock).mockResolvedValue({
      id: 'listing-1', status: 'active', sellerId: 'seller-1',
      listingType: 'auction', startPrice: 100, price: 100, purchases: [],
      heroItem: { item: { name: 'Test Item' } },
    })
    ;(mockDb.bazarPurchase.create as Mock).mockResolvedValue({ id: 'purchase-1' })

    const { POST } = await import('@/app/api/bazar/bid/route')
    const req = new Request('http://localhost/api/bazar/bid', {
      method: 'POST', body: JSON.stringify({ listingId: 'listing-1', amount: 150 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const data = await jsonResponse(res)
    expect(data.bidAmount).toBe(150)
  })

  it('rejects bid below minimum', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, gold: 1000 })
    ;(mockDb.bazarListing.findUnique as Mock).mockResolvedValue({
      id: 'listing-1', status: 'active', sellerId: 'seller-1',
      listingType: 'auction', startPrice: 100, price: 100, purchases: [],
      heroItem: { item: { name: 'Test Item' } },
    })
    const { POST } = await import('@/app/api/bazar/bid/route')
    const req = new Request('http://localhost/api/bazar/bid', {
      method: 'POST', body: JSON.stringify({ listingId: 'listing-1', amount: 50 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect((await jsonResponse(res)).error).toContain('Puja mínima')
  })
})

// ─── POST /api/clan ────────────────────────────────────────────────────────────
describe('POST /api/clan', () => {
  beforeEach(() => { vi.clearAllMocks(); mockActiveHeroDefault() })

  it('creates a clan', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, clanMember: null })
    const fakeClan = { id: 'clan-1', name: 'Los Testers', tag: 'TST', members: [] }
    ;(mockDb.clan.create as Mock).mockResolvedValue(fakeClan)

    const { POST } = await import('@/app/api/clan/route')
    const req = new Request('http://localhost/api/clan', {
      method: 'POST',
      body: JSON.stringify({ name: 'Los Testers', tag: 'TST', icon: '⚔️', description: 'Test clan' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await jsonResponse(res)
    expect(data.name).toBe('Los Testers')
  })

  it('rejects clan creation without name', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, clanMember: null })
    const { POST } = await import('@/app/api/clan/route')
    const req = new Request('http://localhost/api/clan', {
      method: 'POST', body: JSON.stringify({ tag: 'TST' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects if already in a clan', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, clanMember: { clanId: 'clan-1' } })
    const { POST } = await import('@/app/api/clan/route')
    const req = new Request('http://localhost/api/clan', {
      method: 'POST', body: JSON.stringify({ name: 'New Clan', tag: 'NEW' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})

// ─── POST /api/clan/join ───────────────────────────────────────────────────────
describe('POST /api/clan/join', () => {
  beforeEach(() => { vi.clearAllMocks(); mockActiveHeroDefault() })

  it('joins a clan', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, name: 'TestHero', clanMember: null })
    ;(mockDb.clan.findUnique as Mock).mockResolvedValue({ id: 'clan-1', _count: { members: 5 } })
    ;(mockDb.clanMember.create as Mock).mockResolvedValue({ heroId: FAKE_HERO_ID, clanId: 'clan-1', role: 'member' })
    ;(mockDb.clanMember.findMany as Mock).mockResolvedValue([])

    const { POST } = await import('@/app/api/clan/join/route')
    const req = new Request('http://localhost/api/clan/join', {
      method: 'POST', body: JSON.stringify({ clanId: 'clan-1' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
  })

  it('rejects if already in a clan', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, clanMember: { clanId: 'clan-1' } })
    const { POST } = await import('@/app/api/clan/join/route')
    const req = new Request('http://localhost/api/clan/join', {
      method: 'POST', body: JSON.stringify({ clanId: 'clan-2' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect((await jsonResponse(res)).error).toContain('Ya pertenecés')
  })
})

// ─── POST /api/quests/accept ───────────────────────────────────────────────────
describe('POST /api/quests/accept', () => {
  beforeEach(() => { vi.clearAllMocks(); mockActiveHeroDefault() })

  it('accepts a quest', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, level: 5, heroQuests: [] })
    ;(mockDb.quest.findUnique as Mock).mockResolvedValue({
      id: 1, slug: 'test-quest', name: 'Test Quest', levelReq: 3,
      objectives: [{ id: 'obj1', type: 'kill', required: 10 }],
      rewards: { ep: 100, gold: 50 },
    })
    const fakeHeroQuest = { id: 'hq-1', heroId: FAKE_HERO_ID, questId: 1, progress: { obj1: 0 } }
    ;(mockDb.heroQuest.create as Mock).mockResolvedValue(fakeHeroQuest)

    const { POST } = await import('@/app/api/quests/accept/route')
    const req = new Request('http://localhost/api/quests/accept', {
      method: 'POST', body: JSON.stringify({ questSlug: 'test-quest' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    expect((await jsonResponse(res)).progress).toEqual({ obj1: 0 })
  })

  it('rejects if level too low', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, level: 1, heroQuests: [] })
    ;(mockDb.quest.findUnique as Mock).mockResolvedValue({
      id: 1, slug: 'test-quest', levelReq: 5,
    })
    const { POST } = await import('@/app/api/quests/accept/route')
    const req = new Request('http://localhost/api/quests/accept', {
      method: 'POST', body: JSON.stringify({ questSlug: 'test-quest' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect((await jsonResponse(res)).error).toContain('Requiere nivel')
  })
})

// ─── POST /api/quests/complete ─────────────────────────────────────────────────
describe('POST /api/quests/complete', () => {
  beforeEach(() => { vi.clearAllMocks(); mockActiveHeroDefault() })

  it('completes a quest with all objectives done', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID })
    ;(mockDb.heroQuest.findUnique as Mock).mockResolvedValue({
      id: 'hq-1', status: 'active', questId: 1,
      progress: { obj1: 10 },
      quest: {
        name: 'Test Quest', type: 'daily', chainNext: null,
        objectives: [{ id: 'obj1', required: 10 }],
        rewards: { ep: 100, gold: 50, fame: 10 },
      },
    })

    const { POST } = await import('@/app/api/quests/complete/route')
    const req = new Request('http://localhost/api/quests/complete', {
      method: 'POST', body: JSON.stringify({ questId: 1 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const data = await jsonResponse(res)
    expect(data.completed).toBe(true)
    expect(data.rewards.ep).toBe(100)
    expect(data.rewards.gold).toBe(50)
  })

  it('rejects if objectives not complete', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID })
    ;(mockDb.heroQuest.findUnique as Mock).mockResolvedValue({
      id: 'hq-1', status: 'active',
      progress: { obj1: 3 },
      quest: {
        objectives: [{ id: 'obj1', required: 10 }],
        rewards: {},
      },
    })
    const { POST } = await import('@/app/api/quests/complete/route')
    const req = new Request('http://localhost/api/quests/complete', {
      method: 'POST', body: JSON.stringify({ questId: 1 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect((await jsonResponse(res)).error).toContain('No completaste')
  })
})

// ─── POST /api/arena/duel ──────────────────────────────────────────────────────
describe('POST /api/arena/duel', () => {
  beforeEach(() => { vi.clearAllMocks(); mockActiveHeroDefault() })

  it('returns 401 without auth', async () => {
    mockNoSession()
    const { POST } = await import('@/app/api/arena/duel/route')
    const req = new Request('http://localhost/api/arena/duel', {
      method: 'POST', body: JSON.stringify({ hero2Id: 'hero-2' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it('rejects dueling yourself', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID })
    const { POST } = await import('@/app/api/arena/duel/route')
    const req = new Request('http://localhost/api/arena/duel', {
      method: 'POST', body: JSON.stringify({ hero2Id: FAKE_HERO_ID }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('executes a duel and returns result', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID })
    const { runArenaDuel } = await import('@/lib/combat-engine/arena-runner')
    const fakeResult = { won: true, eloChange: 16, winner: FAKE_HERO_ID, loser: 'hero-2', rounds: 3, log: [] }
    ;(runArenaDuel as Mock).mockResolvedValue(fakeResult)

    const { POST } = await import('@/app/api/arena/duel/route')
    const req = new Request('http://localhost/api/arena/duel', {
      method: 'POST', body: JSON.stringify({ hero2Id: 'hero-2' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const data = await jsonResponse(res)
    expect(data.won).toBe(true)
    expect(data.eloChange).toBe(16)
  })
})

// ─── POST /api/craft ───────────────────────────────────────────────────────────
describe('POST /api/craft', () => {
  beforeEach(() => { vi.clearAllMocks(); mockActiveHeroDefault() })

  it('crafts an item', async () => {
    mockSession()
    ;(mockDb.item.findUnique as Mock).mockResolvedValue({
      id: 1, name: 'Poción', isCraftable: true,
      recipe: { materials: [{ materialId: 1, quantity: 5 }], goldCost: 100 },
    })
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({
      id: FAKE_HERO_ID, gold: 500,
      materials: [{ materialId: 1, quantity: 10 }],
      items: [],
    })

    const { POST } = await import('@/app/api/craft/route')
    const req = new Request('http://localhost/api/craft', {
      method: 'POST', body: JSON.stringify({ itemId: 1 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect((await jsonResponse(res)).success).toBe(true)
  })

  it('rejects if not enough gold', async () => {
    mockSession()
    ;(mockDb.item.findUnique as Mock).mockResolvedValue({
      id: 1, isCraftable: true,
      recipe: { materials: [], goldCost: 1000 },
    })
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({
      id: FAKE_HERO_ID, gold: 100, materials: [], items: [],
    })

    const { POST } = await import('@/app/api/craft/route')
    const req = new Request('http://localhost/api/craft', {
      method: 'POST', body: JSON.stringify({ itemId: 1 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect((await jsonResponse(res)).error).toContain('Oro insuficiente')
  })

  it('rejects non-craftable item', async () => {
    mockSession()
    ;(mockDb.item.findUnique as Mock).mockResolvedValue({ id: 1, isCraftable: false })
    const { POST } = await import('@/app/api/craft/route')
    const req = new Request('http://localhost/api/craft', {
      method: 'POST', body: JSON.stringify({ itemId: 1 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
