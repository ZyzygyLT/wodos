// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { RunResult } from "@/lib/combat-engine/dungeon-runner"
import { CombatPlayback } from "@/components/combat/CombatPlayback"

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
    } as RunResult

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
})
