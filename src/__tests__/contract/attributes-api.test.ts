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

describe('Attributes API contract', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const now = new Date()
  const fakeAttr = {
    id: 'attr-1',
    name: 'Strength',
    abbreviation: 'st',
    description: 'Physical power',
    minValue: 1,
    maxValue: 100,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  describe('GET /api/attributes', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/attributes/route')
      const res = await route.GET(new Request('http://localhost/api/attributes'))
      expect(res.status).toBe(401)
      expect((await jsonResponse(res)).error).toBe('No autenticado')
    })

    it('returns 200 with attributes array', async () => {
      mockSession()
      mockDb.attributeDefinition.findMany.mockResolvedValue([fakeAttr])
      const route = await import('@/app/api/attributes/route')
      const res = await route.GET(new Request('http://localhost/api/attributes'))
      expect(res.status).toBe(200)
      const body = await jsonResponse(res)
      expect(body).toHaveProperty('attributes')
      expect(Array.isArray(body.attributes)).toBe(true)
      expect(body.attributes[0].name).toBe('Strength')
      expect(body.attributes[0].abbreviation).toBe('st')
    })

    it('respects includeArchived query param', async () => {
      mockSession()
      mockDb.attributeDefinition.findMany.mockResolvedValue([fakeAttr])
      const route = await import('@/app/api/attributes/route')
      const url = 'http://localhost/api/attributes?includeArchived=true'
      await route.GET(new Request(url))
      expect(mockDb.attributeDefinition.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
    })
  })

  describe('POST /api/attributes', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/attributes/route')
      const req = new Request('http://localhost/api/attributes', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', abbreviation: 't' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await route.POST(req)
      expect(res.status).toBe(401)
    })

    it('returns 201 with created attribute', async () => {
      mockSession()
      mockDb.attributeDefinition.create.mockResolvedValue(fakeAttr)
      const route = await import('@/app/api/attributes/route')
      const req = new Request('http://localhost/api/attributes', {
        method: 'POST',
        body: JSON.stringify({ name: 'Strength', abbreviation: 'st', description: 'Physical power', minValue: 1, maxValue: 100 }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await route.POST(req)
      expect(res.status).toBe(201)
      const body = await jsonResponse(res)
      expect(body).toHaveProperty('id')
      expect(body.name).toBe('Strength')
      expect(body.abbreviation).toBe('st')
    })

    it('returns 422 for missing required fields', async () => {
      mockSession()
      const route = await import('@/app/api/attributes/route')
      const req = new Request('http://localhost/api/attributes', {
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

  describe('GET /api/attributes/[id]', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/attributes/[id]/route')
      const params = Promise.resolve({ id: 'attr-1' })
      const res = await route.GET(new Request('http://localhost'), { params })
      expect(res.status).toBe(401)
    })

    it('returns 200 with attribute', async () => {
      mockSession()
      mockDb.attributeDefinition.findUnique.mockResolvedValue(fakeAttr)
      const route = await import('@/app/api/attributes/[id]/route')
      const params = Promise.resolve({ id: 'attr-1' })
      const res = await route.GET(new Request('http://localhost'), { params })
      expect(res.status).toBe(200)
      const body = await jsonResponse(res)
      expect(body.id).toBe('attr-1')
      expect(body.name).toBe('Strength')
      expect(body.minValue).toBe(1)
      expect(body.maxValue).toBe(100)
    })

    it('returns 404 for non-existent attribute', async () => {
      mockSession()
      mockDb.attributeDefinition.findUnique.mockResolvedValue(null)
      const route = await import('@/app/api/attributes/[id]/route')
      const params = Promise.resolve({ id: 'nonexistent' })
      const res = await route.GET(new Request('http://localhost'), { params })
      expect(res.status).toBe(404)
      expect((await jsonResponse(res)).error).toBe('Attribute not found')
    })
  })

  describe('PUT /api/attributes/[id]', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/attributes/[id]/route')
      const params = Promise.resolve({ id: 'attr-1' })
      const req = new Request('http://localhost', { method: 'PUT', body: '{}', headers: { 'Content-Type': 'application/json' } })
      const res = await route.PUT(req, { params })
      expect(res.status).toBe(401)
    })

    it('returns 200 with updated attribute', async () => {
      mockSession()
      mockDb.attributeDefinition.findUnique.mockResolvedValue(fakeAttr)
      mockDb.attributeDefinition.update.mockResolvedValue({ ...fakeAttr, name: 'Might' })
      const route = await import('@/app/api/attributes/[id]/route')
      const params = Promise.resolve({ id: 'attr-1' })
      const req = new Request('http://localhost', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Might' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await route.PUT(req, { params })
      expect(res.status).toBe(200)
      const body = await jsonResponse(res)
      expect(body.name).toBe('Might')
    })

    it('returns 404 for non-existent attribute', async () => {
      mockSession()
      mockDb.attributeDefinition.findUnique.mockResolvedValue(null)
      const route = await import('@/app/api/attributes/[id]/route')
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

  describe('POST /api/attributes/[id]/archive', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/attributes/[id]/archive/route')
      const params = Promise.resolve({ id: 'attr-1' })
      const res = await route.POST(new Request('http://localhost'), { params })
      expect(res.status).toBe(401)
    })

    it('returns 200 with archivedAt date', async () => {
      mockSession()
      mockDb.attributeDefinition.findUnique.mockResolvedValue(fakeAttr)
      mockDb.attributeDefinition.update.mockResolvedValue({ ...fakeAttr, archivedAt: new Date() })
      const route = await import('@/app/api/attributes/[id]/archive/route')
      const params = Promise.resolve({ id: 'attr-1' })
      const res = await route.POST(new Request('http://localhost'), { params })
      expect(res.status).toBe(200)
      const body = await jsonResponse(res)
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('archivedAt')
      expect(body.archivedAt).not.toBeNull()
    })

    it('returns 404 for non-existent attribute', async () => {
      mockSession()
      mockDb.attributeDefinition.findUnique.mockResolvedValue(null)
      const route = await import('@/app/api/attributes/[id]/archive/route')
      const params = Promise.resolve({ id: 'nonexistent' })
      const res = await route.POST(new Request('http://localhost'), { params })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/attributes/[id]/reactivate', () => {
    it('returns 401 without auth', async () => {
      mockNoSession()
      const route = await import('@/app/api/attributes/[id]/reactivate/route')
      const params = Promise.resolve({ id: 'attr-1' })
      const res = await route.POST(new Request('http://localhost'), { params })
      expect(res.status).toBe(401)
    })

    it('returns 200 with archivedAt null', async () => {
      mockSession()
      const archived = { ...fakeAttr, archivedAt: new Date() }
      mockDb.attributeDefinition.findUnique.mockResolvedValue(archived)
      mockDb.attributeDefinition.update.mockResolvedValue(fakeAttr)
      const route = await import('@/app/api/attributes/[id]/reactivate/route')
      const params = Promise.resolve({ id: 'attr-1' })
      const res = await route.POST(new Request('http://localhost'), { params })
      expect(res.status).toBe(200)
      const body = await jsonResponse(res)
      expect(body.archivedAt).toBeNull()
    })

    it('returns 404 for non-existent attribute', async () => {
      mockSession()
      mockDb.attributeDefinition.findUnique.mockResolvedValue(null)
      const route = await import('@/app/api/attributes/[id]/reactivate/route')
      const params = Promise.resolve({ id: 'nonexistent' })
      const res = await route.POST(new Request('http://localhost'), { params })
      expect(res.status).toBe(404)
    })
  })
})
