import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const { mergeAttrs, getActiveHeroByUserId, setActiveHeroForUser } = await import('@/lib/hero-utils')
const { default: db } = await import('@/lib/db')
const prisma = db as unknown as {
  user: { findUnique: Mock; updateMany: Mock; update: Mock }
  hero: { findFirst: Mock }
}

describe('mergeAttrs', () => {
  it('adds base attrs and mods', () => {
    const base = { st: 10, co: 8, in: 12, dx: 9, ch: 7, ag: 11, pe: 6, wi: 14 }
    const mods = { st: 2, ag: -1, wi: 0 }
    const result = mergeAttrs(base, mods)
    expect(result).toEqual({
      st: 12, co: 8, in: 12, dx: 9,
      ch: 7, ag: 10, pe: 6, wi: 14,
    })
  })

  it('uses defaults for missing keys', () => {
    const base = { st: 5 }
    const mods = { dx: 3 }
    const result = mergeAttrs(base, mods)
    expect(result).toEqual({
      st: 5, co: 0, in: 0, dx: 3,
      ch: 0, ag: 0, pe: 0, wi: 0,
    })
  })

  it('handles empty mods', () => {
    const base = { st: 10, co: 8, in: 12, dx: 9, ch: 7, ag: 11, pe: 6, wi: 14 }
    expect(mergeAttrs(base, {})).toEqual(base)
  })

  it('always has exactly 8 keys', () => {
    const result = mergeAttrs({}, {})
    expect(Object.keys(result).length).toBe(8)
  })
})

describe('getActiveHeroByUserId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the selected hero only when it belongs to the requesting user', async () => {
    prisma.user.findUnique.mockResolvedValue({ currentHeroId: 'hero-selected' })
    prisma.hero.findFirst.mockResolvedValue({ id: 'hero-selected', userId: 'user-1' })

    const hero = await getActiveHeroByUserId('user-1', { include: { class: true } })

    if (!hero) throw new Error('Expected selected hero')
    expect(hero.id).toBe('hero-selected')
    expect(prisma.hero.findFirst).toHaveBeenCalledWith({
      where: { id: 'hero-selected', userId: 'user-1' },
      include: { class: true },
    })
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('repairs a missing active hero pointer using the oldest owned hero', async () => {
    prisma.user.findUnique.mockResolvedValue({ currentHeroId: 'deleted-hero' })
    prisma.hero.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'oldest-owned', userId: 'user-1' })
    prisma.user.updateMany.mockResolvedValue({ count: 1 })

    const hero = await getActiveHeroByUserId('user-1')

    if (!hero) throw new Error('Expected fallback hero')
    expect(hero.id).toBe('oldest-owned')
    expect(prisma.hero.findFirst).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'asc' },
    })
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', currentHeroId: 'deleted-hero' },
      data: { currentHeroId: 'oldest-owned' },
    })
  })

  it('does not resolve a hero when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    await expect(getActiveHeroByUserId('missing-user')).resolves.toBeNull()
    expect(prisma.hero.findFirst).not.toHaveBeenCalled()
  })

  it('does not replace a concurrently changed active hero pointer', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ currentHeroId: 'stale-hero' })
      .mockResolvedValueOnce({ currentHeroId: 'new-selection' })
    prisma.hero.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'fallback', userId: 'user-1' })
      .mockResolvedValueOnce({ id: 'new-selection', userId: 'user-1' })
    prisma.user.updateMany.mockResolvedValue({ count: 0 })

    const hero = await getActiveHeroByUserId('user-1')

    if (!hero) throw new Error('Expected concurrent selection')
    expect(hero.id).toBe('new-selection')
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', currentHeroId: 'stale-hero' },
      data: { currentHeroId: 'fallback' },
    })
  })
})

describe('setActiveHeroForUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('changes the active hero only when the hero belongs to the user', async () => {
    prisma.hero.findFirst.mockResolvedValue({ id: 'hero-2' })
    prisma.user.update.mockResolvedValue({ id: 'user-1', currentHeroId: 'hero-2' })

    await expect(setActiveHeroForUser('user-1', 'hero-2')).resolves.toBe(true)

    expect(prisma.hero.findFirst).toHaveBeenCalledWith({
      where: { id: 'hero-2', userId: 'user-1' },
      select: { id: true },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { currentHeroId: 'hero-2' },
    })
  })

  it('rejects a hero that belongs to another user', async () => {
    prisma.hero.findFirst.mockResolvedValue(null)

    await expect(setActiveHeroForUser('user-1', 'foreign-hero')).resolves.toBe(false)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
