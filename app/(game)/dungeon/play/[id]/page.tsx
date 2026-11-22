"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import type { RunResult, LevelReport } from "@/lib/combat-engine/dungeon-runner"
import { CombatPlayback } from "@/components/combat/CombatPlayback"
import { LevelUpCelebration } from "@/components/game/LevelUpCelebration"

interface LevelUpData {
  leveledUp: boolean
  levelsGained: number
  newLevel: number
  newHpMax: number
  newMpMax: number
  pointsAwarded: number
}

interface RunReport {
  id: string
  dungeonName: string
  status: string
  result: string | null
  levelsCleared: number | null
  epGained: number | null
  goldGained: number | null
  loot: any
  levelReports: LevelReport[] | null
  groupRun?: boolean
  totalHeroes?: number
}

export default function DungeonPlayPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [report, setReport] = useState<RunReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levelUp, setLevelUp] = useState<LevelUpData | null>(null)
  const [firstOfDay, setFirstOfDay] = useState(false)

  const fetchReport = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dungeon/report/${id}`)
      if (res.status === 401) { router.push("/login"); return }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setReport(data)
    } catch (e: any) {
      setError(e.message || "Error al cargar")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    let id = params?.id as string | undefined
    if (!id && globalThis.window !== undefined) {
      const m = /\/dungeon\/play\/([^/]+)/.exec(globalThis.window.location.pathname)
      if (m) id = m[1]
    }
    if (id) fetchReport(id)

    const lvl = searchParams?.get("lvl")
    const pts = searchParams?.get("pts")
    const fod = searchParams?.get("fod")
    if (lvl && pts) {
      setLevelUp({
        leveledUp: true,
        levelsGained: 1,
        newLevel: Number(lvl),
        newHpMax: 0,
        newMpMax: 0,
        pointsAwarded: Number(pts),
      })
    }
    if (fod === '1') setFirstOfDay(true)
  }, [params?.id, fetchReport, searchParams])

  const runResult: RunResult | null = report?.levelReports
    ? {
        victory: report.result === "victory",
        levelsCleared: report.levelsCleared ?? 0,
        totalRounds: report.levelReports.reduce((s, l) => s + (l.rounds?.length ?? 0), 0),
        epGained: report.epGained ?? 0,
        goldGained: report.goldGained ?? 0,
        fameGained: 0,
        loot: report.loot ?? [],
        heroesFinalState: [],
        log: [],
        levelResults: [],
        levelReports: report.levelReports,
        eventJournal: { schemaVersion: 1, events: [] },
      }
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-pulse">⚔️</div>
          <p className="text-gray-400 animate-pulse">Preparando la batalla...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-2">❌ {error}</p>
          <button onClick={() => router.push("/dungeon")}
            className="mt-4 px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
            Volver al mapa
          </button>
        </div>
      </div>
    )
  }

  if (!report || !runResult) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Reporte no encontrado</p>
          <button onClick={() => router.push("/dungeon")}
            className="mt-4 px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
            Volver al mapa
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {levelUp && (
        <LevelUpCelebration data={levelUp} onClose={() => setLevelUp(null)} />
      )}
      {firstOfDay && (
        <div className="fixed top-4 right-4 z-50 bg-amber-900/90 border border-amber-600 rounded-lg px-4 py-2 text-amber-200 text-sm font-medium shadow-lg">
          ⭐ Bonus primera mazmorra del día (+30% EP)
        </div>
      )}
      <CombatPlayback
        result={runResult}
        dungeonName={report.dungeonName}
        onFinish={() => router.push(`/dungeon/report/${report.id}`)}
      />
    </>
  )
}
