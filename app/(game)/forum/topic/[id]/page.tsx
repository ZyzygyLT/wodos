"use client"

import logger from "@/lib/logger"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/useToast"

export default function TopicPage() {
  const params = useParams()
  const router = useRouter()
  const [hero, setHero] = useState<any>(null)
  const [data, setData] = useState<{ topic: any; replies: any[] } | null>(null)
  const [content, setContent] = useState("")
  const [posting, setPosting] = useState(false)
  const { toast: message, show: setMessage, dismiss } = useToast()
  const [clanRole, setClanRole] = useState<string | null>(null)
  const [editingTopic, setEditingTopic] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editingReply, setEditingReply] = useState<string | null>(null)
  const [editReplyContent, setEditReplyContent] = useState("")

  async function refresh() {
    if (!params.id) return
    try {
      const r = await fetch(`/api/forum/topics/${params.id}/replies`)
      if (r.ok) setData(await r.json()); else router.push("/forum")
    } catch {}
  }

  useEffect(() => {
    fetch("/api/hero").then(r => r.json()).then(setHero).catch(e => logger.error("game", "Failed to fetch data", e))
    fetch("/api/clan").then(r => { if (r.ok) { return r.json(); } return null }).then(d => { if (d?.member) { setClanRole(d.member.role); } }).catch(e => logger.error("game", "Failed to fetch data", e))
    if (params.id) refresh()
  }, [params.id, router])

  async function postReply() {
    if (!content) return
    setPosting(true)
    try {
      const res = await fetch(`/api/forum/topics/${params.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      setPosting(false)
      if (res.ok) {
        setMessage("✅ Respuesta publicada!")
        setContent("")
        refresh()
      } else {
        const d = await res.json()
        setMessage(`❌ ${d.error}`)
      }
    } catch { setPosting(false); setMessage("❌ Error al publicar respuesta") }
  }

  const isMod = hero?.id === data?.topic?.authorId || clanRole === "leader" || clanRole === "officer"

  async function togglePin() {
    const res = await fetch(`/api/forum/topics/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !data?.topic?.isPinned }),
    })
    if (res.ok) { setMessage(data?.topic?.isPinned ? "📌 Desanclado" : "📌 Anclado"); refresh() }
    else { const d = await res.json(); setMessage(`❌ ${d.error}`) }
  }

  async function toggleLock() {
    const res = await fetch(`/api/forum/topics/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !data?.topic?.isLocked }),
    })
    if (res.ok) { setMessage(data?.topic?.isLocked ? "🔓 Desbloqueado" : "🔒 Bloqueado"); refresh() }
    else { const d = await res.json(); setMessage(`❌ ${d.error}`) }
  }

  async function deleteTopic() {
    if (!confirm("¿Borrar este topic y todas sus respuestas?")) return
    const res = await fetch(`/api/forum/topics/${params.id}`, { method: "DELETE" })
    if (res.ok) router.push("/forum")
    else { const d = await res.json(); setMessage(`❌ ${d.error}`) }
  }

  async function deleteReply(replyId: string) {
    if (!confirm("¿Borrar esta respuesta?")) return
    const res = await fetch(`/api/forum/replies/${replyId}`, { method: "DELETE" })
    if (res.ok) { setMessage("🗑️ Respuesta borrada"); refresh() }
    else { const d = await res.json(); setMessage(`❌ ${d.error}`) }
  }

  async function saveTopicEdit() {
    if (!editTitle.trim() || !editContent.trim()) return
    const res = await fetch(`/api/forum/topics/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, content: editContent }),
    })
    if (res.ok) { setMessage("✅ Topic actualizado"); setEditingTopic(false); refresh() }
    else { const d = await res.json(); setMessage(`❌ ${d.error}`) }
  }

  async function saveReplyEdit(replyId: string) {
    if (!editReplyContent.trim()) return
    const res = await fetch(`/api/forum/replies/${replyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editReplyContent }),
    })
    if (res.ok) { setMessage("✅ Respuesta actualizada"); setEditingReply(null); refresh() }
    else { const d = await res.json(); setMessage(`❌ ${d.error}`) }
  }

  if (!hero || !data) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  const { topic, replies } = data

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => dismiss()}>{message}</button>
      )}

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <nav className="flex items-center gap-2 text-xs text-gray-500">
          <button onClick={() => router.push("/forum")} className="hover:text-yellow-400 transition">Foro</button>
          <span>›</span>
          <button onClick={() => router.push(`/forum/category/${topic.categoryId}`)} className="hover:text-yellow-400 transition">{topic.category?.name || "Categoría"}</button>
          <span>›</span>
          <span className="text-gray-300 truncate">{topic.title}</span>
        </nav>
        <h1 className="text-xl font-bold">{topic.title}</h1>

        {isMod && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={togglePin} className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition">
              {topic.isPinned ? "📌 Desanclear" : "📌 Anclar"}
            </button>
            <button onClick={toggleLock} className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition">
              {topic.isLocked ? "🔓 Desbloquear" : "🔒 Bloquear"}
            </button>
            <button onClick={deleteTopic} className="px-3 py-1.5 text-xs rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-800/60 transition">
              🗑️ Borrar topic
            </button>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{topic.author.class.icon}</span>
            <div>
              <p className="font-bold text-sm">{topic.author.name}</p>
              <p className="text-[10px] text-gray-500">{topic.author.class.name} · Nv.{topic.author.level}</p>
            </div>
            <span className="ml-auto text-[10px] text-gray-500">{new Date(topic.createdAt).toLocaleString()}</span>
          </div>
          {editingTopic ? (
            <div className="space-y-3">
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-600" />
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-600 resize-none" />
              <div className="flex gap-2">
                <button onClick={saveTopicEdit} className="px-3 py-1.5 text-xs rounded-lg bg-yellow-700 hover:bg-yellow-600 transition">Guardar</button>
                <button onClick={() => setEditingTopic(false)} className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 transition">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-200 whitespace-pre-wrap">{topic.content}</div>
              {hero.id === topic.authorId && (
                <button onClick={() => { setEditingTopic(true); setEditTitle(topic.title); setEditContent(topic.content) }}
                  className="mt-3 text-[11px] text-yellow-400 hover:text-yellow-300 transition">✏️ Editar</button>
              )}
            </>
          )}
        </div>

        {replies.map(r => (
          <div key={r.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{r.author.class.icon}</span>
              <p className="font-bold text-sm">{r.author.name}</p>
              <span className="text-[10px] text-gray-500">Nv.{r.author.level}</span>
              <span className="ml-auto text-[10px] text-gray-500">{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            {editingReply === r.id ? (
              <div className="space-y-3">
                <textarea value={editReplyContent} onChange={e => setEditReplyContent(e.target.value)} rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-600 resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => saveReplyEdit(r.id)} className="px-3 py-1.5 text-xs rounded-lg bg-yellow-700 hover:bg-yellow-600 transition">Guardar</button>
                  <button onClick={() => setEditingReply(null)} className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 transition">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-300 whitespace-pre-wrap">{r.content}</div>
                <div className="flex gap-3 mt-2">
                  {hero.id === r.authorId && (
                    <button onClick={() => { setEditingReply(r.id); setEditReplyContent(r.content) }}
                      className="text-[11px] text-yellow-400 hover:text-yellow-300 transition">✏️ Editar</button>
                  )}
                  {(hero.id === r.authorId || isMod) && (
                    <button onClick={() => deleteReply(r.id)}
                      className="text-[11px] text-red-400 hover:text-red-300 transition">🗑️ Borrar</button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {!topic.isLocked && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
            <p className="text-sm font-bold">Responder</p>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Escribí tu respuesta..." rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-600 resize-none" />
            <button onClick={postReply} disabled={posting || !content}
              className="px-4 py-2 rounded-lg text-sm bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 transition">
              {posting ? "..." : "Publicar respuesta"}
            </button>
          </div>
        )}

        {topic.isLocked && (
          <p className="text-center text-sm text-gray-500 py-4">🔒 Este topic está cerrado a nuevas respuestas.</p>
        )}
      </div>
    </>
  )
}
