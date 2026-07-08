"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(session => {
        if (!session?.user) {
          router.push("/login")
          return
        }
        fetch("/api/hero")
          .then(r => {
            if (r.status === 404) router.push("/onboarding")
            else router.push("/dashboard")
          })
      })
      .catch(() => setChecking(false))
  }, [router])

  if (checking) return <div className="flex items-center justify-center min-h-screen">Cargando...</div>

  return (
    <div className="flex items-center justify-center min-h-screen">
      <a href="/api/auth/signin" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Iniciar sesión
      </a>
    </div>
  )
}
