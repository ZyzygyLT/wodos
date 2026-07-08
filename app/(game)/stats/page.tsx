"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

interface Summary {
  totalRuns: number; victories: number; defeats: number; winRate: number
  totalEp: number; totalGold: number; totalFame: number
  totalLevelsCleared: number
  firstRun: string | null; lastRun: string | null
}

interface DungeonStat {
  name: string; icon: string; runs: number; wins: number
  totalEp: number; totalGold: number; difficulty: number; difficultyLabel: string
}

interface EnemyKill {
  name: string; icon: string; count: number
}

interface CombatStats {
  totalDamageDealt: number; totalDamageTaken: number; totalHealingDone: number
  totalActions: number; criticalHits: number; dodges: number; blocks: number
  avgDamagePerAction: number
}

function StatCard({ icon, label, value, color = "text-gray-200", sub }: Readonly<{
  icon: string; label: string; value: string | number; color?: string; sub?: string
}>) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <p className="text-xs text-gray-500 mb-1">{icon} {label}</p>
      <p className={`text-xl font-bold ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function winRateStyle(wr: number): { text: string; bg: string } {
  if (wr >= 80) return { text: "text-green-400", bg: "bg-green-500" }
  if (wr >= 50) return { text: "text-yellow-400", bg: "bg-yellow-500" }
  return { text: "text-red-400", bg: "bg-red-500" }
}

export default function StatsPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [dungeonStats, setDungeonStats] = useState<DungeonStat[]>([])
  const [topEnemies, setTopEnemies] = useState<EnemyKill[]>([])
  const [combat, setCombat] = useState<CombatStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/hero/stats")
      if (res.status === 401) { router.push("/api/auth/signin"); return }
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary)
        setDungeonStats(data.dungeonStats)
        setTopEnemies(data.topEnemies)
        setCombat(data.combatStats)
      }
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>
  if (!summary) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Error al cargar</div>

  const daysActive = summary.firstRun
    ? Math.max(1, Math.ceil((Date.now() - new Date(summary.firstRun).getTime()) / 86400000))
    : 1
  const runsPerDay = (summary.totalRuns / daysActive).toFixed(1)

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-100">📊 Estadísticas de Combate</h1>

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon="⚔️" label="Mazmorras" value={summary.totalRuns} color="text-amber-400" sub={`${runsPerDay}/día`} />
        <StatCard icon="🏆" label="Victoria" value={`${summary.winRate}%`} color="text-green-400" sub={`${summary.victories}V / ${summary.defeats}D`} />
        <StatCard icon="⭐" label="EP total" value={summary.totalEp} color="text-yellow-400" />
        <StatCard icon="🪙" label="Oro total" value={summary.totalGold} color="text-yellow-300" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon="🏆" label="Fama" value={summary.totalFame} color="text-amber-400" />
        <StatCard icon="🗺️" label="Niveles limpiados" value={summary.totalLevelsCleared} color="text-blue-400" />
        <StatCard icon="📅" label="Días activo" value={daysActive} color="text-gray-300" />
        <StatCard icon="⏱️" label="Última run" value={summary.lastRun ? new Date(summary.lastRun).toLocaleDateString() : "Nunca"} color="text-gray-400" />
      </div>

      {/* Combat stats */}
      {combat && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-sm font-bold text-gray-400 mb-3">⚔️ Stats de combate</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">{combat.totalDamageDealt.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">Daño infligido</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-orange-400">{combat.totalDamageTaken.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">Daño recibido</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{combat.totalHealingDone.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">Curación total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-purple-400">{combat.avgDamagePerAction}</p>
              <p className="text-[10px] text-gray-500">Daño promedio/acción</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-800">
            <div className="text-center">
              <p className="text-sm font-bold text-yellow-400">💥 {combat.criticalHits}</p>
              <p className="text-[10px] text-gray-500">Críticos</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-cyan-400">💨 {combat.dodges}</p>
              <p className="text-[10px] text-gray-500">Esquivas</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-yellow-300">🛡️ {combat.blocks}</p>
              <p className="text-[10px] text-gray-500">Bloqueos</p>
            </div>
          </div>
        </div>
      )}

      {/* Dungeon breakdown */}
      {dungeonStats.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-sm font-bold text-gray-400">🗺️ Mazmorras jugadas</h2>
          </div>
          <div className="divide-y divide-gray-800">
              {dungeonStats.map(d => {
              const wr = d.runs > 0 ? Math.round((d.wins / d.runs) * 100) : 0
              const wrSty = winRateStyle(wr)
              return (
                <div key={d.name} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">{d.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-200 truncate">{d.name}</p>
                      <span className="text-[10px] text-gray-600">{d.difficultyLabel}</span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-gray-500 mt-0.5">
                      <span>{d.runs} runs</span>
                      <span className={wrSty.text}>{wr}% victoria</span>
                      <span>⭐{d.totalEp} 🪙{d.totalGold}</span>
                    </div>
                  </div>
                  <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden shrink-0">
                    <div className={`h-full rounded-full ${wrSty.bg}`}
                      style={{ width: `${wr}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top enemies */}
      {topEnemies.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-sm font-bold text-gray-400">☠️ Enemigos más derrotados</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {topEnemies.map((e, i) => (
              <div key={"enemy-" + i} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-xs text-gray-600 w-5 text-right">#{i + 1}</span>
                <span className="text-xl">{e.icon}</span>
                <span className="text-sm text-gray-300 flex-1">{e.name}</span>
                <span className="text-sm font-bold text-red-400">{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.totalRuns === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">⚔️</p>
          <p className="text-gray-400">Aún no has completado ninguna mazmorra.</p>
          <p className="text-gray-600 text-sm mt-1">¡Entrá a una mazmorra para ver tus estadísticas!</p>
        </div>
      )}
    </div>
  )
}
