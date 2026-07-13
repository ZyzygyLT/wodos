"use client"

import logger from "@/lib/logger"

import { useEffect, useState, useCallback } from "react"

interface Achievement {
  id: string; slug: string; name: string; icon: string; description: string
  category: string; condition: any; rewards: any; order: number
}

const EMPTY_FORM: Partial<Achievement> = { slug: '', name: '', icon: '🏅', description: '', category: 'combat', condition: {}, rewards: {}, order: 0 }

export default function AdminAchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [editing, setEditing] = useState<Partial<Achievement> | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch("/api/admin/achievements").then(r => r.json()).then(d => setAchievements(Array.isArray(d) ? d : [])).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    if (!editing.name || !editing.slug) { setMessage("❌ Nombre y slug requeridos"); return }
    setSaving(true)
    const isNew = !editing.id
    const body = JSON.stringify(isNew ? editing : { ...editing, id: editing.id })
    try {
      const res = await fetch("/api/admin/achievements", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      })
      if (res.ok) { setEditing(null); setMessage(isNew ? "✅ Logro creado" : "✅ Logro actualizado"); load() }
      else { const d = await res.json(); setMessage(`❌ ${d.error || "Error"}`) }
    } catch { setMessage("❌ Error de red") }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm("¿Borrar logro?")) return
    await fetch(`/api/admin/achievements?id=${id}`, { method: "DELETE" }).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
    setMessage("🗑️ Logro borrado")
    load()
  }

  return (
    <div>
      {message && <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer" onClick={() => setMessage(null)}>{message}</button>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🏅 Logros</h1>
        <button onClick={() => setEditing(EMPTY_FORM)}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold transition">+ Nuevo</button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)} role="dialog" aria-modal="true">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing.id ? "Editar" : "Nuevo"} Logro</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="achievement-nombre" className="block text-xs text-gray-400 mb-1">Nombre</label>
                   <input id="achievement-nombre" value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="achievement-slug" className="block text-xs text-gray-400 mb-1">Slug</label>
                     <input id="achievement-slug" value={editing.slug ?? ''} onChange={e => setEditing({ ...editing, slug: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="achievement-icono" className="block text-xs text-gray-400 mb-1">Icono</label>
                     <input id="achievement-icono" value={editing.icon ?? ''} onChange={e => setEditing({ ...editing, icon: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="achievement-categoria" className="block text-xs text-gray-400 mb-1">Categoría</label>
                     <input id="achievement-categoria" value={editing.category ?? ''} onChange={e => setEditing({ ...editing, category: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="achievement-descripcion" className="block text-xs text-gray-400 mb-1">Descripción</label>
                 <textarea id="achievement-descripcion" value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" rows={2} />
              </div>
              <div>
                <label htmlFor="achievement-condition-json" className="block text-xs text-gray-400 mb-1">Condition (JSON)</label>
                 <textarea id="achievement-condition-json" value={JSON.stringify(editing.condition ?? {}, null, 2)}
                  onChange={e => { try { setEditing({ ...editing, condition: JSON.parse(e.target.value) }) } catch {} }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-xs" rows={3} />
                <div className="flex gap-1 mt-1">
                  {[['asesinatos','{"type":"kill_count","target":100}'],['mazmorra','{"type":"dungeon_clear","target":"dungeon_slug"}'],['nivel','{"type":"level_reach","target":50}']].map(([label,val]) => (
                    <button key={label} onClick={() => { try { setEditing({...editing, condition: JSON.parse(val)}) } catch {} }}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded">{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="achievement-rewards-json" className="block text-xs text-gray-400 mb-1">Rewards (JSON)</label>
                 <textarea id="achievement-rewards-json" value={JSON.stringify(editing.rewards ?? {}, null, 2)}
                  onChange={e => { try { setEditing({ ...editing, rewards: JSON.parse(e.target.value) }) } catch {} }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-xs" rows={3} />
                <div className="flex gap-1 mt-1">
                  {[['monedas','{"gold":500,"ep":200}'],['titulo','{"title":"Legendario"}'],['vacio','{}']].map(([label,val]) => (
                    <button key={label} onClick={() => { try { setEditing({...editing, rewards: JSON.parse(val)}) } catch {} }}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded">{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="achievement-orden" className="block text-xs text-gray-400 mb-1">Orden</label>
                 <input id="achievement-orden" type="number" value={editing.order ?? 0} onChange={e => setEditing({ ...editing, order: Number.parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
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
              <th className="text-left py-3 px-4">Categoría</th>
              <th className="text-left py-3 px-4">Condición</th>
              <th className="text-center py-3 px-4">Orden</th>
              <th className="text-right py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {achievements.map(a => (
              <tr key={a.id} className="border-t border-gray-800/50 hover:bg-white/5">
                <td className="py-3 px-4 text-lg">{a.icon}</td>
                <td className="py-3 px-4 font-medium">{a.name}</td>
                <td className="py-3 px-4 text-xs text-gray-400">{a.category}</td>
                <td className="py-3 px-4 text-xs font-mono text-gray-500">{JSON.stringify(a.condition).slice(0, 40)}</td>
                <td className="py-3 px-4 text-center">{a.order}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => setEditing(a)} className="text-blue-400 hover:text-blue-300 mr-3">Editar</button>
                  <button onClick={() => remove(a.id)} className="text-red-400 hover:text-red-300">Borrar</button>
                </td>
              </tr>
            ))}
            {achievements.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-500">No hay logros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
