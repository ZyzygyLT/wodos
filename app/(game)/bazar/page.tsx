"use client"

import { useEffect, useState, useCallback } from "react"

export default function BazarPage() {
  const [hero, setHero] = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [myItems, setMyItems] = useState<any[]>([])
  const [tab, setTab] = useState<"browse" | "sell">("browse")
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [heroRes, bazarRes] = await Promise.all([
        fetch("/api/hero"),
        fetch("/api/bazar"),
      ])
      if (heroRes.status === 401 || heroRes.status === 404) return
      const h = await heroRes.json()
      setHero(h)
      setListings(await bazarRes.json())
    } catch {}
  }, [])

  const fetchMyItems = useCallback(async () => {
    try {
      const res = await fetch("/api/hero/inventory")
      if (res.ok) {
        const items = await res.json()
        setMyItems(items.filter((i: any) => i.item.category !== "consumable"))
      }
    } catch {}
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (tab === "sell") fetchMyItems() }, [tab, fetchMyItems])

  async function buyNow(listingId: string) {
    try {
      const res = await fetch("/api/bazar/bid", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      })
      const data = await res.json()
      setMessage(res.ok ? `✅ Comprado por ${data.pricePaid} oro` : `❌ ${data.error}`)
    } catch { setMessage("❌ Error de red") }
    fetchData()
  }

  async function placeBid(listingId: string) {
    const amount = Number.parseInt(bidAmounts[listingId] ?? "0")
    try {
      const res = await fetch("/api/bazar/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, amount }),
      })
      const data = await res.json()
      setMessage(res.ok ? `✅ Puja de ${data.bidAmount} oro registrada` : `❌ ${data.error}`)
    } catch { setMessage("❌ Error de red") }
    fetchData()
  }

  async function sellItem(heroItemId: string) {
    const price = Number.parseInt((document.getElementById(`price-${heroItemId}`) as HTMLInputElement)?.value ?? "0")
    const listingType = (document.querySelector(`input[name="type-${heroItemId}"]:checked`) as HTMLInputElement)?.value ?? "fixed"
    if (!price || price < 1) { setMessage("❌ Poné un precio válido"); return }
    try {
      const res = await fetch("/api/bazar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroItemId, price, listingType }),
      })
      const data = await res.json()
      setMessage(res.ok ? "✅ Item listado en el bazar" : `❌ ${data.error}`)
    } catch { setMessage("❌ Error de red") }
    fetchData()
    fetchMyItems()
  }

  async function cleanExpired() {
    setCleaning(true)
    try {
      const res = await fetch("/api/bazar/expire", { method: "POST" })
      setCleaning(false)
      const data = await res.json()
      setMessage(res.ok ? `🧹 ${data.expired ?? 0} listings vencidos limpiados` : `❌ ${data.error}`)
    } catch { setCleaning(false); setMessage("❌ Error de red") }
    fetchData()
  }

  const rarityColors: Record<string, string> = {
    common: "text-gray-300",
    uncommon: "text-green-400",
    rare: "text-blue-400",
    epic: "text-purple-400",
    unique: "text-red-400",
  }

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg"
          onClick={() => setMessage(null)}>
          {message}
        </button>
      )}

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("browse")}
            className={`px-4 py-2 rounded-lg text-sm transition ${tab === "browse" ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            🛒 Comprar
          </button>
          <button onClick={() => setTab("sell")}
            className={`px-4 py-2 rounded-lg text-sm transition ${tab === "sell" ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            💰 Vender
          </button>
          <button onClick={cleanExpired} disabled={cleaning}
            className="ml-auto px-3 py-2 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 disabled:opacity-50 transition">
            {cleaning ? "..." : "🧹 Limpiar vencidos"}
          </button>
        </div>

        {tab === "browse" && (
          <div className="grid gap-3">
            {listings.length === 0 && (
              <p className="text-gray-500 text-center py-12">No hay items en venta</p>
            )}
            {listings.map((l) => {
              const currentBid = l.purchases?.[0]?.pricePaid ?? l.startPrice ?? l.price
              const minBid = currentBid + 1
              const isAuction = l.listingType === "auction"
              return (
                <div key={l.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="text-2xl">{l.item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{l.item.name}</div>
                    <div className="text-xs">
                      <span className={rarityColors[l.item.rarity] ?? "text-gray-400"}>{l.item.rarity}</span>
                      <span className="text-gray-600 mx-1">·</span>
                      <span className="text-gray-400">{l.item.category}</span>
                      <span className="text-gray-600 mx-1">·</span>
                      <span className="text-gray-400">por {l.seller.name}</span>
                    </div>
                    {isAuction && (
                      <div className="text-xs text-purple-400 mt-1">
                        ⏳ Subasta · Puja actual: {currentBid} oro · Mín: {minBid} oro
                        {l.buyNowPrice && <span> · Comprar ahora: {l.buyNowPrice} oro</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 w-full sm:w-auto">
                    {isAuction ? (
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="number"
                          placeholder={String(minBid)}
                          className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-center"
                          value={bidAmounts[l.id] ?? ""}
                          onChange={e => setBidAmounts(s => ({ ...s, [l.id]: e.target.value }))}
                        />
                        <button onClick={() => placeBid(l.id)}
                          className="px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 text-xs transition">
                          Pujar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => buyNow(l.id)}
                        className="w-full sm:w-auto px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-xs transition">
                        Comprar {l.price}💰
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === "sell" && (
          <div className="grid gap-3">
            {myItems.length === 0 && (
              <p className="text-gray-500 text-center py-12">No tenés items para vender</p>
            )}
            {myItems.map((hi: any) => {
              const alreadyListed = listings.some(l => l.heroItemId === hi.id)
              return (
                <div key={hi.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="text-2xl">{hi.item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{hi.item.name}</div>
                    <div className="text-xs">
                      <span className={rarityColors[hi.item.rarity] ?? "text-gray-400"}>{hi.item.rarity}</span>
                      <span className="text-gray-600 mx-1">·</span>
                      <span className="text-gray-400">{hi.item.category}</span>
                      {hi.equipped && <span className="text-yellow-400 ml-2">🔹 Equipado</span>}
                    </div>
                  </div>
                  {alreadyListed ? (
                    <span className="text-xs text-gray-500">Ya en venta</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <input id={`price-${hi.id}`} type="number" placeholder="Precio"
                        className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-center" />
                      <div><label className="text-xs text-gray-400 flex items-center gap-1">
                        <input type="radio" name={`type-${hi.id}`} value="fixed" defaultChecked />{' '}Fijo
                      </label></div>
                      <div><label className="text-xs text-gray-400 flex items-center gap-1">
                        <input type="radio" name={`type-${hi.id}`} value="auction" />{' '}Subasta
                      </label></div>
                      <button onClick={() => sellItem(hi.id)}
                        className="px-2 py-1 rounded bg-yellow-700 hover:bg-yellow-600 text-xs transition">
                        Vender
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
