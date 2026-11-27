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
  epGained: number | null; goldGained: number | null; fameGained: number | null
  loot: any; recentLog: string[] | null
  fullReport: any[] | null; levelReports: LevelReport[] | null
  groupRun?: boolean; totalHeroes?: number
  participants?: { heroId: string; name: string }[]
  finalResources?: Array<{
    heroId: string; name: string
    hpCurrent: number; hpMax: number
    mpCurrent: number; mpMax: number
  }>
}

export default function DungeonReport() {
  const params = useParams()
  const router = useRouter()
  const [report, setReport] = useState<RunReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportTab, setReportTab] = useState<'report' | 'stats' | 'loot'>('report')
  const levelReports = report?.levelReports
  const heroStats: HeroStats[] = useMemo(() => {
    if (!levelReports) return []
    return computeCombatStats(levelReports)
  }, [levelReports])

  useEffect(() => {
    let cancelled = false
    let id = params?.id as string | undefined
    if (!id && globalThis.window !== undefined) {
      const m = /\/dungeon\/report\/([^/]+)/.exec(globalThis.window.location.pathname)
      if (m) id = m[1]
    }
    if (!id) {
      Promise.resolve().then(() => {
        if (cancelled) return
        setError("ID de reporte no encontrado en la URL")
        setLoading(false)
      })
      return () => { cancelled = true }
    }

    fetch(`/api/dungeon/report/${id}`)
      .then(async r => {
        if (r.status === 401) {
          if (!cancelled) router.push("/login")
          return null
        }
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          throw new Error(body.error || `Error ${r.status}`)
        }
        return r.json()
      })
      .then(d => {
        if (cancelled || !d) return
        if (d.error) {
          setError(d.error)
          setLoading(false)
          return
        }
        setReport(d)
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Error al cargar el reporte")
        setLoading(false)
      })

    return () => { cancelled = true }
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
        fameGained={report.fameGained}
        groupRun={report.groupRun}
        totalHeroes={report.totalHeroes}
        participants={report.participants}
      />

      {report.finalResources && report.finalResources.length > 0 && (
        <section aria-label="Recursos al finalizar la expedición" className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-200">Recursos al finalizar la expedición</h2>
            <p className="text-xs text-gray-500">Estado registrado al terminar el último combate, por participante</p>
          </div>
          <div className="space-y-4">
            {report.finalResources.map(participant => {
              const hpPercent = participant.hpMax > 0
                ? Math.max(0, Math.min(100, participant.hpCurrent / participant.hpMax * 100))
                : 0
              const mpPercent = participant.mpMax > 0
                ? Math.max(0, Math.min(100, participant.mpCurrent / participant.mpMax * 100))
                : 0
              return (
                <div key={participant.heroId} className="rounded-lg border border-gray-800/80 p-3">
                  <p className="mb-3 text-sm font-semibold text-gray-200">{participant.name}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-red-300">❤️ Vida</span>
                        <span className="tabular-nums text-gray-300">{participant.hpCurrent} / {participant.hpMax}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                        <div className="h-full rounded-full bg-red-600" style={{ width: `${hpPercent}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-sky-300">💧 Maná</span>
                        <span className="tabular-nums text-gray-300">{participant.mpCurrent} / {participant.mpMax}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                        <div className="h-full rounded-full bg-sky-600" style={{ width: `${mpPercent}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

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

      <div className="flex justify-end border-t border-gray-800 pt-5">
        <button
          onClick={() => router.push("/dungeon")}
          className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-gray-950 font-semibold text-sm transition"
        >
          Volver al mapa de expediciones →
        </button>
      </div>
    </div>
  )
}
