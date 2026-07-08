"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { LevelReport, RunResult } from "@/lib/combat-engine/dungeon-runner"
import { RoundView } from "./RoundView"

interface CombatPlaybackProps {
  result: RunResult
  dungeonName: string
  onFinish: () => void
}

interface FlattenedRound {
  levelIndex: number
  round: LevelReport["rounds"][number]
  level: LevelReport
}

export function CombatPlayback({ result, dungeonName, onFinish }: Readonly<CombatPlaybackProps>) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const levels = result.levelReports ?? []

  const rounds: FlattenedRound[] = levels.flatMap((l, li) =>
    l.rounds.map(r => ({ levelIndex: li, round: r, level: l }))
  )

  const totalRounds = rounds.length
  const current = rounds[currentIndex]
  const isLast = currentIndex >= totalRounds - 1
  const percent = totalRounds > 0 ? ((currentIndex + 1) / totalRounds) * 100 : 0

  const advance = useCallback(() => {
    if (isLast) {
      setPlaying(false)
      return
    }
    setCurrentIndex(i => i + 1)
  }, [isLast])

  const goTo = useCallback((idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(idx, totalRounds - 1)))
  }, [totalRounds])

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    const delay = Math.max(400, 2000 / speed)
    timerRef.current = setTimeout(advance, delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [playing, currentIndex, speed, advance])

  if (totalRounds === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        No hay rondas para mostrar.
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-200">⚔️ {dungeonName}</h1>
          <p className="text-sm text-gray-500">
            Nivel {current.level.levelNumber} · Ronda {current.round.roundNumber} ({currentIndex + 1}/{totalRounds})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Current round */}
      <div className="space-y-4">
        {current.levelIndex > 0 && current.round.roundNumber === 1 && (
          <div className="text-center py-4">
            <span className="px-4 py-2 bg-amber-900/30 text-amber-400 rounded-lg text-sm font-bold">
              🗺️ Nivel {current.level.levelNumber}
            </span>
          </div>
        )}
        <RoundView round={current.round} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-800">
        <button
          onClick={() => goTo(0)}
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
          onClick={() => goTo(totalRounds - 1)}
          className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition disabled:opacity-30"
          disabled={isLast}
        >
          Fin ⏭
        </button>

        <div className="ml-4 flex items-center gap-1">
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

      {/* Finished overlay */}
      {isLast && !playing && (
        <div className="text-center py-8 space-y-4">
          <div className="text-5xl">{result.victory ? "🏆" : "💀"}</div>
          <h2 className={`text-2xl font-bold ${result.victory ? "text-emerald-400" : "text-red-400"}`}>
            {result.victory ? "¡Victoria!" : "Derrota"}
          </h2>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
            <span>⚔️ {result.totalRounds} rondas</span>
            <span>⭐ +{result.epGained} EP</span>
            <span>💰 +{result.goldGained} oro</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => goTo(0)}
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
