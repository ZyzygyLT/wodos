"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { skillUpgradeCost } from "@/lib/skill-cost"

export default function SkillsPage() {
  const router = useRouter()
  const [hero, setHero] = useState<any>(null)
  const [skills, setSkills] = useState<any[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState<number | null>(null)
  const [actionType, setActionType] = useState<"buy" | "upgrade" | null>(null)
  const [tab, setTab] = useState<"learned" | "available">("learned")

  const fetchData = useCallback(async () => {
    try {
      const [heroRes, skillsRes] = await Promise.all([
        fetch("/api/hero"),
        fetch("/api/hero/skills"),
      ])
      if (heroRes.status === 401) return router.push("/login")
      if (heroRes.status === 404) return router.push("/onboarding")
      setHero(await heroRes.json())
      setSkills(await skillsRes.json())
    } catch {}
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  async function buySkill(skillId: number) {
    setLoading(skillId)
    setActionType("buy")
    try {
      const res = await fetch("/api/hero/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      })
      setLoading(null)
      const data = await res.json()
      if (res.ok) {
        setMessage("✅ Skill aprendida!")
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setLoading(null); setMessage("❌ Error de red") }
  }

  async function upgradeSkill(skillId: number) {
    setLoading(skillId)
    setActionType("upgrade")
    try {
      const res = await fetch("/api/hero/skills/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      })
      setLoading(null)
      const data = await res.json()
      if (res.ok) {
        setMessage(`⬆️ Skill mejorada a rango ${data.newRank}!`)
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setLoading(null); setMessage("❌ Error de red") }
  }

  function canUnlock(skill: any): { ok: boolean; reason?: string } {
    if (skill.requiresSkills.length === 0) return { ok: true }
    const unlockedIds = new Set(skills.filter(s => s.unlocked).map(s => s.id))
    const missing = skill.requiresSkills.filter((id: number) => !unlockedIds.has(id))
    if (missing.length > 0) {
      const names = missing.map((id: number) => skills.find(s => s.id === id)?.name ?? `#${id}`)
      return { ok: false, reason: `Requiere: ${names.join(", ")}` }
    }
    return { ok: true }
  }

  const learned = skills.filter(s => s.unlocked)
  const available = skills.filter(s => !s.unlocked)

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => setMessage(null)}>
          {message}
        </button>
      )}

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("learned")}
            className={`px-4 py-1.5 rounded text-sm transition ${tab === "learned" ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            Aprendidas ({learned.length})
          </button>
          <button onClick={() => setTab("available")}
            className={`px-4 py-1.5 rounded text-sm transition ${tab === "available" ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            Disponibles ({available.length})
          </button>
        </div>

        <div className="space-y-3">
          {(tab === "learned" ? learned : available).map(s => {
            const req = canUnlock(s)
            const isActive = loading === s.id
            return (
              <div key={s.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{s.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{s.type}</span>
                      {s.timing !== "passive" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{s.timing}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-yellow-400">T{s.tier}</span>
                      {s.defenseCategory && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">{s.defenseCategory}</span>}
                      {s.unlocked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900 text-blue-300">Rango {s.rank}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mt-2">
                      <span>⚡ {s.effect}</span>
                      {s.timing !== "passive" && <span>🌀 {s.manaCost} MP</span>}
                      {s.multiplier !== 1 && <span>×{s.multiplier}</span>}
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      {s.unlocked ? (
                        <button onClick={() => upgradeSkill(s.id)} disabled={isActive}
                          className="text-xs px-3 py-1.5 rounded bg-blue-800 hover:bg-blue-700 disabled:opacity-50 transition">
                          {isActive && actionType === "upgrade" ? "..." : `⬆ Mejorar (💡${skillUpgradeCost(s.epCost, s.rank)} EXP · 💰${skillUpgradeCost(s.goldCost, s.rank)})`}
                        </button>
                      ) : (
                        <button onClick={() => buySkill(s.id)} disabled={isActive || !req.ok}
                          className="text-xs px-3 py-1.5 rounded bg-green-800 hover:bg-green-700 disabled:opacity-50 transition">
                          {isActive && actionType === "buy" ? "..." : `🔓 Aprender (💰${s.goldCost})`}
                        </button>
                      )}
                      {!s.unlocked && !req.ok && (
                        <span className="text-xs text-red-400">{req.reason}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {(tab === "learned" ? learned : available).length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">⚡</p>
              <p className="text-gray-400">
                {tab === "learned" ? "No aprendiste ninguna skill aún" : "No hay más skills disponibles"}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
