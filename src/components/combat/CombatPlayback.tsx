"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { LevelReport, RunResult } from "@/lib/combat-engine/dungeon-runner"
import { RoundView } from "./RoundView"

interface CombatPlaybackProps {
  result: Pick<RunResult, 'victory' | 'totalRounds' | 'epGained' | 'goldGained' | 'levelReports'>
  dungeonName: string
  onFinish: () => void
  showRewards?: boolean
}

type PlaybackStep =
  | {
      kind: "preliminary"
      levelIndex: number
      level: LevelReport
      entries: NonNullable<LevelReport["preliminaryLog"]>
    }
  | {
      kind: "round"
      levelIndex: number
      level: LevelReport
      round: LevelReport["rounds"][number]
    }

export function CombatPlayback({ result, dungeonName, onFinish, showRewards = true }: Readonly<CombatPlaybackProps>) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const levels = result.levelReports ?? []
  const steps: PlaybackStep[] = levels.flatMap((level, levelIndex): PlaybackStep[] => {
    const preliminaryStep: PlaybackStep[] = level.preliminaryLog?.length
      ? [{ kind: "preliminary", levelIndex, level, entries: level.preliminaryLog }]
      : []
    const roundSteps: PlaybackStep[] = level.rounds.map(round => ({
      kind: "round",
      levelIndex,
      level,
      round,
    }))
    return [...preliminaryStep, ...roundSteps]
  })

  const totalSteps = steps.length
  const totalRounds = result.totalRounds
  const current = steps[currentIndex]
  const isLast = currentIndex >= totalSteps - 1
  const percent = totalSteps > 0 ? ((currentIndex + 1) / totalSteps) * 100 : 0
  const isFirstStepInLevel = currentIndex === 0 || steps[currentIndex - 1]?.levelIndex !== current?.levelIndex

  const advance = useCallback(() => {
    if (isLast) {
      setPlaying(false)
      return
    }
    setCurrentIndex(i => i + 1)
  }, [isLast])

  const goTo = useCallback((idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(idx, totalSteps - 1)))
  }, [totalSteps])

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    const delay = Math.max(400, 2000 / speed)
    timerRef.current = setTimeout(advance, delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [playing, currentIndex, speed, advance])

  if (totalSteps === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 min-h-[60vh] flex items-center justify-center">
        <div className="w-full rounded-xl border border-gray-800 bg-gray-900 p-8 text-center space-y-4">
          <div className="text-5xl">{result.victory ? "🏆" : "💀"}</div>
          <h1 className={`text-2xl font-bold ${result.victory ? "text-emerald-400" : "text-red-400"}`}>
            {result.victory ? "¡Victoria!" : "Derrota"}
          </h1>
          <p className="text-sm text-gray-400">
            No hay fases ni rondas detalladas disponibles para reproducir. El resultado de la expedición se ha guardado.
          </p>
          {showRewards && (
            <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
              <span>⭐ +{result.epGained} EP</span>
              <span>💰 +{result.goldGained} oro</span>
            </div>
          )}
          <button
            onClick={onFinish}
            className="px-5 py-2 rounded bg-amber-700 hover:bg-amber-600 text-sm text-white font-bold transition"
          >
            📜 Ver reporte completo →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold text-gray-200">⚔️ {dungeonName}</h1>
          <p className="text-sm text-gray-500">
            {current.kind === "preliminary"
              ? `Nivel ${current.level.levelNumber} · Preparación previa`
              : `Nivel ${current.level.levelNumber} · Ronda ${current.round.roundNumber}`}
            {" "}({currentIndex + 1}/{totalSteps})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-28 sm:w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {current.levelIndex > 0 && isFirstStepInLevel && (
          <div className="text-center py-4">
            <span className="px-4 py-2 bg-amber-900/30 text-amber-400 rounded-lg text-sm font-bold">
              🗺️ Nivel {current.level.levelNumber}
            </span>
          </div>
        )}

        {current.kind === "preliminary" ? (
          <section aria-label="Acciones de preparación previa" className="space-y-3 rounded-lg border border-blue-900/30 bg-blue-950/10 p-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-300">Preparación previa</h2>
              <p className="mt-1 text-xs text-gray-500">Acciones ejecutadas antes de comenzar las rondas de combate</p>
            </div>
            <ol className="space-y-2">
              {current.entries.map((entry, index) => {
                const label = entry.type === "buff" ? "Mejora" : entry.type === "heal" ? "Recuperación" : entry.type === "tactic_eval" ? "Táctica" : "Acción"
                const color = entry.type === "buff" ? "text-blue-300" : entry.type === "heal" ? "text-emerald-300" : "text-gray-300"
                return (
                  <li key={`${entry.timestamp}-${index}`} className="flex flex-wrap items-start gap-x-2 gap-y-0.5 text-sm">
                    <span className={`shrink-0 font-semibold ${color}`}>{label}</span>
                    <span className="text-gray-300">{entry.message}</span>
                  </li>
                )
              })}
            </ol>
          </section>
        ) : (
          <RoundView round={current.round} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-4 border-t border-gray-800">
        <button
          onClick={() => { goTo(0); setPlaying(true) }}
          className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition disabled:opacity-30"
          disabled={currentIndex === 0}
        >
          ⏮ Inicio
        </button>
        <button
          onClick={() => goTo(currentIndex - 1)}
          className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition disabled:opacity-30"
          disabled={currentIndex === 0}
        >
          ◀ Anterior
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          className={`px-5 py-2 rounded text-sm font-bold transition ${
            playing ? "bg-yellow-700 hover:bg-yellow-600" : "bg-green-700 hover:bg-green-600"
          } text-white`}
        >
          {playing ? "⏸ Pausa" : "▶ Reanudar"}
        </button>
        <button
          onClick={() => goTo(currentIndex + 1)}
          className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition disabled:opacity-30"
          disabled={isLast}
        >
          Siguiente ▶
        </button>
        <button
          onClick={() => goTo(totalSteps - 1)}
          className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition disabled:opacity-30"
          disabled={isLast}
        >
          Fin ⏭
        </button>

        <div className="basis-full sm:basis-auto ml-0 sm:ml-4 flex items-center justify-center gap-1">
          <span className="text-[10px] text-gray-600 font-mono">Vel:</span>
          {[0.5, 1, 2, 4].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded text-[10px] font-mono transition ${
                speed === s ? "bg-amber-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {isLast && !playing && (
        <div className="text-center py-8 space-y-4">
          <div className="text-5xl">{result.victory ? "🏆" : "💀"}</div>
          <h2 className={`text-2xl font-bold ${result.victory ? "text-emerald-400" : "text-red-400"}`}>
            {result.victory ? "¡Victoria!" : "Derrota"}
          </h2>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
            <span>⚔️ {totalRounds} rondas</span>
            {showRewards && (
              <>
                <span>⭐ +{result.epGained} EP</span>
                <span>💰 +{result.goldGained} oro</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => { goTo(0); setPlaying(true) }}
              className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition"
            >
              🔄 Repetir
            </button>
            <button
              onClick={onFinish}
              className="px-4 py-2 rounded bg-amber-700 hover:bg-amber-600 text-sm text-white font-bold transition"
            >
              📜 Ver reporte completo →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
