import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/services/enchant.service', () => ({
  processEnchant: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ ok: true, remaining: 20, resetAt: new Date() })),
  ipKey: vi.fn(() => 'test-ip'),
}))

import { auth } from '@/auth'
const FAKE_USER_ID = 'user-1'

function mockSession() {
  ;(auth as Mock).mockResolvedValue({ user: { id: FAKE_USER_ID } })
}

function mockNoSession() {
  ;(auth as Mock).mockResolvedValue(null)
}

function jsonResponse(res: Response): Promise<any> {
  return res.json()
}

describe('POST /api/hero/inventory/enchant', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    mockNoSession()
    const { POST } = await import('@/app/api/hero/inventory/enchant/route')
    const req = new Request('http://localhost/api/hero/inventory/enchant', {
      method: 'POST', body: JSON.stringify({ heroItemId: 'item-1' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing heroItemId', async () => {
    mockSession()
    const { POST } = await import('@/app/api/hero/inventory/enchant/route')
    const req = new Request('http://localhost/api/hero/inventory/enchant', {
      method: 'POST', body: JSON.stringify({}),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty heroItemId', async () => {
    mockSession()
    const { POST } = await import('@/app/api/hero/inventory/enchant/route')
    const req = new Request('http://localhost/api/hero/inventory/enchant', {
      method: 'POST', body: JSON.stringify({ heroItemId: '' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('enchant succeeds and returns new level', async () => {
    mockSession()
    const { processEnchant } = await import('@/services/enchant.service')
    ;(processEnchant as Mock).mockResolvedValue({
      ok: true,
      data: { success: true, newLevel: 3, newMax: 10 },
    })

    const { POST } = await import('@/app/api/hero/inventory/enchant/route')
    const req = new Request('http://localhost/api/hero/inventory/enchant', {
      method: 'POST', body: JSON.stringify({ heroItemId: 'item-1' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const data = await jsonResponse(res)
    expect(data.success).toBe(true)
    expect(data.newLevel).toBe(3)
  })

  it('enchant fails and returns current level', async () => {
    mockSession()
    const { processEnchant } = await import('@/services/enchant.service')
    ;(processEnchant as Mock).mockResolvedValue({
      ok: true,
      data: { success: false, currentLevel: 5 },
    })

    const { POST } = await import('@/app/api/hero/inventory/enchant/route')
    const req = new Request('http://localhost/api/hero/inventory/enchant', {
      method: 'POST', body: JSON.stringify({ heroItemId: 'item-1' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const data = await jsonResponse(res)
    expect(data.success).toBe(false)
    expect(data.currentLevel).toBe(5)
  })

  it('returns service error when item not found', async () => {
    mockSession()
    const { processEnchant } = await import('@/services/enchant.service')
    ;(processEnchant as Mock).mockResolvedValue({
      ok: false, error: 'Item no encontrado', status: 404,
    })

    const { POST } = await import('@/app/api/hero/inventory/enchant/route')
    const req = new Request('http://localhost/api/hero/inventory/enchant', {
      method: 'POST', body: JSON.stringify({ heroItemId: 'item-999' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(404)
    expect((await jsonResponse(res)).error).toBe('Item no encontrado')
  })
})
