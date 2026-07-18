"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import logger from "@/lib/logger"
import { useToast } from "@/hooks/useToast"

export function useInventory() {
  const router = useRouter()
  const [hero, setHero] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [clan, setClan] = useState<any>(null)
  const { toast: message, show: setMessage, dismiss } = useToast()
  const [toggling, setToggling] = useState<string | null>(null)
  const [socketItem, setSocketItem] = useState<any>(null)
  const [enchantItem, setEnchantItem] = useState<any>(null)
  const [enchanting, setEnchanting] = useState(false)
  const [runes, setRunes] = useState<any[]>([])
  const [socketing, setSocketing] = useState<string | null>(null)
  const [usingItem, setUsingItem] = useState<string | null>(null)
  const [sellingItem, setSellingItem] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [heroRes, invRes, clanRes] = await Promise.all([
        fetch("/api/hero"),
        fetch("/api/hero/inventory"),
        fetch("/api/clan"),
      ])
      if (heroRes.status === 401) return router.push("/login")
      if (heroRes.status === 404) return router.push("/onboarding")
      setHero(await heroRes.json())
      setItems(await invRes.json())
      if (clanRes.ok) setClan(await clanRes.json())
    } catch { /* silently ignore network errors */ }
    fetch("/api/hero/inventory/socket").then(r => r.json()).then(setRunes).catch(e => logger.error("useInventory", "Failed to fetch inventory data", e))
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleEquip(heroItemId: string, currentlyEquipped: boolean) {
    setToggling(heroItemId)
    try {
      const res = await fetch("/api/hero/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroItemId, equipped: !currentlyEquipped }),
      })
      setToggling(null)
      const data = await res.json()
      if (res.ok) {
        setMessage(currentlyEquipped ? "🔓 Item de-equipado" : "✅ Item equipado")
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setToggling(null); setMessage("❌ Error de red") }
  }

  async function socketRune(slotIndex: number, runeHeroItemId: string) {
    if (!socketItem) return
    setSocketing(`${slotIndex}-${runeHeroItemId}`)
    try {
      const res = await fetch("/api/hero/inventory/socket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroItemId: socketItem.id, slotIndex, runeHeroItemId }),
      })
      setSocketing(null)
      const data = await res.json()
      if (res.ok) {
        setMessage("💎 Runa socketada!")
        setSocketItem(null)
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setSocketing(null); setMessage("❌ Error de red") }
  }

  async function unsocketRune(slotIndex: number) {
    if (!socketItem) return
    setSocketing(`unsocket-${slotIndex}`)
    try {
      const res = await fetch("/api/hero/inventory/socket", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroItemId: socketItem.id, slotIndex }),
      })
      setSocketing(null)
      const data = await res.json()
      if (res.ok) {
        setMessage("🔓 Runa removida")
        setSocketItem(null)
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setSocketing(null); setMessage("❌ Error de red") }
  }

  async function doEnchant(heroItemId: string) {
    setEnchanting(true)
    try {
      const res = await fetch("/api/hero/inventory/enchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroItemId }),
      })
      setEnchanting(false)
      const data = await res.json()
      if (res.ok) {
        if (data.success) {
          setMessage(`✨ ¡Mejora exitosa! Nivel ${data.newLevel}`)
        } else {
          setMessage(`💥 Falló la mejora. Item sigue en nivel ${data.currentLevel}`)
        }
        setEnchantItem(null)
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setEnchanting(false); setMessage("❌ Error de red") }
  }

  async function consumeItem(heroItemId: string) {
    setUsingItem(heroItemId)
    try {
      const res = await fetch("/api/hero/consumables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroItemId }),
      })
      setUsingItem(null)
      const data = await res.json()
      if (res.ok) {
        setMessage(`✅ Usado! ${data.effects.healHp ? '+' + data.effects.healHp + '❤️' : ''} ${data.effects.healMp ? '+' + data.effects.healMp + '💧' : ''}`)
        fetchData()
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch { setUsingItem(null); setMessage("❌ Error de red") }
  }

  async function sellToBazar(heroItemId: string) {
    setSellingItem(heroItemId)
    const price = prompt("Precio de venta (oro):")
    if (!price || Number.isNaN(Number.parseInt(price)) || Number.parseInt(price) < 1) { setSellingItem(null); return }
    try {
      const res = await fetch("/api/bazar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroItemId, price: Number.parseInt(price), listingType: "fixed" }),
      })
      setSellingItem(null)
      const data = await res.json()
      setMessage(res.ok ? "✅ Item listado en el bazar" : `❌ ${data.error}`)
      if (res.ok) fetchData()
    } catch { setSellingItem(null); setMessage("❌ Error de red") }
  }

  return {
    hero,
    items,
    clan,
    message,
    setMessage,
    dismiss,
    toggling,
    socketItem,
    setSocketItem,
    enchantItem,
    setEnchantItem,
    enchanting,
    runes,
    socketing,
    usingItem,
    sellingItem,
    toggleEquip,
    socketRune,
    unsocketRune,
    doEnchant,
    consumeItem,
    sellToBazar,
  }
}
