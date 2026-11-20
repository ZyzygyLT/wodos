"use client"

import logger from "@/lib/logger"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"

const RARITY_COLORS: Record<string, string> = {
  common: "border-gray-600", uncommon: "border-green-700", rare: "border-blue-700",
  epic: "border-purple-700", legendary: "border-orange-600",
}

const ATTR_LABELS: Record<string, string> = {
  st: "Fuerza", co: "Constitución", in: "Inteligencia", dx: "Destreza",
  ch: "Carisma", ag: "Agilidad", pe: "Percepción", wi: "Voluntad",
}

export default function ProfilePage() {
  const params = useParams()
  const [hero, setHero] = useState<any>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [achievements, setAchievements] = useState<any[]>([])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    fetch("/api/hero").then(r => r.json()).then(h => setMyId(h.id)).catch(e => logger.error("game", "Failed to fetch data", e))
  }, [])

  useEffect(() => {
    if (!params.id) return
    Promise.all([
      fetch(`/api/hero/${params.id}/profile`).then(r => r.json()),
      fetch(`/api/hero/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([heroData, statsData]) => {
      setHero(heroData)
      setStats(statsData)
    }).catch(() => setHero(null))
  }, [params.id])

  const isMyProfile = myId === hero?.id

  useEffect(() => {
    if (!params.id || !isMyProfile) return
    fetch("/api/achievements").then(r => r.ok ? r.json() : []).then(d => {
      setAchievements((d.achievements ?? []).filter((a: any) => a.completed).slice(0, 6))
    }).catch(e => logger.error("game", "Failed to fetch data", e))
  }, [params.id, isMyProfile])

  const startEditing = useCallback(() => {
    setEditName(hero?.name ?? "")
    setEditDesc(hero?.description ?? "")
    setEditing(true)
  }, [hero])

  const cancelEditing = useCallback(() => { setEditing(false) }, [])

  const saveProfile = useCallback(async () => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/hero/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || "Error al guardar")
        return
      }
      const updated = await res.json()
      setHero((prev: any) => ({ ...prev, ...updated, description: editDesc.trim() }))
      setEditing(false)
      showToast("✅ Perfil actualizado")
    } catch {
      showToast("❌ Error de conexión")
    } finally {
      setSaving(false)
    }
  }, [editName, editDesc, params.id])

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  const epForLevel = (level: number) => Math.round(200 * Math.pow(1.6, level - 1))
  const currentLevelEp = epForLevel(hero.level)
  const previousLevelsEp = Array.from({ length: hero.level - 1 }, (_, i) => epForLevel(i + 1)).reduce((a, b) => a + b, 0)
  const epInCurrent = (hero.epTotal ?? 0) - previousLevelsEp
  const epProgress = Math.min(100, Math.round((epInCurrent / currentLevelEp) * 100))

  const base = (hero.attrs ?? {}) as Record<string, number>
  const effectiveAttrs = (hero.computedAttrs ?? base) as Record<string, number>

  const winRate = (hero.arenaWins ?? 0) + (hero.arenaLosses ?? 0) > 0
    ? Math.round(((hero.arenaWins ?? 0) / ((hero.arenaWins ?? 0) + (hero.arenaLosses ?? 0))) * 100)
    : 0

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-gray-900 border border-amber-800/50 text-sm text-amber-300 shadow-lg">
          {toast}
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-start gap-5">
          <span className="text-5xl">{hero.race?.icon ?? "🧙"}</span>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-lg font-bold"
                  placeholder="Nombre del héroe" maxLength={40} />
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm"
                  placeholder="Descripción (opcional)" rows={2} maxLength={500} />
                <div className="flex gap-2">
                  <button onClick={saveProfile} disabled={saving || !editName.trim()}
                    className="px-4 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-sm font-bold text-white transition disabled:opacity-50">
                    {saving ? "..." : "💾 Guardar"}
                  </button>
                  <button onClick={cancelEditing}
                    className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">{hero.name}</h2>
                  {isMyProfile && (
                    <button onClick={startEditing} className="text-xs text-amber-500 hover:text-amber-400 transition">✏️</button>
                  )}
                </div>
                <p className="text-sm text-gray-400">{hero.class?.icon ?? ""} {hero.race?.name ?? ""} · {hero.class?.name ?? ""}</p>
                {hero.race?.flavor && <p className="text-xs text-gray-500 italic mt-1">"{hero.race.flavor}"</p>}
                {hero.description && <p className="text-sm text-gray-400 mt-2">{hero.description}</p>}
                {hero.clanMember && (
                  <p className="text-xs text-gray-400 mt-1">
                    {hero.clanMember.clan.icon} [{hero.clanMember.clan.tag}] {hero.clanMember.clan.name}
                    <span className="text-gray-500 ml-1">· {hero.clanMember.role}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Core Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Nivel" value={hero.level} icon="📈" />
        <StatCard label="Fama" value={hero.fame} icon="🏆" />
        <StatCard label="ELO" value={hero.eloRating} icon="⚔️" />
        <StatCard label="Oro" value={`${hero.gold}💰`} icon="" />
      </div>

      {/* EP Progress */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Experiencia</span>
          <span>{epInCurrent} / {currentLevelEp} EP</span>
        </div>
        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${epProgress}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>Nv. {hero.level}</span>
          <span>Siguiente: Nv. {hero.level + 1}</span>
        </div>
      </div>

      {/* Free Attribute Points */}
      {hero.freeAttrPoints > 0 && (
        <div className="bg-gray-900 rounded-xl border border-amber-800/60 p-4 text-center">
          <p className="text-xs text-amber-400/80">🎯 Puntos de atributo disponibles</p>
          <p className="text-2xl font-bold text-amber-400">{hero.freeAttrPoints}</p>
          {isMyProfile && (
            <a href="/hero/attrs" className="inline-block mt-2 text-xs text-amber-500 hover:text-amber-400 underline">Asignar puntos →</a>
          )}
        </div>
      )}

      {/* Attributes */}
      {hero.attrs && typeof hero.attrs === "object" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="font-bold text-sm mb-3">📊 Atributos</h3>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(base).map(([key, val]) => {
              const total = effectiveAttrs[key] ?? val
              const bonus = total - val
              return (
                <div key={key} className="bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">{ATTR_LABELS[key] ?? key}</p>
                  <p className="text-sm font-bold text-amber-400">{total}</p>
                  {bonus > 0 && <p className="text-[10px] text-green-400">+{bonus}</p>}
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3 text-xs">
            <span className="text-gray-400">⚡ Iniciativa base (AGI + ⌊PER / 2⌋)</span>
            <span className="font-bold text-amber-400">{hero.computedInitiativeBase ?? "—"}</span>
          </div>
        </div>
      )}

      {/* HP/MP + Arena */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-xs text-gray-400 mb-1">❤️ HP</p>
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold text-sm">{hero.hpCurrent ?? "?"}</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${((hero.hpCurrent ?? 1) / (hero.computedHpMax ?? hero.hpMax ?? 1)) * 100}%` }} />
            </div>
            <span className="text-gray-500 text-xs">{hero.computedHpMax ?? hero.hpMax ?? "?"}</span>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-xs text-gray-400 mb-1">💧 MP</p>
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-bold text-sm">{hero.mpCurrent ?? "?"}</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((hero.mpCurrent ?? 1) / (hero.computedMpMax ?? hero.mpMax ?? 1)) * 100}%` }} />
            </div>
            <span className="text-gray-500 text-xs">{hero.computedMpMax ?? hero.mpMax ?? "?"}</span>
          </div>
        </div>
      </div>

      {/* Combat Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
          <p className="text-xs text-gray-400">⚔️ Arena</p>
          <p className="text-lg font-bold text-green-400">{hero.arenaWins ?? 0}W</p>
          <p className="text-xs text-gray-500">/ {hero.arenaLosses ?? 0}L</p>
          <p className="text-[10px] text-gray-600 mt-1">{winRate}% win</p>
        </div>
        {stats?.summary && (
          <>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
              <p className="text-xs text-gray-400">🗺️ Mazmorras</p>
              <p className="text-lg font-bold text-purple-400">{stats.summary.totalRuns ?? 0}</p>
              <p className="text-[10px] text-gray-600">{stats.summary.winRate ?? 0}% victoria</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
              <p className="text-xs text-gray-400">📅 Racha</p>
              <p className="text-lg font-bold text-orange-400">{hero.loginStreak ?? 0}🔥</p>
              <p className="text-[10px] text-gray-600">días consecutivos</p>
            </div>
          </>
        )}
      </div>

      {/* Equipment */}
      {hero.items?.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="font-bold text-sm mb-3">🛡️ Equipamiento</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {hero.items.map((hi: any) => (
              <div key={hi.id} className={`bg-gray-800 rounded-lg p-2 text-center border ${RARITY_COLORS[hi.item?.rarity] ?? "border-gray-700"}`}>
                <span className="text-xl block">{hi.item?.icon ?? "📦"}</span>
                <p className="text-[10px] font-bold truncate">{hi.item?.name ?? "?"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {hero.skills?.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="font-bold text-sm mb-3">⚡ Skills</h3>
          <div className="flex flex-wrap gap-1.5">
            {hero.skills.map((hs: any) => (
              <span key={hs.id} className="px-2 py-1 rounded bg-gray-800 text-xs flex items-center gap-1">
                {hs.skill?.icon ?? "⚡"} {hs.skill?.name ?? "?"}
                <span className="text-gray-500 text-[10px]">T{hs.skill?.tier ?? "?"}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">🏅 Logros recientes</h3>
            <a href="/achievements" className="text-[10px] text-amber-500 hover:text-amber-400">Ver todos →</a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {achievements.map((a: any) => (
              <div key={a.id} className="bg-gray-800 rounded-lg p-2 flex items-center gap-2">
                <span className="text-lg">{a.icon ?? "🏅"}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{a.name}</p>
                  <p className="text-[10px] text-gray-500">{a.completedAt ? new Date(a.completedAt).toLocaleDateString() : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dungeon Stats */}
      {stats?.dungeonStats && stats.dungeonStats.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="font-bold text-sm mb-3">🗺️ Mazmorras jugadas</h3>
          <div className="space-y-2">
            {stats.dungeonStats.slice(0, 5).map((d: any, i: number) => (
              <div key={"dungeon-" + i} className="flex items-center gap-3 text-xs">
                <span className="text-lg">{d.icon}</span>
                <span className="flex-1 truncate">{d.name}</span>
                <span className="text-gray-500">{d.runs} runs</span>
                <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${d.runs > 0 ? Math.round((d.wins / d.runs) * 100) : 0}%` }} />
                </div>
                <span className="text-gray-500 w-8 text-right">{d.runs > 0 ? Math.round((d.wins / d.runs) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: Readonly<{ label: string; value: any; icon: string }>) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
      <p className="text-xs text-gray-400">{icon} {label}</p>
      <p className="text-xl font-bold text-yellow-400">{value ?? "—"}</p>
    </div>
  )
}
