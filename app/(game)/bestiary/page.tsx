"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DAMAGE_ICONS, DAMAGE_LABELS } from "@/components/combat/constants"

interface EnemySkill {
  id: number; name: string; icon: string; description?: string; manaCost?: number; cooldownRounds?: number
}

interface BestiaryEnemy {
  id: number; name: string; icon: string; level: number
  hp: number; mp: number; atk: number; def: number; dx: number; ag: number
  position: string; faction: string | null; damageType: string | null
  conditions: any; ai: any
  skills: EnemySkill[]
  appearances: { dungeonId: number; dungeonName: string; dungeonIcon: string; levelNumber: number }[]
  isBoss: boolean
}

const FACTION_INFO: Record<string, { icon: string; label: string; color: string; bonus: string }> = {
  arachnid: { icon: "🕷️", label: "Arácnidos", color: "text-green-400", bonus: "2+ vivos: +50% ATK" },
  undead: { icon: "💀", label: "No-muertos", color: "text-gray-400", bonus: "3+ vivos: +15% ATK, +10 DEF" },
  fire: { icon: "🔥", label: "Fuego", color: "text-orange-400", bonus: "2+ vivos: ataques aplican quemadura" },
  darkness: { icon: "🌑", label: "Oscuridad", color: "text-purple-400", bonus: "2+ vivos: curan 8% HP/ronda" },
  elemental: { icon: "🌀", label: "Elementales", color: "text-cyan-400", bonus: "2+ vivos: +50% DEF" },
  goblin: { icon: "👺", label: "Goblins", color: "text-yellow-400", bonus: "3+ vivos: +25% ATK" },
  slime: { icon: "🟢", label: "Slimes", color: "text-lime-400", bonus: "2+ vivos: +20% DEF" },
  trap: { icon: "⚠️", label: "Trampas", color: "text-red-400", bonus: "2+ vivos: +20% ATK" },
  dragon: { icon: "🐉", label: "Dragones", color: "text-red-300", bonus: "+10% Físico/Fuego/Hielo" },
  demon: { icon: "👹", label: "Demonios", color: "text-red-500", bonus: "+20% Fuego" },
  plant: { icon: "🌿", label: "Plantas", color: "text-green-300", bonus: "+30% Veneno" },
}

const FACTION_RESISTANCES: Record<string, string> = {
  slime: "+15% Físico",
  undead: "+20% Oscuridad, -20% Sagrado",
  demon: "+20% Fuego",
  elemental: "+30% Fuego, +30% Hielo",
  dragon: "+10% Físico, +10% Fuego, +10% Hielo",
  plant: "+30% Veneno",
  goblin: "+15% Mental",
}

const RARITY_COLORS = {
  common: "border-gray-600",
  uncommon: "border-green-600",
  rare: "border-blue-600",
  epic: "border-purple-600",
  unique: "border-orange-500",
}

export default function BestiaryPage() {
  const router = useRouter()
  const [enemies, setEnemies] = useState<BestiaryEnemy[]>([])
  const [heroKills, setHeroKills] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null)
  const [selectedEnemy, setSelectedEnemy] = useState<BestiaryEnemy | null>(null)
  const [showKillsOnly, setShowKillsOnly] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/bestiary")
      if (res.status === 401) { router.push("/login"); return }
      if (res.ok) {
        const data = await res.json()
        setEnemies(data.enemies)
        setHeroKills(data.heroKills ?? {})
      }
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const factions = [...new Set(enemies.map(e => e.faction).filter(Boolean))] as string[]

  const filtered = enemies.filter(e => {
    if (selectedFaction && e.faction !== selectedFaction) return false
    if (showKillsOnly && !heroKills[e.id]) return false
    return true
  })

  const totalKills = Object.values(heroKills).reduce((s, k) => s + k, 0)
  const discoveredCount = Object.keys(heroKills).length
  const discoveredPct = enemies.length > 0 ? Math.round((discoveredCount / enemies.length) * 100) : 0

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]" /></div></div>

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header stats */}
      <div className="flex flex-wrap gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex-1 min-w-[140px]">
          <p className="text-xs text-gray-500">Descubiertos</p>
          <p className="text-lg font-bold text-amber-400">{discoveredCount}/{enemies.length} <span className="text-xs text-gray-500">({discoveredPct}%)</span></p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex-1 min-w-[140px]">
          <p className="text-xs text-gray-500">Bajas totales</p>
          <p className="text-lg font-bold text-red-400">{totalKills}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 flex-1 min-w-[140px]">
          <p className="text-xs text-gray-500">Facciones</p>
          <p className="text-lg font-bold text-purple-400">{factions.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSelectedFaction(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedFaction ? "bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-800" : "bg-gray-700 text-white"}`}>
          Todos
        </button>
        {factions.map(f => {
          const info = FACTION_INFO[f] ?? { icon: "❓", label: f, color: "text-gray-400" }
          return (
            <button key={f} onClick={() => setSelectedFaction(selectedFaction === f ? null : f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${selectedFaction === f ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-800"}`}>
              <span>{info.icon}</span> {info.label}
            </button>
          )
        })}
        <div className="ml-auto">
          <button onClick={() => setShowKillsOnly(!showKillsOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${showKillsOnly ? "bg-red-900 text-red-300" : "bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-800"}`}>
            {showKillsOnly ? "☠️ Solo derrotados" : "☠️ Todos"}
          </button>
        </div>
      </div>

      {/* Enemy grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(e => {
          const kills = heroKills[e.id] ?? 0
          const info = e.faction ? FACTION_INFO[e.faction] : null
          return (
            <button type="button" key={e.id} onClick={() => setSelectedEnemy(e)}
              className={`w-full text-left bg-gray-900 rounded-xl border p-3 cursor-pointer transition hover:border-gray-600 ${
                kills > 0 ? "border-red-900/50" : "border-gray-800"
              }`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{e.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-gray-200 truncate">{e.name}</p>
                    {e.isBoss && <span className="text-[10px] text-red-400 bg-red-900/30 px-1 rounded">BOSS</span>}
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Nv.{e.level} · {info ? `${info.icon} ${info.label}` : e.faction ?? "Sin facción"}
                    {e.damageType && ` · ${DAMAGE_ICONS[e.damageType] ?? ""} ${DAMAGE_LABELS[e.damageType] ?? e.damageType}`}
                  </p>
                  <div className="flex gap-3 text-[10px] text-gray-500 mt-1">
                    <span>❤️ {e.hp}</span>
                    <span>⚔️ {e.atk}</span>
                    <span>🛡️ {e.def}</span>
                    <span>💨 {e.ag}</span>
                  </div>
                  {kills > 0 && (
                    <p className="text-[10px] text-red-400 mt-1">☠️ {kills} {kills === 1 ? "baja" : "bajas"}</p>
                  )}
                  {e.appearances.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[...new Set(e.appearances.map(a => a.dungeonName))].map(name => (
                        <span key={name} className="text-[9px] bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-500">
                          {e.appearances.find(a => a.dungeonName === name)?.dungeonIcon} {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Enemy detail modal */}
      {selectedEnemy && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEnemy(null)} role="dialog" aria-modal="true">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-4">
              <span className="text-5xl">{selectedEnemy.icon}</span>
              <div>
                <h2 className="text-xl font-bold text-gray-100">
                  {selectedEnemy.name}
                  {selectedEnemy.isBoss && <span className="text-sm text-red-400 ml-2">👑 BOSS</span>}
                </h2>
                <p className="text-sm text-gray-400">
                  Nv.{selectedEnemy.level} · {selectedEnemy.faction ? FACTION_INFO[selectedEnemy.faction]?.label : "Sin facción"}
                </p>
                {heroKills[selectedEnemy.id] > 0 && (
                  <p className="text-xs text-red-400">☠️ {heroKills[selectedEnemy.id]} {heroKills[selectedEnemy.id] === 1 ? "baja" : "bajas"}</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "❤️ HP", value: selectedEnemy.hp, color: "text-green-400" },
                { label: "💎 MP", value: selectedEnemy.mp, color: "text-blue-400" },
                { label: "⚔️ ATK", value: selectedEnemy.atk, color: "text-red-400" },
                { label: "🛡️ DEF", value: selectedEnemy.def, color: "text-yellow-400" },
                { label: "🎯 DX", value: selectedEnemy.dx, color: "text-cyan-400" },
                { label: "💨 AG", value: selectedEnemy.ag, color: "text-purple-400" },
              ].map(s => (
                <div key={s.label} className="bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Faction info */}
            {selectedEnemy.faction && FACTION_INFO[selectedEnemy.faction] && (
              <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-gray-300 mb-1">
                  {FACTION_INFO[selectedEnemy.faction].icon} {FACTION_INFO[selectedEnemy.faction].label}
                </p>
                <p className="text-[11px] text-gray-400">{FACTION_INFO[selectedEnemy.faction].bonus}</p>
                {FACTION_RESISTANCES[selectedEnemy.faction] && (
                  <p className="text-[11px] text-gray-500 mt-1">Resistencias: {FACTION_RESISTANCES[selectedEnemy.faction]}</p>
                )}
              </div>
            )}

            {/* Damage type */}
            {selectedEnemy.damageType && (
              <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-400">
                  Tipo de daño: {DAMAGE_ICONS[selectedEnemy.damageType] ?? ""} {DAMAGE_LABELS[selectedEnemy.damageType] ?? selectedEnemy.damageType}
                </p>
              </div>
            )}

            {/* Skills */}
            {selectedEnemy.skills.length > 0 && (
              <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-gray-300 mb-2">⚡ Habilidades</p>
                <div className="space-y-1">
                  {selectedEnemy.skills.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <span>{s.icon}</span>
                      <span className="text-gray-300">{s.name}</span>
                      {s.manaCost ? <span className="text-blue-400 ml-auto">{s.manaCost} MP</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI */}
            {selectedEnemy.ai && (
              <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-400">IA: {selectedEnemy.ai.type ?? "desconocida"}</p>
              </div>
            )}

            {/* Appearances */}
            {selectedEnemy.appearances.length > 0 && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-300 mb-2">🗺️ Aparece en</p>
                <div className="space-y-1">
                  {[...new Map(selectedEnemy.appearances.map(a => [a.dungeonId, a])).values()].map(a => (
                    <p key={`${a.dungeonId}-${a.levelNumber}`} className="text-xs text-gray-400">
                      {a.dungeonIcon} {a.dungeonName} — Nivel {a.levelNumber}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setSelectedEnemy(null)}
              className="mt-4 w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
