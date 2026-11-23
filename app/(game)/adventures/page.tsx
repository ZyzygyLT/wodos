"use client"

import logger from "@/lib/logger"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function AdventuresPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/adventures", { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 401) { router.push("/login"); return null }
        if (res.status === 404) return null
        return res.json()
      })
      .then((result) => setData(result))
      .catch((error) => {
        if (error.name !== "AbortError") setError("Error al cargar aventuras")
      })
      .finally(() => setLoading(false))

    fetch("/api/adventures/history", { signal: controller.signal })
      .then(async (res) => res.ok ? res.json() : null)
      .then((result) => { if (result) setHistory(result.history ?? []) })
      .catch((error) => {
        if (error.name !== "AbortError") logger.error("adventures", "Failed to fetch adventures", error)
      })

    return () => controller.abort()
  }, [router])

  async function startAdventure(adventureId: number) {
    setStarting(adventureId)
    setError(null)
    try {
      const res = await fetch("/api/adventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adventureId }),
      })
      if (!res.ok) { const e = await res.json(); setError(e.error); return }
      router.push("/adventures/active")
    } catch { setError("Error al iniciar aventura") } finally {
      setStarting(null)
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Cargando aventuras...</div>

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-amber-300">🏕️ Aventuras</h1>
            <p className="text-gray-400 mt-1">Misiones en solitario — enfréntate a peligros y obtén recompensas</p>
          </div>
          {data && (
            <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-400">Energía:</span>
              <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${(data.energy / data.energyMax) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-emerald-400">{data.energy}/{data.energyMax}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        {data?.hasActiveAdventure && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 mb-6">
            <p className="text-amber-300 font-semibold">{data.blockingAdventureStatus === 'completed' ? '🎁 Tenés recompensas pendientes' : data.blockingAdventureStatus === 'failed' ? '🎒 Tenés botín pendiente de recuperar' : '📜 Tenés una aventura en curso'}</p>
            <button
              onClick={() => router.push("/adventures/active")}
              className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm"
            >
              {data.blockingAdventureStatus === 'completed' ? 'Reclamar recompensas' : data.blockingAdventureStatus === 'failed' ? 'Recuperar botín' : 'Continuar aventura'}
            </button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {data?.adventures?.map((adv: any) => (
            <div key={adv.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5 hover:border-amber-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-amber-200">{adv.icon} {adv.name}</h3>
                  {adv.faction && (
                    <span
                      className="inline-block text-xs px-2 py-0.5 rounded mt-1"
                      style={{ backgroundColor: adv.faction.color + "33", color: adv.faction.color }}
                    >
                      {adv.faction.icon} {adv.faction.name}
                    </span>
                  )}
                </div>
                <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                  Nivel {adv.levelReq}–{adv.maxLevel}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-3">{adv.description}</p>
              {adv.completionRewards && (
                <div className="rounded-lg border border-emerald-900/50 bg-gray-900/60 px-3 py-2 mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300 mb-1">
                    Recompensa por completar
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-300">
                    <span>
                      💰 {adv.completionRewards.goldMin === adv.completionRewards.goldMax
                        ? adv.completionRewards.goldMin
                        : `${adv.completionRewards.goldMin}–${adv.completionRewards.goldMax}`} oro
                    </span>
                    <span>⭐ {adv.completionRewards.ep} EP</span>
                    <span>🏆 {adv.completionRewards.fame} fama</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <span>⏱️ {adv.duration} min</span>
                <span>⚡ {adv.energyCost} energía</span>
                {!adv.canAfford && !data?.hasActiveAdventure && (
                  <span className="text-amber-400">Te faltan {adv.energyCost - data.energy} energía</span>
                )}
              </div>
              <button
                onClick={() => startAdventure(adv.id)}
                disabled={starting !== null || !adv.canAfford || data?.hasActiveAdventure}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                  adv.canAfford
                    ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                {starting === adv.id ? "Iniciando..." : data?.hasActiveAdventure ? (data.blockingAdventureStatus === 'completed' ? "Reclama tus recompensas primero" : data.blockingAdventureStatus === 'failed' ? "Recupera tu botín primero" : "Ya tienes una aventura activa") : adv.canAfford ? "Iniciar aventura" : "Energía insuficiente"}
              </button>
            </div>
          ))}
        </div>

        {data?.adventures?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay aventuras disponibles para tu nivel
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold text-amber-300 mb-4">📋 Historial</h2>
            <div className="space-y-2">
              {history.map((h: any) => (
                <div key={h.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{h.adventureIcon}</span>
                    <div>
                      <p className="font-semibold text-gray-200">{h.adventureName}</p>
                      <p className="text-xs text-gray-500">
                        {h.status === 'claimed' && h.outcome === 'defeated' ? '🎒 Botín reclamado tras derrota' : h.status === 'claimed' ? '✅ Reclamado' : h.status === 'completed' ? '🎉 Completado' : h.outcome === 'abandoned' ? '↩️ Abandonada' : '💀 Fallado'}
                        {h.completedAt && ` · ${new Date(h.completedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">⚡ {h.energySpent} energía</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
