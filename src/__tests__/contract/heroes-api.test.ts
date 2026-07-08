import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDb } from '../setup'
import { auth } from '@/auth'
import type { Mock } from 'vitest'

const FAKE_ADMIN_ID = 'admin-1'

function mockSession() {
  ;(auth as Mock).mockResolvedValue({ user: { id: FAKE_ADMIN_ID, isAdmin: true } })
  mockDb.user.findUnique.mockResolvedValue({ id: FAKE_ADMIN_ID, isAdmin: true })
}

function mockNoSession() {
  ;(auth as Mock).mockResolvedValue(null)
}

function jsonResponse(res: Response): Promise<any> {
  return res.json()
}

describe('Heroes API contract', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const fakeHero = {
    id: 'hero-1',
    name: 'Aragorn',
    userId: FAKE_ADMIN_ID,
    classId: 1,
    raceId: 1,
    level: 1,
    attrs: { st: 50, ag: 70, in: 60 },
    hpCurrent: 0, hpMax: 0, mpCurrent: 0, mpMax: 0,
    createdAt: new Date(), updatedAt: new Date(),
    class: { id: 1, name: 'Warrior', icon: '⚔️', slug: 'warrior', createdAt: new Date() },
    race: { id: 1, name: 'Human', icon: '🌍', flavor: '', lore: '', attrMods: {}, racialTraits: [], createdAt: new Date() },
    user: { id: FAKE_ADMIN_ID, name: 'Admin', email: 'admin@test.com' },
  }

  describe('GET /api/heroes', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/heroes/route')
      const res = await route.GET()
      expect(res.status).toBe(401)
      expect((await jsonResponse(res)).error).toBe('No autenticado')
    })

    it('returns 200 with heroes array', async () => {
      mockSession()
      mockDb.hero.findMany.mockResolvedValue([fakeHero])
      const route = await import('@/app/api/heroes/route')
      const res = await route.GET()
      expect(res.status).toBe(200)
      const body = await jsonResponse(res)
      expect(body).toHaveProperty('heroes')
      expect(Array.isArray(body.heroes)).toBe(true)
      expect(body.heroes[0].name).toBe('Aragorn')
    })

    it('returns empty array when no heroes', async () => {
      mockSession()
      mockDb.hero.findMany.mockResolvedValue([])
      const route = await import('@/app/api/heroes/route')
      const res = await route.GET()
      const body = await jsonResponse(res)
      expect(body.heroes).toEqual([])
    })
  })

  describe('POST /api/heroes', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/heroes/route')
      const req = new Request('http://localhost/api/heroes', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', classId: 1, raceId: 1 }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await route.POST(req)
      expect(res.status).toBe(401)
    })

    it('returns 201 with created hero', async () => {
      mockSession()
      mockDb.hero.findFirst.mockResolvedValue(null)
      mockDb.hero.create.mockResolvedValue(fakeHero)
      mockDb.class.findMany.mockResolvedValue([])
      mockDb.race.findMany.mockResolvedValue([])
      const route = await import('@/app/api/heroes/route')
      const req = new Request('http://localhost/api/heroes', {
        method: 'POST',
        body: JSON.stringify({ name: 'Aragorn', classId: 1, raceId: 1, attrs: { st: 50 } }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await route.POST(req)
      expect(res.status).toBe(201)
      const body = await jsonResponse(res)
      expect(body).toHaveProperty('id')
      expect(body.name).toBe('Aragorn')
    })

    it('returns 422 for invalid body', async () => {
      mockSession()
      const route = await import('@/app/api/heroes/route')
      const req = new Request('http://localhost/api/heroes', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await route.POST(req)
      expect(res.status).toBe(422)
      const body = await jsonResponse(res)
      expect(body).toHaveProperty('error')
    })
  })

  describe('GET /api/heroes/[id]', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'hero-1' })
      const res = await route.GET(new Request('http://localhost'), { params })
      expect(res.status).toBe(401)
    })

    it('returns 200 with hero', async () => {
      mockSession()
      mockDb.hero.findUnique.mockResolvedValue(fakeHero)
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'hero-1' })
      const res = await route.GET(new Request('http://localhost'), { params })
      expect(res.status).toBe(200)
      const body = await jsonResponse(res)
      expect(body.id).toBe('hero-1')
      expect(body.name).toBe('Aragorn')
      expect(body.attrs).toEqual({ st: 50, ag: 70, in: 60 })
    })

    it('returns 404 for non-existent hero', async () => {
      mockSession()
      mockDb.hero.findUnique.mockResolvedValue(null)
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'nonexistent' })
      const res = await route.GET(new Request('http://localhost'), { params })
      expect(res.status).toBe(404)
      expect((await jsonResponse(res)).error).toBe('Hero not found')
    })
  })

  describe('PUT /api/heroes/[id]', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'hero-1' })
      const res = await route.PUT(new Request('http://localhost', { method: 'PUT', body: '{}', headers: { 'Content-Type': 'application/json' } }), { params })
      expect(res.status).toBe(401)
    })

    it('returns 200 after updating name', async () => {
      mockSession()
      mockDb.hero.findUnique.mockResolvedValue(fakeHero)
      mockDb.hero.findFirst.mockResolvedValue(null)
      mockDb.hero.update.mockResolvedValue({ ...fakeHero, name: 'Aragorn II' })
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'hero-1' })
      const req = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Aragorn II' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await route.PUT(req, { params })
      expect(res.status).toBe(200)
      const body = await jsonResponse(res)
      expect(body.name).toBe('Aragorn II')
    })

    it('returns 200 after updating attrs', async () => {
      mockSession()
      mockDb.hero.findUnique.mockResolvedValue(fakeHero)
      mockDb.hero.update.mockResolvedValue({ ...fakeHero, attrs: { st: 99 } })
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'hero-1' })
      const req = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ attrs: { st: 99 } }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await route.PUT(req, { params })
      expect(res.status).toBe(200)
      const body = await jsonResponse(res)
      expect(body.attrs.st).toBe(99)
    })

    it('returns 404 for non-existent hero', async () => {
      mockSession()
      mockDb.hero.findUnique.mockResolvedValue(null)
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'nonexistent' })
      const req = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await route.PUT(req, { params })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/heroes/[id]', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'hero-1' })
      const res = await route.DELETE(new Request('http://localhost'), { params })
      expect(res.status).toBe(401)
    })

    it('returns 204 on successful delete', async () => {
      mockSession()
      mockDb.hero.findUnique.mockResolvedValue(fakeHero)
      mockDb.hero.delete.mockResolvedValue(fakeHero)
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'hero-1' })
      const res = await route.DELETE(new Request('http://localhost'), { params })
      expect(res.status).toBe(204)
    })

    it('returns 404 for non-existent hero', async () => {
      mockSession()
      mockDb.hero.findUnique.mockResolvedValue(null)
      const route = await import('@/app/api/heroes/[id]/route')
      const params = Promise.resolve({ id: 'nonexistent' })
      const res = await route.DELETE(new Request('http://localhost'), { params })
      expect(res.status).toBe(404)
    })
  })
})
