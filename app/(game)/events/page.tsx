"use client"

import { useEffect, useState, useCallback, useRef } from "react"

interface ClanInfo {
  id: string; name: string; tag: string; icon: string
}

interface ClanParticipation {
  clanId: string; score: number; claimed: boolean; clan: ClanInfo
}

interface HeroParticipation {
  heroId: string; progress: number; target: number; completed: boolean; claimedAt: string | null
}

interface EventData {
  id: string; name: string; description: string; type: string
  startsAt: string; endsAt: string; isActive: boolean
  rewards: { rank: string; fame?: number; gold?: number; title?: string }[]
  participations: ClanParticipation[]
  heroParticipations?: HeroParticipation[]
}

function getEventIcon(type: string): string {
  switch (type) {
    case "invasion": return "⚔️"
    case "dungeon": return "🏰"
    case "pvp": return "🛡️"
    case "crafting": return "🔨"
    case "boss": return "🐉"
    default: return "🎪"
  }
}

function getEventTypeName(type: string): string {
  switch (type) {
    case "invasion": return "Invasión"
    case "dungeon": return "Dungeon"
    case "pvp": return "PvP"
    case "crafting": return "Crafting"
    case "boss": return "Caza de Jefes"
    default: return "Evento"
  }
}

function getRewardLabel(rank: string): string {
  if (rank === "1") return "🥇 1er puesto"
  if (rank === "2-3") return "🥈 2do-3er"
  if (rank === "top10pct") return "🏅 Top 10%"
  if (rank === "participant") return "🎖️ Participante"
  return rank
}

function getCountdown(target: string): string {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return "Finalizado"
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function determineRewardTier(rank: number, total: number, rewards: { rank: string; fame?: number; gold?: number }[]): { fame: number; gold: number } | null {
  for (const r of rewards) {
    if (r.rank === "1" && rank === 1) return { fame: r.fame ?? 0, gold: r.gold ?? 0 }
    if (r.rank === "2-3" && (rank === 2 || rank === 3)) return { fame: r.fame ?? 0, gold: r.gold ?? 0 }
    if (r.rank === "top10pct" && rank <= Math.ceil(total * 0.1)) return { fame: r.fame ?? 0, gold: r.gold ?? 0 }
    if (r.rank === "participant") return { fame: r.fame ?? 0, gold: r.gold ?? 0 }
  }
  return null
}

export default function EventsPage() {
  const [hero, setHero] = useState<any>(null)
  const [activeEvents, setActiveEvents] = useState<EventData[]>([])
  const [pastEvents, setPastEvents] = useState<EventData[]>([])
  const [clan, setClan] = useState<any>(null)
  const [tab, setTab] = useState<"active" | "past">("active")
  const [contributing, setContributing] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchActive = useCallback(async () => {
    const [heroRes, eventsRes, clanRes] = await Promise.all([
      fetch("/api/hero"),
      fetch("/api/events"),
      fetch("/api/clan"),
    ])
    if (heroRes.status === 401 || heroRes.status === 404) return
    setHero(await heroRes.json())
    setActiveEvents(await eventsRes.json())
    setClan(await clanRes.json())
  }, [])

  const fetchPast = useCallback(async () => {
    const res = await fetch("/api/events?past=true")
    if (res.ok) setPastEvents(await res.json())
  }, [])

  useEffect(() => {
    fetchActive()
    intervalRef.current = setInterval(() => {
      setNow(Date.now())
    }, 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchActive])

  useEffect(() => { if (tab === "past" && pastEvents.length === 0) fetchPast() }, [tab, pastEvents.length, fetchPast])

  async function contributeClan(eventId: string) {
    if (!clan) return
    setContributing(eventId)
    const res = await fetch(`/api/events/${eventId}/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clanId: clan.id, kills: 1 }),
    })
    setContributing(null)
    if (res.ok) {
      setMessage("✅ Contribuiste al evento (clan)!")
      fetchActive()
    } else {
      const d = await res.json()
      setMessage(`❌ ${d.error}`)
    }
  }

  async function contributeHero(eventId: string) {
    setContributing(eventId)
    const res = await fetch(`/api/events/${eventId}/hero-contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1 }),
    })
    setContributing(null)
    if (res.ok) {
      setMessage("✅ +1 progreso personal!")
      fetchActive()
    } else {
      const d = await res.json()
      setMessage(`❌ ${d.error}`)
    }
  }

  async function claimClanReward(eventId: string) {
    setClaiming(eventId)
    const res = await fetch(`/api/events/${eventId}/claim`, { method: "POST" })
    setClaiming(null)
    if (res.ok) {
      setMessage("✅ Recompensas del clan reclamadas!")
      fetchPast()
    } else {
      const d = await res.json()
      setMessage(`❌ ${d.error}`)
    }
  }

  async function claimHeroReward(eventId: string) {
    setClaiming(eventId)
    const res = await fetch(`/api/events/${eventId}/hero-claim`, { method: "POST" })
    setClaiming(null)
    if (res.ok) {
      const d = await res.json()
      setMessage(`✅ Recompensa reclamada! 🏆${d.fame} 💰${d.gold}`)
      fetchActive()
      fetchPast()
    } else {
      const d = await res.json()
      setMessage(`❌ ${d.error}`)
    }
  }

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => setMessage(null)}>
          {message}
        </button>
      )}

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎪</span>
          <div>
            <h1 className="text-xl font-bold">Eventos Semanales</h1>
            <p className="text-xs text-gray-400">Completá objetivos y reclamá recompensas</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-xl border border-gray-800 p-1 w-fit">
          <button onClick={() => setTab("active")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "active" ? "bg-yellow-700 text-white" : "text-gray-400 hover:text-white"}`}>
            🎯 Activos
          </button>
          <button onClick={() => setTab("past")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "past" ? "bg-yellow-700 text-white" : "text-gray-400 hover:text-white"}`}>
            📜 Pasados
          </button>
        </div>

        {/* Active events */}
        {tab === "active" && (
          activeEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">📅</p>
              <p className="text-gray-400">No hay eventos activos en este momento</p>
            </div>
          ) : (
            activeEvents.map(ev => (
              <EventCard key={ev.id} ev={ev} clan={clan} hero={hero} now={now}
                contributing={contributing} onContributeClan={contributeClan} onContributeHero={contributeHero}
                claiming={claiming} onClaimClan={claimClanReward} onClaimHero={claimHeroReward} showClaim={false} />
            ))
          )
        )}

        {/* Past events */}
        {tab === "past" && (
          pastEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">📜</p>
              <p className="text-gray-400">No hay eventos pasados</p>
            </div>
          ) : (
            pastEvents.map(ev => (
              <EventCard key={ev.id} ev={ev} clan={clan} hero={hero} now={now}
                contributing={null} onContributeClan={() => {}} onContributeHero={() => {}}
                claiming={claiming} onClaimClan={claimClanReward} onClaimHero={claimHeroReward} showClaim={true} />
            ))
          )
        )}
      </div>
    </>
  )
}

function EventCard({ ev, clan, hero, now, contributing, onContributeClan, onContributeHero, claiming, onClaimClan, onClaimHero, showClaim }: Readonly<{
  ev: EventData; clan: any; hero: any; now: number
  contributing: string | null
  onContributeClan: (id: string) => void; onContributeHero: (id: string) => void
  claiming: string | null; onClaimClan: (id: string) => void; onClaimHero: (id: string) => void
  showClaim: boolean
}>) {
  const endsAt = new Date(ev.endsAt)
  const diff = endsAt.getTime() - now
  const isEnded = diff <= 0
  const countdown = getCountdown(ev.endsAt)
  let timeColor
  if (isEnded) timeColor = "text-red-400"
  else if (diff < 86400000) timeColor = "text-yellow-400"
  else timeColor = "text-green-400"
  const myClanParticipation = ev.participations.find(p => p.clanId === clan?.id)
  const myClanRank = myClanParticipation ? ev.participations.findIndex(p => p.clanId === clan?.id) + 1 : null
  const myHeroPart = ev.heroParticipations?.find(p => p.heroId === hero?.id)
  const isLeader = clan?.members?.some((m: any) => m.heroId === hero?.id && m.role === "leader") ?? false

  return (
    <div key={ev.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{getEventIcon(ev.type)}</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ev.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 capitalize">{getEventTypeName(ev.type)}</span>
              {ev.type === "invasion" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-800/40">⚔️ Clan vs Clan</span>}
            </div>
          </div>
          <div className="text-right">
            <p className={`text-sm font-mono font-bold ${timeColor}`}>
              {isEnded ? "🏁 Finalizado" : `⏱ ${countdown}`}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-300 mb-3">{ev.description}</p>
        <div className="text-xs text-gray-500 flex gap-4">
          <span>🏁 {endsAt.toLocaleDateString()} {endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {myClanParticipation && (
            <span className="text-green-400">Clan: #{myClanRank} · {myClanParticipation.score} pts</span>
          )}
        </div>
      </div>

      {/* Personal Progress */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400 font-medium">📊 Tu progreso</p>
          {myHeroPart && (
            <span className={`text-xs font-medium ${myHeroPart.completed ? "text-green-400" : "text-yellow-400"}`}>
              {myHeroPart.progress}/{myHeroPart.target}
              {myHeroPart.completed && " ✅"}
            </span>
          )}
        </div>
        {myHeroPart ? (
          <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full transition-all ${myHeroPart.completed ? "bg-green-500" : "bg-yellow-500"}`}
              style={{ width: `${Math.min(100, (myHeroPart.progress / myHeroPart.target) * 100)}%` }}
            />
          </div>
        ) : (
          <p className="text-xs text-gray-500 mb-3">Aún no participás</p>
        )}

        <div className="flex gap-2">
          {!showClaim && (
            <>
              <button onClick={() => onContributeHero(ev.id)} disabled={contributing === ev.id || (myHeroPart?.completed ?? false)}
                className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-xs transition">
                {contributing === ev.id ? "..." : "🎯 +1 Progreso"}
              </button>
              {clan && (
                <button onClick={() => onContributeClan(ev.id)} disabled={contributing === ev.id}
                  className="px-3 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-xs transition">
                  {contributing === ev.id ? "..." : "⚔️ +1 Clan"}
                </button>
              )}
            </>
          )}
          {showClaim && myHeroPart?.completed && !myHeroPart.claimedAt && (
            <button onClick={() => onClaimHero(ev.id)} disabled={claiming === ev.id}
              className="px-4 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-xs transition">
              {claiming === ev.id ? "..." : "🎁 Reclamar recompensa personal"}
            </button>
          )}
          {myHeroPart?.claimedAt && (
            <span className="text-green-500 text-xs">✅ Recompensa reclamada</span>
          )}
        </div>
      </div>

      {/* Clan Leaderboard */}
      <div className="border-t border-gray-800">
        <div className="p-3 bg-gray-800/50 text-xs text-gray-400 font-medium uppercase">Ranking de clanes</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
            <tr>
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">Clan</th>
              <th className="p-3 text-right">Puntos</th>
              {showClaim && <th className="p-3 text-center">Reclamado</th>}
            </tr>
          </thead>
          <tbody>
            {ev.participations.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-gray-500 text-xs">Ningún clan participa aún</td></tr>
            )}
            {ev.participations.map((p, i) => {
              const isMyClan = clan?.id === p.clanId
              return (
                <tr key={p.clanId} className={`border-t border-gray-800 ${isMyClan ? "bg-yellow-900/20" : ""}`}>
                  <td className="p-3 text-gray-400">{i + 1}</td>
                  <td className="p-3">
                    <span className="font-medium">{p.clan.icon} {p.clan.name}</span>
                    <span className="text-gray-500 ml-1">[{p.clan.tag}]</span>
                  </td>
                  <td className="p-3 text-right font-mono">{p.score}</td>
                  {showClaim && (
                    <td className="p-3 text-center text-xs">
                      {p.claimed ? <span className="text-green-500">✅</span> : <span className="text-gray-600">—</span>}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Rewards preview */}
      <div className="border-t border-gray-800 p-4">
        <p className="text-xs text-gray-500 font-medium mb-2">🏆 Recompensas</p>
        <div className="grid grid-cols-2 gap-2">
          {ev.rewards.map((r, i) => (
            <div key={r.rank} className="bg-gray-800 rounded-lg px-3 py-2 text-xs">
              <span className="text-yellow-400 font-medium">{getRewardLabel(r.rank)}</span>
              <div className="text-gray-400 mt-0.5">
                {r.fame && <span>🏆 {r.fame} · </span>}
                {r.gold && <span>💰 {r.gold}</span>}
                {r.title && <span> · 🏅 {r.title}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clan claim */}
      {showClaim && isLeader && myClanParticipation && !myClanParticipation.claimed && (
        <div className="border-t border-gray-800 p-4 flex justify-end">
          <button onClick={() => onClaimClan(ev.id)} disabled={claiming === ev.id}
            className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm transition">
            {claiming === ev.id ? "..." : "🎁 Reclamar recompensas del clan"}
          </button>
        </div>
      )}
    </div>
  )
}
