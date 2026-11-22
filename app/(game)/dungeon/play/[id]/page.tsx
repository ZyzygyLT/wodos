"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
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
  const [dismissedLevelUpKey, setDismissedLevelUpKey] = useState<string | null>(null)
  const levelUpParams = {
    level: searchParams?.get("lvl") ?? null,
    points: searchParams?.get("pts") ?? null,
  }
  const levelUpKey = levelUpParams.level && levelUpParams.points
    ? `${levelUpParams.level}:${levelUpParams.points}`
    : null
  const levelUp = useMemo<LevelUpData | null>(() => {
    if (!levelUpKey || dismissedLevelUpKey === levelUpKey) return null
    return {
      leveledUp: true,
      levelsGained: 1,
      newLevel: Number(levelUpParams.level),
      newHpMax: 0,
      newMpMax: 0,
      pointsAwarded: Number(levelUpParams.points),
    }
  }, [dismissedLevelUpKey, levelUpKey, levelUpParams.level, levelUpParams.points])
  const firstOfDay = searchParams?.get("fod") === "1"

  const fetchReport = useCallback(async (id: string): Promise<RunReport | null> => {
    const res = await fetch(`/api/dungeon/report/${id}`)
    if (res.status === 401) {
      router.push("/login")
      return null
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Error ${res.status}`)
    }
    return await res.json() as RunReport
  }, [router])

  useEffect(() => {
    let id = params?.id as string | undefined
    if (!id && globalThis.window !== undefined) {
      const match = /\\/dungeon\\/play\\/([^/]+)/.exec(globalThis.window.location.pathname)
      if (match) id = match[1]
    }

    let cancelled = false
    if (!id) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setError("No se encontró el identificador de la expedición")
          setLoading(false)
        }
      })
      return () => { cancelled = true }
    }

    void fetchReport(id)
      .then(data => {
        if (cancelled || !data) return
        setError(null)
        setReport(data)
      })
      .catch(error => {
        if (!cancelled) setError(error instanceof Error ? error.message : "Error al cargar")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [params?.id, fetchReport])

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
        <LevelUpCelebration data={levelUp} onClose={() => levelUpKey && setDismissedLevelUpKey(levelUpKey)} />
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
