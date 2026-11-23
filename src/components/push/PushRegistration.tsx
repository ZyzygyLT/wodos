"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

export default function PushRegistration() {
  const { data: session } = useSession()
  const [heroId, setHeroId] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/hero")
      .then((r) => {
        if (r.ok) return r.json()
        throw new Error('Push registration failed')
      })
      .then((h) => setHeroId(h.id))
      .catch(() => {})
  }, [session])

  useEffect(() => {
    if (globalThis.window === undefined || !("Notification" in globalThis.window) || !heroId) return
    if (Notification.permission === "denied") return

    const OneSignal = (globalThis.window as any).OneSignal
    if (!OneSignal) return

    const register = async () => {
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission()
        if (p !== "granted") return
      }

      const userId = await OneSignal.getUserId()
      if (userId) {
        try {
          await fetch("/api/hero/push-token", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: userId }),
          })
        } catch {}
        OneSignal.sendTags({ hero_id: heroId }).catch(() => {})
      }
    }

    register()
  }, [heroId])

  return null
}
