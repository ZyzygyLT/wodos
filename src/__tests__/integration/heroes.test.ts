import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = {
  hero: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  class: { findMany: vi.fn() },
  race: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ default: mockDb }))

vi.mock('@/auth', () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: 'admin-1', isAdmin: true } })),
}))

vi.mock('@/lib/notifications/emitter', () => ({ notify: vi.fn() }))
vi.mock('@/lib/analytics/events', () => ({ trackHeroCreated: vi.fn() }))

const { findAllHeroes, findHeroById, createAdminHero, deleteHero } = await import('@/services/hero-admin-service')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Hero CRUD (integration)', () => {
  const mockHero = {
    id: 'hero-1',
    name: 'Aragorn',
    userId: 'admin-1',
    classId: 1,
    raceId: 1,
    level: 1,
    attrs: { st: 50, ag: 70, in: 60 },
    hpCurrent: 0,
    hpMax: 0,
    mpCurrent: 0,
    mpMax: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('lists all heroes', async () => {
    mockDb.hero.findMany.mockResolvedValue([{ ...mockHero, class: { name: 'Warrior', icon: '⚔️' }, race: { name: 'Human', icon: '🌍' } }])
    const heroes = await findAllHeroes()
    expect(heroes).toHaveLength(1)
    expect(heroes[0].name).toBe('Aragorn')
    expect(heroes[0].class.name).toBe('Warrior')
    expect(mockDb.hero.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: { class: true, race: true } }))
  })

  it('finds hero by ID', async () => {
    mockDb.hero.findUnique.mockResolvedValue({ ...mockHero, class: { name: 'Warrior' }, race: { name: 'Human' }, user: { id: 'admin-1' } })
    const hero = await findHeroById('hero-1')
    expect(hero).not.toBeNull()
    expect(hero!.name).toBe('Aragorn')
    expect(hero!.attrs).toEqual({ st: 50, ag: 70, in: 60 })
  })

  it('returns null for non-existent hero', async () => {
    mockDb.hero.findUnique.mockResolvedValue(null)
    const hero = await findHeroById('nonexistent')
    expect(hero).toBeNull()
  })

  it('creates a new hero', async () => {
    mockDb.hero.findFirst.mockResolvedValue(null)
    mockDb.hero.create.mockResolvedValue(mockHero)
    const hero = await createAdminHero({ userId: 'admin-1', name: 'Aragorn', classId: 1, raceId: 1, attrs: { st: 50, ag: 70, in: 60 } })
    expect(hero.name).toBe('Aragorn')
    expect(mockDb.hero.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Aragorn' }) }))
  })

  it('rejects duplicate hero name', async () => {
    mockDb.hero.findFirst.mockResolvedValue(mockHero)
    await expect(createAdminHero({ userId: 'admin-1', name: 'Aragorn', classId: 1, raceId: 1 })).rejects.toThrow('A hero with this name already exists')
  })

  it('deletes a hero', async () => {
    mockDb.hero.delete.mockResolvedValue(mockHero)
    await deleteHero('hero-1')
    expect(mockDb.hero.delete).toHaveBeenCalledWith({ where: { id: 'hero-1' } })
  })
})
