"use client"

import logger from "@/lib/logger"

import { useEffect, useState, useMemo } from "react"
import { computeCombatStats, type HeroStats } from "@/lib/combat-report-stats"
import { LevelAccordion, StatsTable } from "@/components/combat"
import { ExpeditionHeader } from "@/components/report"
import type { LevelReport } from "@/lib/combat-engine/dungeon-runner"

interface GroupMember {
  heroId: string; name: string; className: string; classSlug: string
  raceName: string; level: number; role: string
}

interface Group {
  id: string; name: string; icon: string; leaderId: string; members: GroupMember[]
}

interface DungeonInfo {
  id: number; name: string; slug: string; icon: string
  difficultyLabel: string; isInstant: boolean; recommendedLevel: number
}

interface RunResult {
  victory: boolean; totalRounds: number; epGained: number; goldGained: number
  fameGained: number; levelsCleared: number; dungeonName: string; groupName: string
  heroes: { id: string; name: string; hpMax: number; mpMax: number; finalHp?: number; finalMp?: number }[]
  levelReports: LevelReport[]
  loot: { itemId: number; qty: number; heroId?: string; heroName?: string }[]
}

export default function TestDungeonPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [dungeons, setDungeons] = useState<DungeonInfo[]>([])
  const [selectedGroup, setSelectedGroup] = useState("")
  const [selectedDungeon, setSelectedDungeon] = useState("")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'detalles' | 'stats'>('detalles')

  const heroStats: HeroStats[] = useMemo(() => {
    if (!result?.levelReports) return []
    return computeCombatStats(result.levelReports)
  }, [result?.levelReports])

  useEffect(() => {
    fetch("/api/admin/test-groups").then(r => r.json()).then(setGroups).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
    fetch("/api/admin/dungeons").then(r => r.json()).then(all => {
      setDungeons(Array.isArray(all) ? all : [])
    }).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
  }, [])

  async function run() {
    if (!selectedGroup || !selectedDungeon) return
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch("/api/admin/test-dungeon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroup, dungeonId: Number.parseInt(selectedDungeon) }),
      })
      const data = await res.json()
      if (res.ok) setResult(data)
      else setError(data.error || "Error ejecutando dungeon")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const selectedGroupData = groups.find(g => g.id === selectedGroup)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🧪 Test Dungeon</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <label htmlFor="test-group" className="block text-sm text-gray-400 mb-2">Grupo</label>
          <select id="test-group" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
            <option value="">Seleccionar grupo...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.icon} {g.name} ({g.members.length} miembros)</option>
            ))}
          </select>
          {selectedGroupData && (
            <div className="mt-3 space-y-1">
              {selectedGroupData.members.map(m => (
                <div key={m.heroId} className="flex items-center gap-2 text-xs bg-gray-800/50 rounded px-2 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${m.role === 'leader' ? 'bg-yellow-400' : 'bg-gray-500'}`} />
                  <span>{m.name}</span>
                  <span className="text-gray-500">{m.className} Lv{m.level}</span>
                  <span className="text-gray-600">{m.raceName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <label htmlFor="test-dungeon" className="block text-sm text-gray-400 mb-2">Dungeon</label>
          <select id="test-dungeon" value={selectedDungeon} onChange={e => setSelectedDungeon(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
            <option value="">Seleccionar dungeon...</option>
            {dungeons.map(d => (
              <option key={d.id} value={d.id}>{d.icon} {d.name} ({d.difficultyLabel})</option>
            ))}
          </select>
        </div>
      </div>

      <button onClick={run} disabled={running || !selectedGroup || !selectedDungeon}
        className="px-6 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-bold transition">
        {running ? "⚔️ Ejecutando..." : "⚔️ Ejecutar Dungeon"}
      </button>

      {error && (
        <div className="mt-6 bg-red-900/30 border border-red-800 rounded-xl p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <ExpeditionHeader
            dungeonName={result.dungeonName}
            result={result.victory ? 'victory' : 'defeat'}
            levelsCleared={result.levelsCleared}
            totalRounds={result.totalRounds}
            epGained={result.epGained}
            goldGained={result.goldGained}
            fameGained={result.fameGained}
            groupRun
            totalHeroes={result.heroes.length}
            participants={result.heroes.map(h => ({ heroId: h.id, name: h.name }))}
          />

          {result.heroes.length > 0 && (
            <div className="rounded-xl border border-amber-900/20 bg-gray-900/40 overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-900/10 border-b border-amber-900/20 flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-300/90 flex items-center gap-2">🛡️ Héroes</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
                {result.heroes.map(h => {
                  const maxHp = h.hpMax ?? 100
                  const hpPct = Math.min(100, Math.max(0, ((h.finalHp ?? h.hpMax) / maxHp) * 100))
                  let barCls
                  if (hpPct > 50) barCls = 'bg-emerald-500'
                  else if (hpPct > 20) barCls = 'bg-amber-500'
                  else barCls = 'bg-red-500'
                  return (
                    <div key={h.id} className="bg-gray-900/60 border border-gray-800/50 rounded-lg p-2">
                      <p className="font-medium text-xs text-gray-200">{h.name}</p>
                      <div className="mt-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${hpPct}%` }} />
                      </div>
                      <div className="flex justify-between mt-0.5 text-[10px]">
                        <span className="text-gray-500">HP {h.finalHp ?? h.hpMax}/{maxHp}</span>
                        <span className="text-blue-400/70">MP {h.finalMp ?? h.mpMax}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-amber-900/20">
            {[
              { key: 'detalles' as const, label: '📋 Detalles' },
              { key: 'stats' as const, label: '📊 Stats' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-center text-sm font-medium transition ${tab === t.key ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-600 hover:text-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'detalles' && result.levelReports.map((lvl, idx) => (
            <LevelAccordion key={lvl.levelNumber} level={lvl} defaultOpen={idx === 0} />
          ))}

          {tab === 'stats' && <StatsTable stats={heroStats} />}

          {result.loot && result.loot.length > 0 && (
            <div className="rounded-xl border border-amber-900/20 bg-gray-900/50 p-4">
              <h3 className="font-bold mb-2 text-sm text-amber-400/80 font-mono tracking-widest uppercase">Botín</h3>
              <div className="space-y-2">
                {(() => {
                  const byHero = new Map<string, { heroName: string; items: typeof result.loot }>()
                  for (const l of result.loot) {
                    const key = l.heroId ?? ''
                    if (!byHero.has(key)) byHero.set(key, { heroName: l.heroName ?? '—', items: [] })
                    byHero.get(key)!.items.push(l)
                  }
                  return Array.from(byHero.entries()).map(([heroId, h]) => (
                    <div key={heroId} className="text-sm">
                      <span className="text-gray-400 font-medium">{h.heroName}:</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {h.items.map((l, i) => (
                          <span key={"loot-" + i} className="bg-gray-800/60 border border-amber-900/20 rounded px-2 py-0.5 text-gray-300 text-xs">
                            x{l.qty} (item #{l.itemId})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
