"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface RunSummary {
  id: string; dungeonName: string; dungeonIcon: string
  status: string; result: string | null
  levelsCleared: number | null
  epGained: number | null; goldGained: number | null
  fameGained: number | null
  createdAt: string
}

export default function DungeonHistory() {
  const router = useRouter()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dungeon/history")
      .then(r => { if (r.status === 401) { router.push("/login"); } return r })
      .then(r => r.json())
      .then(d => { setRuns(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [router])

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]" /></div></div>
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Historial de expediciones</h1>
          <p className="mt-1 text-sm text-gray-400">Consulta los resultados, las recompensas y los informes de tus últimas mazmorras.</p>
        </div>
        <a href="/dungeon"
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200 transition hover:bg-gray-700">
          Volver a mazmorras
        </a>
      </header>
      {runs.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
          <p className="text-gray-400">Todavía no hay ejecuciones</p>
          <p className="mt-1 text-sm text-gray-500">Cuando completes una expedición, su resultado aparecerá aquí.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(r => {
            const isVictory = r.result === "victory"
            const isDefeat = r.result === "defeat"
            const resultLabel = isVictory ? "Victoria"
              : isDefeat ? "Derrota"
              : r.status === "failed" ? "Ejecución fallida"
              : "Resultado pendiente"
            const resultColor = isVictory ? "text-green-400"
              : isDefeat || r.status === "failed" ? "text-red-400"
              : "text-gray-400"
            const borderColor = isVictory ? "border-green-800"
              : isDefeat || r.status === "failed" ? "border-red-800"
              : "border-gray-700"
            return (
              <a key={r.id} href={`/dungeon/report/${r.id}`}
                className={`block bg-gray-900 rounded-xl border p-4 transition hover:bg-gray-800 ${borderColor}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{r.dungeonIcon}</span>
                    <div>
                      <span className="font-semibold">{r.dungeonName}</span>
                      <span className={`ml-2 text-xs ${resultColor}`}>
                        {resultLabel}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                  <span>⭐ +{r.epGained ?? 0} PE</span>
                  <span>💰 +{r.goldGained ?? 0} oro</span>
                  <span>🏅 +{r.fameGained ?? 0} fama</span>
                  <span>🗡️ {r.levelsCleared ?? 0} niveles</span>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
