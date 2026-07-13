"use client"

import logger from "@/lib/logger"

import { useEffect, useState, useCallback } from "react"

interface SkillInfo { id: number; name: string; icon: string; class: { name: string }; defenseCategory?: string; attackCategory?: string; formula?: any }

interface Enemy {
  id: number; name: string; icon: string; hp: number; mp: number
  atk: number; def: number; dx: number; ag: number; level: number
  position: string; damageType: string | null; ai: any; lootTable: any; skillIds: number[]
}

const POSITIONS = ['front', 'center', 'rear', 'left_flank', 'right_flank', 'flexible']
const EMPTY_FORM: Partial<Enemy> = { name: '', icon: '👹', hp: 20, mp: 0, atk: 10, def: 5, dx: 10, ag: 10, level: 1, position: 'front', damageType: 'physical', ai: { type: 'weakest' }, lootTable: null, skillIds: [] }

export default function AdminEnemiesPage() {
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [allSkills, setAllSkills] = useState<SkillInfo[]>([])
  const [editing, setEditing] = useState<Partial<Enemy> | null>(null)
  const [saving, setSaving] = useState(false)
  const [skillFilter, setSkillFilter] = useState('all')

  function evalDefenseFormula(formula: any, dx: number): number {
    if (!formula) return dx * 2
    let base = formula.flatBonus ?? 0
    for (const [attr, coeff] of Object.entries(formula.attrCoeffs ?? {})) {
      if (attr === 'dx') base += (dx ?? 5) * (coeff as number)
      else if (attr === 'atk') base += (editing?.atk ?? 5) * (coeff as number)
      else if (attr === 'def') base += (editing?.def ?? 5) * (coeff as number)
      else if (attr === 'ag') base += (editing?.ag ?? 5) * (coeff as number)
      else if (attr === 'level') base += (editing?.level ?? 1) * (coeff as number)
    }
    base += 1 * (formula.skillRankCoeff ?? 0)
    const dice = formula.diceCount ?? 0
    return Math.max(1, base + (dice > 0 ? Math.round((dice * (formula.diceSides ?? 6) + dice) / 2) : 0))
  }

  const load = useCallback(() => {
    fetch("/api/admin/enemies").then(r => r.json()).then(setEnemies).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
    fetch("/api/admin/skills").then(r => r.json()).then(setAllSkills).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    setSaving(true)
    const isNew = !editing.id
    try {
      const res = await fetch("/api/admin/enemies", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      })
      if (res.ok) { setEditing(null); load() }
    } catch {}
    setSaving(false)
  }

  async function remove(id: number) {
    if (!confirm("¿Borrar este enemigo?")) return
    await fetch(`/api/admin/enemies?id=${id}`, { method: "DELETE" }).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
    load()
  }

  function toggleSkill(sid: number) {
    if (!editing) return
    const current = editing.skillIds ?? []
    setEditing({ ...editing, skillIds: current.includes(sid) ? current.filter(x => x !== sid) : [...current, sid] })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">👹 Enemies</h1>
        <button onClick={() => setEditing(EMPTY_FORM)}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold transition">
          + Nuevo
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)} role="dialog" aria-modal="true">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing.id ? "Editar" : "Nuevo"} Enemigo</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="enemy-name" className="block text-xs text-gray-400 mb-1">Nombre</label>
                  <input id="enemy-name" value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="enemy-icon" className="block text-xs text-gray-400 mb-1">Icono</label>
                    <input id="enemy-icon" value={editing.icon ?? ''} onChange={e => setEditing({ ...editing, icon: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['hp','mp','atk','def','dx','ag','level'].map(stat => (
                  <div key={stat}>
                    <label htmlFor={`enemy-${stat}`} className="block text-xs text-gray-400 mb-1 uppercase">{stat}</label>
                    <input id={`enemy-${stat}`} type="number" value={(editing as any)[stat] ?? 0} onChange={e => setEditing({ ...editing, [stat]: Number.parseInt(e.target.value) || 0 })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="enemy-position" className="block text-xs text-gray-400 mb-1">Posición</label>
                  <select id="enemy-position" value={editing.position ?? 'front'} onChange={e => setEditing({ ...editing, position: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  </div>
                  <div>
                    <label htmlFor="enemy-damage-type" className="block text-xs text-gray-400 mb-1">Damage Type</label>
                    <input id="enemy-damage-type" value={editing.damageType ?? ''} onChange={e => setEditing({ ...editing, damageType: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="enemy-ai" className="block text-xs text-gray-400 mb-1">AI (JSON)</label>
                <textarea id="enemy-ai" value={JSON.stringify(editing.ai ?? { type: 'weakest' }, null, 2)}
                  onChange={e => { try { setEditing({ ...editing, ai: JSON.parse(e.target.value) }) } catch {} }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono" rows={3} />
              </div>
              <div>
                <div className="block text-xs text-gray-400 mb-2">Skills asignadas</div>
                {allSkills.length === 0 ? (
                  <p className="text-xs text-gray-500">No hay skills disponibles. Créalas en la sección Skills.</p>
                ) : (
                  <>
                    <div className="flex gap-1 mb-2">
                      {['all','melee','ranged','magic'].map(cat => (
                        <button key={cat} onClick={() => setSkillFilter(cat)}
                          className={`px-2 py-1 rounded text-xs transition ${skillFilter === cat ? 'bg-red-800 text-red-200' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                          {cat === 'all' ? 'Todas' : cat}
                        </button>
                      ))}
                    </div>
                    {editing && (
                      <div className="text-xs text-gray-400 mb-2 space-x-2">
                        {['melee','ranged','magic'].map(cat => {
                          const skillId = editing.skillIds?.find(sid => {
                            const sk = allSkills.find(x => x.id === sid)
                            return sk?.defenseCategory === cat || sk?.defenseCategory === 'all'
                          })
                          const sk = skillId ? allSkills.find(x => x.id === skillId) : null
                          const val = sk?.formula ? evalDefenseFormula(sk.formula, editing.dx ?? 5) : (editing.dx ?? 5) * 2
                          let effect
                          if (sk?.defenseCategory) {
                            effect = sk.defenseCategory === cat ? sk.defenseCategory : 'all'
                          } else {
                            effect = '—'
                          }
                          return <span key={cat} className="text-gray-500">{cat}: <strong className="text-gray-300">{val}</strong> {effect !== '—' && <span className="text-gray-600">({effect})</span>}</span>
                        })}
                      </div>
                    )}
                    <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
                      {allSkills.filter(s => skillFilter === 'all' || s.defenseCategory === skillFilter || s.defenseCategory === 'all').map(s => {
                        const selected = (editing.skillIds ?? []).includes(s.id)
                        return (
                          <button key={s.id} onClick={() => toggleSkill(s.id)}
                            className={`text-left text-xs px-2 py-1 rounded transition ${selected ? 'bg-red-800 text-red-200' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                            {s.icon} {s.name}
                            {s.defenseCategory && <span className="ml-1 text-[10px] px-1 rounded bg-gray-700 text-gray-400">{s.defenseCategory}</span>}
                            <span className="text-gray-600"> ({s.class?.name})</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditing(null)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">Cancelar</button>
              <button onClick={save} disabled={saving}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 rounded-lg text-sm font-bold transition">
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left py-3 px-4">Icon</th>
              <th className="text-left py-3 px-4">Nombre</th>
              <th className="text-left py-3 px-4">HP</th>
              <th className="text-left py-3 px-4">ATK/DEF</th>
              <th className="text-left py-3 px-4">DX/AG</th>
              <th className="text-left py-3 px-4">Lv</th>
              <th className="text-left py-3 px-4">Pos</th>
              <th className="text-left py-3 px-4">Skills</th>
              <th className="text-right py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {enemies.map(e => (
              <tr key={e.id} className="border-t border-gray-800/50 hover:bg-white/5">
                <td className="py-3 px-4 text-lg">{e.icon}</td>
                <td className="py-3 px-4 font-medium">{e.name}</td>
                <td className="py-3 px-4 font-mono">{e.hp}</td>
                <td className="py-3 px-4 font-mono">{e.atk}/{e.def}</td>
                <td className="py-3 px-4 font-mono">{e.dx}/{e.ag}</td>
                <td className="py-3 px-4">{e.level}</td>
                <td className="py-3 px-4 text-gray-400">{e.position}</td>
                <td className="py-3 px-4 text-xs text-gray-400">{(e.skillIds ?? []).length > 0 ? `${e.skillIds.length} skill(s)` : '—'}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => setEditing(e)} className="text-blue-400 hover:text-blue-300 mr-3">Editar</button>
                  <button onClick={() => remove(e.id)} className="text-red-400 hover:text-red-300">Borrar</button>
                </td>
              </tr>
            ))}
            {enemies.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-center text-gray-500">No hay enemigos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
