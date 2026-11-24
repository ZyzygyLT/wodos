// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import DungeonMap from '@/components/game/DungeonMap'

const mockDungeons = [
  {
    id: 1, slug: 'cueva-aranyas', name: 'Cueva de Arañas', icon: '🕷️',
    description: 'Una cueva oscura', lore: 'Llena de telarañas',
    levelReq: 1, recommendedLevel: 2,
    difficulty: 1, difficultyLabel: 'Fácil', isInstant: true,
    isRegistered: false, nextScheduledTime: null,
    profiles: [{ id: 'p1', name: 'Estándar', position: 'front' }],
  },
  {
    id: 2, slug: 'ruinas-abandonadas', name: 'Ruinas Abandonadas', icon: '🏛️',
    description: 'Antiguas ruinas', lore: 'Guardan secretos',
    levelReq: 3, recommendedLevel: 5,
    difficulty: 3, difficultyLabel: 'Media', isInstant: false,
    isRegistered: true, nextScheduledTime: new Date(Date.now() + 3600000).toISOString(),
    profiles: [
      { id: 'p1', name: 'Estándar', position: 'front' },
      { id: 'p2', name: 'Agresivo', position: 'rear' },
    ],
  },
]

beforeEach(() => { cleanup() })

describe('DungeonMap', () => {
  it('renders SVG map', () => {
    const { container } = render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders dungeon nodes', () => {
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    expect(screen.getByText('🕷️')).toBeTruthy()
    expect(screen.getByText('🏛️')).toBeTruthy()
  })

  it('shows detail panel when a dungeon is clicked', () => {
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('🕷️'))
    expect(screen.getByText('Cueva de Arañas')).toBeTruthy()
    expect(screen.getByText('Fácil')).toBeTruthy()
  })

  it('shows locked indicator for high-level dungeons', () => {
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={1}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    // Ruinas requires level 3, hero is level 1
    const lockIcons = screen.getAllByText('🔒')
    expect(lockIcons.length).toBeGreaterThanOrEqual(1)
  })

  it('shows register button for non-registered dungeons', () => {
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('🕷️'))
    expect(screen.getByText('Entrar ahora')).toBeTruthy()
  })

  it('blocks entry into a different dungeon while the hero is committed elsewhere', () => {
    const activeDungeons = mockDungeons.map(d => ({
      ...d,
      isRegistered: d.id === 2,
      activeRunDungeonId: 2,
      activeRunDungeonName: 'Ruinas Abandonadas',
    }))
    const onRegister = vi.fn()
    render(
      <DungeonMap
        dungeons={activeDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={onRegister}
      />
    )
    fireEvent.click(screen.getByText('🕷️'))
    expect(screen.getByText(/Tu héroe ya participa en Ruinas Abandonadas/)).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Comprometido' })
    expect(button.hasAttribute('disabled')).toBe(true)
    fireEvent.click(button)
    expect(onRegister).not.toHaveBeenCalled()
  })

  it('shows registered status for registered dungeons', () => {
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('🏛️'))
    expect(screen.getByText('Ya registrado')).toBeTruthy()
  })

  it('disables enter button when hero is dead', () => {
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={0}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('🕷️'))
    const btn = screen.getByText('Entrar ahora')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('calls onRegister when enter button is clicked', () => {
    const onRegister = vi.fn()
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={onRegister}
      />
    )
    fireEvent.click(screen.getByText('🕷️'))
    fireEvent.click(screen.getByText('Entrar ahora'))
    expect(onRegister).toHaveBeenCalledWith(1, true)
  })

  it('shows profile selector', () => {
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('🏛️'))
    fireEvent.click(screen.getByText(/Estándar/))
    expect(screen.getByText('Agresivo')).toBeTruthy()
  })

  it('calls onSelectProfile when a profile is chosen', () => {
    const onSelectProfile = vi.fn()
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={onSelectProfile}
        onRegister={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('🏛️'))
    fireEvent.click(screen.getByText(/Estándar/))
    fireEvent.click(screen.getByText('Agresivo'))
    expect(onSelectProfile).toHaveBeenCalledWith(2, 'p2')
  })

  it('shows scheduled time for non-instant dungeons', () => {
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('🏛️'))
    expect(screen.getByText('Programado')).toBeTruthy()
    expect(screen.getByText('Instantáneo')).toBeTruthy() // For the other one
  })

  it('renders region labels', () => {
    render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    expect(screen.getByText('Valle de Hierro')).toBeTruthy()
  })

  it('renders path lines between dungeons', () => {
    const { container } = render(
      <DungeonMap
        dungeons={mockDungeons}
        heroLevel={5}
        heroHp={100}
        selectedProfiles={{}}
        onSelectProfile={vi.fn()}
        onRegister={vi.fn()}
      />
    )
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThan(0)
  })
})
