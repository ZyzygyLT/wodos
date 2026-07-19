"use client"

import logger from "@/lib/logger"

import { useEffect, useState, useCallback } from "react"

interface ClassInfo { id: number; name: string; slug: string }

interface Skill {
  id: number; classId: number; name: string; slug: string; icon: string
  type: string; tier: number; timing: string; description: string; effect: string
  epCost: number; goldCost: number; manaCost: number; multiplier: number
  cooldownRounds: number; maxRank: number; requiresSkills: number[]
  attackCategory?: string | null
  defenseCategory?: string | null
  formula: any; tags: string[]
  class: ClassInfo
}

const EMPTY_FORM = {
  classId: 1, name: '', slug: '', icon: '⚡', type: 'active', tier: 1,
  timing: 'round', description: '', effect: '', epCost: 0, goldCost: 0,
  manaCost: 5, multiplier: 1, cooldownRounds: 0, maxRank: 10,
  requiresSkills: [], formula: null, tags: [],
  attackCategory: null, defenseCategory: null,
}

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [editing, setEditing] = useState<Partial<Skill> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    fetch("/api/admin/skills").then(r => r.json()).then(setSkills).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
    fetch("/api/admin/classes").then(r => r.json()).then(setClasses).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const isNew = !editing.id
      const res = await fetch("/api/admin/skills", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      })
      if (res.ok) { setEditing(null); load() }
    } catch (e) { logger.error('admin-skills', 'Failed to delete skill', e) }
    setSaving(false)
  }

  async function remove(id: number) {
    if (!confirm("¿Borrar esta skill?")) return
    await fetch(`/api/admin/skills?id=${id}`, { method: "DELETE" }).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">⚡ Skills</h1>
        <button onClick={() => setEditing(EMPTY_FORM)}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold transition">
          + Nueva
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)} role="dialog" aria-modal="true">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing.id ? "Editar" : "Nueva"} Skill</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="skill-name" className="block text-xs text-gray-400 mb-1">Nombre</label>
                  <input id="skill-name" value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="skill-slug" className="block text-xs text-gray-400 mb-1">Slug</label>
                    <input id="skill-slug" value={editing.slug ?? ''} onChange={e => setEditing({ ...editing, slug: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="skill-class" className="block text-xs text-gray-400 mb-1">Clase</label>
                  <select id="skill-class" value={editing.classId ?? ''} onChange={e => setEditing({ ...editing, classId: e.target.value ? Number.parseInt(e.target.value) : (null as any) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                    <option value="">Global</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="skill-icon" className="block text-xs text-gray-400 mb-1">Icono</label>
                  <input id="skill-icon" value={editing.icon ?? ''} onChange={e => setEditing({ ...editing, icon: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[{key:'type',label:'Tipo'},{key:'tier',label:'Tier'},{key:'timing',label:'Timing'},{key:'effect',label:'Efecto'}].map(f => (
                    <div key={f.key}>
                      <label htmlFor={`skill-${f.key}`} className="block text-xs text-gray-400 mb-1">{f.label}</label>
                      <input id={`skill-${f.key}`} value={(editing as any)[f.key] ?? ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="skill-attack-category" className="block text-xs text-gray-400 mb-1">Categoría ataque</label>
                  <select id="skill-attack-category" value={editing.attackCategory ?? ''} onChange={e => setEditing({ ...editing, attackCategory: e.target.value || null })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                    <option value="">—</option>
                    <option value="melee">Cuerpo a cuerpo</option>
                    <option value="ranged">A distancia</option>
                    <option value="magic">Mágico</option>
                  </select>
                  </div>
                  <div>
                    <label htmlFor="skill-defense-category" className="block text-xs text-gray-400 mb-1">Categoría defensa</label>
                    <select id="skill-defense-category" value={editing.defenseCategory ?? ''} onChange={e => setEditing({ ...editing, defenseCategory: e.target.value || null })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                    <option value="">—</option>
                    <option value="melee">Cuerpo a cuerpo</option>
                    <option value="ranged">A distancia</option>
                    <option value="magic">Mágico</option>
                    <option value="all">Todas</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="skill-description" className="block text-xs text-gray-400 mb-1">Descripción</label>
                <textarea id="skill-description" value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[{key:'manaCost',label:'Mana'},{key:'epCost',label:'EP'},{key:'goldCost',label:'Oro'},{key:'cooldownRounds',label:'CD (rds)'}].map(f => (
                  <div key={f.key}>
                    <label htmlFor={`skill-${f.key}`} className="block text-xs text-gray-400 mb-1">{f.label}</label>
                    <input id={`skill-${f.key}`} type="number" value={(editing as any)[f.key] ?? 0} onChange={e => setEditing({ ...editing, [f.key]: Number.parseInt(e.target.value) || 0 })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{key:'multiplier',label:'Multiplier'},{key:'maxRank',label:'Max Rank'}].map(f => (
                  <div key={f.key}>
                    <label htmlFor={`skill-${f.key}`} className="block text-xs text-gray-400 mb-1">{f.label}</label>
                    <input id={`skill-${f.key}`} type="number" step="0.1" value={(editing as any)[f.key] ?? 0} onChange={e => setEditing({ ...editing, [f.key]: Number.parseFloat(e.target.value) || 0 })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
              <div>
                <label htmlFor="skill-formula" className="block text-xs text-gray-400 mb-1">Formula (JSON)</label>
                <textarea id="skill-formula" value={editing.formula ? JSON.stringify(editing.formula, null, 2) : ''}
                  onChange={e => { try { setEditing({ ...editing, formula: JSON.parse(e.target.value) }) } catch {} }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono" rows={3} />
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
              <th className="text-left py-3 px-4"></th>
              <th className="text-left py-3 px-4">Nombre</th>
              <th className="text-left py-3 px-4">Clase</th>
              <th className="text-left py-3 px-4">Tipo</th>
              <th className="text-left py-3 px-4">Categ.</th>
              <th className="text-left py-3 px-4">Mana</th>
              <th className="text-left py-3 px-4">Mult</th>
              <th className="text-left py-3 px-4">CD</th>
              <th className="text-left py-3 px-4">Tier</th>
              <th className="text-right py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {skills.map(s => (
              <tr key={s.id} className="border-t border-gray-800/50 hover:bg-white/5">
                <td className="py-3 px-4 text-lg">{s.icon}</td>
                <td className="py-3 px-4 font-medium">{s.name}</td>
                <td className="py-3 px-4 text-gray-400">{s.class?.name ?? '—'}</td>
                <td className="py-3 px-4">{s.type}</td>
                <td className="py-3 px-4 text-xs">{s.attackCategory ?? s.defenseCategory ?? '—'}</td>
                <td className="py-3 px-4 font-mono">{s.manaCost}</td>
                <td className="py-3 px-4 font-mono">{s.multiplier}x</td>
                <td className="py-3 px-4">{s.cooldownRounds > 0 ? `${s.cooldownRounds} rd` : '—'}</td>
                <td className="py-3 px-4">{s.tier}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => setEditing(s)} className="text-blue-400 hover:text-blue-300 mr-3">Editar</button>
                  <button onClick={() => remove(s.id)} className="text-red-400 hover:text-red-300">Borrar</button>
                </td>
              </tr>
            ))}
            {skills.length === 0 && (
              <tr>              <td colSpan={10} className="py-8 text-center text-gray-500">No hay skills.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
