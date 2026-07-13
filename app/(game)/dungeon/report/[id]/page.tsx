"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { computeCombatStats, type HeroStats } from "@/lib/combat-report-stats"
import { LevelAccordion, StatsTable } from "@/components/combat"
import { ExpeditionHeader } from "@/components/report"
import type { LevelReport } from "@/lib/combat-engine/dungeon-runner"

interface RunReport {
  id: string; dungeonName: string; status: string
  result: string | null; levelsCleared: number | null
  epGained: number | null; goldGained: number | null
  loot: any; recentLog: string[] | null
  fullReport: any[] | null; levelReports: LevelReport[] | null
  groupRun?: boolean; totalHeroes?: number
  participants?: { heroId: string; name: string }[]
}

export default function DungeonReport() {
  const params = useParams()
  const router = useRouter()
  const [report, setReport] = useState<RunReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportTab, setReportTab] = useState<'report' | 'stats' | 'loot'>('report')

  const heroStats: HeroStats[] = useMemo(() => {
    if (!report?.levelReports) return []
    return computeCombatStats(report.levelReports)
  }, [report?.levelReports])

  useEffect(() => {
    let id = params?.id as string | undefined
    if (!id && globalThis.window !== undefined) {
      const m = /\/dungeon\/report\/([^/]+)/.exec(globalThis.window.location.pathname)
      if (m) id = m[1]
    }
    if (!id) {
      setError("ID de reporte no encontrado en la URL")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`/api/dungeon/report/${id}`)
      .then(async r => {
        if (r.status === 401) { router.push("/login"); return null }
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(body.error || `Error ${r.status}`)
        }
        return r.json()
      })
      .then(d => {
        if (!d) return
        if (d.error) { setError(d.error); setLoading(false); return }
        setReport(d)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message || "Error al cargar el reporte")
        setLoading(false)
      })
  }, [params?.id, router])

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-2">❌ {error}</p>
          <button onClick={() => router.push("/dashboard")}
            className="mt-4 px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
            Volver al dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Reporte no encontrado</p>
          <button onClick={() => router.push("/dashboard")}
            className="mt-4 px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
            Volver al dashboard
          </button>
        </div>
      </div>
    )
  }

  const totalRounds = report.levelReports?.reduce((s, l) => s + (l.rounds?.length ?? 0), 0) ?? null

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <ExpeditionHeader
        dungeonName={report.dungeonName}
        result={report.result}
        levelsCleared={report.levelsCleared}
        totalRounds={totalRounds}
        epGained={report.epGained}
        goldGained={report.goldGained}
        fameGained={null}
        groupRun={report.groupRun}
        totalHeroes={report.totalHeroes}
        participants={report.participants}
      />

      {/* Tab navigation */}
      <div className="flex border-b border-amber-900/20">
        {[
          { key: 'report' as const, label: '📋 Detalles' },
          { key: 'stats' as const, label: '📊 Estadísticas' },
          { key: 'loot' as const, label: '📦 Botín' },
        ].map(t => (
          <button key={t.key} onClick={() => setReportTab(t.key)}
            className={`flex-1 py-3 text-center text-sm font-medium transition ${reportTab === t.key ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-600 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Detalles tab */}
      {reportTab === 'report' && (
        <>
          {report.levelReports && report.levelReports.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-200">🗺️ Reporte por niveles</h2>
              {report.levelReports.map((l, i) => (
                <LevelAccordion key={l.levelNumber} level={l} defaultOpen={i === 0} />
              ))}
            </div>
          )}

          {(!report.levelReports || report.levelReports.length === 0) && report.fullReport && report.fullReport.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-bold mb-4">⚔️ Bitácora de batalla</h2>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {report.fullReport.map((entry: any, i: number) => {
                  let entryColor
                  if (entry.type === 'damage') entryColor = 'text-red-400'
                  else if (entry.type === 'heal') entryColor = 'text-green-400'
                  else if (entry.type === 'death') entryColor = 'text-red-600'
                  else if (entry.type === 'round') entryColor = 'text-yellow-400 font-bold'
                  else entryColor = 'text-gray-400'
                  return (
                    <p key={`entry-${i}_${entry.message}`} className={`text-xs font-mono leading-relaxed ${entryColor}`}>
                      {entry.message}
                    </p>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Estadísticas tab */}
      {reportTab === 'stats' && (
        <StatsTable stats={heroStats} />
      )}

      {/* Objetos tab */}
      {reportTab === 'loot' && (
        <div className="rounded-xl border border-amber-900/20 bg-gray-900/50 p-6">
          <h2 className="text-sm font-bold text-amber-400/80 mb-4 font-mono tracking-widest uppercase">Botín obtenido</h2>
          {report.loot && report.loot.length > 0 ? (
            <div className="space-y-3">
              {(() => {
                const byHero = new Map<string, { heroName: string; items: any[] }>()
                for (const l of report.loot) {
                  const key = l.heroId ?? ''
                  if (!byHero.has(key)) byHero.set(key, { heroName: l.heroName ?? '—', items: [] })
                  byHero.get(key)!.items.push(l)
                }
                return Array.from(byHero.entries()).map(([heroId, h]) => (
                  <div key={heroId}>
                    <p className="text-xs text-gray-400 font-medium mb-1">🎒 {h.heroName}</p>
                    <div className="flex flex-wrap gap-2">
                      {h.items.map((l: any) => (
                        <span key={l.name + (l.qty ?? 1)} className="text-sm bg-gray-800/60 border border-amber-900/20 rounded-lg px-3 py-1.5 text-gray-300">
                          {l.name}{l.qty > 1 ? ` ×${l.qty}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No se obtuvo ningún objeto en esta run.</p>
          )}
        </div>
      )}
    </div>
  )
}
