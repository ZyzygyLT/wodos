import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { authMock, activeHeroMock, createProfileMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  activeHeroMock: vi.fn(),
  createProfileMock: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/hero-utils', () => ({ getActiveHeroByUserId: activeHeroMock }))
vi.mock('@/lib/db', () => ({
  default: { combatProfile: { create: createProfileMock } },
}))

import { POST } from '@/app/api/hero/profiles/route'

describe('POST /api/hero/profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    createProfileMock.mockImplementation(async ({ data }) => ({ id: 'profile-1', ...data }))
  })

  it('uses the hero owned healing skill and its own attack skill for initial tactics', async () => {
    activeHeroMock.mockResolvedValue({
      id: 'hero-1',
      skills: [
        { skill: { id: 14, type: 'active', effect: 'attack', manaCost: 0 } },
        { skill: { id: 27, type: 'active', effect: 'heal', manaCost: 8 } },
      ],
    })

    const response = await POST(new Request('http://localhost/api/hero/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mazmorra', position: 'rear' }),
    }) as NextRequest)

    expect(response.status).toBe(201)
    expect(activeHeroMock).toHaveBeenCalledWith('user-1', {
      include: { skills: { include: { skill: true } } },
    })
    expect(createProfileMock).toHaveBeenCalledWith({
      data: {
        heroId: 'hero-1',
        name: 'Mazmorra',
        position: 'rear',
        roundRules: [
          {
            priority: 1,
            condition: { type: 'hp_self_lt', value: 30 },
            action: { skillId: 27, targetPos: 'auto', targetType: 'most_injured_ally' },
          },
          {
            priority: 2,
            condition: { type: 'always' },
            action: { skillId: 14, targetPos: 'auto', targetType: 'weakest' },
          },
        ],
      },
    })
  })

  it('does not create a healing rule when the hero has no active healing skill', async () => {
    activeHeroMock.mockResolvedValue({
      id: 'hero-1',
      skills: [{ skill: { id: 33, type: 'active', effect: 'attack', manaCost: 0 } }],
    })

    const response = await POST(new Request('http://localhost/api/hero/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Arena' }),
    }) as NextRequest)

    expect(response.status).toBe(201)
    expect(createProfileMock).toHaveBeenCalledWith({
      data: {
        heroId: 'hero-1',
        name: 'Arena',
        position: 'front',
        roundRules: [{
          priority: 1,
          condition: { type: 'always' },
          action: { skillId: 33, targetPos: 'auto', targetType: 'weakest' },
        }],
      },
    })
  })
})
