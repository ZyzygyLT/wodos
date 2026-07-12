"use client"

import { useEffect, useState } from "react"

interface LoginStatus {
  canClaim: boolean
  streak: number
  todayReward: { gold: number; materials: { name: string; icon: string; qty: number }[] }
  nextRewards: { day: number; gold: number; materials: { name: string; icon: string; qty: number }[] }[]
}

interface ClaimResult {
  gold: number
  materials: { name: string; icon: string; qty: number }[]
  newStreak: number
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export default function DailyLoginModal({ onClaimed }: Readonly<{ onClaimed?: () => void }>) {
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<LoginStatus | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState<ClaimResult | null>(null)

  useEffect(() => {
    fetch("/api/daily-login")
      .then(r => r.json())
      .then(data => {
        if (data.canClaim) {
          setStatus(data)
          setShow(true)
        }
      })
      .catch(() => {})
  }, [])

  async function claim() {
    setClaiming(true)
    try {
      const res = await fetch("/api/daily-login", { method: "POST" })
      setClaiming(false)
      if (res.ok) {
        const data = await res.json()
        setClaimed(data)
        onClaimed?.()
      }
    } catch { setClaiming(false) }
  }

  if (!show || !status) return null

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-md w-full relative">
        {claimed ? (
          <div className="text-center space-y-4">
            <p className="text-3xl">🎁</p>
            <h3 className="font-bold text-xl text-yellow-400">¡Recompensa reclamada!</h3>
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-lg">💰 +{claimed.gold} oro</p>
              {claimed.materials.map((m, i) => (
                <p key={"mat-" + i} className="text-sm">{m.icon} +{m.qty} {m.name}</p>
              ))}
            </div>
            <p className="text-gray-400 text-sm">Racha: {claimed.newStreak} días 🔥</p>
            <button onClick={() => setShow(false)}
              className="w-full py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition">
              ¡Gracias!
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-3xl mb-2">📅</p>
              <h3 className="font-bold text-xl">Recompensa Diaria</h3>
              <p className="text-gray-400 text-sm mt-1">Racha: {status.streak} días 🔥</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">Hoy (Día {status.streak})</p>
              <div className="space-y-1">
                <p className="text-lg font-bold">💰 +{status.todayReward.gold} oro</p>
                {status.todayReward.materials.map((m, i) => (
                  <p key={"today-mat-" + i} className="text-sm">{m.icon} +{m.qty} {m.name}</p>
                ))}
              </div>
            </div>

            {status.nextRewards.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Próximas recompensas</p>
                <div className="flex gap-2">
                  {status.nextRewards.map((r, i) => (
                    <div key={"reward-" + i} className="flex-1 bg-gray-800 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-gray-500">Día {r.day}</p>
                      <p className="text-xs font-bold">💰{r.gold}</p>
                      {r.materials.length > 0 && (
                        <p className="text-[10px]">{r.materials[0].icon}+{r.materials[0].qty}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={claim} disabled={claiming}
                className="flex-1 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition disabled:opacity-50">
                {claiming ? "..." : "🎁 Reclamar"}
              </button>
              <button onClick={() => setShow(false)}
                className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
