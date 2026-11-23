"use client"

interface HeroFinal {
  id: string
  hp: number
  hpMax?: number
  mp?: number
  name?: string
}

interface Participant {
  heroId: string
  name: string
}

interface Props {
  heroesFinalState: HeroFinal[]
  participants?: Participant[]
  totalHeroes?: number
}

export function PartyPanel({ heroesFinalState, participants, totalHeroes }: Readonly<Props>) {
  const merged = heroesFinalState.map(h => {
    const p = participants?.find(p => p.heroId === h.id)
    return { ...h, name: p?.name ?? h.name ?? h.id.substring(0, 8) }
  })

  if (merged.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-900/20 bg-gray-900/40 overflow-hidden">
      <div className="px-4 py-2.5 bg-amber-900/10 border-b border-amber-900/20 flex items-center justify-between">
        <span className="text-sm font-semibold text-amber-300/90 flex items-center gap-2">
          🛡️ Grupo de expedición
        </span>
        {totalHeroes != null && (
          <span className="text-[10px] text-gray-500 font-mono">{merged.length}/{totalHeroes} héroes</span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {merged.map(h => {
          const maxHp = h.hpMax ?? 100
          const hpPct = Math.min(100, Math.max(0, (h.hp / maxHp) * 100))
          let hpCls: string
          if (hpPct > 50) hpCls = 'bg-emerald-500'
          else if (hpPct > 20) hpCls = 'bg-amber-500'
          else hpCls = 'bg-red-500'
          let hpTextCls: string
          if (hpPct > 50) hpTextCls = 'text-emerald-300'
          else if (hpPct > 20) hpTextCls = 'text-amber-300'
          else hpTextCls = 'text-red-300'
          let condition: string
          if (hpPct <= 0) condition = '💀 Derribado'
          else if (hpPct <= 20) condition = '❤️‍🔥 Crítico'
          else if (hpPct <= 50) condition = '💔 Herido'
          else condition = '❤️ Normal'

          return (
            <div key={h.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-900/60 border border-gray-800/50">
              <span className="text-lg">🧙</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-200 truncate">{h.name}</span>
                  <span className={`text-[10px] font-mono ${hpTextCls}`}>{h.hp}/{maxHp}</span>
                </div>
                <div className="mt-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${hpCls}`} style={{ width: `${hpPct}%` }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] text-gray-500">{condition}</span>
                  {h.mp != null && (
                    <span className="text-[10px] text-blue-400/70 font-mono">MP {h.mp}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
