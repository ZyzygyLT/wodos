"use client"

import { useRouter } from "next/navigation"

interface Props {
  result: any
  onClose: () => void
}

export default function DungeonResultModal({ result, onClose }: Readonly<Props>) {
  const router = useRouter()
  if (!result) return null

  const isVictory = result.victory
  const resultIcon = isVictory ? '🏆' : '💀'
  const resultLabel = isVictory ? '¡Victoria!' : 'Derrota'
  const borderCls = isVictory ? 'border-emerald-800/50' : 'border-red-800/50'
  const glowCls = isVictory ? 'shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'shadow-[0_0_40px_rgba(239,68,68,0.2)]'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`relative bg-gray-950 border ${borderCls} ${glowCls} rounded-2xl max-w-lg w-full overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />

        <div className="relative p-8 text-center">
          <p className="text-5xl mb-3 animate-fade-in">{resultIcon}</p>
          <h2 className={`text-3xl font-bold tracking-wide ${isVictory ? 'text-emerald-400' : 'text-red-400'}`}>
            {resultLabel}
          </h2>
          <p className="text-sm text-gray-500 mt-1 font-mono">{result.dungeonName}</p>

          {result.groupRun && (
            <p className="text-xs text-amber-500/80 mt-2">
              👥 Run grupal · {result.totalHeroes} héroes
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-900/60 rounded-lg border border-amber-900/20 p-3">
              <div className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Rondas</div>
              <div className="text-lg font-bold text-gray-200">⚔️ {result.rounds}</div>
            </div>
            <div className="bg-gray-900/60 rounded-lg border border-amber-900/20 p-3">
              <div className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">EP c/u</div>
              <div className="text-lg font-bold text-amber-400">⭐ +{Math.round(result.epGained / (result.totalHeroes ?? 1))}</div>
            </div>
            <div className="bg-gray-900/60 rounded-lg border border-amber-900/20 p-3">
              <div className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Oro c/u</div>
              <div className="text-lg font-bold text-yellow-300">💰 +{Math.round(result.goldGained / (result.totalHeroes ?? 1))}</div>
            </div>
            <div className="bg-gray-900/60 rounded-lg border border-amber-900/20 p-3">
              <div className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Resultado</div>
              <div className={`text-lg font-bold ${isVictory ? 'text-emerald-400' : 'text-red-400'}`}>
                {isVictory ? '✅ Éxito' : '❌ Fracaso'}
              </div>
            </div>
          </div>

          {result.heroesFinalState?.length > 1 && (
            <div className="mt-4 pt-4 border-t border-amber-900/20">
              <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-2">Estado del grupo</p>
              <div className="space-y-1.5">
                {result.heroesFinalState.map((h: any, i: number) => {
                  const maxHp = h.hpMax ?? 100
                  const hpPct = Math.min(100, Math.max(0, (h.hp / maxHp) * 100))
                  let barCls: string
                  if (hpPct > 50) barCls = 'bg-emerald-500'
                  else if (hpPct > 20) barCls = 'bg-amber-500'
                  else barCls = 'bg-red-500'
                  return (
                    <div key={"hero-" + i} className="flex items-center gap-2 text-xs">
                      <span className="w-20 text-right text-gray-400 truncate">{h.name ?? h.id.substring(0, 8)}</span>
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${hpPct}%` }} />
                      </div>
                      <span className="w-16 text-left font-mono text-gray-400">{h.hp}/{maxHp}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {result.heroesFinalState?.length === 1 && (
            <div className="mt-4 pt-4 border-t border-amber-900/20">
              {(() => {
                const h = result.heroesFinalState[0]
                const maxHp = h.hpMax ?? 100
                const hpPct = Math.min(100, Math.max(0, (h.hp / maxHp) * 100))
                let hpCls: string
                if (hpPct > 50) hpCls = 'text-emerald-400'
                else if (hpPct > 20) hpCls = 'text-amber-400'
                else hpCls = 'text-red-400'
                let barCls: string
                if (hpPct > 50) barCls = 'bg-emerald-500'
                else if (hpPct > 20) barCls = 'bg-amber-500'
                else barCls = 'bg-red-500'
                return (
                  <div>
                    <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-2">HP final</p>
                    <div className="flex items-center gap-3">
                      <span className={hpCls}>{h.hp}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${hpPct}%` }} />
                      </div>
                      <span className="text-gray-500">{maxHp}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {result.loot?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-amber-900/20">
              <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-2">📦 Botín</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {result.loot.map((l: any, i: number) => (
                  <span key={"loot-" + i} className="text-xs bg-gray-800/60 border border-amber-900/20 rounded px-2 py-0.5 text-gray-300">
                    {l.name}{l.qty > 1 ? ` ×${l.qty}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.levelUp && (
            <div className="mt-4 p-4 rounded-lg bg-amber-900/30 border border-amber-700/40 animate-fade-in">
              <p className="text-amber-400 font-bold text-lg">⬆️ ¡Subiste de nivel!</p>
              <p className="text-amber-300">Nv. {result.levelUp.newLevel}</p>
              {result.levelUp.newHpMax && (
                <p className="text-xs text-gray-400 mt-1">HP máx: {result.levelUp.newHpMax}</p>
              )}
            </div>
          )}

          {result.runId && (
            <button type="button" onClick={() => router.push(`/dungeon/report/${result.runId}`)}
              className="mt-5 text-xs text-amber-500 hover:text-amber-400 underline transition-colors">
              📜 Ver reporte completo →
            </button>
          )}

          <button type="button" onClick={onClose}
            className="mt-5 px-6 py-2 rounded-lg bg-gray-800/60 border border-gray-700/50 text-sm text-gray-300 hover:bg-gray-700/60 hover:border-gray-600/50 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
