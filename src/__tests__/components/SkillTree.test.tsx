// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SkillTree from '@/components/game/SkillTree'

const mockSkills = [
  {
    id: 1, name: 'Golpe básico', icon: '👊', tier: 0, maxRank: 10,
    epCost: 0, goldCost: 0, type: 'attack', description: 'Ataque básico',
    requiresSkills: [], unlocked: true, rank: 1,
    manaCost: 5, multiplier: 1, tags: ['físico'],
    formula: { attrCoeffs: { st: 2 }, skillRankCoeff: 1, diceSides: 6, diceCount: 1, flatBonus: 0 },
  },
  {
    id: 2, name: 'Golpe poderoso', icon: '💥', tier: 1, maxRank: 10,
    epCost: 100, goldCost: 50, type: 'attack', description: 'Un golpe devastador',
    requiresSkills: [1], unlocked: false, rank: 0,
    manaCost: 10, multiplier: 2, tags: ['físico', 'pesado'],
    formula: { attrCoeffs: { st: 3 }, skillRankCoeff: 2, diceSides: 8, diceCount: 1, flatBonus: 5 },
  },
  {
    id: 3, name: 'Escudo de maná', icon: '🛡️', tier: 2, maxRank: 10,
    epCost: 200, goldCost: 100, type: 'passive', description: 'Reduce daño mágico',
    requiresSkills: [1, 2], unlocked: false, rank: 0,
    manaCost: 0, multiplier: 0, tags: ['defensivo', 'magia'],
    formula: null,
  },
]

beforeEach(() => { cleanup() })

describe('SkillTree', () => {
  it('renders SVG with skills', () => {
    const { container } = render(
      <SkillTree skills={mockSkills} epAvailable={500} gold={500} classId={1} onUnlock={vi.fn()} onUpgrade={vi.fn()} />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('shows detail panel when a skill is clicked', () => {
    render(
      <SkillTree skills={mockSkills} epAvailable={500} gold={500} classId={1} onUnlock={vi.fn()} onUpgrade={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Golpe básico'))
    expect(screen.getByText('Ataque básico')).toBeTruthy()
    expect(screen.getByText('Rango 1')).toBeTruthy()
  })

  it('shows unlock button for available skills', () => {
    render(
      <SkillTree skills={mockSkills} epAvailable={500} gold={500} classId={1} onUnlock={vi.fn()} onUpgrade={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Golpe poderoso'))
    expect(screen.getByText(/Desbloquear/)).toBeTruthy()
  })

  it('shows upgrade button for unlocked skills', () => {
    render(
      <SkillTree skills={mockSkills} epAvailable={500} gold={500} classId={1} onUnlock={vi.fn()} onUpgrade={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Golpe básico'))
    expect(screen.getByText(/Mejorar/)).toBeTruthy()
  })

  it('calls onUnlock when unlock button is clicked', async () => {
    const onUnlock = vi.fn().mockResolvedValue(undefined)
    render(
      <SkillTree skills={mockSkills} epAvailable={500} gold={500} classId={1} onUnlock={onUnlock} onUpgrade={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Golpe poderoso'))
    fireEvent.click(screen.getByText(/Desbloquear/))
    expect(onUnlock).toHaveBeenCalledWith(2)
  })

  it('calls onUpgrade when upgrade button is clicked', async () => {
    const onUpgrade = vi.fn().mockResolvedValue(undefined)
    render(
      <SkillTree skills={mockSkills} epAvailable={500} gold={500} classId={1} onUnlock={vi.fn()} onUpgrade={onUpgrade} />
    )
    fireEvent.click(screen.getByText('Golpe básico'))
    fireEvent.click(screen.getByText(/Mejorar/))
    expect(onUpgrade).toHaveBeenCalledWith(1)
  })

  it('shows requirement message when prerequisites not met', () => {
    render(
      <SkillTree skills={mockSkills} epAvailable={0} gold={0} classId={1} onUnlock={vi.fn()} onUpgrade={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Escudo de maná'))
    expect(screen.getByText('Requiere desbloquear habilidades previas')).toBeTruthy()
  })

  it('shows EP shortage message', () => {
    render(
      <SkillTree skills={mockSkills} epAvailable={50} gold={500} classId={1} onUnlock={vi.fn()} onUpgrade={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Golpe poderoso'))
    expect(screen.getByText(/Faltan 50 EXP/)).toBeTruthy()
  })

  it('shows gold shortage message', () => {
    render(
      <SkillTree skills={mockSkills} epAvailable={500} gold={20} classId={1} onUnlock={vi.fn()} onUpgrade={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Golpe poderoso'))
    expect(screen.getByText(/Faltan 30/)).toBeTruthy()
  })

  it('renders connection lines between skills', () => {
    const { container } = render(
      <SkillTree skills={mockSkills} epAvailable={500} gold={500} classId={1} onUnlock={vi.fn()} onUpgrade={vi.fn()} />
    )
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThan(0)
  })

  it('shows formula breakdown for skills with formula', () => {
    render(
      <SkillTree skills={mockSkills} epAvailable={500} gold={500} classId={1} onUnlock={vi.fn()} onUpgrade={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Golpe poderoso'))
    expect(screen.getByText(/3×ST/)).toBeTruthy()
  })
})
