"use client"

import logger from "@/lib/logger"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function ForumPage() {
  const router = useRouter()
  const [hero, setHero] = useState<any>(null)
  const [data, setData] = useState<{ public: any[]; clanCategory: any } | null>(null)

  useEffect(() => {
    fetch("/api/hero").then(r => r.json()).then(h => setHero(h)).catch(e => logger.error("game", "Failed to fetch data", e))
    fetch("/api/forum/categories").then(r => r.json()).then(setData).catch(e => logger.error("game", "Failed to fetch data", e))
  }, [])

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]" /></div></div>

  return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {data?.clanCategory && (
          <div>
            <h2 className="font-bold text-sm text-purple-400 mb-3">🏰 Clan</h2>
            <button type="button" onClick={() => router.push(`/forum/category/${data.clanCategory.id}`)}
              className="w-full text-left bg-gray-900 rounded-xl border border-purple-800 p-4 flex items-center gap-4 cursor-pointer hover:border-purple-600 transition">
              <span className="text-3xl">{data.clanCategory.icon}</span>
              <div className="flex-1">
                <p className="font-bold">{data.clanCategory.name}</p>
                <p className="text-xs text-gray-400">{data.clanCategory.description}</p>
              </div>
              <span className="text-xs text-gray-500">{data.clanCategory._count.topics} topics</span>
            </button>
          </div>
        )}

        <div>
          <h2 className="font-bold text-sm text-yellow-400 mb-3">🌐 Público</h2>
          <div className="space-y-3">
            {(data?.public ?? []).map(cat => (
              <button type="button" key={cat.id} onClick={() => router.push(`/forum/category/${cat.id}`)}
                className="w-full text-left bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-4 cursor-pointer hover:border-gray-600 transition">
                <span className="text-3xl">{cat.icon}</span>
                <div className="flex-1">
                  <p className="font-bold">{cat.name}</p>
                  <p className="text-xs text-gray-400">{cat.description}</p>
                </div>
                <span className="text-xs text-gray-500">{cat._count.topics} topics</span>
              </button>
            ))}
          </div>
        </div>

        {(!data || (data.public.length === 0 && !data.clanCategory)) && (
          <div className="text-center py-12 text-gray-400">Sin categorías</div>
        )}
      </div>
  )
}
