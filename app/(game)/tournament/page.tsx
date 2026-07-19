"use client"

import logger from "@/lib/logger"
import { useEffect, useState, useCallback } from "react"
import { useToast } from "@/hooks/useToast"

export default function TournamentPage() {
  const [hero, setHero] = useState<any>(null)
  const [tournament, setTournament] = useState<any>(null)
  const { toast: message, show: setMessage, dismiss } = useToast()
  const [loading, setLoading] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [heroRes, tourRes] = await Promise.all([
        fetch("/api/hero"),
        fetch("/api/arena/tournament"),
      ])
      if (heroRes.status === 401 || heroRes.status === 404) return
      setHero(await heroRes.json())
      setTournament(await tourRes.json())
    } catch (e) { logger.error('tournament', 'Failed to fetch tournament', e) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function register() {
    setLoading(true)
    try {
      const res = await fetch("/api/arena/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json()
      setLoading(false)
      if (res.ok) {
        setMessage("✅ Te inscribiste al torneo!")
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setLoading(false); setMessage("❌ Error de red") }
  }

  async function advance() {
    setAdvancing(true)
    try {
      const res = await fetch("/api/arena/tournament/advance", { method: "POST" })
      const data = await res.json()
      setAdvancing(false)
      if (res.ok) {
        setMessage(`✅ Torneo avanzado — estado: ${data.status}`)
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setAdvancing(false); setMessage("❌ Error de red") }
  }

  const isRegistered = tournament?.participants?.some((p: any) => p.heroId === hero?.id)

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]" /></div></div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => dismiss()}>
          {message}
        </button>
      )}

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {tournament ? (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{tournament.name}</h2>
                  <p className="text-sm text-gray-400 capitalize">Estado: {tournament.status}</p>
                  <p className="text-xs text-gray-500">
                    Inscritos: {tournament.participants?.length ?? 0}/{tournament.maxPlayers}
                  </p>
                </div>
                {tournament.status === "registration" && !isRegistered && (
                  <button onClick={register} disabled={loading}
                    className="px-4 py-2 rounded-lg bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-sm transition">
                    {loading ? "..." : "Inscribirse"}
                  </button>
                )}
                {isRegistered && tournament.status === "registration" && (
                  <button onClick={advance} disabled={advancing}
                    className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm transition">
                    {advancing ? "..." : "📊 Generar bracket"}
                  </button>
                )}
                {isRegistered && tournament.status !== "registration" && tournament.status !== "completed" && (
                  <button onClick={advance} disabled={advancing}
                    className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-sm transition">
                    {advancing ? "..." : "⚔️ Jugar ronda"}
                  </button>
                )}
                {tournament.status === "completed" && (
                  <span className="text-yellow-400 text-sm">🏆 Torneo finalizado</span>
                )}
              </div>
            </div>

            {tournament.participants?.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800 font-bold text-sm">
                  Participantes ({tournament.participants.length})
                </div>
                <div className="divide-y divide-gray-800">
                  {tournament.participants.map((p: any) => (
                    <div key={p.id} className="p-3 flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-6 text-right">#{p.seed || "—"}</span>
                      <span className="text-sm font-medium">{p.hero.name}</span>
                      <span className="text-xs text-gray-400">{p.hero.class?.icon} {p.hero.class?.name}</span>
                      <span className="text-xs text-purple-400 ml-auto">{p.hero.eloRating} ELO</span>
                      {p.eliminated && <span className="text-xs text-red-400">Eliminado</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tournament.matches?.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800 font-bold text-sm">
                  Bracket
                </div>
                <div className="divide-y divide-gray-800">
                  {tournament.matches.map((m: any) => {
                    const h1 = tournament.participants?.find((p: any) => p.heroId === m.hero1Id)
                    const h2 = tournament.participants?.find((p: any) => p.heroId === m.hero2Id)
                    return (
                      <div key={m.id} className="p-3 flex items-center gap-3 text-sm">
                        <span className="text-xs text-gray-500">R{m.round}#{m.matchNumber}</span>
                        <span className={`font-medium ${m.winnerId === m.hero1Id ? "text-green-400" : ""}`}>
                          {h1?.hero?.name ?? "—"}
                        </span>
                        <span className="text-gray-600">vs</span>
                        <span className={`font-medium ${m.winnerId === m.hero2Id ? "text-green-400" : ""}`}>
                          {h2?.hero?.name ?? "—"}
                        </span>
                        {m.winnerId && <span className="text-xs text-green-400 ml-auto">🏆</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">🏆</p>
            <p className="text-gray-400">No hay torneo activo en este momento</p>
          </div>
        )}
      </div>
    </>
  )
}
