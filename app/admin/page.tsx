"use client"

import logger from "@/lib/logger"

import { useEffect, useState } from "react"
import Link from "next/link"

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/items").then(r => r.json()),
      fetch("/api/admin/quests").then(r => r.json()),
      fetch("/api/admin/dungeons").then(r => r.json()),
      fetch("/api/admin/enemies").then(r => r.json()),
      fetch("/api/admin/skills").then(r => r.json()),
      fetch("/api/admin/achievements").then(r => r.json()),
    ]).then(([items, quests, dungeons, enemies, skills, achievements]) => {
      setCounts({
        items: Array.isArray(items) ? items.length : 0,
        quests: Array.isArray(quests) ? quests.length : 0,
        dungeons: Array.isArray(dungeons) ? dungeons.length : 0,
        enemies: Array.isArray(enemies) ? enemies.length : 0,
        skills: Array.isArray(skills) ? skills.length : 0,
        achievements: Array.isArray(achievements) ? achievements.length : 0,
      })
    }).catch(e => logger.error("admin", "Failed to fetch or delete data", e))
  }, [])

  const cards = [
    { href: "/admin/items", label: "📦 Items", count: counts.items ?? "..." },
    { href: "/admin/quests", label: "📜 Quests", count: counts.quests ?? "..." },
    { href: "/admin/dungeons", label: "🗺️ Dungeons", count: counts.dungeons ?? "..." },
    { href: "/admin/enemies", label: "👹 Enemies", count: counts.enemies ?? "..." },
    { href: "/admin/skills", label: "⚡ Skills", count: counts.skills ?? "..." },
    { href: "/admin/achievements", label: "🏅 Logros", count: counts.achievements ?? "..." },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">⚙️ Panel de Administración</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <Link key={card.href} href={card.href}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-red-800 transition">
            <p className="text-3xl mb-2">{card.label.split(" ")[0]}</p>
            <p className="font-bold text-lg">{card.count}</p>
            <p className="text-sm text-gray-400">{card.label.split(" ").slice(1).join(" ")}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
