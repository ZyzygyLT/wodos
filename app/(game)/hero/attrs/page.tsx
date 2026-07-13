"use client"

import logger from "@/lib/logger"

import { useEffect, useState, useCallback } from "react"

const VALID_ATTRS = [
  { key: "st", label: "Fuerza", icon: "💪" },
  { key: "co", label: "Constitución", icon: "❤️" },
  { key: "in", label: "Inteligencia", icon: "🧠" },
  { key: "dx", label: "Destreza", icon: "🎯" },
  { key: "ch", label: "Carisma", icon: "🗣️" },
  { key: "ag", label: "Agilidad", icon: "💨" },
  { key: "pe", label: "Percepción", icon: "👁️" },
  { key: "wi", label: "Voluntad", icon: "🧿" },
]

const ATTR_DESC: Record<string, string> = {
  st: "Daño físico, fuerza bruta",
  co: "HP máximo, resistencia",
  in: "MP máximo, daño mágico",
  dx: "Precisión, crítico, iniciativa",
  ch: "Comercio, liderazgo",
  ag: "Defensa, esquivar",
  pe: "Detección, iniciativa",
  wi: "MP máximo, resistencia mágica",
}

export default function HeroAttrsPage() {
  const [hero, setHero] = useState<any>(null)
  const [spending, setSpending] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    fetch("/api/hero").then(r => r.json()).then(setHero).catch(e => logger.error("game", "Failed to fetch data", e))
  }, [])

  const spendPoint = useCallback(async (attr: string) => {
    setSpending(attr)
    try {
      const res = await fetch("/api/hero/attrs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attr, amount: 1 }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || "Error")
        return
      }
      setHero((prev: any) => ({
        ...prev,
        attrs: data.attrs,
        freeAttrPoints: data.freeRemaining,
        hpMax: data.hpMax,
        mpMax: data.mpMax,
        epSpent: prev.epSpent + (data.epCost ?? 0),
      }))
      if (data.freeUsed > 0) {
        showToast(`✅ +1 ${attr.toUpperCase()} (punto gratis)`)
      } else {
        showToast(`✅ +1 ${attr.toUpperCase()} (${data.epCost} EP)`)
      }
    } catch {
      showToast("❌ Error de conexión")
    } finally {
      setSpending(null)
    }
  }, [])

  const refundPoint = useCallback(async (attr: string) => {
    setSpending(attr)
    try {
      const res = await fetch("/api/hero/attrs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attr, amount: -1 }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || "Error")
        return
      }
      setHero((prev: any) => ({
        ...prev,
        attrs: data.attrs,
        hpMax: data.hpMax,
        mpMax: data.mpMax,
        epSpent: Math.max(0, prev.epSpent - (data.epRefund ?? 0)),
      }))
      showToast(`⬅️ -1 ${attr.toUpperCase()} (recuperaste ${data.epRefund ?? 0} EP)`)
    } catch {
      showToast("❌ Error de conexión")
    } finally {
      setSpending(null)
    }
  }, [])

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-gray-900 border border-amber-800/50 text-sm text-amber-300 shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-xl font-bold">📊 Atributos de {hero.name}</h2>
        <div className="flex gap-4 mt-3 text-sm">
          <span className="text-amber-400">🎯 Puntos libres: <strong>{hero.freeAttrPoints}</strong></span>
          <span className="text-gray-500">⚡ EP disponibles: <strong>{hero.epTotal - hero.epSpent}</strong></span>
        </div>
      </div>

      {/* Attribute list */}
      <div className="space-y-2">
        {VALID_ATTRS.map(({ key, label, icon }) => {
          const val = (hero.attrs as Record<string, number>)?.[key] ?? 0
          return (
            <div key={key}
              className="flex items-center gap-4 bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-amber-800/30 transition">
              <span className="text-xl w-8 text-center">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{label}</span>
                  <span className="font-mono text-amber-400 font-bold">{val}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{ATTR_DESC[key]}</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => refundPoint(key)}
                  disabled={spending === key || val <= 0 || (hero.epSpent ?? 0) <= 0}
                  className="px-3 py-1.5 rounded-lg bg-red-800/30 hover:bg-red-700/40 text-red-400 text-sm font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {spending === key ? "..." : "-1"}
                </button>
                <button
                  onClick={() => spendPoint(key)}
                  disabled={spending === key}
                  className="px-3 py-1.5 rounded-lg bg-amber-800/40 hover:bg-amber-700/50 text-amber-300 text-sm font-bold transition disabled:opacity-40"
                >
                  {spending === key ? "..." : "+1"}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info box */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 text-xs text-gray-500 space-y-1">
        <p>💡 Los puntos de atributo gratis se obtienen al subir de nivel.</p>
        <p>⚡ Si no tenés puntos gratis, se usarán EP con la curva de costo.</p>
        <p>⬅️ -1 devuelve EP invertidos (congela si el atributo está en 0 o no hay EP invertidos).</p>
      </div>
    </div>
  )
}
