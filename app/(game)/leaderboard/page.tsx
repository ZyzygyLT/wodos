"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const SORTS = [
  { key: "fame", label: "🏆 Fama" },
  { key: "eloRating", label: "⚔️ ELO" },
  { key: "level", label: "📈 Nivel" },
  { key: "gold", label: "💰 Oro" },
  { key: "arenaWins", label: "🎯 Victorias Arena" },
] as const

function formatValue(key: string, val: any) {
  if (key === "gold") return `${val}💰`
  if (key === "eloRating") return `${val} pts`
  if (key === "arenaWins") return `${val} victorias`
  return val
}

export default function LeaderboardPage() {
  const router = useRouter()
  const [heroes, setHeroes] = useState<any[]>([])
  const [sort, setSort] = useState("fame")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/leaderboard?sort=${sort}`)
      .then(r => r.json())
      .then(data => { setHeroes(data.heroes); setLoading(false) })
      .catch(() => setLoading(false))
  }, [sort])

  return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <h1 className="text-xl font-bold mb-4">🏆 Leaderboard</h1>
        <div className="flex gap-2 mb-6 flex-wrap">
          {SORTS.map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              className={`px-3 py-1.5 rounded text-sm transition ${sort === s.key ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : (
          <div className="space-y-2">
            {heroes.map((h, i) => (
              <button type="button" key={h.id}
                className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex items-center gap-4 hover:border-gray-600 transition cursor-pointer"
                onClick={() => router.push(`/profile/${h.id}`)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/profile/${h.id}`) } }}>
                <span className={`text-lg font-bold w-8 text-center ${i < 3 ? "text-yellow-400" : "text-gray-500"}`}>
                  {(() => {
                    if (i === 0) return "🥇"
                    if (i === 1) return "🥈"
                    if (i === 2) return "🥉"
                    return `#${i + 1}`
                  })()}
                </span>
                <span className="text-2xl">{h.class.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold truncate">{h.name}</p>
                    <span className="text-xs text-gray-500">{h.race.icon} {h.race.name}</span>
                    {h.clanMember && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                        [{h.clanMember.clan.tag}]
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Nv.{h.level} · {h.class.name}</p>
                </div>
                <span className="text-sm font-mono text-yellow-400">{formatValue(sort, h[sort as keyof typeof h])}</span>
              </button>
            ))}
            {heroes.length === 0 && (
              <div className="text-center py-12 text-gray-400">Sin datos</div>
            )}
          </div>
        )}
      </div>
  )
}
