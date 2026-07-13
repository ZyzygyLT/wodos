"use client"

import { useEffect } from "react"

/**
 * Polls the cron endpoint in development to simulate scheduled runs.
 * Uses a dedicated NEXT_PUBLIC_CRON_POLL_SECRET that is NOT the same
 * value as the server-side CRON_SECRET.
 */
export default function CronPoller() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    const secret = process.env.NEXT_PUBLIC_CRON_POLL_SECRET
    if (!secret) return
    const poll = () => fetch("/api/cron", { headers: { "x-cron-secret": secret } }).catch(() => {})
    poll()
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [])

  return null
}
