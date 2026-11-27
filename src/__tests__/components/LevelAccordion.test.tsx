// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { LevelReport, StateSnapshot } from "@/lib/combat-engine/dungeon-runner"
import { LevelAccordion } from "@/components/combat/LevelAccordion"

vi.mock("@/components/combat/RoundView", () => ({
  RoundView: () => <div>Ronda de prueba</div>,
}))

vi.mock("@/components/combat/StateTables", () => ({
  StateTables: ({ snapshot }: { snapshot: StateSnapshot }) => (
    <div data-testid="final-state">
      {snapshot.heroes.map(hero => hero.name).join(", ")}
    </div>
  ),
}))

describe("LevelAccordion", () => {
  it("shows the final recorded state of the level after its rounds", () => {
    const finalState: StateSnapshot = {
      heroes: [{
        id: "hero-1",
        name: "Aventurera",
        level: 5,
        position: "front",
        hp: 12,
        maxHp: 20,
        mp: 3,
        maxMp: 8,
        condition: "normal",
        isHero: true,
      }],
      enemies: [],
    }
    const level: LevelReport = {
      levelNumber: 1,
      victory: true,
      epGained: 10,
      goldGained: 5,
      rounds: [{
        roundNumber: 1,
        stateBefore: { heroes: [], enemies: [] },
        stateAfter: finalState,
        actions: [],
      }],
    }

    render(<LevelAccordion level={level} defaultOpen />)

    expect(screen.getByRole("region", { name: "Estado al finalizar el nivel" })).toBeTruthy()
    expect(screen.getByTestId("final-state").textContent).toBe("Aventurera")
  })

  it("does not invent a final snapshot for levels without recorded rounds", () => {
    const level: LevelReport = {
      levelNumber: 1,
      victory: true,
      epGained: 10,
      goldGained: 5,
      rounds: [],
    }

    render(<LevelAccordion level={level} defaultOpen />)

    expect(screen.queryByRole("region", { name: "Estado al finalizar el nivel" })).toBeNull()
    expect(screen.getByText("Nivel superado sin combate")).toBeTruthy()
  })
})
