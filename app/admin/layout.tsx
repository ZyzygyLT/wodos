"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"

const ADMIN_NAV = [
  { href: "/admin", label: "📊 Dashboard", exact: true },
  { href: "/admin/items", label: "📦 Items", exact: false },
  { href: "/admin/quests", label: "📜 Quests", exact: false },
  { href: "/admin/dungeons", label: "🗺️ Dungeons", exact: false },
  { href: "/admin/enemies", label: "👹 Enemies", exact: false },
  { href: "/admin/skills", label: "⚡ Skills", exact: false },
  { href: "/admin/achievements", label: "🏅 Logros", exact: false },
  { href: "/admin/test-dungeon", label: "🧪 Test Dungeon", exact: false },
]

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch("/api/admin").then(r => { if (r.ok) setChecking(false); else router.push("/dashboard") }).catch(() => router.push("/dashboard"))
  }, [router])

  if (checking) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Verificando acceso...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-2 flex items-center justify-between">
        <Link href="/admin" className="font-bold text-red-400 hover:text-red-300 transition text-sm">⚙️ ADMIN</Link>
        <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition">⬅ Volver al juego</Link>
      </div>
      <nav className="border-b border-gray-800 bg-gray-900/80 px-4 py-2 flex items-center gap-1 overflow-x-auto text-sm">
        {ADMIN_NAV.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`whitespace-nowrap px-3 py-1.5 rounded text-xs transition ${
                active ? "bg-red-800 text-red-200" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {children}
      </div>
    </div>
  )
}
