"use client"

interface Props {
  dungeonName: string
  result: string | null
  levelsCleared: number | null
  totalRounds: number | null
  epGained: number | null
  goldGained: number | null
  fameGained: number | null
  groupRun?: boolean
  totalHeroes?: number
  participants?: { heroId: string; name: string }[]
}

export function ExpeditionHeader({
  dungeonName, result, levelsCleared, totalRounds,
  epGained, goldGained, fameGained,
  groupRun, totalHeroes, participants,
}: Readonly<Props>) {
  const isVictory = result === 'victory'
  const resultIcon = isVictory ? '🏆' : '💀'
  const resultLabel = isVictory ? 'Victoria' : 'Derrota'
  const resultCls = isVictory ? 'text-emerald-400 border-emerald-800/50' : 'text-red-400 border-red-800/50'
  const glowCls = isVictory ? 'shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'shadow-[0_0_30px_rgba(239,68,68,0.15)]'

  return (
    <div className={`relative overflow-hidden rounded-xl border ${resultCls} ${glowCls}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-amber-900/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />

      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{resultIcon}</span>
            <div>
              <h1 className="text-2xl font-bold text-amber-100 tracking-wide">{dungeonName}</h1>
              <p className={`text-lg font-semibold ${isVictory ? 'text-emerald-400' : 'text-red-400'}`}>
                {resultLabel}
              </p>
            </div>
          </div>
          {groupRun && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/20 border border-amber-800/30">
              <span className="text-amber-400 text-sm">👥</span>
              <span className="text-amber-300 text-xs font-medium">{totalHeroes ?? 0} héroes</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox icon="🗺️" label="Niveles" value={levelsCleared ?? 0} />
          <StatBox icon="⚔️" label="Rondas" value={totalRounds ?? 0} />
          <StatBox icon="⭐" label="EP" value={`+${epGained ?? 0}`} color="text-amber-400" />
          <StatBox icon="💰" label="Oro" value={`+${goldGained ?? 0}`} color="text-yellow-300" />
        </div>

        {fameGained != null && fameGained > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-violet-400">
            <span>👑</span>
            <span>+{fameGained} Reputación</span>
          </div>
        )}

        {participants && participants.length > 1 && (
          <div className="mt-4 pt-3 border-t border-amber-900/20">
            <p className="text-xs text-amber-600/80 mb-1.5 font-mono tracking-widest uppercase">Integrantes</p>
            <div className="flex flex-wrap gap-1.5">
              {participants.map((p, i) => (
                <span key={"participant-" + i} className="text-xs bg-gray-800/60 border border-amber-900/20 rounded px-2 py-0.5 text-gray-300">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBox({ icon, label, value, color }: Readonly<{ icon: string; label: string; value: string | number; color?: string }>) {
  return (
    <div className="bg-gray-900/60 backdrop-blur-sm rounded-lg border border-amber-900/20 p-3 text-center">
      <div className="text-xs text-gray-500 mb-1 font-mono tracking-wider uppercase">{label}</div>
      <div className={`text-lg font-bold ${color ?? 'text-gray-200'}`}>
        {icon} {value}
      </div>
    </div>
  )
}
