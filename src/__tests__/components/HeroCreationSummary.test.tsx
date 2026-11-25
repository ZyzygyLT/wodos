// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import HeroCreationSummary from "@/components/game/HeroCreationSummary"

describe("HeroCreationSummary", () => {
  const heroClass = {
    name: "Guerrero",
    icon: "⚔️",
    baseAttrs: { st: 12, co: 10, in: 6, dx: 9, ch: 7, ag: 8, pe: 8, wi: 7 },
    primaryAttr: "st",
    secondaryAttr: "co",
  }
  const race = {
    name: "Enano",
    icon: "⛏️",
    attrMods: { st: 2, co: 2, ag: -1 },
    racialTraits: [{ name: "Resistencia Enana", desc: "+2 a la constitución" }],
  }

  it("shows the final class-plus-race attributes before hero creation", () => {
    render(<HeroCreationSummary heroClass={heroClass} race={race} />)
    expect(screen.getByRole("region", { name: "Resumen del héroe" })).toBeTruthy()
    expect(screen.getByText("Guerrero · Enano")).toBeTruthy()
    expect(screen.getByText("14")).toBeTruthy()
    expect(screen.getByText("12")).toBeTruthy()
    expect(screen.getByText("Resistencia Enana")).toBeTruthy()
  })

  it("renders nothing until both choices are made", () => {
    const { container } = render(<HeroCreationSummary heroClass={heroClass} race={null} />)
    expect(container.firstChild).toBeNull()
  })
})
