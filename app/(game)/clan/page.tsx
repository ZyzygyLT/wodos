"use client"

import { useEffect, useState, useCallback } from "react"

export default function ClanPage() {
  const [hero, setHero] = useState<any>(null)
  const [clan, setClan] = useState<any>(null)
  const [tab, setTab] = useState<"view" | "create" | "join">("view")
  const [createName, setCreateName] = useState("")
  const [createTag, setCreateTag] = useState("")
  const [createIcon, setCreateIcon] = useState("⚔️")
  const [createDesc, setCreateDesc] = useState("")
  const [joinId, setJoinId] = useState("")
  const [contributeAmount, setContributeAmount] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clanTab, setClanTab] = useState<"members" | "groups" | "upgrades">("members")
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [kicking, setKicking] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  const UPGRADE_DEFS: Record<string, { name: string; icon: string; tiers: { goldCost: number; effect: string }[] }> = {
    library: { name: "Biblioteca del clan", icon: "📚", tiers: [
      { goldCost: 500, effect: "+5% EP" },
      { goldCost: 1200, effect: "+10% EP" },
      { goldCost: 3000, effect: "+15% EP" },
    ]},
    time_altar: { name: "Altar del tiempo", icon: "⏳", tiers: [
      { goldCost: 800, effect: "Timer -1h" },
      { goldCost: 2000, effect: "Timer -2h" },
      { goldCost: 5000, effect: "Timer -3h" },
    ]},
    storage: { name: "Almacén compartido", icon: "📦", tiers: [
      { goldCost: 400, effect: "500 slots" },
      { goldCost: 1000, effect: "1500 slots" },
      { goldCost: 2500, effect: "5000 slots" },
    ]},
    training: { name: "Sala de entrenamiento", icon: "🏋️", tiers: [
      { goldCost: 1000, effect: "+5% ATK" },
      { goldCost: 2500, effect: "+10% ATK+DEF" },
      { goldCost: 6000, effect: "+20% stats" },
    ]},
    infirmary: { name: "Enfermería", icon: "🏥", tiers: [
      { goldCost: 600, effect: "1 cura/sem" },
      { goldCost: 1500, effect: "3 curas/sem" },
      { goldCost: 4000, effect: "Ilimitado" },
    ]},
    cartography: { name: "Cartografía", icon: "🗺️", tiers: [
      { goldCost: 700, effect: "+10% oro" },
      { goldCost: 1800, effect: "+15% oro+preview" },
      { goldCost: 4500, effect: "Boss reveal" },
    ]},
    smithy: { name: "Herrería del clan", icon: "🔨", tiers: [
      { goldCost: 1200, effect: "Reparar gratis" },
      { goldCost: 3000, effect: "Craft básico" },
      { goldCost: 7000, effect: "Craft único" },
    ]},
    exclusive_dungeon: { name: "Dungeon exclusivo", icon: "🔥", tiers: [
      { goldCost: 5000, effect: "Dungeon lv1-5" },
      { goldCost: 10000, effect: "Dungeon lv6-10" },
      { goldCost: 20000, effect: "Dungeon legendario" },
    ]},
  }

  const fetchData = useCallback(async () => {
    const [heroRes, clanRes] = await Promise.all([
      fetch("/api/hero"),
      fetch("/api/clan"),
    ])
    if (heroRes.status === 401 || heroRes.status === 404) return
    setHero(await heroRes.json())
    const c = await clanRes.json()
    setClan(c)
    if (c) setTab("view")
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function createClan() {
    if (!createName || !createTag) { setMessage("❌ Nombre y tag requeridos"); return }
    setLoading(true)
    const res = await fetch("/api/clan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: createName, tag: createTag, icon: createIcon, description: createDesc }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setMessage("✅ Clan creado!")
      fetchData()
    } else {
      setMessage(`❌ ${data.error}`)
    }
  }

  async function joinClan() {
    if (!joinId) { setMessage("❌ Ingresá un ID de clan"); return }
    setLoading(true)
    const res = await fetch("/api/clan/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clanId: joinId }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setMessage("✅ Te uniste al clan!")
      fetchData()
    } else {
      setMessage(`❌ ${data.error}`)
    }
  }

  async function contribute() {
    if (!contributeAmount || contributeAmount < 1) { setMessage("❌ Monto inválido"); return }
    setLoading(true)
    const res = await fetch("/api/clan/contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: contributeAmount }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setMessage(`✅ Contribuiste ${data.contributed} oro al clan!`)
      fetchData()
    } else {
      setMessage(`❌ ${data.error}`)
    }
  }

  async function kickMember(heroId: string) {
    setKicking(heroId)
    const res = await fetch("/api/clan/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heroId }),
    })
    setKicking(null)
    const data = await res.json()
    if (res.ok) {
      setMessage(`✅ ${data.kicked} fue expulsado del clan`)
      fetchData()
    } else {
      setMessage(`❌ ${data.error}`)
    }
  }

  async function changeRole(heroId: string, role: string) {
    setChangingRole(heroId + role)
    const res = await fetch("/api/clan/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heroId, role }),
    })
    setChangingRole(null)
    const data = await res.json()
    if (res.ok) {
      setMessage(`✅ Rol cambiado a ${role}`)
      fetchData()
    } else {
      setMessage(`❌ ${data.error}`)
    }
  }

  async function transfer(heroId: string) {
    if (!confirm("¿Estás seguro? Vas a transferir el liderazgo del clan.")) return
    const res = await fetch("/api/clan/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heroId }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage("✅ Liderazgo transferido!")
      fetchData()
    } else {
      setMessage(`❌ ${data.error}`)
    }
  }

  async function leaveClan() {
    if (!confirm("¿Estás seguro de abandonar el clan?")) return
    const res = await fetch("/api/clan/leave", { method: "POST" })
    const data = await res.json()
    if (res.ok) {
      setMessage("✅ Abandonaste el clan")
      fetchData()
    } else {
      setMessage(`❌ ${data.error}`)
    }
  }

  const myMember = clan?.members?.find((m: any) => m.heroId === hero?.id)
  const canKick = myMember?.role === "leader" || myMember?.role === "officer"
  const canChangeRoles = myMember?.role === "leader"
  const [groups, setGroups] = useState<any[]>([])
  const [newGroupName, setNewGroupName] = useState("")
  const setJoiningGroup = (_v: string | null) => {}
  const [leavingGroup, setLeavingGroup] = useState<string | null>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [invitingHero, setInvitingHero] = useState<string | null>(null)
  const [unassignedMembers, setUnassignedMembers] = useState<any[]>([])

  const fetchGroups = useCallback(async () => {
    const [groupsRes, invitesRes] = await Promise.all([
      fetch("/api/clan/groups"),
      fetch("/api/clan/groups/invites"),
    ])
    if (groupsRes.ok) {
      const gs = await groupsRes.json()
      setGroups(gs)
    }
    if (invitesRes.ok) {
      const invs = await invitesRes.json()
      setPendingInvites(invs)
    }
  }, [])

  useEffect(() => {
    if (clan) {
      fetchGroups()
      setUnassignedMembers(clan.members?.filter((m: any) => !m.groupId) ?? [])
    }
  }, [clan, fetchGroups])

  async function createGroup() {
    if (!newGroupName) { setMessage("❌ Nombre requerido"); return }
    setCreatingGroup(true)
    const res = await fetch("/api/clan/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName }),
    })
    setCreatingGroup(false)
    const data = await res.json()
    if (res.ok) { setMessage("✅ Grupo creado!"); setNewGroupName(""); fetchGroups() }
    else { setMessage(`❌ ${data.error}`) }
  }

  async function joinGroup(groupId: string) {
    setJoiningGroup(groupId)
    const res = await fetch(`/api/clan/groups/${groupId}/join`, { method: "POST" })
    setJoiningGroup(null)
    const data = await res.json()
    if (res.ok) { setMessage(`✅ Te uniste a ${data.groupName}`); fetchGroups(); fetchData() }
    else { setMessage(`❌ ${data.error}`) }
  }

  async function leaveGroup(groupId: string) {
    setLeavingGroup(groupId)
    const res = await fetch(`/api/clan/groups/${groupId}/leave`, { method: "POST" })
    setLeavingGroup(null)
    const data = await res.json()
    if (res.ok) { setMessage("✅ Saliste del grupo"); fetchGroups(); fetchData() }
    else { setMessage(`❌ ${data.error}`) }
  }

  async function kickFromGroup(groupId: string, heroId: string) {
    const res = await fetch(`/api/clan/groups/${groupId}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heroId }),
    })
    const data = await res.json()
    if (res.ok) { setMessage(`✅ Expulsado`); fetchGroups() }
    else { setMessage(`❌ ${data.error}`) }
  }

  async function transferGroup(groupId: string, heroId: string) {
    if (!confirm("¿Transferir liderazgo del grupo?")) return
    const res = await fetch(`/api/clan/groups/${groupId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heroId }),
    })
    const data = await res.json()
    if (res.ok) { setMessage("✅ Liderazgo transferido"); fetchGroups() }
    else { setMessage(`❌ ${data.error}`) }
  }

  async function inviteToGroup(groupId: string, heroId: string) {
    setInvitingHero(heroId)
    const res = await fetch("/api/clan/groups/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, heroId }),
    })
    setInvitingHero(null)
    const data = await res.json()
    if (res.ok) { setMessage(`✅ Invitación enviada!`); fetchGroups() }
    else { setMessage(`❌ ${data.error}`) }
  }

  async function acceptInvite(inviteId: string) {
    const res = await fetch(`/api/clan/groups/invites/${inviteId}/accept`, { method: "POST" })
    const data = await res.json()
    if (res.ok) { setMessage("✅ Te uniste al grupo!"); fetchGroups(); fetchData() }
    else { setMessage(`❌ ${data.error}`) }
  }

  async function rejectInvite(inviteId: string) {
    const res = await fetch(`/api/clan/groups/invites/${inviteId}/reject`, { method: "POST" })
    if (res.ok) { setMessage("✅ Invitación rechazada"); fetchGroups() }
    else { setMessage(`❌ ${(await res.json()).error}`) }
  }

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => setMessage(null)}>
          {message}
        </button>
      )}

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {!clan && tab === "view" && (
          <div className="text-center py-12 space-y-4">
            <p className="text-gray-400">No pertenecés a ningún clan</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setTab("create")}
                className="px-4 py-2 rounded-lg bg-yellow-700 hover:bg-yellow-600 transition text-sm">
                Crear clan
              </button>
              <button onClick={() => setTab("join")}
                className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 transition text-sm">
                Unirse a clan
              </button>
            </div>
          </div>
        )}

        {!clan && tab === "create" && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md mx-auto space-y-4">
            <h2 className="font-bold text-lg">Crear Clan</h2>
            <input placeholder="Nombre del clan" value={createName} onChange={e => setCreateName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <input placeholder="Tag (max 4 chars)" value={createTag} onChange={e => setCreateTag(e.target.value.slice(0, 4))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Ícono" value={createIcon} onChange={e => setCreateIcon(e.target.value)}
                className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-center" />
            </div>
            <textarea placeholder="Descripción (opcional)" value={createDesc} onChange={e => setCreateDesc(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" rows={3} />
            <div className="flex gap-2">
              <button onClick={createClan} disabled={loading}
                className="flex-1 py-2 rounded-lg bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 transition text-sm">
                {loading ? "..." : "Crear"}
              </button>
              <button onClick={() => setTab("view")}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!clan && tab === "join" && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md mx-auto space-y-4">
            <h2 className="font-bold text-lg">Unirse a Clan</h2>
            <p className="text-xs text-gray-400">Pedile el ID del clan al líder</p>
            <input placeholder="ID del clan" value={joinId} onChange={e => setJoinId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={joinClan} disabled={loading}
                className="flex-1 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 transition text-sm">
                {loading ? "..." : "Unirse"}
              </button>
              <button onClick={() => setTab("view")}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {clan && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl">{clan.icon}</span>
                <div>
                  <h2 className="text-xl font-bold">{clan.name}</h2>
                  <p className="text-sm text-gray-400">[{clan.tag}] · Nivel {clan.level} · 🏆 {clan.fame} fama</p>
                  {clan.description && <p className="text-xs text-gray-500 mt-1">{clan.description}</p>}
                </div>
              </div>

              {/* Level progress bar */}
              {(() => {
                const nextFame = clan.level * clan.level * 50 + 50
                const prevFame = (clan.level - 1) * (clan.level - 1) * 50 + 50
                const pct = Math.min(100, ((clan.fame - prevFame) / (nextFame - prevFame)) * 100)
                const maxMembers = 20 + (clan.level - 1) * 2
                return (
                  <div className="mb-4 space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>🏆 {clan.fame} / {nextFame} para nivel {clan.level + 1}</span>
                      <span>👥 Max {maxMembers} miembros</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full transition-all" style={{ width: `${Math.max(0, pct)}%` }} />
                    </div>
                  </div>
                )
              })()}

              <div className="flex items-center gap-4 text-sm border-t border-gray-800 pt-4">
                <span className="text-yellow-300">💰 Fondo del clan: {clan.gold}</span>
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="Oro" value={contributeAmount || ""}
                    onChange={e => setContributeAmount(Number.parseInt(e.target.value) || 0)}
                    className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" />
                  <button onClick={contribute} disabled={loading}
                    className="px-3 py-1 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-xs transition">
                    Contribuir
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setClanTab("members")}
                className={`px-4 py-2 rounded-lg text-sm transition ${clanTab === "members" ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                👥 Miembros
              </button>
              <button onClick={() => setClanTab("groups")}
                className={`px-4 py-2 rounded-lg text-sm transition ${clanTab === "groups" ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                🔰 Grupos
              </button>
              <button onClick={() => setClanTab("upgrades")}
                className={`px-4 py-2 rounded-lg text-sm transition ${clanTab === "upgrades" ? "bg-yellow-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                🏰 Guarida
              </button>
            </div>

            {clanTab === "members" && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800 font-bold text-sm">
                  Miembros ({clan.members?.length ?? 0}/{20 + (clan.level - 1) * 2})
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="p-3 text-left whitespace-nowrap">Nombre</th>
                      <th className="p-3 text-left whitespace-nowrap">Clase</th>
                      <th className="p-3 text-center whitespace-nowrap">Nv.</th>
                      <th className="p-3 text-center whitespace-nowrap">Rol</th>
                      <th className="p-3 text-right whitespace-nowrap">Aportado</th>
                      <th className="p-3 text-right whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clan.members?.map((m: any) => {
                      let roleColor
                      if (m.role === "leader") roleColor = "text-yellow-400"
                      else if (m.role === "officer") roleColor = "text-blue-400"
                      else roleColor = "text-gray-400"
                      return (
                      <tr key={m.heroId} className="border-t border-gray-800">
                        <td className="p-3 font-medium">{m.hero.name}</td>
                        <td className="p-3 text-gray-400">{m.hero.class?.icon} {m.hero.class?.name}</td>
                        <td className="p-3 text-center">{m.hero.level}</td>
                        <td className="p-3 text-center">
                          <span className={`text-xs ${roleColor}`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="p-3 text-right text-gray-400">{m.goldContributed}💰</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {m.role !== "leader" && canKick && (
                              <button onClick={() => kickMember(m.heroId)} disabled={kicking === m.heroId}
                                className="px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 disabled:opacity-50 text-[10px] transition">
                                {kicking === m.heroId ? "..." : "Expulsar"}
                              </button>
                            )}
                            {canChangeRoles && m.role !== "leader" && (
                              <>
                                {m.role === "member" && (
                                  <button onClick={() => changeRole(m.heroId, "officer")} disabled={changingRole === m.heroId + "officer"}
                                    className="px-2 py-0.5 rounded bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-[10px] transition">
                                    Ascender
                                  </button>
                                )}
                                {m.role === "officer" && (
                                  <button onClick={() => changeRole(m.heroId, "member")} disabled={changingRole === m.heroId + "member"}
                                    className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-[10px] transition">
                                    Descender
                                  </button>
                                )}
                                <button onClick={() => transfer(m.heroId)}
                                  className="px-2 py-0.5 rounded bg-yellow-800 hover:bg-yellow-700 text-[10px] transition">
                                  Líder
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
                </div>
                {myMember?.role !== "leader" && (
                  <div className="p-3 border-t border-gray-800 flex justify-end">
                    <button onClick={leaveClan}
                      className="px-3 py-1.5 rounded bg-red-800 hover:bg-red-700 text-xs transition">
                      🚪 Abandonar clan
                    </button>
                  </div>
                )}
              </div>
            )}

            {clanTab === "groups" && (
              <div className="space-y-4">
                {/* Pending invites for current hero */}
                {pendingInvites.length > 0 && (
                  <div className="bg-gray-900 rounded-xl border border-yellow-800 overflow-hidden">
                    <div className="p-4 border-b border-yellow-800 font-bold text-sm text-yellow-400">
                      📩 Invitaciones pendientes
                    </div>
                    <div className="divide-y divide-gray-800">
                      {pendingInvites.map(inv => (
                        <div key={inv.id} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{inv.group.name}</p>
                            <p className="text-xs text-gray-400">{inv.group.clan.name} · {inv.group.members?.length ?? 0} miembros</p>
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

                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="p-4 border-b border-gray-800 font-bold text-sm flex items-center justify-between">
                    <span>🔰 Grupos ({groups.length}/3)</span>
                    {(myMember?.role === "leader" || myMember?.role === "officer") && (
                      <div className="flex gap-2 items-center">
                        <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                          placeholder="Nombre del grupo"
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs w-36" />
                        <button onClick={createGroup} disabled={creatingGroup}
                          className="px-3 py-1 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-xs transition">
                          {creatingGroup ? "..." : "+ Crear"}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="divide-y divide-gray-800">
                    {groups.length === 0 && (
                      <div className="p-6 text-center text-sm text-gray-500">
                        No hay grupos. {myMember?.role === "leader" || myMember?.role === "officer" ? "Creá el primero arriba." : "Pedile al líder que cree uno."}
                      </div>
                    )}
                    {groups.map((g: any) => {
                      const isLeader = g.leaderId === hero?.id
                      const isMember = g.members?.some((m: any) => m.heroId === hero?.id)
                      return (
                        <div key={g.id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium text-sm">{g.name}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {g.members?.length ?? 0}/10 miembros
                                {isLeader && " · 👑 Líder"}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {isMember && !isLeader && (
                                <button onClick={() => leaveGroup(g.id)} disabled={leavingGroup === g.id}
                                  className="px-2 py-1 rounded bg-red-800 hover:bg-red-700 disabled:opacity-50 text-[10px] transition">
                                  {leavingGroup === g.id ? "..." : "Salir"}
                                </button>
                              )}
                              {!isMember && (
                                <span className="text-xs text-gray-500">Invitación requerida</span>
                              )}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-800 text-gray-400 uppercase">
                                <tr>
                                  <th className="p-2 text-left">Nombre</th>
                                  <th className="p-2 text-center">Rol</th>
                                  <th className="p-2 text-center">Nv.</th>
                                  <th className="p-2 text-right">Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.members?.map((m: any) => (
                                  <tr key={m.heroId} className="border-t border-gray-800">
                                    <td className="p-2 font-medium">{m.hero.name}</td>
                                    <td className="p-2 text-center">
                                      <span className={`${m.groupRole === "leader" ? "text-yellow-400" : "text-gray-400"}`}>
                                        {m.groupRole}
                                      </span>
                                    </td>
                                    <td className="p-2 text-center">{m.hero.level}</td>
                                    <td className="p-2 text-right">
                                      {isLeader && m.heroId !== hero?.id && (
                                        <div className="flex justify-end gap-1">
                                          <button onClick={() => kickFromGroup(g.id, m.heroId)}
                                            className="px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-[10px] transition">
                                            Expulsar
                                          </button>
                                          <button onClick={() => transferGroup(g.id, m.heroId)}
                                            className="px-2 py-0.5 rounded bg-yellow-800 hover:bg-yellow-700 text-[10px] transition">
                                            Líder
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Unassigned members — only for group leaders */}
                {(myMember?.role === "leader" || myMember?.role === "officer") && unassignedMembers.length > 0 && (
                  <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-4 border-b border-gray-800 font-bold text-sm">
                      👤 Miembros sin grupo ({unassignedMembers.length})
                    </div>
                    <div className="divide-y divide-gray-800">
                      {unassignedMembers.map((m: any) => (
                        <div key={m.heroId} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{m.hero.name}</p>
                            <p className="text-xs text-gray-400">Nv.{m.hero.level} · {m.hero.class?.name}</p>
                          </div>
                          <div className="flex gap-1">
                            {groups.filter(g => (g.members?.length ?? 0) < 10).map(g => (
                              <button key={g.id} onClick={() => inviteToGroup(g.id, m.heroId)} disabled={invitingHero === m.heroId}
                                className="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-[10px] transition">
                                {invitingHero === m.heroId ? "..." : `Invitar a ${g.name}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {clanTab === "upgrades" && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800 font-bold text-sm">
                  🏰 Mejoras de la Guarida
                </div>
                <div className="divide-y divide-gray-800">
                  {Object.entries(UPGRADE_DEFS).map(([id, def]) => {
                    const current = clan.upgrades?.find((u: any) => u.upgradeId === id)
                    const currentTier = current?.tier ?? 0
                    const isMax = currentTier >= def.tiers.length
                    const nextTier = currentTier
                      const next = isMax ? null : def.tiers[nextTier]
                      let upgradeLabel
                      if (upgrading === id) upgradeLabel = "..."
                      else if (isMax) upgradeLabel = "Max"
                      else upgradeLabel = "Mejorar"
                    return (
                      <div key={id} className="p-4 flex items-center gap-4">
                        <span className="text-2xl">{def.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{def.name}</div>
                          <div className="text-xs text-gray-400">
                            {currentTier > 0 ? `Tier ${currentTier}` : "Bloqueado"}
                            {next && ` · Siguiente: ${next.effect} (${next.goldCost}💰)`}
                            {isMax && " · ¡MAX!"}
                          </div>
                        </div>
                        <button onClick={async () => {
                          setUpgrading(id)
                          const res = await fetch("/api/clan/upgrade", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ upgradeId: id }),
                          })
                          const data = await res.json()
                          setUpgrading(null)
                          if (res.ok) {
                            setMessage(`✅ ${def.name} mejorada a Tier ${data.newTier}!`)
                            fetchData()
                          } else {
                            setMessage(`❌ ${data.error}`)
                          }
                        }}
                          disabled={isMax || upgrading === id}
                          className="shrink-0 px-3 py-1 rounded bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition">
                          {upgradeLabel}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
