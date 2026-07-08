"use client"

import type { HeroStats } from "@/lib/combat-report-stats"
import { DAMAGE_ICONS, DAMAGE_LABELS } from "./constants"

export function StatsTable({ stats }: Readonly<{ stats: HeroStats[] }>) {
  if (stats.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No hay datos de combate estructurados para este reporte.</p>
  }

  return (
    <div className="space-y-4">
      {stats.map(s => {
        const atkPct = s.totalAttacks > 0 ? Math.round(s.successfulAttacks / s.totalAttacks * 100) : 0
        return (
          <div key={s.heroId} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">🧙 {s.heroName}</h3>
              <div className="text-xs text-gray-500">{s.totalActions} acciones</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Daño infligido</div>
                <div className="text-lg font-bold text-red-400">{s.totalDamageDealt.toLocaleString()}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Daño recibido</div>
                <div className="text-lg font-bold text-orange-400">{s.totalDamageTaken.toLocaleString()}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Curaciones</div>
                <div className="text-lg font-bold text-green-400">{s.totalHealingDone.toLocaleString()}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Kills</div>
                <div className="text-lg font-bold text-yellow-400">{s.kills}</div>
              </div>
            </div>
            <div className="mt-3 bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Efectividad en ataques</span>
                <span>{s.successfulAttacks}/{s.totalAttacks} ({atkPct}%)</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${atkPct}%` }} />
              </div>
            </div>
            {(s.dodged > 0 || s.blocked > 0 || s.barriered > 0) && (
              <div className="mt-2 bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1.5">🛡️ Defensa</div>
                <div className="flex gap-3 text-sm">
                  <div className="flex items-center gap-1"><span>💨</span><span className="text-gray-300">{s.dodged}</span><span className="text-gray-500 text-xs">esquivados</span></div>
                  <div className="flex items-center gap-1"><span>🛡️</span><span className="text-gray-300">{s.blocked}</span><span className="text-gray-500 text-xs">bloqueos</span></div>
                  <div className="flex items-center gap-1"><span>🔮</span><span className="text-gray-300">{s.barriered}</span><span className="text-gray-500 text-xs">barreras</span></div>
                </div>
              </div>
            )}
            {s.totalDamageDealt > 0 && (
              <div className="mt-2 bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1.5">Desglose por tipo de daño</div>
                <div className="space-y-1">
                  {Object.entries(s.damageByType).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([t, v]) => (
                    <div key={t} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-center">{DAMAGE_ICONS[t] ?? '💥'}</span>
                      <span className="w-20 text-gray-400">{DAMAGE_LABELS[t] ?? t}</span>
                      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${v / s.totalDamageDealt * 100}%` }} />
                      </div>
                      <span className="w-16 text-right font-mono text-gray-300">{v.toLocaleString()}</span>
                      <span className="w-10 text-right text-gray-500">{Math.round(v / s.totalDamageDealt * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
