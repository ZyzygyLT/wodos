// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import RaceSelector from '@/components/game/RaceSelector'

type MockRace = {
  id: number; name: string; icon: string; flavor: string
  attrMods: Record<string, number>; racialTraits: { name: string; desc: string }[]
  lore: string
}

const mockRaces: MockRace[] = [
  {
    id: 1, name: 'Humano', icon: '🧑', flavor: 'Versátiles y adaptables',
    attrMods: { st: 1, co: 1, in: 1, dx: 1, ch: 1, ag: 1, pe: 1, wi: 1 },
    racialTraits: [{ name: 'Versatilidad', desc: '+1 a todos los atributos' }],
    lore: 'La raza más común.',
  },
  {
    id: 2, name: 'Elfo', icon: '🧝', flavor: 'Ágiles y longevos',
    attrMods: { st: -1, dx: 2, ag: 2 },
    racialTraits: [{ name: 'Agilidad felina', desc: '+2 Destreza y Agilidad' }],
    lore: 'Habitantes de los bosques.',
  },
]

const classAttrs = { st: 10, co: 8, in: 12, dx: 9, ch: 7, ag: 11, pe: 6, wi: 14 }

beforeEach(() => { cleanup() })

describe('RaceSelector', () => {
  it('renders all race buttons', () => {
    const onSelect = vi.fn()
    render(<RaceSelector races={mockRaces} classAttrs={classAttrs} onSelect={onSelect} />)
    expect(screen.getByText('Humano')).toBeTruthy()
    expect(screen.getByText('Elfo')).toBeTruthy()
  })

  it('shows race icons', () => {
    render(<RaceSelector races={mockRaces} classAttrs={classAttrs} onSelect={vi.fn()} />)
    expect(screen.getByText('🧑')).toBeTruthy()
    expect(screen.getByText('🧝')).toBeTruthy()
  })

  it('calls onSelect when a race is clicked', () => {
    const onSelect = vi.fn()
    render(<RaceSelector races={mockRaces} classAttrs={classAttrs} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Humano'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('shows attribute modifiers on race cards', () => {
    render(<RaceSelector races={mockRaces} classAttrs={classAttrs} onSelect={vi.fn()} />)
    expect(screen.getByText('Fuerza +1')).toBeTruthy()
    expect(screen.getByText('Destreza +2')).toBeTruthy()
  })

  it('shows detail panel after selection', () => {
    render(<RaceSelector races={mockRaces} classAttrs={classAttrs} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByText('Humano'))
    expect(screen.getByText('Stats finales (clase + raza)')).toBeTruthy()
    expect(screen.getByText('Habilidades raciales')).toBeTruthy()
    expect(screen.getByText('Versatilidad')).toBeTruthy()
  })

  it('calculates final stats correctly', () => {
    render(<RaceSelector races={mockRaces} classAttrs={classAttrs} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByText('Humano'))
    expect(screen.getByText('11')).toBeTruthy() // st: 10 + 1
  })

  it('shows negative modifiers in red', () => {
    render(<RaceSelector races={mockRaces} classAttrs={classAttrs} onSelect={vi.fn()} />)
    const elfoBtn = screen.getByText('Elfo')
    fireEvent.click(elfoBtn)
    // Elfo has st: -1, should show negative modifier
    const detailPanel = screen.getByText('Stats finales (clase + raza)').closest('div')
    expect(detailPanel?.textContent).toContain('-1')
  })

  it('restores the previously selected race when the selector is mounted again', () => {
    render(
      <RaceSelector
        races={mockRaces}
        classAttrs={classAttrs}
        defaultSelectedRaceId={2}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Elfo/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Stats finales (clase + raza)')).toBeTruthy()
    expect(screen.getByText('Agilidad felina')).toBeTruthy()
  })

  it('handles empty races list', () => {
    render(<RaceSelector races={[]} classAttrs={classAttrs} onSelect={vi.fn()} />)
    expect(screen.queryByText('Humano')).toBeNull()
  })
})
