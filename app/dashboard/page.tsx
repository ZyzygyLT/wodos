"use client"

import logger from "@/lib/logger"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import DailyLoginModal from "@/components/game/DailyLoginModal"
import { DashboardSkeleton } from "@/components/game/Skeleton"

interface HeroData {
  id: string; name: string; level: number; classId: number; raceId: number
  class: { id: number; name: string; icon: string; slug: string }
  race: { id: number; name: string; icon: string; slug: string }
  attrs: Record<string, number>
  hpMax: number; hpCurrent: number
  mpMax: number; mpCurrent: number
  gold: number; fame: number
  epTotal: number; epSpent: number; freeAttrPoints: number
  combatProfiles: CombatProfile[]
  computedDefense?: Record<string, number>
  defenseBreakdown?: Record<string, string[]>
  heroCount?: number
  maxHeroes?: number
}

interface CombatProfile {
  id: string; name: string; position: string
  prelimRules: any[]; roundRules: any[]
}

const ATTR_LABELS: Record<string, string> = {
  st: 'Fuerza', co: 'Constitución', in: 'Inteligencia',
  dx: 'Destreza', ch: 'Carisma', ag: 'Agilidad',
  pe: 'Percepción', wi: 'Voluntad',
}

const POSITION_LABELS: Record<string, string> = {
  front: 'Frontal', center: 'Centro', rear: 'Trasera',
  left_flank: 'Flanco izq.', right_flank: 'Flanco der.', flexible: 'Flexible',
}

export default function Dashboard() {
  const router = useRouter()
  const [hero, setHero] = useState<HeroData | null>(null)
  const [spending, setSpending] = useState<Record<string, number>>({})
  const [tab, setTab] = useState('hero')
  const [renamingProfile, setRenamingProfile] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState("")
  const [newProfilePosition, setNewProfilePosition] = useState("front")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(t)
    }
  }, [message])

  const fetchData = useCallback(async () => {
    try {
      const heroRes = await fetch("/api/hero")
      if (heroRes.status === 401) return router.push("/login")
      if (heroRes.status === 404) return router.push("/onboarding")
      setHero(await heroRes.json())
    } catch (e) { logger.error('dashboard', 'Failed to load data', e) }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const epForLevel = (level: number) => Math.round(200 * Math.pow(1.6, level - 1))
  const currentLevelEp = hero ? epForLevel(hero.level) : 1
  const previousLevelsEp = hero ? Array.from({ length: hero.level - 1 }, (_, i) => epForLevel(i + 1)).reduce((a, b) => a + b, 0) : 0
  const epInCurrent = hero ? hero.epTotal - previousLevelsEp : 0
  const epProgress = Math.min(100, Math.round((epInCurrent / currentLevelEp) * 100))

  const epAvailable = hero ? hero.epTotal - hero.epSpent : 0

  function attrCost(val: number): number {
    if (val < 10) return 10
    if (val < 15) return 15
    if (val < 20) return 20
    return 30
  }

  function calcTotalCost(): number {
    if (!hero) return 0
    return Object.entries(spending)
      .filter(([, v]) => v !== 0)
      .reduce((total, [attr, amount]) => {
        const currentVal = hero.attrs[attr] || 0
        if (amount > 0) {
          for (let i = 0; i < amount; i++) total += attrCost(currentVal + i)
        } else {
          for (let i = 0; i < Math.abs(amount); i++) total -= attrCost(currentVal - 1 - i)
        }
        return total
      }, 0)
  }

  async function spendPoints() {
    const entries = Object.entries(spending).filter(([, v]) => v !== 0)
    if (entries.length !== 1) { setMessage("Solo podés modificar un atributo a la vez"); return }
    const [attr, amount] = entries[0]

    try {
      const res = await fetch("/api/hero/attrs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attr, amount }),
      })

      if (res.ok) {
        setSpending({})
        fetchData()
      } else {
        const data = await res.json()
        setMessage(data.error || "Error al gastar EP")
      }
    } catch { setMessage("Error de red al gastar EP") }
  }

  async function renameProfile(profileId: string) {
    try {
      const res = await fetch(`/api/hero/profiles/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue }),
      })
      if (res.ok) {
        setRenamingProfile(null)
        fetchData()
      }
    } catch (e) { logger.error('dashboard', 'Failed to load data', e) }
  }

  async function deleteProfile(profileId: string) {
    try {
      const res = await fetch(`/api/hero/profiles/${profileId}`, { method: "DELETE" })
      if (res.ok) {
        fetchData()
      } else {
        const data = await res.json()
        setMessage(data.error || "Error al eliminar")
      }
    } catch { setMessage("Error de red al eliminar perfil") }
  }

  async function addProfile() {
    if (!newProfileName.trim()) return
    try {
      const res = await fetch("/api/hero/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProfileName.trim(), position: newProfilePosition }),
      })
      if (res.ok) {
        setShowAddProfile(false)
        setNewProfileName("")
        setNewProfilePosition("front")
        fetchData()
      }
    } catch (e) { logger.error('dashboard', 'Failed to load data', e) }
  }

  if (!hero) return <div className="min-h-screen bg-gray-950"><DashboardSkeleton /></div>

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <DailyLoginModal onClaimed={fetchData} />
      {message && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-gray-900 border border-amber-800/50 text-sm text-amber-300 shadow-lg cursor-pointer" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-yellow-400">⚔️ Ironhold</h1>
        <div className="flex items-center gap-4 text-sm">
          <span>{hero.name}</span>
          <span className="text-yellow-400">Nv. {hero.level}</span>
          <span className="text-yellow-300">💰 {hero.gold}</span>
          <span className="text-gray-500 text-xs">{hero.heroCount ?? 1}/{hero.maxHeroes ?? 3} héroes</span>
          <Link href="/dungeon" className="text-gray-400 hover:text-gray-200 text-xs">🗺️ Ir al juego</Link>
        </div>
      </header>

      <div className="flex border-b border-gray-800">
        {[
          { key: 'hero', label: 'Héroe' },
          { key: 'attrs', label: 'Atributos' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-center text-sm font-medium transition ${tab === t.key ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div>
        {tab === 'hero' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl">{hero.class.icon} {hero.race.icon}</span>
                <div>
                  <h2 className="text-2xl font-bold">{hero.name}</h2>
                  <p className="text-gray-400">{hero.class.name} · {hero.race.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-400">HP</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(hero.hpCurrent / hero.hpMax) * 100}%` }} />
                    </div>
                    <span>{hero.hpCurrent}/{hero.hpMax}</span>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-400">MP</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(hero.mpCurrent / hero.mpMax) * 100}%` }} />
                    </div>
                    <span>{hero.mpCurrent}/{hero.mpMax}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-gray-800 rounded-lg p-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Experiencia</span>
                  <span>{epInCurrent} / {currentLevelEp} EP</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${epProgress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Nv. {hero.level}</span>
                  <span>Siguiente: Nv. {hero.level + 1}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-400">Puntos libres</span>
                  <p className="text-xl font-bold text-yellow-400">{hero.freeAttrPoints}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-400">Fama</span>
                  <p className="text-xl font-bold">🏆 {hero.fame}</p>
                </div>
              </div>

              {hero.computedDefense && (
                <div className="mt-4 bg-gray-800 rounded-lg p-3">
                  <span className="text-gray-400 text-xs">🛡️ Defensa por categoría</span>
                  <div className="flex gap-3 mt-1 text-sm">
                    {['melee', 'ranged', 'magic'].map(cat => {
                      const breakdown = hero.defenseBreakdown?.[cat]
                      return (
                        <div key={cat} className="flex-1 text-center bg-gray-700/50 rounded p-2 relative group">
                          <div className="text-xs text-gray-500 capitalize">{cat}</div>
                          <div className="text-lg font-bold text-cyan-400">{hero.computedDefense![cat] ?? '—'}</div>
                          {breakdown && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-[11px] text-gray-300 whitespace-nowrap z-10 shadow-xl text-left">
                              {breakdown.map((l, i) => <div key={"def-" + i}>{l}</div>)}
                              <div className="border-t border-gray-700 mt-1 pt-1 text-blue-300">Total: {hero.computedDefense![cat]}</div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">⚙️ Configuraciones de combate</h2>
                <button onClick={() => setShowAddProfile(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
                  + Agregar
                </button>
              </div>

              <div className="space-y-2">
                {hero.combatProfiles.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-lg">⚔️</span>
                      {renamingProfile === p.id ? (
                        <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { renameProfile(p.id); } if (e.key === 'Escape') { setRenamingProfile(null); } }}
                          onBlur={() => renameProfile(p.id)}
                          className="bg-gray-700 rounded px-2 py-1 text-sm w-40 outline-none focus:ring-1 focus:ring-yellow-500"
                          autoFocus />
                      ) : (
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-gray-400">{POSITION_LABELS[p.position] ?? p.position}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setRenamingProfile(p.id); setRenameValue(p.name) }}
                        className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition">
                        ✏️
                      </button>
                      <button onClick={() => deleteProfile(p.id)}
                        className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-red-900 text-gray-300 transition">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {showAddProfile && (
                <div className="mt-4 bg-gray-800 rounded-lg p-4 space-y-3">
                  <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
                    placeholder="Nombre del perfil"
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-yellow-500" />
                  <select value={newProfilePosition} onChange={e => setNewProfilePosition(e.target.value)}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-yellow-500">
                    {Object.entries(POSITION_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={addProfile}
                      className="flex-1 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold transition">
                      Crear
                    </button>
                    <button onClick={() => setShowAddProfile(false)}
                      className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'attrs' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Atributos</h2>
              <span className="text-yellow-400">{epAvailable} EP disponibles</span>
            </div>

            <div className="space-y-3">
              {Object.entries(ATTR_LABELS).map(([key, label]) => {
                const base = hero.attrs[key] || 0
                const add = spending[key] || 0
                const attrVal = base + add
                const nextCost = attrCost(attrVal)
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-400">{label}</div>
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(base / 30) * 100}%` }} />
                    </div>
                    <div className="w-8 text-right font-mono">{base}</div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSpending(s => ({ ...s, [key]: (s[key] || 0) - 1 }))}
                        className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-30"
                        disabled={attrVal <= 0}>−</button>
                      <span className="w-8 text-center text-sm text-yellow-400">
                        {add > 0 ? `+${add}` : add < 0 ? `${add}` : ''}
                      </span>
                      <span className="text-xs text-yellow-500 w-12 text-right">
                        {add > 0 ? `${nextCost} EP` : add < 0 ? `-${attrCost(attrVal)} EP` : ''}
                      </span>
                      <button onClick={() => setSpending(s => ({ ...s, [key]: (s[key] || 0) + 1 }))}
                        className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-30"
                        disabled={epAvailable - calcTotalCost() < nextCost}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {Object.values(spending).some(v => v !== 0) && (
              <button onClick={spendPoints}
                className="w-full mt-6 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition">
                {calcTotalCost() >= 0 ? `Gastar ${calcTotalCost()} EP` : `Devolver ${Math.abs(calcTotalCost())} EP`}
              </button>
            )}
          </div>
        )}
        </div>

        <aside className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-bold text-yellow-400 mb-3">👤 Héroe</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{hero.class.icon} {hero.race.icon}</span>
                <div>
                  <p className="font-bold">{hero.name}</p>
                  <p className="text-xs text-gray-400">{hero.class.name} · {hero.race.name}</p>
                </div>
              </div>
              <div className="flex justify-between border-t border-gray-800 pt-2">
                <span className="text-gray-400">Nivel</span>
                <span className="text-yellow-400">{hero.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Oro</span>
                <span className="text-yellow-300">💰 {hero.gold}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fama</span>
                <span>🏆 {hero.fame}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Héroes</span>
                <span className="text-xs">{hero.heroCount ?? 1}/{hero.maxHeroes ?? 3}</span>
              </div>
              <div className="pt-2 border-t border-gray-800">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">EXP</span>
                  <span>{epInCurrent} / {currentLevelEp}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${epProgress}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-bold text-green-400 mb-3">🗺️ Mazmorras</h3>
            <div className="space-y-2 text-sm">
              <Link href="/dungeon" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                <span>⚔️</span>
                <span>Ir a mazmorras</span>
              </Link>
              <Link href="/dungeon/reports" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                <span>📜</span>
                <span>Historial</span>
              </Link>
              <Link href="/profile" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                <span>👤</span>
                <span>Perfil</span>
              </Link>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">⚡ Atajos</h3>
            <div className="space-y-2 text-sm">
              <Link href="/skills" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                <span>⚡</span>
                <span>Habilidades</span>
              </Link>
              <Link href="/inventory" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                <span>🎒</span>
                <span>Inventario</span>
              </Link>
              <Link href="/shop" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                <span>🏪</span>
                <span>Tienda</span>
              </Link>
              <Link href="/quests" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                <span>📋</span>
                <span>Misiones</span>
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
