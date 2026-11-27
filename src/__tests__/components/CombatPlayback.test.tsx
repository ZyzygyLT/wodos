// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { RunResult } from "@/lib/combat-engine/dungeon-runner"
import { CombatPlayback } from "@/components/combat/CombatPlayback"

vi.mock("@/components/combat/RoundView", () => ({
  RoundView: () => <div>Ronda de prueba</div>,
}))

beforeEach(() => cleanup())

describe("CombatPlayback", () => {
  it("lets the player open the report when no replayable rounds exist", () => {
    const onFinish = vi.fn()
    const result = {
      victory: true,
      totalRounds: 0,
      epGained: 12,
      goldGained: 7,
      levelReports: [],
    } as unknown as RunResult

    render(
      <CombatPlayback
        result={result}
        dungeonName="Cueva de prueba"
        onFinish={onFinish}
      />
    )

    expect(screen.getByText("¡Victoria!")).toBeTruthy()
    expect(screen.getByText(/No hay rondas detalladas disponibles/)).toBeTruthy()
    expect(screen.getByText("⭐ +12 EP")).toBeTruthy()
    fireEvent.click(screen.getByText(/Ver reporte completo/))
    expect(onFinish).toHaveBeenCalledOnce()
  })
  it("restarts automatic playback when the player chooses repeat", () => {
    const result = {
      victory: true,
      totalRounds: 1,
      epGained: 0,
      goldGained: 0,
      levelReports: [{
        levelNumber: 1,
        rounds: [{ roundNumber: 1 }],
      }],
    } as unknown as RunResult

    render(
      <CombatPlayback
        result={result}
        dungeonName="Cueva de prueba"
        onFinish={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText("⏸ Pausa"))
    fireEvent.click(screen.getByText("🔄 Repetir"))

    expect(screen.getByText("⏸ Pausa")).toBeTruthy()
    expect(screen.queryByText("🔄 Repetir")).toBeNull()
  })

})
