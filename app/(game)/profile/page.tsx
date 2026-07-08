"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function MyProfilePage() {
  const router = useRouter()

  useEffect(() => {
    fetch("/api/hero")
      .then(r => r.json())
      .then(h => {
        if (h?.id) router.replace(`/profile/${h.id}`)
        else router.replace("/dungeon")
      })
      .catch(() => router.replace("/dungeon"))
  }, [router])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
      Cargando...
    </div>
  )
}
