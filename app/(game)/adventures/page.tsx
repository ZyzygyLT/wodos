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
  const [selectedAdventure, setSelectedAdventure] = useState<any>(null)
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
      setSelectedAdventure(null)
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

        {data?.heroResources && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800/70 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold text-red-300">❤️ Salud del héroe</span>
                <span className="tabular-nums text-gray-300">{data.heroResources.hpCurrent}/{data.heroResources.hpMax}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{ width: `${data.heroResources.hpMax > 0 ? Math.max(0, Math.min(100, data.heroResources.hpCurrent / data.heroResources.hpMax * 100)) : 0}%` }}
                />
              </div>
            </div>
            {data.heroResources.hpCurrent <= 0 && (
              <a href="/inventory" className="rounded-md border border-amber-700/60 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-950/40">
                Recuperar salud en inventario
              </a>
            )}
          </div>
        )}

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
              {adv.lore && (
                <details className="mb-4 rounded-lg border border-gray-700/70 bg-gray-900/40 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                    📖 Conocer el trasfondo
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                    {adv.lore}
                  </p>
                </details>
              )}
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
              {adv.startBlockReason && !data?.hasActiveAdventure && (
                <p className="mb-3 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  {adv.startBlockReason}
                  {" "}
                  <a href="/inventory" className="font-semibold underline underline-offset-2">Ir al inventario</a>
                </p>
              )}
              <button
                onClick={() => setSelectedAdventure(adv)}
                disabled={starting !== null || !adv.canAfford || !adv.canStart || data?.hasActiveAdventure}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                  adv.canAfford && adv.canStart
                    ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                {starting === adv.id ? "Iniciando..." : data?.hasActiveAdventure ? (data.blockingAdventureStatus === 'completed' ? "Reclama tus recompensas primero" : data.blockingAdventureStatus === 'failed' ? "Recupera tu botín primero" : "Ya tienes una aventura activa") : !adv.canStart ? "Salud insuficiente" : adv.canAfford ? "Iniciar aventura" : "Energía insuficiente"}
              </button>
            </div>
          ))}
        </div>

        {data?.adventures?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay aventuras disponibles para tu nivel
          </div>
        )}


        {selectedAdventure && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adventure-confirm-title"
          >
            <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
              <div className="mb-5 flex items-start gap-3">
                <span className="text-3xl" aria-hidden="true">{selectedAdventure.icon}</span>
                <div>
                  <h2 id="adventure-confirm-title" className="text-xl font-bold text-amber-300">
                    Preparar expedición: {selectedAdventure.name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Revisa el coste y el estado del héroe antes de partir.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                  <p className="text-xs text-gray-400">❤️ Salud actual</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-red-300">
                    {data?.heroResources?.hpCurrent ?? "—"}/{data?.heroResources?.hpMax ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                  <p className="text-xs text-gray-400">🔷 Maná actual</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-blue-300">
                    {data?.heroResources?.mpCurrent ?? "—"}/{data?.heroResources?.mpMax ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                  <p className="text-xs text-gray-400">⚡ Coste de energía</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-emerald-300">
                    {selectedAdventure.energyCost} · Disponibles: {data?.energy ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                  <p className="text-xs text-gray-400">⏱️ Duración estimada</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-gray-200">
                    {selectedAdventure.duration} min
                  </p>
                </div>
              </div>

              {selectedAdventure.completionRewards && (
                <div className="mt-4 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    Recompensa por completar
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-200">
                    <span>💰 {selectedAdventure.completionRewards.goldMin === selectedAdventure.completionRewards.goldMax
                      ? selectedAdventure.completionRewards.goldMin
                      : `${selectedAdventure.completionRewards.goldMin}–${selectedAdventure.completionRewards.goldMax}`} oro</span>
                    <span>⭐ {selectedAdventure.completionRewards.ep} EP</span>
                    <span>🏆 {selectedAdventure.completionRewards.fame} fama</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Los objetos y materiales, si los hay, dependen de las probabilidades de recompensa.
                  </p>
                </div>
              )}

              <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-200">
                La energía se consume al partir. Si abandonas la expedición o eres derrotado, no se devuelve.
                {selectedAdventure.requiresCombat
                  ? " Esta aventura contiene combates: prepara al héroe con salud suficiente y revisa su equipo."
                  : " Esta ruta no contiene encuentros de combate."}
              </p>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedAdventure(null)}
                  disabled={starting !== null}
                  className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-600 disabled:opacity-50"
                >
                  Volver a revisar
                </button>
                <button
                  type="button"
                  onClick={() => startAdventure(selectedAdventure.id)}
                  disabled={starting !== null || !selectedAdventure.canAfford || !selectedAdventure.canStart || data?.hasActiveAdventure}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
                >
                  {starting === selectedAdventure.id ? "Preparando..." : "Confirmar y partir"}
                </button>
              </div>
            </div>
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
