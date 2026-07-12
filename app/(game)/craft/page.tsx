"use client"

import { useEffect, useState } from "react"

const STAT_LABELS: Record<string, string> = {
  str: "STR", agi: "AGI", int: "INT", wis: "WIS", con: "CON", cha: "CHA",
  hp: "HP", mp: "MP", armor: "Armor", atk: "ATK", dx: "DX", co: "CO",
  fireResist: "🔥", iceResist: "❄️", poisonResist: "☠️",
}

const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-400", uncommon: "text-green-400", rare: "text-blue-400",
  epic: "text-purple-400", legendary: "text-orange-400",
}

type Tab = "craft" | "decompose" | "reroll"

export default function CraftPage() {
  const [tab, setTab] = useState<Tab>("craft")
  const [recipes, setRecipes] = useState<any[]>([])
  const [heroMats, setHeroMats] = useState<any[]>([])
  const setHeroGold = (_v: number) => {}
  const [heroItems, setHeroItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [crafting, setCrafting] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [decomposing, setDecomposing] = useState<string | null>(null)
  const [rerollTarget, setRerollTarget] = useState<any>(null)
  const [rerolling, setRerolling] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [craftRes, invRes] = await Promise.all([
        fetch("/api/craft").then(r => r.json()),
        fetch("/api/hero/inventory").then(r => r.json()),
      ])
      setRecipes(craftRes.recipes ?? [])
      setHeroMats(craftRes.recipes?.[0]?.heroMaterials ?? [])
      setHeroGold(craftRes.recipes?.[0]?.heroGold ?? 0)
      setHeroItems(invRes.items ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function craftItem(itemId: number) {
    setCrafting(itemId)
    try {
      const res = await fetch("/api/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      })
      setCrafting(null)
      const data = await res.json()
      if (res.ok) {
        setMessage(`🔨 ${data.name} crafteado!`)
        loadData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setCrafting(null); setMessage("❌ Error de red") }
  }

  async function decomposeItem(heroItemId: string) {
    setDecomposing(heroItemId)
    try {
      const res = await fetch("/api/craft/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroItemId }),
      })
      setDecomposing(null)
      const data = await res.json()
      if (res.ok) {
        const mats = data.materials.map((m: any) => `${m.icon}×${m.quantity}`).join(", ")
        setMessage(`♻️ Desmontado! +${data.gold}💰, ${mats}`)
        loadData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setDecomposing(null); setMessage("❌ Error de red") }
  }

  async function rerollStat() {
    if (!rerollTarget) return
    setRerolling(true)
    try {
      const res = await fetch("/api/craft/reroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroItemId: rerollTarget.heroItemId, statKey: rerollTarget.statKey }),
      })
      setRerolling(false)
      const data = await res.json()
      if (res.ok) {
        setMessage(`🔄 ${rerollTarget.statKey.toUpperCase()}: ${data.oldValue} → ${data.newValue}`)
        setRerollTarget(null)
        loadData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setRerolling(false); setMessage("❌ Error de red") }
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => setMessage(null)}>
          {message}
        </button>
      )}

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex gap-2 mb-6">
          {([["craft", "🔨 Craftear"], ["decompose", "♻️ Desmontar"], ["reroll", "🔄 Re-Roll"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-orange-700 text-white" : "bg-gray-900 text-gray-400 hover:bg-gray-800"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "craft" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <h2 className="font-bold text-lg">📖 Recetas</h2>
              {recipes.length === 0 ? (
                <p className="text-gray-500 text-sm">No hay recetas disponibles</p>
              ) : recipes.map(item => {
                const recipe = item.recipe ?? { materials: [], goldCost: 0 }
                return (
                  <div key={item.id} className={`bg-gray-900 rounded-xl border p-4 ${item.canCraft ? "border-gray-700" : "border-gray-800 opacity-70"}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold">{item.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded bg-gray-700 ${RARITY_COLORS[item.rarity] ?? "text-gray-300"}`}>{item.rarity}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {recipe.materials.map((req: any) => {
                            const mat = item.heroMaterials?.find((m: any) => m.id === req.materialId)
                            const have = mat?.quantity ?? 0
                            return (
                              <span key={req.materialId}
                                className={`text-xs px-2 py-1 rounded ${have >= req.quantity ? "bg-gray-800 text-gray-300" : "bg-red-900 text-red-300"}`}>
                                {mat?.icon ?? "📦"} {mat?.name ?? `#${req.materialId}`} {have}/{req.quantity}
                              </span>
                            )
                          })}
                          <span className="text-xs px-2 py-1 rounded bg-yellow-900 text-yellow-300">💰 {recipe.goldCost}</span>
                        </div>
                        {item.canCraft && (
                          <button onClick={() => craftItem(item.id)} disabled={crafting === item.id}
                            className="mt-3 text-xs px-4 py-1.5 rounded bg-orange-700 hover:bg-orange-600 disabled:opacity-50 transition">
                            {crafting === item.id ? "..." : "🔨 Craftear"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div>
              <h2 className="font-bold text-lg mb-3">📦 Materiales</h2>
              <div className="space-y-2">
                {heroMats.map((m: any) => (
                  <div key={m.id} className="bg-gray-900 rounded-lg border border-gray-800 p-3 flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">{m.icon} {m.name}</span>
                    <span className="text-sm font-mono text-yellow-400">×{m.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "decompose" && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Desmontá items para obtener materiales. No se pueden desmontar items equipados.</p>
            {heroItems.length === 0 ? (
              <p className="text-gray-500">No tenés items para desmontar</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {heroItems.map((hi: any) => (
                  <div key={hi.id} className={`bg-gray-900 rounded-xl border border-gray-800 p-4 ${hi.equipped ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{hi.item?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{hi.item?.name}</p>
                        <p className={`text-xs ${RARITY_COLORS[hi.item?.rarity] ?? "text-gray-400"}`}>{hi.item?.rarity}</p>
                        {hi.upgradeLevel > 0 && <span className="text-[10px] text-yellow-400">+{hi.upgradeLevel}</span>}
                        {hi.equipped ? (
                          <span className="text-[10px] text-gray-500 mt-1 block">Equipado</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries((hi.item?.stats ?? {}) as Record<string, number>).map(([k, v]) => (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{STAT_LABELS[k] ?? k} {v}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {!hi.equipped && (
                      <button onClick={() => decomposeItem(hi.id)} disabled={decomposing === hi.id}
                        className="mt-3 w-full text-xs px-3 py-1.5 rounded bg-red-900 hover:bg-red-800 disabled:opacity-50 transition">
                        {decomposing === hi.id ? "..." : "♻️ Desmontar"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "reroll" && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Re-Rollea un stat de un item. Costo: 80💰 + 2✨ + 1💎</p>
            {heroItems.length === 0 ? (
              <p className="text-gray-500">No tenés items</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {heroItems.map((hi: any) => {
                  const stats = (hi.item?.stats ?? {}) as Record<string, number>
                  const statKeys = Object.keys(stats)
                  if (statKeys.length === 0) return null
                  return (
                    <div key={hi.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{hi.item?.icon}</span>
                        <div>
                          <p className="font-bold text-sm">{hi.item?.name}</p>
                          <p className={`text-xs ${RARITY_COLORS[hi.item?.rarity] ?? "text-gray-400"}`}>{hi.item?.rarity}</p>
                          {hi.upgradeLevel > 0 && <span className="text-[10px] text-yellow-400">+{hi.upgradeLevel}</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {statKeys.map(k => (
                          <button key={k}
                            onClick={() => setRerollTarget({ heroItemId: hi.id, statKey: k, current: stats[k] })}
                            className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition">
                            {STAT_LABELS[k] ?? k}: {stats[k]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {rerollTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRerollTarget(null)} role="dialog" aria-modal="true">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">🔄 Re-Roll {rerollTarget.statKey.toUpperCase()}</h3>
            <p className="text-gray-400 text-sm mb-4">
              Valor actual: <span className="text-white font-bold">{rerollTarget.current}</span>
            </p>
            <p className="text-gray-400 text-sm mb-4">Costo: 80💰 + 2✨ + 1💎</p>
            <div className="flex gap-2">
              <button onClick={rerollStat} disabled={rerolling}
                className="flex-1 px-4 py-2 rounded bg-orange-700 hover:bg-orange-600 disabled:opacity-50 transition text-sm">
                {rerolling ? "..." : "🔄 Re-Roll"}
              </button>
              <button onClick={() => setRerollTarget(null)}
                className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 transition text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
