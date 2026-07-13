"use client"

import logger from "@/lib/logger"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const [hero, setHero] = useState<any>(null)
  const [data, setData] = useState<{ category: any; topics: any[] } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [posting, setPosting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/hero").then(r => r.json()).then(setHero).catch(e => logger.error("game", "Failed to fetch data", e))
    if (params.id) {
      fetch(`/api/forum/categories/${params.id}/topics`).then(r => { if (r.ok) return r.json(); else router.push("/forum") }).then(setData).catch(e => logger.error("game", "Failed to fetch data", e))
    }
  }, [params.id, router])

  async function createTopic() {
    if (!title || !content) return
    setPosting(true)
    try {
      const res = await fetch(`/api/forum/categories/${params.id}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      })
      setPosting(false)
      if (res.ok) {
        setMessage("✅ Topic creado!")
        setShowForm(false)
        setTitle("")
        setContent("")
        const newData = await fetch(`/api/forum/categories/${params.id}/topics`).then(r => r.json())
        setData(newData)
      } else {
        const d = await res.json()
        setMessage(`❌ ${d.error}`)
      }
    } catch { setPosting(false); setMessage("❌ Error al crear topic") }
  }

  if (!hero || !data) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => setMessage(null)}>{message}</button>
      )}

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <button onClick={() => router.push("/forum")} className="hover:text-yellow-400 transition">Foro</button>
          <span>›</span>
          <span className="text-gray-300">{data.category.icon} {data.category.name}</span>
        </nav>
        <h1 className="text-xl font-bold mb-4">{data.category.icon} {data.category.name}</h1>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500">{data.topics.length} topics</p>
          <button onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1.5 rounded bg-yellow-700 hover:bg-yellow-600 transition">
            {showForm ? "Cancelar" : "✏️ Nuevo topic"}
          </button>
        </div>

        {showForm && (
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 mb-6 space-y-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-600" />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Contenido" rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-600 resize-none" />
            <button onClick={createTopic} disabled={posting || !title || !content}
              className="px-4 py-2 rounded-lg text-sm bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 transition">
              {posting ? "..." : "Publicar"}
            </button>
          </div>
        )}

        <div className="space-y-2">
          {data.topics.map(t => (
            <button type="button" key={t.id} onClick={() => router.push(`/forum/topic/${t.id}`)}
              className="w-full text-left bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-3 cursor-pointer hover:border-gray-600 transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {t.isPinned && <span className="text-xs text-yellow-400">📌</span>}
                  {t.isLocked && <span className="text-xs text-red-400">🔒</span>}
                  <p className="font-bold truncate">{t.title}</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t.author.class.icon} {t.author.name} · {t._count.replies} respuestas
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-[10px] text-gray-500 block">{new Date(t.createdAt).toLocaleDateString()}</span>
                {t.lastReply && (
                  <span className="text-[10px] text-gray-600 block mt-0.5">
                    Última: {t.lastReply.author.name} · {new Date(t.lastReply.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </button>
          ))}
          {data.topics.length === 0 && (
            <div className="text-center py-12 text-gray-400">Sin topics todavía. ¡Creá el primero!</div>
          )}
        </div>
      </div>
    </>
  )
}
