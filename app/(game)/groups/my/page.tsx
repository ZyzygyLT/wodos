"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/useToast"

interface GroupItem {
  id: string
  name: string
  icon: string
  leaderId: string
  clanId: string | null
  groupMembers: {
    id: string
    heroId: string
    role: string
    hero: { id: string; name: string; level: number }
  }[]
  _count?: { groupMembers: number }
}

export default function MyGroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [hero, setHero] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [newGroupName, setNewGroupName] = useState("")
  const [creating, setCreating] = useState(false)
  const { show: toast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [groupsRes, heroRes, invitesRes] = await Promise.all([
        fetch("/api/groups"),
        fetch("/api/hero"),
        fetch("/api/groups/invites"),
      ])
      if (groupsRes.status === 401 || heroRes.status === 401) { router.push("/login"); return }
      if (groupsRes.ok) setGroups(await groupsRes.json())
      if (heroRes.ok) {
        const h = await heroRes.json()
        setHero({ id: h.id })
      }
      if (invitesRes.ok) setPendingInvites(await invitesRes.json())
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  async function createGroup() {
    if (!newGroupName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewGroupName("")
        fetchData()
      } else {
        toast(data.error || "Error al crear grupo")
      }
    } finally {
      setCreating(false)
    }
  }

  async function acceptInvite(inviteId: string) {
    try {
      const res = await fetch(`/api/groups/invites/${inviteId}/accept`, { method: "POST" })
      if (res.ok) fetchData()
    } catch {}
  }

  async function rejectInvite(inviteId: string) {
    try {
      const res = await fetch(`/api/groups/invites/${inviteId}/reject`, { method: "POST" })
      if (res.ok) fetchData()
    } catch {}
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]" /></div></div>
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">👥 Mis Grupos</h1>
        <div className="flex gap-2 items-center">
          <input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createGroup()}
            placeholder="Nuevo grupo..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-700"
          />
          <button
            onClick={createGroup}
            disabled={creating || !newGroupName.trim()}
            className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm transition"
          >
            {creating ? "..." : "+ Crear"}
          </button>
        </div>
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-amber-900/40 overflow-hidden">
          <div className="p-4 border-b border-amber-900/30 text-sm font-bold text-amber-400">
            📩 Invitaciones pendientes ({pendingInvites.length})
          </div>
          <div className="divide-y divide-gray-800">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">{inv.group.name}</p>
                  <p className="text-xs text-gray-500">
                    {inv.group.clan?.name ?? "Grupo independiente"} · {inv.group.groupMembers?.length ?? 0} miembros
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acceptInvite(inv.id)}
                    className="px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-xs transition">
                    ✅ Aceptar
                  </button>
                  <button onClick={() => rejectInvite(inv.id)}
                    className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs transition">
                    ❌ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group list */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800 text-sm font-bold text-gray-200">
          ⚔️ Grupos ({groups.length}/5)
        </div>
        <div className="divide-y divide-gray-800">
          {groups.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No tenés grupos. Creá uno o esperá una invitación.
            </div>
          ) : (
            groups.map(g => {
              const isLeader = g.leaderId === hero?.id
              const memberCount = g.groupMembers.length

              return (
                <div key={g.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{g.icon}</span>
                      <Link href={`/groups/${g.id}`} className="font-medium text-sm text-amber-400 hover:text-amber-300 transition">
                        {g.name}
                      </Link>
                      <span className="text-xs text-gray-500">{memberCount}/10</span>
                      {isLeader && <span className="text-yellow-400 text-xs">👑</span>}
                    </div>
                    <Link href={`/groups/${g.id}`}
                      className="text-xs text-gray-500 hover:text-amber-400 transition">
                      ⚙️ Admin
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.groupMembers.map(m => (
                      <span key={m.id} className="text-[10px] bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-400">
                        {m.hero.name} <span className="text-gray-600">Nv.{m.hero.level}</span>
                        {m.role === "leader" && " 👑"}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
