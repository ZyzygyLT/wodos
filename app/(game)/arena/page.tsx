"use client"

import { useEffect, useState, useCallback } from "react"

interface TournamentMatch {
  id: string; round: number; matchNumber: number
  hero1Id: string | null; hero2Id: string | null; winnerId: string | null
  hero1?: { id: string; name: string; level: number; class?: { icon: string } } | null
  hero2?: { id: string; name: string; level: number; class?: { icon: string } } | null
  winner?: { id: string; name: string } | null
  log?: any; playedAt?: string | null
}

interface Tournament {
  id: string; name: string; status: string
  startsAt: string; endsAt: string
  maxPlayers: number; minElo: number
  rewards: any
  participants: {
    id: string; heroId: string; seed: number; eliminated: boolean
    hero: { id: string; name: string; level: number; eloRating: number; class?: { icon: string; name: string } }
  }[]
  matches: TournamentMatch[]
}

function DuelResultModal({ duelResult, hero, onClose }: Readonly<{ duelResult: any; hero: any; onClose: () => void }>) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`bg-gray-900 border ${duelResult.winner === hero.name ? "border-green-700" : "border-red-700"} rounded-2xl p-8 max-w-md w-full text-center`}>
        <p className="text-4xl mb-2">{duelResult.winner === hero.name ? "🏆" : "💀"}</p>
        <h2 className="text-2xl font-bold mb-1">
          {duelResult.winner === hero.name ? "¡Victoria!" : "Derrota"}
        </h2>
        <p className="text-sm text-gray-400 mb-4">Rondas: {duelResult.rounds}</p>
        <div className="space-y-1 text-sm mb-4">
          <p>ELO: <span className={duelResult.eloChange >= 0 ? "text-green-400" : "text-red-400"}>
            {duelResult.eloChange >= 0 ? "+" : ""}{duelResult.eloChange}
          </span></p>
          <p>vs <strong>{duelResult.loser === hero.name ? duelResult.winner : duelResult.loser}</strong></p>
        </div>
        {duelResult.defenseStats && (
          <div className="text-xs space-y-1 mb-4 p-2 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400 font-semibold">🛡️ Defensa</p>
            <p className="text-gray-300">
              Tú: 💨{duelResult.defenseStats.hero.dodged} 🛡️{duelResult.defenseStats.hero.blocked} 🔮{duelResult.defenseStats.hero.barriered}
            </p>
            <p className="text-gray-300">
              Rival: 💨{duelResult.defenseStats.enemy.dodged} 🛡️{duelResult.defenseStats.enemy.blocked} 🔮{duelResult.defenseStats.enemy.barriered}
            </p>
          </div>
        )}
        {duelResult.log?.map((m: string, i: number) => (
          <p key={`log-${i}_${m}`} className="text-xs text-gray-500">{m}</p>
        ))}
        <button onClick={onClose}
          className="mt-4 px-6 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
          Cerrar
        </button>
      </div>
    </div>
  )
}

function getTournamentStatusClass(status: string): string {
  if (status === "registration") return "bg-green-800 text-green-300"
  if (status === "active") return "bg-yellow-800 text-yellow-300"
  return "bg-gray-700 text-gray-400"
}

function getTournamentStatusLabel(status: string): string {
  if (status === "registration") return "Abierto"
  if (status === "active") return "Activo"
  return "Finalizado"
}

function getPositionLabel(pos: string): string {
  if (pos === "1st") return "🥇 1°"
  if (pos === "2nd") return "🥈 2°"
  if (pos === "3rd") return "🥉 3°"
  return `#${pos}`
}

function getRoundLabel(round: number, maxRound: number): string {
  if (maxRound === 1) return "Final"
  if (round === maxRound) return "Final"
  if (round === maxRound - 1) return "Semifinal"
  return `Ronda ${round}`
}

function getMatchRowClass(isWinner: boolean, hasWinner: boolean): string {
  if (isWinner) return "bg-green-900/30 text-green-300"
  if (hasWinner) return "text-gray-600"
  return "text-gray-300"
}

export default function ArenaPage() {
  const [hero, setHero] = useState<any>(null)
  const [ranking, setRanking] = useState<any[]>([])
  const [duelResult, setDuelResult] = useState<any>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [tab, setTab] = useState<"ranking" | "tournament" | "history">("ranking")
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [registering, setRegistering] = useState(false)
  const [duelHistory, setDuelHistory] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    try {
      const [heroRes, rankRes, tRes, histRes] = await Promise.all([
        fetch("/api/hero"),
        fetch("/api/arena"),
        fetch("/api/arena/tournament"),
        fetch("/api/arena/history"),
      ])
      if (heroRes.status === 401 || heroRes.status === 404) return
      setHero(await heroRes.json())
      setRanking(await rankRes.json())
      if (tRes.ok) setTournament(await tRes.json())
      if (histRes.ok) {
        const histData = await histRes.json()
        setDuelHistory(histData.duels ?? [])
      }
    } catch {}
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function duel(opponentId: string) {
    setLoading(opponentId)
    try {
      const res = await fetch("/api/arena/duel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero2Id: opponentId }),
      })
      const data = await res.json()
      if (res.ok) { setDuelResult(data); fetchData() }
      else alert(data.error || "Error en el duelo")
    } finally { setLoading(null) }
  }

  async function joinTournament() {
    setRegistering(true)
    try {
      const res = await fetch("/api/arena/tournament", { method: "POST" })
      const data = await res.json()
      if (res.ok) fetchData()
      else alert(data.error || "Error")
    } finally { setRegistering(false) }
  }

  const tMaxRound = tournament ? Math.max(0, ...tournament.matches.map(m => m.round)) : 0
  const isParticipant = tournament?.participants.some(p => p.heroId === hero?.id)

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <>
      {duelResult && <DuelResultModal duelResult={duelResult} hero={hero} onClose={() => setDuelResult(null)} />}

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button onClick={() => setTab("ranking")}
            className={`px-6 py-3 text-sm font-medium transition ${tab === "ranking" ? "text-amber-400 border-b-2 border-amber-500" : "text-gray-500 hover:text-gray-300"}`}>
            🏆 Ranking
          </button>
          <button onClick={() => setTab("tournament")}
            className={`px-6 py-3 text-sm font-medium transition ${tab === "tournament" ? "text-amber-400 border-b-2 border-amber-500" : "text-gray-500 hover:text-gray-300"}`}>
            ⚔️ Torneo {tournament && <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
              getTournamentStatusClass(tournament.status)
            }`}>
              {getTournamentStatusLabel(tournament.status)}
            </span>}
          </button>
          <button onClick={() => setTab("history")}
            className={`px-6 py-3 text-sm font-medium transition ${tab === "history" ? "text-amber-400 border-b-2 border-amber-500" : "text-gray-500 hover:text-gray-300"}`}>
            📜 Historial
          </button>
        </div>

        {/* Ranking tab */}
        {tab === "ranking" && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Nombre</th>
                    <th className="p-3 text-left">Clase</th>
                    <th className="p-3 text-center">Nv.</th>
                    <th className="p-3 text-center">ELO</th>
                    <th className="p-3 text-center">W/L</th>
                    <th className="p-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => {
                    const isMe = r.id === hero.id
                    return (
                      <tr key={r.id} className={`border-t border-gray-800 ${isMe ? "bg-yellow-900/20" : ""}`}>
                        <td className="p-3">{r.rank}</td>
                        <td className="p-3 font-medium">{r.name}{isMe && " (tú)"}</td>
                        <td className="p-3">{r.classIcon} {r.className}</td>
                        <td className="p-3 text-center">{r.level}</td>
                        <td className="p-3 text-center text-purple-400 font-mono">{r.elo}</td>
                        <td className="p-3 text-center text-xs">
                          <span className="text-green-400">{r.wins}</span>
                          <span className="text-gray-600">/</span>
                          <span className="text-red-400">{r.losses}</span>
                        </td>
                        <td className="p-3 text-center">
                          {isMe ? (
                            <span className="text-gray-600 text-xs">—</span>
                          ) : (
                            <button onClick={() => duel(r.id)} disabled={loading === r.id}
                              className="px-2 py-1 rounded bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-xs transition">
                              {loading === r.id ? "..." : "⚔️ Retar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tournament tab */}
        {tab === "tournament" && (
          <div className="space-y-4">
            {tournament ? (
              <>
                {/* Tournament header */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-100">{tournament.name}</h3>
                      <p className="text-xs text-gray-500">
                        {tournament.participants.length}/{tournament.maxPlayers} participantes
                        {tournament.minElo > 0 && ` · ELO mín. ${tournament.minElo}`}
                      </p>
                    </div>
                    {tournament.status === "registration" && !isParticipant && (
                      <button onClick={joinTournament} disabled={registering || tournament.participants.length >= tournament.maxPlayers}
                        className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-sm font-medium transition">
                        {registering ? "..." : "📋 Inscribirse"}
                      </button>
                    )}
                    {isParticipant && (
                      <span className="text-xs text-green-400 bg-green-900/30 border border-green-800 rounded px-2 py-1">
                        ✓ Inscripto
                      </span>
                    )}
                  </div>

                  {/* Rewards */}
                  {tournament.rewards && (
                    <div className="bg-gray-800/50 rounded-lg p-3 text-xs space-y-1">
                      <p className="text-amber-400 font-semibold mb-1">💰 Recompensas</p>
                      {Object.entries(tournament.rewards).map(([pos, reward]: [string, any]) => (
                        <div key={pos} className="flex justify-between text-gray-400">
                          <span>{getPositionLabel(pos)}</span>
                          <span>{reward.fame} fama · {reward.gold} oro</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Participants list (during registration) */}
                {tournament.status === "registration" && (
                  <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-3 border-b border-gray-800 text-xs font-bold text-gray-400">
                      📋 Participantes inscriptos
                    </div>
                    <div className="divide-y divide-gray-800">
                      {tournament.participants.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">Nadie inscripto aún</div>
                      ) : (
                        tournament.participants.map(p => (
                          <div key={p.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                            <span className="text-gray-500 text-xs">#{p.seed || "?"}</span>
                            <span>{p.hero.class?.icon} {p.hero.name}</span>
                            <span className="text-gray-500 text-xs ml-auto">Nv.{p.hero.level} · ELO {p.hero.eloRating}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Bracket (during active) */}
                {tournament.status === "active" && tournament.matches.length > 0 && (
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <h3 className="text-sm font-bold text-gray-400 mb-4">⚔️ Bracket del torneo</h3>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {Array.from({ length: tMaxRound }, (_, i) => i + 1).map(round => {
                        const roundMatches = tournament.matches.filter(m => m.round === round)
                        const roundLabel = getRoundLabel(round, tMaxRound)
                        return (
                          <div key={round} className="min-w-[200px]">
                            <p className="text-xs text-gray-500 font-semibold mb-2 text-center">{roundLabel}</p>
                            <div className="space-y-2">
                              {roundMatches.map(m => {
                                const p1 = m.hero1
                                const p2 = m.hero2
                                const w = m.winnerId
                                return (
                                  <div key={m.id} className="bg-gray-800 rounded-lg border border-gray-700 p-2 space-y-1">
                                    <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${getMatchRowClass(w === m.hero1Id, !!w)}`}>
                                      <span>{p1?.class?.icon ?? "—"}</span>
                                      <span className="flex-1 truncate">{p1?.name ?? "BYE"}</span>
                                      {w && w === m.hero1Id && <span className="text-green-400">✓</span>}
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${getMatchRowClass(w === m.hero2Id, !!w)}`}>
                                      <span>{p2?.class?.icon ?? "—"}</span>
                                      <span className="flex-1 truncate">{p2?.name ?? "BYE"}</span>
                                      {w && w === m.hero2Id && <span className="text-green-400">✓</span>}
                                    </div>
                                    {m.playedAt && (
                                      <p className="text-[9px] text-gray-600 text-right">
                                        {new Date(m.playedAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
                <p className="text-4xl mb-3">⚔️</p>
                <p className="text-gray-400 text-sm">No hay torneo activo en este momento.</p>
                <p className="text-gray-600 text-xs mt-1">Se crea automáticamente cada 7 días.</p>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {duelHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                <p className="text-3xl mb-2">📜</p>
                <p>No tenés duelos registrados</p>
                <p className="text-xs text-gray-600 mt-1">Costo: 10💰 · Cooldown: 5 min</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {duelHistory.map((d: any) => {
                  const isHero1 = d.hero1Id === hero?.id
                  const opponent = isHero1 ? d.hero2 : d.hero1
                  const won = d.winnerId === hero?.id
                  const eloChange = isHero1 ? d.eloChange1 : d.eloChange2
                  return (
                    <div key={d.id} className={`px-4 py-3 flex items-center gap-3 ${won ? "bg-green-900/10" : "bg-red-900/10"}`}>
                      <span className="text-xl">{won ? "🏆" : "💀"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${won ? "text-green-400" : "text-red-400"}`}>
                            {won ? "Victoria" : "Derrota"}
                          </span>
                          <span className="text-xs text-gray-500">vs</span>
                          <span className="text-sm">{opponent?.class?.icon} {opponent?.name}</span>
                          <span className="text-[10px] text-gray-600">Nv.{opponent?.level}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={`text-xs font-mono ${eloChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                            ELO {eloChange >= 0 ? "+" : ""}{eloChange}
                          </span>
                          <span className="text-[10px] text-gray-600">{d.rounds} rondas</span>
                          <span className="text-[10px] text-gray-600">{new Date(d.foughtAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
