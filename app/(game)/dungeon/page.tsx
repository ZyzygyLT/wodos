"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import DungeonMap from "@/components/game/DungeonMap"

async function fetchGroups() {
  try {
    const groupsRes = await fetch("/api/groups")
    if (!groupsRes.ok) return []
    return groupsRes.json()
  } catch { return [] }
}

export default function DungeonPage() {
  const router = useRouter()
  const [hero, setHero] = useState<any>(null)
  const [dungeons, setDungeons] = useState<any[]>([])
  const [clanUpgrades, setClanUpgrades] = useState<any[] | undefined>(undefined)
  const [allGroups, setAllGroups] = useState<any[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<Record<number, string>>({})
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined)
  const [running, setRunning] = useState(false)
  const [questSlugs, setQuestSlugs] = useState<Set<string>>(new Set())

  async function fetchHeroAndDungeons() {
    try {
      const [heroRes, dungeonsRes] = await Promise.all([
        fetch("/api/hero"), fetch("/api/dungeons"),
      ])
      if (heroRes.status === 401 || heroRes.status === 404) return null
      const heroData = await heroRes.json()
      setHero(heroData)
      setDungeons(await dungeonsRes.json())
      return heroData
    } catch { return null }
  }

  async function fetchClan() {
    try {
      const clanRes = await fetch("/api/clan")
      if (!clanRes.ok) return []
      const clan = await clanRes.json()
      setClanUpgrades(clan?.upgrades)
      return clan?.groups ?? []
    } catch { return [] }
  }

  function mergeGroups(clanGroups: any[], independentGroups: any[]) {
    const merged = [...clanGroups]
    const existingIds = new Set(merged.map((g: any) => g.id))
    for (const g of independentGroups) {
      if (!existingIds.has(g.id)) {
        merged.push(g)
        existingIds.add(g.id)
      }
    }
    return merged
  }

  async function fetchQuestSlugs() {
    try {
      const questsRes = await fetch("/api/quests")
      if (!questsRes.ok) return
      const questData = await questsRes.json()
    const slugs = new Set<string>()
    for (const hq of questData.active ?? []) {
      for (const obj of hq.quest?.objectives ?? []) {
        if (obj.dungeonSlug && !hq.progress?.[obj.id] >= (obj.required ?? 1)) {
          slugs.add(obj.dungeonSlug)
        }
      }
    }
    setQuestSlugs(slugs)
    } catch {}
  }

  function autoSelectGroup(mergedGroups: any[], heroId: string) {
    if (mergedGroups.length === 0 || selectedGroupId) return
    const myGroup = mergedGroups.find((g: any) => {
      const inClanMembers = g.members?.some((m: any) => m.heroId === heroId)
      const inGroupMembers = g.groupMembers?.some((m: any) => m.heroId === heroId)
      return inClanMembers || inGroupMembers
    })
    if (myGroup) setSelectedGroupId(myGroup.id)
  }

  const fetchData = useCallback(async () => {
    const heroData = await fetchHeroAndDungeons()
    if (!heroData) return

    const [clanGroups, independentGroups] = await Promise.all([
      fetchClan(),
      fetchGroups(),
    ])

    const mergedGroups = mergeGroups(clanGroups, independentGroups)
    setAllGroups(mergedGroups)

    await fetchQuestSlugs()
    autoSelectGroup(mergedGroups, heroData.id)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function createGroup() {
    const name = prompt("Nombre del nuevo grupo:")
    if (!name || name.length < 2) return
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const group = await res.json()
        setSelectedGroupId(group.id)
        fetchData()
      } else {
        const data = await res.json()
        alert(data.error || "Error al crear grupo")
      }
    } catch { alert("Error de red") }
  }

  async function registerDungeon(dungeonId: number, isInstant: boolean, groupId?: string) {
    const profileId = selectedProfiles[dungeonId] ?? undefined
    setRunning(true)
    try {
      const res = await fetch("/api/dungeon/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dungeonId, profileId, groupId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error de conexión" }))
        alert(data.error || "Error")
        setRunning(false)
        return
      }
      const data = await res.json()
      if (data.instant) {
        let url = `/dungeon/play/${data.runId}`
        const params = new URLSearchParams()
        if (data.levelUp) {
          params.set('lvl', String(data.levelUp.newLevel))
          params.set('pts', String(data.levelUp.pointsAwarded))
        }
        if (data.firstOfDay) params.set('fod', '1')
        const qs = params.toString()
        if (qs) url += `?${qs}`
        router.push(url)
      } else {
        fetchData()
      }
      setRunning(false)
    } catch { setRunning(false) }
  }

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Cargando...</div>

  if (running) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-pulse">⚔️</div>
          <p className="text-gray-400 animate-pulse">Explorando mazmorra...</p>
        </div>
      </div>
    )
  }

  return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <DungeonMap
          dungeons={dungeons}
          heroLevel={hero.level}
          heroHp={hero.hpCurrent}
          selectedProfiles={selectedProfiles}
          onSelectProfile={(id, profileId) => setSelectedProfiles(s => ({ ...s, [id]: profileId }))}
          onRegister={registerDungeon}
          clanUpgrades={clanUpgrades}
          groups={allGroups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onCreateGroup={createGroup}
          questSlugs={questSlugs}
        />
      </div>
  )
}
