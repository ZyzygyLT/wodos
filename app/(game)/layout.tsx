"use client"

import logger from "@/lib/logger"

import { useEffect, useState, useRef } from "react"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import Link from "next/link"

interface MenuItem { href: string; label: string; exact?: boolean }

const MENUS: { label: string; items: MenuItem[] }[] = [
  {
    label: "⚔️ Combate",
    items: [
      { href: "/adventures", label: "🏕️ Aventuras" },
      { href: "/dungeon", label: "🗺️ Mazmorras" },
      { href: "/arena", label: "⚔️ Arena" },
      { href: "/tournament", label: "🏆 Torneo" },
      { href: "/tactics", label: "🎯 Tácticas" },
    ],
  },
  {
    label: "🎒 Personaje",
    items: [
      { href: "/profile", label: "👤 Perfil" },
      { href: "/hero/attrs", label: "📊 Atributos" },
      { href: "/inventory", label: "🎒 Inventario" },
      { href: "/skills", label: "⚡ Skills" },
    ],
  },
  {
    label: "🏪 Comercio",
    items: [
      { href: "/shop", label: "🏪 Tienda" },
      { href: "/bazar", label: "💰 Bazar" },
      { href: "/craft", label: "🔨 Forja" },
    ],
  },
  {
    label: "🏰 Social",
    items: [
      { href: "/clan", label: "🏰 Clan" },
      { href: "/groups/my", label: "👥 Mis Grupos" },
      { href: "/events", label: "🎪 Eventos" },
      { href: "/leaderboard", label: "🏆 Ranking" },
      { href: "/forum", label: "💬 Foro" },
    ],
  },
  {
    label: "📜 Progreso",
    items: [
      { href: "/quests", label: "📜 Quests" },
      { href: "/factions", label: "🏛️ Facciones" },
      { href: "/bestiary", label: "📖 Bestiario" },
      { href: "/stats", label: "📊 Estadísticas" },
      { href: "/achievements", label: "🏅 Logros" },
      { href: "/dungeon/reports", label: "📜 Historial" },
    ],
  },
]

export default function GameLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const [hero, setHero] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/hero").then(r => r.json()).then(setHero).catch(e => logger.error("game", "Failed to fetch data", e))
  }, [])

  useEffect(() => {
    fetch("/api/notifications").then(r => r.json()).then(d => {
      setNotifications(d.notifications ?? [])
      setUnreadCount(d.unreadCount ?? 0)
    }).catch(e => logger.error("game", "Failed to fetch data", e))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/notifications").then(r => r.json()).then(d => {
        setNotifications(d.notifications ?? [])
        setUnreadCount(d.unreadCount ?? 0)
      }).catch(e => logger.error("game", "Failed to fetch data", e))
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false)
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    if (showNotif || openMenu) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showNotif, openMenu])

  async function markAllRead() {
    try { await fetch("/api/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }) } catch {}
    setNotifications(notifications.map((n: any) => ({ ...n, readAt: new Date().toISOString() })))
    setUnreadCount(0)
  }

  function isActive(items: MenuItem[]): boolean {
    return items.some(item => item.exact ? pathname === item.href : pathname.startsWith(item.href))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="border-b border-gray-800 bg-gray-900 px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        <Link href="/dashboard" className="font-bold text-yellow-400 hover:text-yellow-300 transition text-sm sm:text-base shrink-0">IRONHOLD</Link>
        <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-400">
          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotif(!showNotif)}
              className="relative text-lg hover:text-yellow-400 transition">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="fixed sm:absolute right-0 left-0 sm:left-auto top-12 sm:top-full sm:mt-2 mx-2 sm:mx-0 sm:w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300">Notificaciones</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] text-yellow-400 hover:text-yellow-300 transition">
                      Marcar todas leídas
                    </button>
                  )}
                </div>
                {notifications.length === 0 && (
                  <p className="text-center text-gray-500 text-xs py-6">Sin notificaciones</p>
                )}
                {notifications.map((n: any) => (
                  <div key={n.id} className={`px-3 py-2.5 border-b border-gray-800 last:border-0 ${n.readAt ? "" : "bg-gray-800/50"}`}>
                    <p className="text-xs font-medium text-gray-200">{n.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {hero && (
            <>
              <span className="text-gray-300 hidden xs:inline">{hero.name}</span>
              <span className="text-yellow-400">Nv.{hero.level}</span>
              <span className="text-yellow-300">💰{hero.gold}</span>
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-gray-500 hover:text-red-400 transition ml-1" title="Cerrar sesión">
                🚪
              </button>
            </>
          )}
        </div>
      </div>

      <nav className="border-b border-gray-800 bg-gray-900/80 px-2 sm:px-4 py-2 flex items-center gap-1 text-sm relative z-40" ref={menuRef}>
        {MENUS.map(menu => {
          const hasActive = isActive(menu.items)
          return (
            <div key={menu.label} className="relative">
              <button onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
                className={`whitespace-nowrap px-2.5 py-1.5 rounded text-xs transition flex items-center gap-1 ${
                  hasActive
                    ? "bg-yellow-800 text-yellow-200"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}>
                {menu.label}
                <span className={`text-[10px] transition ${openMenu === menu.label ? "rotate-180" : ""}`}>▼</span>
              </button>
              {openMenu === menu.label && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-xl min-w-[160px] py-1">
                  {menu.items.map(item => {
                    const itemActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setOpenMenu(null)}
                        className={`block px-3 py-2 text-xs transition ${
                          itemActive
                            ? "bg-yellow-800/50 text-yellow-200"
                            : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                        }`}>
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <div className="ml-auto">
          <Link href="/dashboard"
            className={`whitespace-nowrap px-2.5 py-1.5 rounded text-xs transition ${
              pathname === "/dashboard"
                ? "bg-yellow-800 text-yellow-200"
                : "text-gray-500 hover:text-gray-200 hover:bg-gray-800"
            }`}>
            ⬅ Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 p-4 pb-20 lg:pb-4">
        <main className="min-w-0">{children}</main>
        <aside className="hidden lg:block space-y-4">
          {hero && (
            <>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="text-sm font-bold text-yellow-400 mb-3">👤 Héroe</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{hero.class?.icon} {hero.race?.icon}</span>
                    <div>
                      <p className="font-bold truncate">{hero.name}</p>
                      <p className="text-xs text-gray-400">{hero.class?.name} · {hero.race?.name}</p>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-gray-800 pt-2">
                    <span className="text-gray-400">Nivel</span>
                    <span className="text-yellow-400">{hero.level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Oro</span>
                    <span className="text-yellow-300">💰 {hero.gold}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fama</span>
                    <span>🏆 {hero.fame}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Héroes</span>
                    <span className="text-xs">{hero.heroCount ?? 1}/{hero.maxHeroes ?? 3}</span>
                  </div>
                  {hero.epTotal != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">EXP disponible</span>
                      <span>{hero.epTotal - hero.epSpent}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="text-sm font-bold text-green-400 mb-3">⚡ Acción rápida</h3>
                <div className="space-y-2 text-sm">
                  <Link href="/dungeon" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                    <span>⚔️</span><span>Ir a mazmorras</span>
                  </Link>
                  <Link href="/quests" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                    <span>📋</span><span>Misiones</span>
                  </Link>
                  <Link href="/skills" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                    <span>⚡</span><span>Skills</span>
                  </Link>
                  <Link href="/shop" className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition">
                    <span>🏪</span><span>Tienda</span>
                  </Link>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 px-2 py-1.5 flex items-center justify-around safe-bottom">
        {[
          { href: "/dashboard", icon: "🏠", label: "Home" },
          { href: "/dungeon", icon: "⚔️", label: "Dungeon" },
          { href: "/inventory", icon: "🎒", label: "Items" },
          { href: "/shop", icon: "🏪", label: "Tienda" },
          { href: "/quests", icon: "📋", label: "Quests" },
        ].map(item => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded text-[10px] transition min-w-[48px] ${
                active ? "text-yellow-400" : "text-gray-500 active:text-gray-300"
              }`}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
