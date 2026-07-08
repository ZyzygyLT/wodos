import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ ok: true, remaining: 10, resetAt: new Date() })),
  ipKey: vi.fn(() => 'test-ip'),
}))

import { mockDb } from '../setup'

function jsonResponse(res: Response): Promise<any> {
  return res.json()
}

describe('POST /api/auth/register', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a new user successfully', async () => {
    ;(mockDb.user.findUnique as Mock).mockResolvedValue(null)
    ;(mockDb.user.create as Mock).mockResolvedValue({ id: 'user-1', email: 'test@test.com' })

    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: 'password123', name: 'Test User' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await jsonResponse(res)
    expect(data.email).toBe('test@test.com')
  })

  it('returns 400 for invalid email', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: 'password123', name: 'Test' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 for short password', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: '123', name: 'Test' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate email', async () => {
    ;(mockDb.user.findUnique as Mock).mockResolvedValue({ id: 'existing', email: 'test@test.com' })
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: 'password123', name: 'Test' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(409)
  })

  it('returns 400 for name too short', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: 'password123', name: 'A' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
