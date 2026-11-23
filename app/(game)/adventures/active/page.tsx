"use client"

import logger from "@/lib/logger"
import type { StepResult, StepRewards } from "@/lib/adventures/types"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function ActiveAdventurePage() {

  const router = useRouter()
  const [active, setActive] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<any[]>([])
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
          result: { steps: [...(prev.result?.steps ?? []), result.stepResult], rewards: result.rewards },
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
      router.push("/adventures")
    } catch { setError("Error al reclamar") } finally {
      setClaiming(false)
    }
  }

  async function abandon() {
    if (!active) return
    try {
      const res = await fetch("/api/adventures/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroAdventureId: active.id }),
      })
      if (!res.ok) {
        const result = await res.json()
        setError(result.error ?? "No se pudo abandonar la aventura")
        return
      }
      router.push("/adventures")
    } catch (e) {
      logger.error('adventures', 'Failed to abandon adventure', e)
      setError("No se pudo abandonar la aventura. Inténtalo de nuevo.")
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
  const isOver = active?.status === "completed" || active?.status === "failed"
  const currentStep = active?.currentStepData
  const isChoice = stepType === 'choice'
  const rewardSteps = ((active?.result?.steps ?? []) as StepResult[])
    .filter((entry): entry is Extract<StepResult, { type: 'reward' }> => entry.type === 'reward')
  const globalRewards: StepRewards = active?.result?.rewards ?? {}
  const sumReward = (key: 'gold' | 'ep' | 'fame') => Number(globalRewards[key] ?? 0) +
    rewardSteps.reduce((total, entry) => total + Number(entry.rewards[key] ?? 0), 0)
  const totalRewards = {
    gold: sumReward('gold'),
    ep: sumReward('ep'),
    fame: sumReward('fame'),
    items: [...(globalRewards.items ?? []), ...rewardSteps.flatMap((entry) => entry.rewards?.items ?? [])]
      .reduce((total, item) => total + Number(item.qty ?? 0), 0),
    materials: [...(globalRewards.materials ?? []), ...rewardSteps.flatMap((entry) => entry.rewards?.materials ?? [])]
      .reduce((total, material) => total + Number(material.qty ?? 0), 0),
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
                <p className="text-xs text-gray-500 italic mt-1">{active.adventureLore.slice(0, 120)}...</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${isOver ? 100 : Math.min(100, ((active?.currentStep ?? 0) + 1) / Math.max(1, (active?.totalSteps ?? 1)) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">
              Paso {isOver ? active?.totalSteps : Math.min((active?.currentStep ?? 0) + 1, active?.totalSteps ?? 1)}/{active?.totalSteps}
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
                  <p className="text-gray-300 text-sm leading-relaxed">{entry.description}</p>
                )}
                {entry.type === 'combat' && (
                  <div>
                    <p className="text-sm font-semibold text-amber-400 mb-1">⚔️ Combate</p>
                    {entry.log?.map((l: string, j: number) => (
                      <p key={j} className="text-sm text-gray-300">{l}</p>
                    ))}
                    <div className="flex gap-4 text-xs text-gray-500 mt-2">
                      <span>Enemigos: {entry.enemiesDefeated}/{entry.totalEnemies}</span>
                      <span>Daño: -{entry.heroHpLost} HP</span>
                    </div>
                    {!entry.victory && (
                      <p className="text-red-400 text-sm font-bold mt-2">💀 Has sido derrotado</p>
                    )}
                  </div>
                )}
                {entry.type === 'choice' && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-400 mb-1">🤔 Decisión tomada</p>
                    {entry.chosen && <p className="text-sm text-gray-200">{entry.chosen}</p>}
                    {entry.flavor && <p className="text-sm text-gray-400 italic">{entry.flavor}</p>}
                    {entry.skillCheck && (
                      <p className={`text-xs mt-1 ${entry.skillCheck.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.skillCheck.attr === 'pe' ? 'Percepción' : entry.skillCheck.attr === 'ch' ? 'Carisma' : entry.skillCheck.attr.toUpperCase()}: {entry.skillCheck.value} / {entry.skillCheck.dc} · {entry.skillCheck.passed ? 'Superada' : 'Fallida'}
                      </p>
                    )}
                  </div>
                )}
                {entry.type === 'reward' && (
                  <div>
                    <p className="text-sm font-semibold text-yellow-400 mb-1">🎁 Recompensa</p>
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

              {isChoice && currentStep.choices && (
                <div className="mt-4 space-y-2">
                  {currentStep.choices.map((c: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => makeChoice(i)}
                      disabled={choosing}
                      className="w-full text-left p-3 bg-gray-800 hover:bg-amber-900/40 border border-gray-600 hover:border-amber-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <span className="text-amber-300 font-medium">{c.text}</span>
                      {c.skillCheck && (
                        <p className="text-xs text-cyan-300 mt-1">
                          Prueba de {c.skillCheck.attr === 'pe' ? 'Percepción' : c.skillCheck.attr === 'ch' ? 'Carisma' : c.skillCheck.attr.toUpperCase()} · Tu valor {active?.heroAttributes?.[c.skillCheck.attr] ?? '—'} · Dificultad {c.skillCheck.dc}
                        </p>
                      )}
                      {c.flavor && <p className="text-xs text-gray-500 mt-1 italic">{c.flavor}</p>}
                    </button>
                  ))}
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
              {active?.status === 'completed' && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">Recompensa total al reclamar, incluidas las obtenidas durante la aventura</p>
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
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {!isOver && !isChoice && (
              <button
                onClick={advanceStep}
                disabled={executing}
                className="flex-1 py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-semibold"
              >
                {executing ? "Cargando..." : "Continuar →"}
              </button>
            )}
            {active?.status === "completed" && (
              <button
                onClick={claimRewards}
                disabled={claiming}
                className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 rounded-lg font-semibold"
              >
                {claiming ? "Reclamando..." : "🎁 Reclamar recompensas"}
              </button>
            )}
            {active?.status === "failed" && (
              <button
                onClick={() => router.push("/adventures")}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
              >
                Volver a aventuras
              </button>
            )}
            {!isOver && (
              <button
                onClick={abandon}
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
