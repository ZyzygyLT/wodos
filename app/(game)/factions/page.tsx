"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/hooks/useToast"
import logger from "@/lib/logger"

interface FactionShop {
  id: number; name: string; icon: string; minRep: number; unlocked: boolean
}

interface Faction {
  id: number; slug: string; name: string; description: string; icon: string; color: string
  rep: number; title: string; shops: FactionShop[]
}

interface ShopItem {
  name: string; itemId: number; repReq: number; goldCost?: number
}

function getRepColor(rep: number): string {
  if (rep >= 80) return "text-green-400"
  if (rep >= 50) return "text-blue-400"
  if (rep >= 20) return "text-yellow-400"
  return "text-gray-400"
}

function getRepBarColor(rep: number): string {
  if (rep >= 80) return "bg-green-500"
  if (rep >= 50) return "bg-blue-500"
  if (rep >= 20) return "bg-yellow-500"
  return "bg-gray-500"
}

export default function FactionsPage() {
  const [factions, setFactions] = useState<Faction[]>([])
  const [selected, setSelected] = useState<Faction | null>(null)
  const [shopData, setShopData] = useState<any>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const { toast: message, show: setMessage, dismiss } = useToast()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/factions")
      .then(r => r.json())
      .then(d => { setFactions(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function selectFaction(f: Faction) {
    setSelected(f)
    try {
      const res = await fetch(`/api/factions/${f.id}/shop`)
      if (res.ok) setShopData(await res.json())
    } catch (e) { logger.error('factions', 'Error fetching data', e) }
  }

  async function buyItem(factionId: number, shopId: number, itemIndex: number, itemName: string) {
    setBuying(itemName)
    try {
      const res = await fetch(`/api/factions/${factionId}/shop/${shopId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIndex }),
      })
      setBuying(null)
      if (res.ok) {
        setMessage(`✅ Compraste "${itemName}"!`)
        if (selected) selectFaction(selected)
      } else {
        const d = await res.json()
      setMessage(`❌ ${d.error}`)
      }
    } catch { setBuying(null); setMessage("❌ Error de red") }
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]" /></div></div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => dismiss()}>{message}</button>
      )}

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏛️</span>
          <div>
            <h1 className="text-xl font-bold">Facciones</h1>
            <p className="text-xs text-gray-400">Ganá reputación y desbloqueá tiendas exclusivas</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {factions.map(f => (
            <button key={f.id} onClick={() => selectFaction(f)}
              className={`bg-gray-900 rounded-xl border p-4 text-left transition hover:scale-[1.02] ${
                selected?.id === f.id ? "border-yellow-600" : "border-gray-800 hover:border-gray-600"
              }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="font-bold text-sm">{f.name}</p>
                  <p className={`text-xs ${getRepColor(f.rep)}`}>{f.title}</p>
                </div>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 mb-1">
                <div className={`h-1.5 rounded-full ${getRepBarColor(f.rep)}`}
                  style={{ width: `${Math.min(100, Math.max(0, (f.rep + 100) / 2))}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Rep: {f.rep}</span>
                <span>{f.shops.filter(s => s.unlocked).length}/{f.shops.length} tiendas</span>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selected.icon}</span>
              <div>
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="text-xs text-gray-400">{selected.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-2xl font-bold" style={{ color: selected.color }}>{selected.rep}</p>
                <p className="text-[10px] text-gray-500">Reputación</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-lg font-bold text-yellow-400">{selected.title}</p>
                <p className="text-[10px] text-gray-500">Título actual</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-400">{selected.shops.filter(s => s.unlocked).length}</p>
                <p className="text-[10px] text-gray-500">Tiendas desbloqueadas</p>
              </div>
            </div>

            {shopData?.shops?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-300">Tiendas</h3>
                {shopData.shops.map((shop: any) => (
                  <div key={shop.id} className={`bg-gray-800 rounded-lg p-4 ${shop.unlocked ? "" : "opacity-50"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{shop.icon}</span>
                        <span className="font-bold text-sm">{shop.name}</span>
                      </div>
                      {shop.unlocked ? (
                        <span className="text-xs text-green-400">✅ Desbloqueada</span>
                      ) : (
                        <span className="text-xs text-red-400">🔒 Rep {shop.minRep} requerida</span>
                      )}
                    </div>
                    {shop.unlocked && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(shop.items as ShopItem[]).map((item, i) => (
                          <div key={item.name} className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-xs font-medium">{item.name}</p>
                              <p className="text-[10px] text-gray-500">💰 {item.goldCost ?? 100}</p>
                            </div>
                            <button onClick={() => buyItem(selected.id, shop.id, i, item.name)}
                              disabled={buying === item.name}
                              className="px-3 py-1 text-[11px] rounded-lg bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 transition">
                              {buying === item.name ? "..." : "Comprar"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
