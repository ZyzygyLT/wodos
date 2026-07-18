"use client"

import { useEffect, useState, useCallback } from "react"
import { LevelUpCelebration } from "@/components/game/LevelUpCelebration"
import { useToast } from "@/hooks/useToast"

const QUEST_TYPE_BADGES: Record<string, { label: string; color: string }> = {
  main: { label: "📜 Principal", color: "border-amber-700/50 bg-amber-900/20 text-amber-400" },
  daily: { label: "🔄 Diaria", color: "border-blue-700/50 bg-blue-900/20 text-blue-400" },
  side: { label: "🤝 Secundaria", color: "border-gray-700/50 bg-gray-800/50 text-gray-400" },
  chain: { label: "🔗 Cadena", color: "border-purple-700/50 bg-purple-900/20 text-purple-400" },
}

function getObjectiveProgress(obj: any, progress: Record<string, number>) {
  const current = progress[obj.id] || 0
  const required = obj.required || 1
  return { current, required, pct: Math.min(100, (current / required) * 100), done: current >= required }
}

function isQuestDone(quest: any, hq: any) {
  const objectives = quest.objectives || []
  const progress = hq?.progress || {}
  return objectives.every((o: any) => (progress[o.id] || 0) >= (o.required || 1))
}

function getQuestPct(quest: any, hq: any) {
  const objectives = quest.objectives || []
  const progress = hq?.progress || {}
  if (objectives.length === 0) return 0
  const total = objectives.reduce((sum: number, obj: any) => {
    const { pct } = getObjectiveProgress(obj, progress)
    return sum + pct
  }, 0)
  return total / objectives.length
}

export default function QuestsPage() {
  const [hero, setHero] = useState<any>(null)
  const [quests, setQuests] = useState<{ active: any[]; available: any[] }>({ active: [], available: [] })
  const { toast: message, show: setMessage, dismiss } = useToast()
  const [accepting, setAccepting] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [levelUp, setLevelUp] = useState<any>(null)

  const fetchData = useCallback(async () => {
    try {
      const [heroRes, questsRes] = await Promise.all([
        fetch("/api/hero"),
        fetch("/api/quests"),
      ])
      if (heroRes.status === 401 || heroRes.status === 404) return
      setHero(await heroRes.json())
      setQuests(await questsRes.json())
    } catch {}
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function acceptQuest(slug: string) {
    setAccepting(slug)
    try {
      const res = await fetch("/api/quests/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questSlug: slug }),
      })
      setAccepting(null)
      const data = await res.json()
      if (res.ok) {
        setMessage("✅ Quest aceptada!")
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setAccepting(null); setMessage("❌ Error de red") }
  }

  async function claimReward(questId: string) {
    setClaiming(questId)
    try {
      const res = await fetch("/api/quests/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      })
      setClaiming(null)
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ Quest completada! Recompensa: ${data.rewards.ep} EP, ${data.rewards.gold} oro, ${data.rewards.fame} fama`)
        if (data.levelUp) setLevelUp(data.levelUp)
        fetchData()
    } else {
      setMessage(`❌ ${data.error}`)
      }
    } catch { setClaiming(null) }
  }

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]" /></div></div>

  return (
    <>
      {levelUp && (
        <LevelUpCelebration data={levelUp} onClose={() => setLevelUp(null)} />
      )}
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => dismiss()}>
          {message}
        </button>
      )}

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {quests.active.length > 0 && (
          <div>
            <h2 className="font-bold text-lg mb-3">📋 Activas ({quests.active.length})</h2>
            <div className="space-y-4">
              {quests.active.map((hq: any) => {
                const q = hq.quest
                const objectives = q.objectives || []
                const progress = hq.progress || {}
                const questPct = getQuestPct(q, hq)
                const badge = QUEST_TYPE_BADGES[q.type] ?? QUEST_TYPE_BADGES.side
                const done = isQuestDone(q, hq)

                return (
                  <div key={hq.id} className={`bg-gray-900 rounded-xl border p-4 transition ${done ? "border-green-700/50" : "border-gray-800"}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{q.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.color}`}>{badge.label}</span>
                      </div>
                      <span className="text-xs text-gray-500">{q.npcName}</span>
                    </div>

                    {/* Dialog */}
                    {q.npcDialog && (
                      <p className="text-xs text-gray-500 italic mb-3">"{q.npcDialog}"</p>
                    )}

                    {/* Quest progress bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Progreso</span>
                        <span>{Math.round(questPct)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${done ? "bg-green-500" : "bg-amber-500"}`}
                          style={{ width: `${questPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Objectives */}
                    <div className="space-y-2 mb-3">
                      {objectives.map((obj: any) => {
                        const { current, required, pct, done: objDone } = getObjectiveProgress(obj, progress)
                        return (
                          <div key={obj.id} className="flex items-center gap-2 text-sm">
                            <span className={objDone ? "text-green-400" : "text-gray-500"}>{objDone ? "✅" : "⬜"}</span>
                            <div className="flex-1 min-w-0">
                              <span className={objDone ? "text-gray-400 line-through" : "text-gray-300"}>{obj.text}</span>
                              <div className="h-1 bg-gray-800 rounded-full overflow-hidden mt-1">
                                <div
                                  className={`h-full rounded-full transition-all ${objDone ? "bg-green-500" : "bg-amber-600"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 shrink-0">{current}/{required}</span>
                            {obj.dungeonSlug && !objDone && (
                              <a href="/dungeon"
                                className="text-[10px] text-amber-500 hover:text-amber-400 hover:underline shrink-0">
                                📍 Ir
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Rewards */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      {q.rewards?.ep > 0 && <span>⭐ {q.rewards.ep} EP</span>}
                      {q.rewards?.gold > 0 && <span>💰 {q.rewards.gold} oro</span>}
                      {q.rewards?.fame > 0 && <span>🏆 {q.rewards.fame} fama</span>}
                      {q.chainNext && <span className="text-purple-400">🔗 Tiene continuación</span>}
                    </div>

                    {/* Claim button */}
                    {done && (
                      <button onClick={() => claimReward(q.id)} disabled={claiming === q.id}
                        className="w-full px-3 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm font-bold transition">
                        {claiming === q.id ? "..." : "🎁 Reclamar recompensa"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {quests.available.length > 0 && (
          <div>
            <h2 className="font-bold text-lg mb-3">📭 Disponibles ({quests.available.length})</h2>
            <div className="space-y-3">
              {quests.available.map((q: any) => {
                const badge = QUEST_TYPE_BADGES[q.type] ?? QUEST_TYPE_BADGES.side
                return (
                  <div key={q.id} className="bg-gray-900 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{q.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.color}`}>{badge.label}</span>
                      </div>
                    </div>
                    {q.description && <p className="text-xs text-gray-400 mb-2">{q.description}</p>}

                    {/* Rewards */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      <span>🎯 Nv. {q.levelReq}</span>
                      {q.rewards?.ep > 0 && <span>⭐ {q.rewards.ep} EP</span>}
                      {q.rewards?.gold > 0 && <span>💰 {q.rewards.gold} oro</span>}
                      {q.rewards?.fame > 0 && <span>🏆 {q.rewards.fame} fama</span>}
                    </div>

                    <button onClick={() => acceptQuest(q.slug)} disabled={accepting === q.slug}
                      className="px-3 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-xs font-bold transition">
                      {accepting === q.slug ? "..." : "Aceptar quest"}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {quests.active.length === 0 && quests.available.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">📜</p>
            <p className="text-gray-400">No hay quests disponibles</p>
          </div>
        )}
      </div>
    </>
  )
}
