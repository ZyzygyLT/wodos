"use client"

import logger from "@/lib/logger"
import {
  combineAdventureRewards, hasAdventureRewardPayload, getAdventureChoiceCosts, canAffordAdventureChoice,
} from "@/lib/adventures/adventure-helpers"
import type { StepResult, StepRewards, AdventureStepEnemy, AdventureChoice } from "@/lib/adventures/types"
import type { LevelUpResult } from "@/lib/level-up"
import { CombatPlayback } from "@/components/combat/CombatPlayback"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type AdventureClaimResult = {
  claimed: true
  partial: boolean
  rewards: StepRewards
  levelUp: LevelUpResult | null
}

export default function ActiveAdventurePage() {

  const router = useRouter()
  const [active, setActive] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<AdventureClaimResult | null>(null)
  const [abandoning, setAbandoning] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [expandedCombat, setExpandedCombat] = useState<number | null>(null)
  const [stepType, setStepType] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/adventures/active", { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 401) { router.push("/login"); return null }
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(typeof body?.error === "string" ? body.error : "No se pudo cargar la aventura")
        }
        const data = await res.json()
        if (!data) throw new Error("Respuesta inválida al cargar la aventura")
        if (data.active === false) {
          router.push("/adventures")
          return null
        }
        return data
      })
      .then((data) => {
        if (!data) return
        setActive(data)
        setHistory(data.result?.steps ?? [])
        setStepType(data.currentStepData?.type ?? null)
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setError(error instanceof Error ? error.message : "Error al cargar aventura")
        }
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [router])

  async function advanceStep() {
    if (!active) return
    setExecuting(true)
    setError(null)
    try {
      const res = await fetch("/api/adventures/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroAdventureId: active.id, expectedCurrentStep: active.currentStep }),
      })
      if (!res.ok) { const e = await res.json(); setError(e.error); return }
      const result = await res.json()

      setHistory((prev: any) => [...prev, result.stepResult])

      if (result.completed) {
        setActive((prev: any) => ({
          ...prev,
          status: result.victory ? 'completed' : 'failed',
          currentStepData: null,
          result: {
            steps: [...(prev.result?.steps ?? []), result.stepResult],
            rewards: result.rewards,
            ...(!result.victory ? { outcome: 'defeated' } : {}),
          },
          heroResources: result.heroResources ?? prev.heroResources,
        }))
        setStepType(null)
      } else {
        setActive((prev: any) => ({
          ...prev,
          currentStep: result.currentStep,
          currentStepData: result.nextStep ?? null,
          result: { steps: [...(prev.result?.steps ?? []), result.stepResult], rewards: null },
          heroResources: result.heroResources ?? prev.heroResources,
        }))
        setStepType(result.nextStep?.type ?? null)
      }
    } catch { setError("Error al ejecutar paso") } finally {
      setExecuting(false)
    }
  }

  async function makeChoice(choiceIndex: number) {
    if (!active) return
    setChoosing(true)
    setError(null)
    try {
      const res = await fetch("/api/adventures/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroAdventureId: active.id, choiceIndex, expectedCurrentStep: active.currentStep }),
      })
      if (!res.ok) { const e = await res.json(); setError(e.error); return }
      const result = await res.json()

      setHistory((prev: any) => [...prev, result.stepResult])

      setActive((prev: any) => ({
        ...prev,
        currentStep: result.nextStepIndex,
        currentStepData: result.nextStep ?? null,
        result: { steps: [...(prev.result?.steps ?? []), result.stepResult], rewards: null },
        heroResources: result.heroResources ?? prev.heroResources,
      }))
      setStepType(result.nextStep?.type ?? null)
    } catch { setError("Error al elegir") } finally {
      setChoosing(false)
    }
  }

  async function claimRewards() {
    if (!active) return
    setClaiming(true)
    setError(null)
    try {
      const res = await fetch("/api/adventures/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroAdventureId: active.id }),
      })
      if (!res.ok) { const e = await res.json(); setError(e.error); return }
      const result: AdventureClaimResult = await res.json()
      setClaimResult(result)
      const levelUp = result.levelUp
      if (levelUp?.leveledUp) {
        setActive({
          ...active,
          heroResources: {
            hpCurrent: levelUp.newHpMax,
            hpMax: levelUp.newHpMax,
            mpCurrent: levelUp.newMpMax,
            mpMax: levelUp.newMpMax,
          },
        })
      }
    } catch { setError("Error al reclamar") } finally {
      setClaiming(false)
    }
  }

  async function abandon() {
    if (!active || abandoning) return
    setAbandoning(true)
    setError(null)
    try {
      const res = await fetch("/api/adventures/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroAdventureId: active.id }),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error ?? "No se pudo abandonar la aventura")
        setConfirmAbandon(false)
        return
      }
      router.push("/adventures")
    } catch (e) {
      logger.error('adventures', 'Failed to abandon adventure', e)
      setError("No se pudo abandonar la aventura. Inténtalo de nuevo.")
      setConfirmAbandon(false)
    } finally {
      setAbandoning(false)
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Cargando aventura...</div>

  if (!active) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
        <div className="max-w-3xl mx-auto bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
          <p className="text-red-300 mb-4">{error ?? "No se pudo cargar la aventura."}</p>
          <button
            onClick={() => router.push("/adventures")}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded-lg font-semibold"
          >
            Volver a aventuras
          </button>
        </div>
      </div>
    )
  }

  const isAbandoned = active?.status === "failed" && active?.result?.outcome === "abandoned"
  const isDefeated = active?.status === "failed" && active?.result?.outcome === "defeated"
  const isOver = active?.status === "completed" || active?.status === "failed"
  const currentStep = active?.currentStepData
  const isChoice = stepType === 'choice'
  const rewardSteps = ((active?.result?.steps ?? []) as StepResult[])
    .filter((entry): entry is (Extract<StepResult, { type: 'reward' }> | Extract<StepResult, { type: 'choice' }>) & { rewards: StepRewards } =>
      (entry.type === 'reward' || entry.type === 'choice') && hasAdventureRewardPayload(entry.rewards))
  const hasRecoverableRewards = isDefeated && rewardSteps.length > 0
  const globalRewards: StepRewards = active?.result?.rewards ?? {}
  // Use the same normalization as the claim transaction so the preview never
  // promises malformed rewards that the server will discard.
  const claimableRewards = combineAdventureRewards(
    isDefeated ? undefined : globalRewards,
    active?.result?.steps ?? [],
  )
  const totalItems = (claimableRewards.items ?? []).reduce((totals, item) => {
    const existing = totals.find((entry) => entry.itemId === item.itemId)
    if (existing) existing.qty += item.qty
    else totals.push({ itemId: item.itemId, qty: item.qty })
    return totals
  }, [] as Array<{ itemId: number; qty: number }>)
  const totalMaterials = (claimableRewards.materials ?? []).reduce((totals, material) => {
    const existing = totals.find((entry) => entry.materialId === material.materialId)
    if (existing) existing.qty += material.qty
    else totals.push({ materialId: material.materialId, qty: material.qty })
    return totals
  }, [] as Array<{ materialId: number; qty: number }>)
  const totalRewards = {
    gold: claimableRewards.gold ?? 0,
    ep: claimableRewards.ep ?? 0,
    fame: claimableRewards.fame ?? 0,
    items: totalItems.reduce((total, item) => total + item.qty, 0),
    materials: totalMaterials.reduce((total, material) => total + material.qty, 0),
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push("/adventures")} className="text-gray-400 hover:text-gray-200 mb-4 block">
          ← Volver a aventuras
        </button>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{active?.adventureIcon}</span>
            <div>
              <h1 className="text-2xl font-bold text-amber-300">{active?.adventureName}</h1>
              {active?.adventureLore && (
                <details className="mt-2 max-w-2xl rounded-lg border border-gray-700/70 bg-gray-900/50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                    📖 Consultar el trasfondo de la aventura
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                    {active.adventureLore}
                  </p>
                </details>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${active?.status === "completed" ? 100 : Math.min(100, history.length / Math.max(1, (active?.totalSteps ?? 1)) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">
              Escenas recorridas {active?.status === "completed" ? active?.totalSteps : Math.min(history.length, active?.totalSteps ?? 0)}/{active?.totalSteps}
            </span>
          </div>

          {active?.heroResources && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-gray-900/70 border border-red-900/60 rounded-lg p-3">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-red-300 font-semibold">❤️ Salud</span>
                  <span className="text-gray-300 tabular-nums">
                    {active.heroResources.hpCurrent}/{active.heroResources.hpMax}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Salud actual"
                  aria-valuemin={0}
                  aria-valuemax={active.heroResources.hpMax}
                  aria-valuenow={active.heroResources.hpCurrent}
                  className="h-2 bg-gray-700 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${active.heroResources.hpMax > 0 ? Math.min(100, Math.max(0, active.heroResources.hpCurrent / active.heroResources.hpMax * 100)) : 0}%` }}
                  />
                </div>
              </div>
              <div className="bg-gray-900/70 border border-blue-900/60 rounded-lg p-3">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-blue-300 font-semibold">🔷 Maná</span>
                  <span className="text-gray-300 tabular-nums">
                    {active.heroResources.mpCurrent}/{active.heroResources.mpMax}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Maná actual"
                  aria-valuemin={0}
                  aria-valuemax={active.heroResources.mpMax}
                  aria-valuenow={active.heroResources.mpCurrent}
                  className="h-2 bg-gray-700 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${active.heroResources.mpMax > 0 ? Math.min(100, Math.max(0, active.heroResources.mpCurrent / active.heroResources.mpMax * 100)) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
            {history.map((entry: any, i: number) => (
              <div key={i} className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4">
                {entry.type === 'narrative' && (
                  <div>
                    {entry.stepName && <p className="text-xs font-semibold text-cyan-300 mb-1">{entry.stepName}</p>}
                    <p className="text-gray-300 text-sm leading-relaxed">{entry.description}</p>
                  </div>
                )}
                {entry.type === 'combat' && (
                  <div>
                    <p className="text-sm font-semibold text-amber-400 mb-1">⚔️ {entry.stepName ?? "Combate"}</p>
                    {entry.log?.map((l: string, j: number) => (
                      <p key={j} className="text-sm text-gray-300">{l}</p>
                    ))}
                    {entry.replay?.levelReports?.length > 0 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setExpandedCombat(expandedCombat === i ? null : i)}
                          className="rounded-md border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-900/40"
                        >
                          {expandedCombat === i ? "Ocultar combate detallado" : "▶ Ver combate ronda a ronda"}
                        </button>
                        {expandedCombat === i && (
                          <div className="mt-3 overflow-hidden rounded-lg border border-gray-700">
                            <CombatPlayback result={entry.replay} dungeonName={entry.stepName ?? "Encuentro"} onFinish={() => setExpandedCombat(null)} showRewards={false} />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                      <span>Enemigos: {entry.enemiesDefeated}/{entry.totalEnemies}</span>
                      <span>Salud perdida: -{entry.heroHpLost} HP</span>
                      <span>Maná gastado: -{entry.heroMpLost} MP</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                      <span className="text-red-300">❤️ Salud restante: {entry.heroHpRemaining} HP</span>
                      <span className="text-blue-300">🔷 Maná restante: {entry.heroMpRemaining} MP</span>
                    </div>
                    {entry.victory ? (
                      <p className="text-emerald-400 text-sm font-bold mt-2">✓ ¡Encuentro superado! Has derrotado a todos los enemigos.</p>
                    ) : (
                      <p className="text-red-400 text-sm font-bold mt-2">💀 Has sido derrotado</p>
                    )}
                  </div>
                )}
                {entry.type === 'choice' && (
                  <div>
                    {entry.stepName && <p className="text-xs font-semibold text-cyan-300 mb-1">{entry.stepName}</p>}
                    <p className={`text-sm font-semibold mb-1 ${entry.skillCheck ? (entry.skillCheck.passed ? "text-emerald-400" : "text-red-400") : "text-emerald-400"}`}>
                      {entry.skillCheck ? (entry.skillCheck.passed ? "✓ Prueba superada" : "✕ Prueba fallida") : "🤔 Decisión tomada"}
                    </p>
                    {entry.chosen && <p className="text-sm text-gray-200">{entry.chosen}</p>}
                    {entry.costs && (
                      <p className="mt-1 text-xs text-orange-300">
                        Coste pagado: {entry.costs.hp > 0 ? `-${entry.costs.hp} HP` : ""}
                        {entry.costs.hp > 0 && entry.costs.mp > 0 ? " · " : ""}
                        {entry.costs.mp > 0 ? `-${entry.costs.mp} MP` : ""}
                      </p>
                    )}
                    {entry.flavor && <p className="text-sm text-gray-400 italic">{entry.flavor}</p>}
                    {entry.nextStepName && (
                      <div className="mt-2 rounded-md border border-cyan-900/60 bg-cyan-950/20 px-3 py-2">
                        <p className="text-xs font-semibold text-cyan-300">➡️ El camino continúa: {entry.nextStepName}</p>
                        {entry.nextStepDescription && <p className="mt-1 text-xs text-gray-400">{entry.nextStepDescription}</p>}
                      </div>
                    )}
                    {entry.skillCheck && (
                      <p className={`text-xs mt-1 ${entry.skillCheck.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.skillCheck.attr === 'pe' ? 'Percepción' : entry.skillCheck.attr === 'ch' ? 'Carisma' : entry.skillCheck.attr.toUpperCase()}: {entry.skillCheck.value} / {entry.skillCheck.dc} · {entry.skillCheck.passed ? 'Superada' : 'Fallida'}
                      </p>
                    )}
                    {entry.rewards && (
                      <div className="mt-2 rounded-md border border-yellow-900/50 bg-yellow-950/20 px-3 py-2">
                        <p className="text-xs font-semibold text-yellow-300 mb-1">Recompensa de tu decisión</p>
                        {entry.rewards.gold ? <p className="text-sm text-gray-300">💰 +{entry.rewards.gold} oro</p> : null}
                        {entry.rewards.ep ? <p className="text-sm text-gray-300">⭐ +{entry.rewards.ep} EP</p> : null}
                        {entry.rewards.fame ? <p className="text-sm text-gray-300">🏆 +{entry.rewards.fame} fama</p> : null}
                        {entry.rewards.items?.map((it: { itemId: number; qty: number }, j: number) => (
                          <p key={j} className="text-sm text-gray-300">{active?.rewardCatalog?.items?.[it.itemId]?.icon ?? "📦"} {active?.rewardCatalog?.items?.[it.itemId]?.name ?? `Objeto #${it.itemId}`} x{it.qty}</p>
                        ))}
                        {entry.rewards.materials?.map((mat: { materialId: number; qty: number }, j: number) => (
                          <p key={j} className="text-sm text-gray-300">{active?.rewardCatalog?.materials?.[mat.materialId]?.icon ?? "🧱"} {active?.rewardCatalog?.materials?.[mat.materialId]?.name ?? `Material #${mat.materialId}`} x{mat.qty}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {entry.type === 'reward' && (
                  <div>
                    <p className="text-sm font-semibold text-yellow-400 mb-1">🎁 {entry.stepName ?? "Recompensa"}</p>
                    {entry.rewards?.gold && <p className="text-sm text-gray-300">💰 +{entry.rewards.gold} oro</p>}
                    {entry.rewards?.ep && <p className="text-sm text-gray-300">⭐ +{entry.rewards.ep} EP</p>}
                    {entry.rewards?.fame ? <p className="text-sm text-gray-300">🏆 +{entry.rewards.fame} fama</p> : null}
                    {entry.rewards?.items?.map((it: any, j: number) => (
                      <p key={j} className="text-sm text-gray-300">{active?.rewardCatalog?.items?.[it.itemId]?.icon ?? "📦"} {active?.rewardCatalog?.items?.[it.itemId]?.name ?? `Objeto #${it.itemId}`} x{it.qty}</p>
                    ))}
                    {entry.rewards?.materials?.map((mat: { materialId: number; qty: number }, j: number) => (
                      <p key={j} className="text-sm text-gray-300">{active?.rewardCatalog?.materials?.[mat.materialId]?.icon ?? "🧱"} {active?.rewardCatalog?.materials?.[mat.materialId]?.name ?? `Material #${mat.materialId}`} x{mat.qty}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Current step */}
          {currentStep && !isOver && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mb-4">
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-1">{currentStep.name}</h3>
              <p className="text-gray-300 leading-relaxed text-sm">{currentStep.description}</p>

              {currentStep.type === 'combat' && currentStep.enemies?.length > 0 && (
                <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-red-300">⚔️ Enemigos del encuentro</p>
                    <span className="text-xs text-gray-400">{currentStep.enemies.length} {currentStep.enemies.length === 1 ? 'enemigo' : 'enemigos'}</span>
                  </div>
                  <div className="space-y-2">
                    {currentStep.enemies.map((enemy: AdventureStepEnemy, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-md bg-gray-900/70 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xl" aria-hidden="true">{enemy.icon || '👹'}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-200">{enemy.name}</p>
                            <p className="text-xs text-gray-500">Nivel {enemy.level}</p>
                            {enemy.position && <p className="text-xs text-gray-500">Posición: {enemy.position}</p>}
                          </div>
                        </div>
                        <div className="shrink-0 space-y-1 text-right text-xs tabular-nums">
                          <p className="text-red-300">❤️ {enemy.hp} HP</p>
                          <p className="text-blue-300">🔷 {enemy.mp} MP</p>
                          <p className="text-gray-300">⚔️ ATQ {enemy.atk} · 🛡️ DEF {enemy.def}</p>
                          <p className="text-gray-400">🎯 DES {enemy.dx} · ⚡ AGI {enemy.ag}</p>
                          {enemy.damageType && <p className="text-amber-300">Daño: {enemy.damageType}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-400">El combate puede consumir salud y maná. Los valores actuales de tu héroe se conservarán al terminar.</p>
                </div>
              )}

              {isChoice && currentStep.choices && (
                <div className="mt-4 space-y-2">
                  {currentStep.choices.map((c: AdventureChoice, i: number) => {
                    const costs = getAdventureChoiceCosts(c)
                    const canAfford = canAffordAdventureChoice(
                      costs,
                      active?.heroResources ?? { hpCurrent: 0, mpCurrent: 0 },
                    )
                    return (
                    <button
                      key={i}
                      onClick={() => makeChoice(i)}
                      disabled={choosing || !canAfford}
                      className="w-full text-left p-3 bg-gray-800 hover:bg-amber-900/40 border border-gray-600 hover:border-amber-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <span className="text-amber-300 font-medium">{c.text}</span>
                      {(costs.hp > 0 || costs.mp > 0) && (
                        <p className="mt-1 text-xs text-orange-300">
                          Coste: {costs.hp > 0 ? `${costs.hp} HP` : ""}
                          {costs.hp > 0 && costs.mp > 0 ? " · " : ""}
                          {costs.mp > 0 ? `${costs.mp} MP` : ""}
                        </p>
                      )}
                      {!canAfford && (
                        <p className="mt-1 text-xs font-semibold text-red-300">
                          No tienes recursos suficientes para esta opción.
                        </p>
                      )}
                      {c.skillCheck && (() => {
                        const value = active?.heroAttributes?.[c.skillCheck.attr]
                        const canPass = typeof value === 'number' && value >= c.skillCheck.dc
                        const outcomeKnown = typeof value === 'number'
                        return (
                          <div className="mt-1 space-y-1">
                            <p className="text-xs text-cyan-300">
                              Prueba de {c.skillCheck.attr === 'pe' ? 'Percepción' : c.skillCheck.attr === 'ch' ? 'Carisma' : c.skillCheck.attr.toUpperCase()} · Tu valor {value ?? '—'} · Dificultad {c.skillCheck.dc}
                            </p>
                            <p className={`text-xs font-semibold ${!outcomeKnown ? 'text-gray-400' : canPass ? 'text-emerald-400' : 'text-red-400'}`}>
                              {!outcomeKnown ? 'Resultado no disponible antes de elegir' : canPass ? '✓ Superarás la prueba con tus atributos actuales' : '✕ No alcanzarás la dificultad con tus atributos actuales'}
                            </p>
                          </div>
                        )
                      })()}
                      {(c.nextStepName || c.passStepName || c.failStepName) && (
                        <div className="mt-2 space-y-1 border-t border-gray-700/70 pt-2 text-xs text-cyan-300">
                          {c.nextStepName && (
                            <div>
                              <p>➡️ Ruta: {c.nextStepName}</p>
                              {c.nextStepDescription && <p className="pl-5 text-gray-400">{c.nextStepDescription}</p>}
                            </div>
                          )}
                          {c.passStepName && (
                            <div>
                              <p>✓ Si superas la prueba: {c.passStepName}</p>
                              {c.passStepDescription && <p className="pl-5 text-gray-400">{c.passStepDescription}</p>}
                            </div>
                          )}
                          {c.failStepName && (
                            <div>
                              <p>✕ Si fallas la prueba: {c.failStepName}</p>
                              {c.failStepDescription && <p className="pl-5 text-gray-400">{c.failStepDescription}</p>}
                            </div>
                          )}
                        </div>
                      )}
                      {c.rewards && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-gray-700/70 pt-2 text-xs text-yellow-300">
                          <span className="font-semibold text-yellow-200">Recompensa:</span>
                          {c.rewards.gold ? <span>💰 +{c.rewards.gold} oro</span> : null}
                          {c.rewards.ep ? <span>⭐ +{c.rewards.ep} EP</span> : null}
                          {c.rewards.fame ? <span>🏆 +{c.rewards.fame} fama</span> : null}
                          {c.rewards.items?.map((item: { itemId: number; qty: number }, itemIndex: number) => (
                            <span key={itemIndex}>{active?.rewardCatalog?.items?.[item.itemId]?.icon ?? "📦"} {active?.rewardCatalog?.items?.[item.itemId]?.name ?? `Objeto #${item.itemId}`} ×{item.qty}</span>
                          ))}
                          {c.rewards.materials?.map((material: { materialId: number; qty: number }, materialIndex: number) => (
                            <span key={materialIndex}>{active?.rewardCatalog?.materials?.[material.materialId]?.icon ?? "🧱"} {active?.rewardCatalog?.materials?.[material.materialId]?.name ?? `Material #${material.materialId}`} ×{material.qty}</span>
                          ))}
                        </div>
                      )}
                      {c.flavor && <p className="text-xs text-gray-500 mt-1 italic">{c.flavor}</p>}
                    </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {claimResult && (
            <div className="mb-4 rounded-lg border border-emerald-700 bg-emerald-900/30 p-4" role="status" aria-live="polite">
              <h3 className="font-bold text-emerald-300">✓ {claimResult.partial ? "Botín recuperado añadido al inventario" : "Recompensas reclamadas correctamente"}</h3>
              <p className="mt-1 text-sm text-gray-300">
                {claimResult.partial
                  ? "El oro, la experiencia, la fama y los objetos obtenidos antes de la derrota ya se han acreditado."
                  : "El oro, la experiencia, la fama y los objetos de esta aventura ya se han acreditado a tu héroe."}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="text-amber-300">💰 +{claimResult.rewards?.gold ?? 0} oro</span>
                <span className="text-purple-300">⭐ +{claimResult.rewards?.ep ?? 0} EP</span>
                <span className="text-blue-300">🏆 +{claimResult.rewards?.fame ?? 0} fama</span>
              </div>
              {claimResult.levelUp?.leveledUp && (
                <div className="mt-3 rounded-md border border-amber-700/70 bg-amber-950/40 p-3">
                  <p className="font-bold text-amber-300">🎉 ¡Has subido al nivel {claimResult.levelUp.newLevel}!</p>
                  <p className="mt-1 text-sm text-gray-200">
                    {claimResult.levelUp.levelsGained > 1 ? `Has avanzado ${claimResult.levelUp.levelsGained} niveles` : "Has avanzado un nivel"} y recibido {claimResult.levelUp.pointsAwarded} puntos de atributo.
                  </p>
                  <p className="mt-1 text-xs text-gray-400">Tu salud y tu maná se han restaurado al máximo.</p>
                </div>
              )}
              {((claimResult.rewards?.items?.length ?? 0) > 0 || (claimResult.rewards?.materials?.length ?? 0) > 0) && (
                <div className="mt-3 border-t border-emerald-800/70 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Añadido al inventario</p>
                  <div className="space-y-1">
                    {claimResult.rewards?.items?.map((item) => (
                      <p key={item.itemId} className="text-sm text-gray-200">
                        {active?.rewardCatalog?.items?.[item.itemId]?.icon ?? "📦"} {active?.rewardCatalog?.items?.[item.itemId]?.name ?? `Objeto #${item.itemId}`} ×{item.qty}
                      </p>
                    ))}
                    {claimResult.rewards?.materials?.map((material) => (
                      <p key={material.materialId} className="text-sm text-gray-200">
                        {active?.rewardCatalog?.materials?.[material.materialId]?.icon ?? "🧱"} {active?.rewardCatalog?.materials?.[material.materialId]?.name ?? `Material #${material.materialId}`} ×{material.qty}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Victory / Defeat banner */}
          {isOver && (
            <div className={`p-4 rounded-lg mb-4 text-center ${
              active?.status === 'completed' ? 'bg-emerald-900/40 border border-emerald-700' : isAbandoned ? 'bg-amber-900/40 border border-amber-700' : 'bg-red-900/40 border border-red-700'
            }`}>
              <h2 className="text-xl font-bold text-amber-300 mb-2">
                {active?.status === 'completed' ? '🎉 ¡Aventura Completada!' : isAbandoned ? '↩️ Expedición abandonada' : '💀 Derrota'}
              </h2>
              {active?.status === 'failed' && !isAbandoned && (
                <p className="text-sm text-gray-300 mt-2">
                  Tu salud y tu maná restantes se conservan para tu héroe. La energía gastada al iniciar esta expedición no se recupera.
                </p>
              )}
              {(active?.status === 'completed' || hasRecoverableRewards) && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">
                    {hasRecoverableRewards
                      ? "Botín obtenido antes de la derrota. Puedes reclamarlo; no incluye la recompensa final de la aventura."
                      : "Recompensa total al reclamar, incluidas las obtenidas durante la aventura"}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <span>💰 Oro: <span className="text-amber-400">{totalRewards.gold}</span></span>
                    <span>⭐ EP: <span className="text-purple-400">{totalRewards.ep}</span></span>
                    <span>🏆 Fama: <span className="text-blue-400">{totalRewards.fame}</span></span>
                    {totalRewards.items > 0 && (
                      <span>📦 Objetos: <span className="text-green-400">{totalRewards.items}</span></span>
                    )}
                    {totalRewards.materials > 0 && (
                      <span>🧱 Materiales: <span className="text-green-400">{totalRewards.materials}</span></span>
                    )}
                  </div>
                  {(totalItems.length > 0 || totalMaterials.length > 0) && (
                    <div className="mt-3 border-t border-gray-700 pt-3 text-left space-y-2">
                      {totalItems.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-1">Objetos obtenidos</p>
                          {totalItems.map((item) => (
                            <p key={item.itemId} className="text-sm text-gray-300">
                              {active?.rewardCatalog?.items?.[item.itemId]?.icon ?? "📦"} {active?.rewardCatalog?.items?.[item.itemId]?.name ?? `Objeto #${item.itemId}`} ×{item.qty}
                            </p>
                          ))}
                        </div>
                      )}
                      {totalMaterials.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-1">Materiales obtenidos</p>
                          {totalMaterials.map((material) => (
                            <p key={material.materialId} className="text-sm text-gray-300">
                              {active?.rewardCatalog?.materials?.[material.materialId]?.icon ?? "🧱"} {active?.rewardCatalog?.materials?.[material.materialId]?.name ?? `Material #${material.materialId}`} ×{material.qty}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {confirmAbandon && !isOver && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="abandon-adventure-title">
              <div className="w-full max-w-md rounded-xl border border-red-900 bg-gray-900 p-6 shadow-2xl">
                <h2 id="abandon-adventure-title" className="text-lg font-bold text-red-300">¿Abandonar la aventura?</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">
                  Perderás el progreso de esta expedición y no podrás reclamar el botín obtenido hasta ahora. La energía gastada no se recuperará.
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => setConfirmAbandon(false)}
                    disabled={abandoning}
                    className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-600 disabled:opacity-50"
                  >
                    Seguir jugando
                  </button>
                  <button
                    onClick={abandon}
                    disabled={abandoning}
                    className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {abandoning ? "Abandonando..." : "Sí, abandonar"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {!isOver && !isChoice && (
              <button
                onClick={advanceStep}
                disabled={executing}
                className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-semibold"
              >
                {executing ? "Resolviendo..." : currentStep?.type === 'combat' ? "⚔️ Combatir" : "Continuar →"}
              </button>
            )}
            {(active?.status === "completed" || hasRecoverableRewards) && !claimResult && (
              <button
                onClick={claimRewards}
                disabled={claiming}
                className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 rounded-lg font-semibold"
              >
                {claiming ? "Reclamando..." : hasRecoverableRewards ? "🎒 Reclamar botín recuperado" : "🎁 Reclamar recompensas"}
              </button>
            )}
            {claimResult && (
              <button
                onClick={() => router.push("/adventures")}
                className="flex-1 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg font-semibold"
              >
                Volver a aventuras
              </button>
            )}
            {active?.status === "failed" && !hasRecoverableRewards && (
              <button
                onClick={() => router.push("/adventures")}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
              >
                Volver a aventuras
              </button>
            )}
            {!isOver && (
              <button
                onClick={() => setConfirmAbandon(true)}
                className="py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              >
                Abandonar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
