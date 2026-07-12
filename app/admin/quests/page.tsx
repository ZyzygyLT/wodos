"use client"

import { useEffect, useState, useCallback } from "react"

interface Quest {
  id: string; slug: string; name: string; type: string; description: string
  npcName: string; npcDialog: string; objectives: any[]; rewards: any
  chainNext: string | null; levelReq: number; isRepeatable: boolean; resetHours: number | null
}

const TYPES = ['daily', 'weekly', 'main', 'side', 'class']
const EMPTY_FORM: Partial<Quest> = { slug: '', name: '', type: 'daily', description: '', npcName: '', npcDialog: '', objectives: [], rewards: {}, chainNext: null, levelReq: 1, isRepeatable: false, resetHours: null }

export default function AdminQuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([])
  const [editing, setEditing] = useState<Partial<Quest> | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch("/api/admin/quests").then(r => r.json()).then(d => setQuests(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    if (!editing.name || !editing.slug) { setMessage("❌ Nombre y slug requeridos"); return }
    setSaving(true)
    const isNew = !editing.id
    const body = JSON.stringify(isNew ? editing : { ...editing, id: editing.id })
    try {
      const res = await fetch("/api/admin/quests", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      })
      if (res.ok) { setEditing(null); setMessage(isNew ? "✅ Quest creada" : "✅ Quest actualizada"); load() }
      else { const d = await res.json(); setMessage(`❌ ${d.error || "Error"}`) }
    } catch { setMessage("❌ Error de red") }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm("¿Borrar quest?")) return
    await fetch(`/api/admin/quests?id=${id}`, { method: "DELETE" }).catch(() => {})
    setMessage("🗑️ Quest borrada")
    load()
  }

  return (
    <div>
      {message && <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer" onClick={() => setMessage(null)}>{message}</button>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📜 Quests</h1>
        <button onClick={() => setEditing(EMPTY_FORM)}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold transition">+ Nueva</button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)} role="dialog" aria-modal="true">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing.id ? "Editar" : "Nueva"} Quest</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-nombre">Nombre</label>
                  <input id="quest-nombre" value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-slug">Slug</label>
                  <input id="quest-slug" value={editing.slug ?? ''} onChange={e => setEditing({ ...editing, slug: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-tipo">Tipo</label>
                  <select id="quest-tipo" value={editing.type ?? 'daily'} onChange={e => setEditing({ ...editing, type: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-npc">NPC</label>
                  <input id="quest-npc" value={editing.npcName ?? ''} onChange={e => setEditing({ ...editing, npcName: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-level-req">Level req</label>
                  <input id="quest-level-req" type="number" value={editing.levelReq ?? 1} onChange={e => setEditing({ ...editing, levelReq: Number.parseInt(e.target.value) || 1 })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-chain-next-slug">Chain next (slug)</label>
                  <input id="quest-chain-next-slug" value={editing.chainNext ?? ''} onChange={e => setEditing({ ...editing, chainNext: e.target.value || null })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-reset-hours">Reset hours</label>
                  <input id="quest-reset-hours" type="number" value={editing.resetHours ?? ''} onChange={e => setEditing({ ...editing, resetHours: e.target.value ? Number.parseInt(e.target.value) : null })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
                <label className="flex items-end gap-2 text-sm text-gray-400 pb-2">
                  <input type="checkbox" checked={editing.isRepeatable ?? false} onChange={e => setEditing({ ...editing, isRepeatable: e.target.checked })} />{' '}Repetible
                </label>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-descripción">Descripción</label>
                <textarea id="quest-descripción" value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-npc-diálogo">NPC Diálogo</label>
                <textarea id="quest-npc-diálogo" value={editing.npcDialog ?? ''} onChange={e => setEditing({ ...editing, npcDialog: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-objectives-json">Objectives (JSON)</label>
                <textarea id="quest-objectives-json" value={JSON.stringify(editing.objectives ?? [], null, 2)}
                  onChange={e => { try { setEditing({ ...editing, objectives: JSON.parse(e.target.value) }) } catch {} }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-xs" rows={3} />
                <div className="flex gap-1 mt-1">
                  {[['matar','[{"type":"kill","target":"enemy_slug","count":5}]'],['recolectar','[{"type":"collect","target":"item_slug","count":3}]'],['hablar','[{"type":"talk","target":"npc_name"}]']].map(([label,val]) => (
                    <button key={label} onClick={() => { try { setEditing({...editing, objectives: JSON.parse(val)}) } catch {} }}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded">{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1" htmlFor="quest-rewards-json">Rewards (JSON)</label>
                <textarea id="quest-rewards-json" value={JSON.stringify(editing.rewards ?? {}, null, 2)}
                  onChange={e => { try { setEditing({ ...editing, rewards: JSON.parse(e.target.value) }) } catch {} }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-xs" rows={3} />
                <div className="flex gap-1 mt-1">
                  {[['monedas','{"gold":100,"ep":50}'],['+item','{"gold":200,"ep":100,"item":"item_slug"}'],['vacio','{}']].map(([label,val]) => (
                    <button key={label} onClick={() => { try { setEditing({...editing, rewards: JSON.parse(val)}) } catch {} }}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded">{label}</button>
                  ))}
                </div>
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
              <th className="text-left py-3 px-4">Nombre</th>
              <th className="text-left py-3 px-4">Tipo</th>
              <th className="text-left py-3 px-4">NPC</th>
              <th className="text-left py-3 px-4">Nv</th>
              <th className="text-left py-3 px-4">Cadena</th>
              <th className="text-center py-3 px-4">Rep</th>
              <th className="text-right py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {quests.map(q => (
              <tr key={q.id} className="border-t border-gray-800/50 hover:bg-white/5">
                <td className="py-3 px-4 font-medium">{q.name}</td>
                <td className="py-3 px-4 text-xs text-gray-400">{q.type}</td>
                <td className="py-3 px-4 text-xs">{q.npcName || '—'}</td>
                <td className="py-3 px-4">{q.levelReq}</td>
                <td className="py-3 px-4 text-xs text-gray-500">{q.chainNext || '—'}</td>
                <td className="py-3 px-4 text-center">{q.isRepeatable ? '✅' : '❌'}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => setEditing(q)} className="text-blue-400 hover:text-blue-300 mr-3">Editar</button>
                  <button onClick={() => remove(q.id)} className="text-red-400 hover:text-red-300">Borrar</button>
                </td>
              </tr>
            ))}
            {quests.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-500">No hay quests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
