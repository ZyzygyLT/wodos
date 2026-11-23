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
}

vi.mock('@/lib/db', () => ({ default: mockDb }))

vi.mock('@/auth', () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: 'admin-1', isAdmin: true } })),
}))

vi.mock('@/lib/notifications/emitter', () => ({ notify: vi.fn() }))
vi.mock('@/lib/analytics/events', () => ({ trackHeroCreated: vi.fn() }))

const { updateHeroName, updateHeroAttrs, deleteHero } = await import('@/services/hero-admin-service')
const { validateHeroAttributes } = await import('@/lib/models/hero')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Hero editing (integration)', () => {
  const now = new Date()
  const baseHero = {
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
    createdAt: now,
    updatedAt: now,
  }

  describe('updateHeroName', () => {
    it('updates hero name', async () => {
      mockDb.hero.findFirst.mockResolvedValue(null)
      mockDb.hero.update.mockResolvedValue({ ...baseHero, name: 'Aragorn II' })
      const hero = await updateHeroName('hero-1', 'Aragorn II')
      expect(hero.name).toBe('Aragorn II')
      expect(mockDb.hero.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'hero-1' }, data: { name: 'Aragorn II' } }))
    })

    it('rejects duplicate name on update', async () => {
      mockDb.hero.findFirst.mockResolvedValue({ id: 'hero-2', name: 'Aragorn II' })
      await expect(updateHeroName('hero-1', 'Aragorn II')).rejects.toThrow('A hero with this name already exists')
    })

    it('allows keeping the same name', async () => {
      mockDb.hero.findFirst.mockResolvedValue({ id: 'hero-1', name: 'Aragorn' })
      mockDb.hero.update.mockResolvedValue(baseHero)
      const hero = await updateHeroName('hero-1', 'Aragorn')
      expect(hero.name).toBe('Aragorn')
    })
  })

  describe('updateHeroAttrs', () => {
    it('updates hero attribute values', async () => {
      const newAttrs = { st: 60, ag: 80, in: 70 }
      mockDb.hero.update.mockResolvedValue({ ...baseHero, attrs: newAttrs })
      const hero = await updateHeroAttrs('hero-1', newAttrs)
      expect(hero.attrs).toEqual(newAttrs)
      expect(mockDb.hero.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'hero-1' }, data: { attrs: newAttrs } }))
    })

    it('partially updates attributes', async () => {
      mockDb.hero.update.mockResolvedValue({ ...baseHero, attrs: { st: 99 } })
      const hero = await updateHeroAttrs('hero-1', { st: 99 })
      expect((hero.attrs as Record<string, number>).st).toBe(99)
    })
  })

  describe('validateHeroAttributes', () => {
    const ranges = { st: { min: 1, max: 100 }, ag: { min: 1, max: 100 } }

    it('returns no errors for valid values', () => {
      const errors = validateHeroAttributes({ st: 50, ag: 70 }, ranges)
      expect(errors).toEqual([])
    })

    it('rejects value below minimum', () => {
      const errors = validateHeroAttributes({ st: 0 }, ranges)
      expect(errors).toContain('st value 0 is below minimum 1')
    })

    it('rejects value above maximum', () => {
      const errors = validateHeroAttributes({ st: 150 }, ranges)
      expect(errors).toContain('st value 150 exceeds maximum 100')
    })

    it('rejects unknown attribute', () => {
      const errors = validateHeroAttributes({ unknown: 50 }, ranges)
      expect(errors).toContain('Unknown attribute: unknown')
    })

    it('rejects non-integer value', () => {
      const errors = validateHeroAttributes({ st: 10.5 }, ranges)
      expect(errors).toContain('st must be an integer')
    })
  })
})
