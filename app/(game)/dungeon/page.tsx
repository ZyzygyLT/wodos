"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import DungeonMap from "@/components/game/DungeonMap"
import { useToast } from "@/hooks/useToast"
import logger from "@/lib/logger"

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
  const [loadError, setLoadError] = useState("")
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [dungeons, setDungeons] = useState<any[]>([])
  const [clanUpgrades, setClanUpgrades] = useState<any[] | undefined>(undefined)
  const [allGroups, setAllGroups] = useState<any[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<Record<number, string>>({})
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined)
  const [running, setRunning] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [questSlugs, setQuestSlugs] = useState<Set<string>>(new Set())
  const { show: toast } = useToast()
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [runStatus, setRunStatus] = useState<{
    status: string
    runId?: string
    dungeon?: string
    nextRunAt?: string | null
    completesAt?: string | null
    result?: string | null
    levelsCleared?: number | null
    epGained?: number | null
    goldGained?: number | null
  } | null>(null)

  const fetchHeroAndDungeons = useCallback(async () => {
    try {
      const [heroRes, dungeonsRes] = await Promise.all([
        fetch("/api/hero"), fetch("/api/dungeons"),
      ])
      if (heroRes.status === 401) {
        router.replace("/login")
        return null
      }
      if (heroRes.status === 404) {
        router.replace("/onboarding")
        return null
      }
      if (!heroRes.ok) throw new Error("No se pudo cargar el héroe")
      if (!dungeonsRes.ok) throw new Error("No se pudieron cargar las expediciones")

      const [heroData, dungeonData] = await Promise.all([heroRes.json(), dungeonsRes.json()])
      if (!heroData?.id || !Array.isArray(dungeonData)) {
        throw new Error("La respuesta del servidor no es válida")
      }
      setHero(heroData)
      setDungeons(dungeonData)
      setSelectedProfiles(current => {
        const next = { ...current }
        for (const dungeon of dungeonData) {
          const availableProfiles = dungeon.profiles ?? []
          if (!availableProfiles.some((profile: { id: string }) => profile.id === next[dungeon.id])) {
            if (availableProfiles[0]?.id) next[dungeon.id] = availableProfiles[0].id
            else delete next[dungeon.id]
          }
        }
        return next
      })
      return heroData
    } catch (error) {
      throw error
    }
  }, [router])

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
        if (obj.dungeonSlug && (hq.progress?.[obj.id] ?? 0) < (obj.required ?? 1)) {
          slugs.add(obj.dungeonSlug)
        }
      }
    }
    setQuestSlugs(slugs)
    } catch (e) { logger.error('dungeon', 'Error fetching data', e) }
  }

  const autoSelectGroup = useCallback((mergedGroups: any[], heroId: string) => {
    if (mergedGroups.length === 0 || selectedGroupId) return
    const myGroup = mergedGroups.find((g: any) => {
      const inClanMembers = g.members?.some((m: any) => m.heroId === heroId)
      const inGroupMembers = g.groupMembers?.some((m: any) => m.heroId === heroId)
      return inClanMembers || inGroupMembers
    })
    if (myGroup) setSelectedGroupId(myGroup.id)
  }, [selectedGroupId])

  const fetchRunStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/dungeon/status")
      if (!response.ok) {
        setRunStatus(null)
        return
      }
      const data = await response.json()
      setRunStatus(data?.status === "idle" ? null : data)
    } catch (error) {
      logger.error("dungeon", "Failed to fetch expedition status", error)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoadError("")
    try {
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
      await fetchRunStatus()
    } catch (error) {
      logger.error("dungeon", "Error loading expedition screen", error)
      setLoadError("No pudimos cargar las expediciones. Comprueba tu conexión e inténtalo de nuevo.")
    }
  }, [fetchHeroAndDungeons, autoSelectGroup, fetchRunStatus])

  useEffect(() => {
    void Promise.resolve().then(fetchData)
  }, [fetchData, loadAttempt])

  const activeRunStatus = runStatus?.status
  const activeRunId = runStatus?.runId

  useEffect(() => {
    if (!activeRunStatus || !["registered", "running"].includes(activeRunStatus)) return
    const interval = setInterval(() => { void fetchRunStatus() }, 15_000)
    return () => clearInterval(interval)
  }, [activeRunStatus, fetchRunStatus])

  useEffect(() => {
    if (!activeRunStatus || ["registered", "running"].includes(activeRunStatus) || !activeRunId) return
    const refreshTimer = setTimeout(() => {
      void fetchHeroAndDungeons().catch(error => {
        logger.error("dungeon", "Failed to refresh hero after expedition", error)
      })
    }, 0)
    return () => clearTimeout(refreshTimer)
  }, [activeRunStatus, activeRunId, fetchHeroAndDungeons])

  async function createGroup() {
    if (!newGroupName.trim() || newGroupName.length < 2) return
    setCreatingGroup(true)
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      })
      if (res.ok) {
        const group = await res.json()
        setSelectedGroupId(group.id)
        setNewGroupName("")
        setShowCreateGroup(false)
        fetchData()
      } else {
        const data = await res.json()
        toast(data.error || "Error al crear grupo")
      }
    } catch { toast("Error de red") }
    setCreatingGroup(false)
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
        toast(data.error || "Error")
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
    } catch (error) {
      logger.error("dungeon", "Failed to register expedition", error)
      toast("No se pudo iniciar la expedición. Inténtalo de nuevo.")
      setRunning(false)
    }
  }

  async function cancelRegisteredRun() {
    if (!runStatus?.runId || runStatus.status !== "registered" || cancelling) return
    const confirmed = globalThis.window.confirm(
      "¿Cancelar esta inscripción? La expedición pendiente se cancelará para todos sus integrantes."
    )
    if (!confirmed) return

    setCancelling(true)
    try {
      const response = await fetch("/api/dungeon/cancel", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast(data.error || "No se pudo cancelar la expedición")
        await fetchData()
        return
      }
      toast("Inscripción cancelada. Tu grupo vuelve a estar disponible.")
      await fetchData()
    } catch (error) {
      logger.error("dungeon", "Failed to cancel registered expedition", error)
      toast("No se pudo cancelar la expedición. Inténtalo de nuevo.")
    } finally {
      setCancelling(false)
    }
  }

  if (!hero && loadError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-gray-100">
        <div className="max-w-md text-center space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h1 className="text-lg font-bold">No pudimos abrir las expediciones</h1>
          <p className="text-sm text-gray-400">{loadError}</p>
          <button onClick={() => setLoadAttempt(attempt => attempt + 1)}
            className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black hover:bg-yellow-400">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]" /></div></div>

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
        <section aria-label="Estado del héroe" className="mb-5 rounded-xl border border-gray-800 bg-gray-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500">Estado del héroe</p>
              <p className="text-sm font-semibold text-gray-100">{hero.name} · Nivel {hero.level}</p>
            </div>
            {(hero.hpCurrent < (hero.computedHpMax ?? hero.hpMax) || hero.mpCurrent < (hero.computedMpMax ?? hero.mpMax)) && (
              <a href="/inventory" className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-900/50">
                Revisar consumibles
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-red-300">❤️ Vida</span>
                <span className="tabular-nums text-gray-300">{hero.hpCurrent} / {hero.computedHpMax ?? hero.hpMax}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                <div className="h-full rounded-full bg-red-600" style={{ width: `${(hero.computedHpMax ?? hero.hpMax) > 0 ? Math.max(0, Math.min(100, hero.hpCurrent / (hero.computedHpMax ?? hero.hpMax) * 100)) : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-sky-300">💧 Maná</span>
                <span className="tabular-nums text-gray-300">{hero.mpCurrent} / {hero.computedMpMax ?? hero.mpMax}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                <div className="h-full rounded-full bg-sky-600" style={{ width: `${(hero.computedMpMax ?? hero.mpMax) > 0 ? Math.max(0, Math.min(100, hero.mpCurrent / (hero.computedMpMax ?? hero.mpMax) * 100)) : 0}%` }} />
              </div>
            </div>
          </div>
          {hero.hpCurrent <= 0 && (
            <p className="mt-3 text-xs text-amber-300">Tu héroe no tiene vida suficiente para iniciar otra expedición. Recuperala con consumibles desde el inventario.</p>
          )}
        </section>
        {runStatus && (
          <section aria-live="polite" aria-label="Estado de la expedición" className="mb-5 rounded-xl border border-amber-800/60 bg-amber-950/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Expedición {runStatus.status === "registered" ? "registrada" : runStatus.status === "running" ? "en curso" : "finalizada"}</p>
                <p className="mt-1 text-sm font-semibold text-gray-100">{runStatus.dungeon ?? "Última expedición"}</p>
                {runStatus.status === "registered" && runStatus.nextRunAt && (
                  <p className="mt-1 text-xs text-gray-400">Salida prevista (hora local): {new Date(runStatus.nextRunAt).toLocaleString()}</p>
                )}
                {runStatus.status === "running" && (
                  <p className="mt-1 text-xs text-gray-400">La expedición está siendo resuelta. Este estado se actualizará automáticamente.</p>
                )}
                {!["registered", "running"].includes(runStatus.status) && (
                  <>
                    <p className="mt-1 text-xs text-gray-400">{runStatus.result === "victory" ? "Victoria" : runStatus.result === "defeat" ? "Derrota" : "Resultado disponible"} · {runStatus.levelsCleared ?? 0} niveles superados</p>
                    <p className="mt-1 text-xs text-amber-300">Recompensas: +{runStatus.epGained ?? 0} PE · +{runStatus.goldGained ?? 0} oro</p>
                  </>
                )}
              </div>
              {runStatus.runId && !["registered", "running"].includes(runStatus.status) && (
                <button onClick={() => router.push("/dungeon/report/" + runStatus.runId)}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-500">
                  Ver informe
                </button>
              )}
              {runStatus.status === "registered" && runStatus.runId && (
                <button onClick={cancelRegisteredRun} disabled={cancelling}
                  className="rounded-lg border border-red-800/70 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/50 disabled:opacity-50">
                  {cancelling ? "Cancelando..." : "Cancelar inscripción"}
                </button>
              )}
            </div>
          </section>
        )}

        {showCreateGroup && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateGroup(false)}>
            <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4">Crear grupo</h3>
              <input type="text" placeholder="Nombre del grupo" autoFocus value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createGroup() }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-4" />
              <div className="flex gap-2">
                <button onClick={createGroup} disabled={creatingGroup || newGroupName.length < 2}
                  className="flex-1 px-4 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm transition">
                  {creatingGroup ? "..." : "Crear"}
                </button>
                <button onClick={() => setShowCreateGroup(false)}
                  className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

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
          onCreateGroup={() => setShowCreateGroup(true)}
          questSlugs={questSlugs}
        />
      </div>
  )
}
