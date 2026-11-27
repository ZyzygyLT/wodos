import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { authMock, activeHeroMock, findFirstMock, updateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  activeHeroMock: vi.fn(),
  findFirstMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/hero-utils', () => ({ getActiveHeroByUserId: activeHeroMock }))
vi.mock('@/lib/db', () => ({
  default: { combatProfile: { findFirst: findFirstMock, update: updateMock } },
}))

import { PUT } from '@/app/api/tactics/route'

describe('PUT /api/tactics initiative skill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    activeHeroMock.mockResolvedValue({
      id: 'hero-1',
      skills: [{ skillId: 77, skill: { id: 77, slug: 'organization', type: 'passive', effect: 'speed_up', timing: 'passive' } }],
      items: [],
    })
    findFirstMock.mockResolvedValue({ id: 'profile-1' })
    updateMock.mockImplementation(async ({ data }) => ({ id: 'profile-1', ...data }))
  })

  it('rejects initiative passives the active hero has not unlocked', async () => {
    const response = await PUT(new Request('http://localhost/api/tactics', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initiativeSkill: 'shadow-step' }),
    }) as NextRequest)

    expect(response.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('persists an owned passive initiative skill on the selected profile', async () => {
    const response = await PUT(new Request('http://localhost/api/tactics', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initiativeSkill: 'organization' }),
    }) as NextRequest)

    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ where: { id: 'profile-1' }, data: { initiativeSkill: 'organization' } })
  })
})
