"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

interface GroupMember {
  id: string
  heroId: string
  role: string
  joinedAt: string
  hero: {
    id: string
    name: string
    level: number
    hpCurrent: number
    hpMax: number
    class?: { name: string }
  }
}

interface GroupDetail {
  id: string
  name: string
  icon: string
  leaderId: string
  clanId: string | null
  groupMembers: GroupMember[]
}

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [hero, setHero] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteName, setInviteName] = useState("")
  const [inviting, setInviting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const groupId = params?.id as string | undefined

  const fetchGroup = useCallback(async () => {
    if (!groupId) return
    try {
      const [groupRes, heroRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`),
        fetch("/api/hero"),
      ])
      if (groupRes.status === 401 || heroRes.status === 401) { router.push("/api/auth/signin"); return }
      if (!groupRes.ok) {
        const body = await groupRes.json().catch(() => ({}))
        throw new Error(body.error || `Error ${groupRes.status}`)
      }
      const g = await groupRes.json()
      setGroup(g)
      if (heroRes.ok) {
        const h = await heroRes.json()
        setHero({ id: h.id, name: h.name })
      }
    } catch (e: any) {
      setError(e.message || "Error al cargar")
    } finally {
      setLoading(false)
    }
  }, [groupId, router])

  useEffect(() => { fetchGroup() }, [fetchGroup])

  const isLeader = group?.leaderId === hero?.id
  const isMember = group && hero && group.groupMembers.some(m => m.heroId === hero.id)
  const memberCount = group?.groupMembers.length ?? 0

  async function inviteHero() {
    if (!inviteName.trim() || !groupId) return
    setInviting(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetName: inviteName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setInviteName("")
        fetchGroup()
      } else {
        alert(data.error || "Error al invitar")
      }
    } finally {
      setInviting(false)
    }
  }

  async function kickMember(heroId: string) {
    if (!confirm("¿Expulsar a este miembro?") || !groupId) return
    setActionLoading(`kick-${heroId}`)
    try {
      const res = await fetch(`/api/groups/${groupId}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId }),
      })
      if (res.ok) fetchGroup()
      else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Error")
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function transferLeadership(heroId: string) {
    if (!confirm("¿Transferir liderazgo a este miembro?") || !groupId) return
    setActionLoading(`transfer-${heroId}`)
    try {
      const res = await fetch(`/api/groups/${groupId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId }),
      })
      if (res.ok) fetchGroup()
      else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Error")
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function leaveGroup() {
    if (!confirm("¿Salir del grupo?") || !groupId) return
    setActionLoading("leave")
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, { method: "POST" })
      if (res.ok) router.push("/dungeon")
      else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Error")
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteGroup() {
    if (!confirm("¿Eliminar el grupo definitivamente?") || !groupId) return
    setActionLoading("delete")
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" })
      if (res.ok) router.push("/dungeon")
      else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Error")
      }
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>
    )
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-2">❌ {error || "Grupo no encontrado"}</p>
          <Link href="/dungeon" className="mt-4 inline-block px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
            Volver al mapa
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dungeon" className="text-gray-500 hover:text-gray-300 text-sm transition">← Mapa</Link>
        <span className="text-2xl">{group.icon}</span>
        <div>
          <h1 className="text-xl font-bold text-gray-100">{group.name}</h1>
          <p className="text-xs text-gray-500">{memberCount}/10 miembros</p>
        </div>
      </div>

      {/* Invite bar (leader only) */}
      {isLeader && memberCount < 10 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex gap-2">
          <input
            value={inviteName}
            onChange={e => setInviteName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && inviteHero()}
            placeholder="Nombre del héroe a invitar..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-700"
          />
          <button
            onClick={inviteHero}
            disabled={inviting || !inviteName.trim()}
            className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-sm font-medium transition"
          >
            {inviting ? "..." : "📩 Invitar"}
          </button>
        </div>
      )}

      {/* Members */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-sm font-bold text-gray-200">⚔️ Miembros del grupo</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {group.groupMembers.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No hay miembros</div>
          ) : (
            group.groupMembers.map(m => {
              const isSelf = m.heroId === hero?.id
              const memberIsLeader = m.role === "leader"
              const hpPct = m.hero.hpMax > 0 ? Math.round((m.hero.hpCurrent / m.hero.hpMax) * 100) : 0
              let hpColor
              if (hpPct <= 0) hpColor = "text-red-400"
              else if (hpPct < 30) hpColor = "text-yellow-400"
              else hpColor = "text-green-400"

              return (
                <div key={m.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-200 truncate">{m.hero.name}</span>
                      {memberIsLeader && <span className="text-yellow-400 text-xs">👑 Líder</span>}
                      {isSelf && <span className="text-xs text-gray-500">(vos)</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {m.hero.class && <span>{m.hero.class.name}</span>}
                      <span>Nv. {m.hero.level}</span>
                      <span className={hpColor}>
                        HP {m.hero.hpCurrent}/{m.hero.hpMax}
                      </span>
                    </div>
                  </div>

                  {isLeader && !isSelf && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => transferLeadership(m.heroId)}
                        disabled={actionLoading === `transfer-${m.heroId}`}
                        className="px-2 py-1 rounded bg-yellow-800 hover:bg-yellow-700 disabled:opacity-50 text-[10px] transition"
                        title="Transferir liderazgo"
                      >
                        👑
                      </button>
                      <button
                        onClick={() => kickMember(m.heroId)}
                        disabled={actionLoading === `kick-${m.heroId}`}
                        className="px-2 py-1 rounded bg-red-900 hover:bg-red-800 disabled:opacity-50 text-[10px] transition"
                        title="Expulsar"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Actions */}
      {isMember && (
        <div className="flex gap-3">
          {!isLeader && (
            <button
              onClick={leaveGroup}
              disabled={actionLoading === "leave"}
              className="px-4 py-2 rounded-lg bg-red-900 hover:bg-red-800 disabled:opacity-50 text-sm transition"
            >
              {actionLoading === "leave" ? "..." : "🚪 Salir del grupo"}
            </button>
          )}
          {isLeader && (
            <button
              onClick={deleteGroup}
              disabled={actionLoading === "delete"}
              className="px-4 py-2 rounded-lg bg-red-950 hover:bg-red-900 disabled:opacity-50 text-sm text-red-300 border border-red-900 transition"
            >
              {actionLoading === "delete" ? "..." : "🗑️ Eliminar grupo"}
            </button>
          )}
          <Link
            href={`/dungeon?group=${group.id}`}
            className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-sm font-medium transition"
          >
            ⚔️ Ir a mazmorras
          </Link>
        </div>
      )}
    </div>
  )
}
