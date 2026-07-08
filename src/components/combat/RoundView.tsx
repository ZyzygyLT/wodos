"use client"

import type { RoundReport } from "@/lib/combat-engine/dungeon-runner"
import { StateTables } from "./StateTables"
import { ActionCard } from "./ActionCard"

export function RoundView({ round }: Readonly<{ round: RoundReport }>) {
  const heroIds = new Set(round.stateBefore.heroes.map(h => h.id))
  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
      <div className="bg-gray-800 px-4 py-2 text-sm font-semibold text-yellow-400 flex items-center gap-2">
        <span>⚔️ Ronda {round.roundNumber}</span>
      </div>
      {/* Initiative timeline */}
      {round.actions.length > 0 && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-800/40 bg-gray-900/30 overflow-x-auto">
          <span className="text-[10px] text-gray-600 font-mono mr-1 shrink-0">init</span>
          {round.actions.map((a, i) => (
            <span key={`${a.actorId}-${a.actionNumber}-tl`}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0
                ${heroIds.has(a.actorId) ? 'text-green-300 bg-green-900/30' : 'text-orange-300 bg-orange-900/30'}`}>
              {a.actorIcon ?? (heroIds.has(a.actorId) ? '🧙' : '👹')}{a.initiative}
            </span>
          ))}
        </div>
      )}
      {round.narrative && (
        <div className="px-4 py-2 border-b border-gray-800/60">
          <p className="text-xs text-gray-400 italic leading-relaxed">{round.narrative}</p>
        </div>
      )}
      <div className="p-3 space-y-3">
        <StateTables snapshot={round.stateBefore} />
        <div className="space-y-1.5">
          <div className="text-xs text-gray-500 font-semibold px-1">Acciones</div>
          {round.actions.map((a, i) => <ActionCard key={`${a.actorId}-${a.actionNumber}`} a={a} isEnemy={!heroIds.has(a.actorId)} />)}
          {round.actions.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2">Sin acciones esta ronda</p>
          )}
        </div>
        <StateTables snapshot={round.stateAfter} />
      </div>
    </div>
  )
}
