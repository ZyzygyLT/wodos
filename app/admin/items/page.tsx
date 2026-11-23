"use client"

import logger from "@/lib/logger"

import { useEffect, useState, useCallback } from "react"

interface Item {
  id: number; name: string; slug: string; icon: string; category: string
  rarity: string; description: string; stats: any; slot: string | null
  classReq: number[]; raceReq: number[]; levelReq: number; runeSlots: number
  twoHanded: boolean; price: number | null; isCraftable: boolean; recipe: any
}

const CATEGORIES = ['weapon', 'armor', 'accessory', 'consumable', 'rune', 'material']
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'unique']
const SLOTS = ['', 'head', 'body', 'hands', 'legs', 'feet', 'main_hand', 'off_hand', 'necklace', 'ring']
const EMPTY_FORM: Partial<Item> = { name: '', slug: '', icon: '📦', category: 'weapon', rarity: 'common', description: '', stats: {}, slot: null, classReq: [], raceReq: [], levelReq: 1, runeSlots: 0, twoHanded: false, price: null, isCraftable: false, recipe: null }

function toggleArray(arr: number[], val: number): number[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export default function AdminItemsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [editing, setEditing] = useState<Partial<Item> | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch("/api/admin/items").then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : [])).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    if (!editing.name || !editing.slug) { setMessage("❌ Nombre y slug requeridos"); return }
    setSaving(true)
    const isNew = !editing.id
    const body = JSON.stringify(isNew ? editing : { ...editing, id: editing.id })
    try {
      const res = await fetch("/api/admin/items", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      })
      if (res.ok) { setEditing(null); setMessage(isNew ? "✅ Item creado" : "✅ Item actualizado"); load() }
      else { const d = await res.json(); setMessage(`❌ ${d.error || "Error"}`) }
    } catch { setMessage("❌ Error de red") }
    setSaving(false)
  }

  async function remove(id: number) {
    if (!confirm("¿Borrar item?")) return
    await fetch(`/api/admin/items?id=${id}`, { method: "DELETE" }).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
    setMessage("🗑️ Item borrado")
    load()
  }

  return (
    <div>
      {message && <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer" onClick={() => setMessage(null)}>{message}</button>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📦 Items</h1>
        <button onClick={() => setEditing(EMPTY_FORM)}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold transition">+ Nuevo</button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)} role="dialog" aria-modal="true">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing.id ? "Editar" : "Nuevo"} Item</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-name" className="block text-xs text-gray-400 mb-1">Nombre</label>
                  <input id="item-name" value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
              <div>
                <label htmlFor="item-slug" className="block text-xs text-gray-400 mb-1">Slug</label>
                <input id="item-slug" value={editing.slug ?? ''} onChange={e => setEditing({ ...editing, slug: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-icono" className="block text-xs text-gray-400 mb-1">Icono</label>
                  <input id="item-icono" value={editing.icon ?? ''} onChange={e => setEditing({ ...editing, icon: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="item-slot" className="block text-xs text-gray-400 mb-1">Slot</label>
                    <select id="item-slot" value={editing.slot ?? ''} onChange={e => setEditing({ ...editing, slot: e.target.value || null })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                    {SLOTS.map(s => <option key={s} value={s}>{s || '— Ninguno'}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-categoria" className="block text-xs text-gray-400 mb-1">Categoría</label>
                  <select id="item-categoria" value={editing.category ?? 'weapon'} onChange={e => setEditing({ ...editing, category: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  </div>
                  <div>
                    <label htmlFor="item-rareza" className="block text-xs text-gray-400 mb-1">Rareza</label>
                    <select id="item-rareza" value={editing.rarity ?? 'common'} onChange={e => setEditing({ ...editing, rarity: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                    {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['levelReq','runeSlots','price'].map(f => (
                  <div key={f}>
                    <label htmlFor={f} className="block text-xs text-gray-400 mb-1">{f}</label>
                    <input id={f} type="number" value={(editing as any)[f] ?? ''} onChange={e => setEditing({ ...editing, [f]: e.target.value ? Number.parseInt(e.target.value) : null })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
              <div>
                <label htmlFor="item-descripcion" className="block text-xs text-gray-400 mb-1">Descripción</label>
                <textarea id="item-descripcion" value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" rows={2} />
              </div>
              <div>
                <label htmlFor="item-stats" className="block text-xs text-gray-400 mb-1">Stats (JSON)</label>
                <textarea id="item-stats" value={JSON.stringify(editing.stats ?? {}, null, 2)}
                  onChange={e => { try { setEditing({ ...editing, stats: JSON.parse(e.target.value) }) } catch {} }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-xs" rows={3} />
                <div className="flex gap-1 mt-1">
                  {[['arma','{"atk":5}'],['armadura','{"def":5}'],['accesorio','{"hp":10}'],['runa','{"atk":2,"def":2}']].map(([label,val]) => (
                    <button key={label} onClick={() => { try { setEditing({...editing, stats: JSON.parse(val)}) } catch {} }}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded">{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="item-recipe" className="block text-xs text-gray-400 mb-1">Recipe (JSON, opcional)</label>
                <textarea id="item-recipe" value={editing.recipe ? JSON.stringify(editing.recipe, null, 2) : ''}
                  onChange={e => { try { setEditing({ ...editing, recipe: JSON.parse(e.target.value) }) } catch {} }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-xs" rows={2} />
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 text-gray-400">
                  <input type="checkbox" checked={editing.twoHanded ?? false} onChange={e => setEditing({ ...editing, twoHanded: e.target.checked })} />{' '}Dos manos
                </label>
                <label className="flex items-center gap-2 text-gray-400">
                  <input type="checkbox" checked={editing.isCraftable ?? false} onChange={e => setEditing({ ...editing, isCraftable: e.target.checked })} />{' '}Crafteable
                </label>
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
              <th className="text-left py-3 px-4">Slug</th>
              <th className="text-left py-3 px-4">Cat</th>
              <th className="text-left py-3 px-4">Rareza</th>
              <th className="text-left py-3 px-4">Slot</th>
              <th className="text-left py-3 px-4">Nv</th>
              <th className="text-right py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-gray-800/50 hover:bg-white/5">
                <td className="py-3 px-4 text-lg">{item.icon}</td>
                <td className="py-3 px-4 font-medium">{item.name}</td>
                <td className="py-3 px-4 text-xs text-gray-400">{item.slug}</td>
                <td className="py-3 px-4">{item.category}</td>
                <td className="py-3 px-4">{item.rarity}</td>
                <td className="py-3 px-4 text-gray-400">{item.slot ?? '—'}</td>
                <td className="py-3 px-4">{item.levelReq}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => setEditing(item)} className="text-blue-400 hover:text-blue-300 mr-3">Editar</button>
                  <button onClick={() => remove(item.id)} className="text-red-400 hover:text-red-300">Borrar</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-gray-500">No hay items.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
