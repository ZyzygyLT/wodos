"use client"

import { useState } from "react"
import type { LevelReport } from "@/lib/combat-engine/dungeon-runner"
import { RoundView } from "./RoundView"
import { StateTables } from "./StateTables"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export function LevelAccordion({ level, defaultOpen }: Readonly<{ level: LevelReport; defaultOpen: boolean }>) {
  const [open, setOpen] = useState(defaultOpen)
  const finalSnapshot = level.rounds.at(-1)?.stateAfter

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-gray-800/60 transition text-left">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="text-lg">{level.victory ? '✅' : '💀'}</span>
          <span className="font-bold">Nivel {level.levelNumber}</span>
          {level.locationName && <span className="text-sm text-gray-300 break-words">— {level.locationName}</span>}
          {level.narrative && <span className="text-sm text-gray-400 italic break-words">— {level.narrative}</span>}
        </div>
        <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-x-3 gap-y-1 text-xs text-gray-400">
          <span>🏅 +{level.epGained} EP</span>
          <span>💰 +{level.goldGained} Oro</span>
          <span className={`transition ${open ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>
      {open && (
        <div className="p-4 space-y-4 border-t border-gray-800">
          {level.narrative && (
            <div className="border-l-2 border-amber-600/50 pl-4 py-1">
              <p className="text-xs text-amber-300/80 italic leading-relaxed">"{level.narrative}"</p>
            </div>
          )}
          {level.specialEvents && level.specialEvents.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {level.specialEvents.map((ev, i) => (
                <span key={"event-" + i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-900/20 border border-amber-700/30 text-xs text-amber-300">
                  {ev.icon} {ev.description}
                  {ev.round != null && <span className="text-gray-500 ml-1">(Ronda {ev.round})</span>}
                </span>
              ))}
            </div>
          )}
          {level.rounds.map((r, i) => (
            <ErrorBoundary key={r.roundNumber} fallback={<p className="text-xs text-red-400 text-center py-2">Error al mostrar ronda {r.roundNumber}</p>}>
              <RoundView round={r} />
            </ErrorBoundary>
          ))}
          {level.rounds.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              {level.victory ? 'Nivel superado sin combate' : 'Derrota inmediata'}
            </p>
          )}
          {finalSnapshot && (
            <section aria-label="Estado al finalizar el nivel" className="space-y-2 border-t border-gray-800 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">Estado al finalizar el nivel</h3>
              <StateTables snapshot={finalSnapshot} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
