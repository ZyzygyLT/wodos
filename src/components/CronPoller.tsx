"use client"

import { useEffect } from "react"

export default function CronPoller() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    const poll = () => fetch("/api/cron").catch(() => {})
    poll()
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [])

  return null
}
