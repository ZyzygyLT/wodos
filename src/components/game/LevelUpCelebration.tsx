import { useEffect, useState } from "react"

interface LevelUpData {
  leveledUp: boolean
  levelsGained: number
  newLevel: number
  newHpMax: number
  newMpMax: number
  pointsAwarded: number
}

interface Props {
  data: LevelUpData
  onClose: () => void
}

export function LevelUpCelebration({ data, onClose }: Readonly<Props>) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <button type="button" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <button type="button"
        className="bg-gray-900 border border-amber-600/60 rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4 animate-bounce-in"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
      >
        <p className="text-5xl">🎉</p>
        <h3 className="text-2xl font-bold text-amber-400">
          ¡Subiste de nivel!
        </h3>
        <p className="text-gray-300">
          {data.levelsGained > 1
            ? `Subiste ${data.levelsGained} niveles de golpe`
            : `Ahora eres nivel ${data.newLevel}`}
        </p>
        {data.pointsAwarded > 0 && (
          <p className="text-amber-400 font-bold text-lg">
            +{data.pointsAwarded} 🎯 puntos de atributo
          </p>
        )}
        <button
          onClick={onClose}
          className="mt-2 px-6 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-bold transition"
        >
          ¡Bien!
        </button>
      </button>
    </button>
  )
}
