"use client"

import { useEffect, useState } from "react"

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/achievements")
      .then(r => r.json())
      .then(data => { setAchievements(data.achievements); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categories = [...new Set(achievements.map(a => a.category))]
  const filtered = filter ? achievements.filter(a => a.category === filter) : achievements

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setFilter(null)}
            className={`px-3 py-1.5 rounded text-sm transition ${filter ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-yellow-700 text-white"}`}>
            Todas
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded text-sm transition ${filter === cat ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map(a => (
            <div key={a.id} className={`bg-gray-900 rounded-xl border p-4 flex items-center gap-4 ${a.completed ? "border-yellow-700" : "border-gray-800 opacity-70"}`}>
              <span className="text-3xl">{a.completed ? a.icon : "🔒"}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{a.name}</p>
                  {a.completed && <span className="text-[10px] text-green-400">✅ Completado</span>}
                </div>
                <p className="text-xs text-gray-400">{a.description}</p>
                <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
                  <span>🏆 +{a.rewards?.fame ?? 0} fama</span>
                  <span>💰 +{a.rewards?.gold ?? 0} oro</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">Sin logros</div>
          )}
        </div>
      </div>
  )
}
