"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/useToast"

const RARITY_COLORS: Record<string, string> = {
  common: "border-gray-500 text-gray-300",
  uncommon: "border-green-600 text-green-400",
  rare: "border-blue-600 text-blue-400",
  epic: "border-purple-600 text-purple-400",
  unique: "border-orange-500 text-orange-300",
}

const RARITY_BG: Record<string, string> = {
  common: "bg-gray-800",
  uncommon: "bg-green-900/30",
  rare: "bg-blue-900/30",
  epic: "bg-purple-900/30",
  unique: "bg-orange-900/30",
}

export default function ShopPage() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [gold, setGold] = useState(0)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<number | null>(null)
  const { toast: message, show: setMessage, dismiss } = useToast()
  const [filter, setFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("rarity")

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/shop")
      if (res.status === 401) { router.push("/login"); return }
      if (res.status === 404) { router.push("/onboarding"); return }
      const data = await res.json()
      setItems(data.items ?? [])
      setGold(data.gold ?? 0)
    } catch {} finally { setLoading(false) }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  async function buyItem(itemId: number) {
    setBuying(itemId)
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      })
      setBuying(null)
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ ${data.name} comprado por ${data.price}💰`)
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setBuying(null); setMessage("❌ Error de red") }
  }

  const categories = ["all", ...new Set(items.map(i => i.category))]
  const filtered = items.filter(i => filter === "all" || i.category === filter)
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "rarity") {
      const order: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, unique: 4 }
      return (order[b.rarity] ?? 0) - (order[a.rarity] ?? 0)
    }
    if (sortBy === "price-asc") return (a.price ?? 0) - (b.price ?? 0)
    if (sortBy === "price-desc") return (b.price ?? 0) - (a.price ?? 0)
    if (sortBy === "name") return a.name.localeCompare(b.name)
    return 0
  })

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => dismiss()}>
          {message}
        </button>
      )}

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">🏪 Tienda</h1>
          <div className="text-sm text-yellow-300 font-mono">💰 {gold}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex flex-wrap gap-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs transition capitalize ${filter === cat ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                {(() => {
                  if (cat === "all") return "Todos"
                  if (cat === "consumable") return "🧪 Consumibles"
                  if (cat === "weapon") return "⚔️ Armas"
                  if (cat === "armor") return "🛡️ Armaduras"
                  if (cat === "accessory") return "💍 Accesorios"
                  if (cat === "material") return "📦 Materiales"
                  return cat
                })()}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="ml-auto bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300">
            <option value="rarity">🌟 Rareza</option>
            <option value="price-asc">💰 Menor precio</option>
            <option value="price-desc">💰 Mayor precio</option>
            <option value="name">🔤 Nombre</option>
          </select>
        </div>

        <div className="grid gap-3">
          {sorted.length === 0 && (
            <p className="text-gray-500 text-center py-12">No hay items en la tienda</p>
          )}
          {sorted.map(item => (
            <div key={item.id} className={`bg-gray-900 rounded-xl border p-4 flex items-start gap-3 sm:gap-4 ${RARITY_BG[item.rarity] ?? "bg-gray-900"} ${item.owned ? "border-gray-700 opacity-60" : "border-gray-700"}`}>
              <div className="text-2xl shrink-0">{item.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{item.name}</span>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${RARITY_COLORS[item.rarity] ?? "border-gray-500 text-gray-300"}`}>{item.rarity}</span>
                  {item.twoHanded && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">2M</span>}
                  {item.owned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-800 text-green-300">✔️ Propio</span>}
                </div>
                <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                {item.stats && typeof item.stats === "object" && Object.keys(item.stats).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(item.stats as Record<string, number>).map(([k, v]) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                        {k.toUpperCase()} +{v}
                      </span>
                    ))}
                  </div>
                )}
                {item.runeSlots > 0 && (
                  <p className="text-[11px] text-purple-400 mt-1">💎 {item.runeSlots} slot{item.runeSlots > 1 ? "s" : ""} de runa</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono text-yellow-400">{item.price}💰</p>
                {item.owned ? (
                  <p className="text-[10px] text-green-500 mt-1">Ya lo tenés</p>
                ) : (
                  <button onClick={() => buyItem(item.id)} disabled={buying === item.id || gold < item.price}
                    className="mt-2 px-3 py-1 rounded text-xs bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    {buying === item.id ? "..." : "Comprar"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
