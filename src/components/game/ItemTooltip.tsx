"use client"

import { useEffect, useRef, useState } from "react"

const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-300 border-gray-500",
  uncommon: "text-green-400 border-green-600",
  rare: "text-blue-400 border-blue-600",
  epic: "text-purple-400 border-purple-600",
  unique: "text-orange-300 border-orange-500",
}

const RARITY_BG: Record<string, string> = {
  common: "from-gray-900 to-gray-950",
  uncommon: "from-green-950/40 to-gray-950",
  rare: "from-blue-950/40 to-gray-950",
  epic: "from-purple-950/40 to-gray-950",
  unique: "from-orange-950/40 to-gray-950",
}

const STAT_LABELS: Record<string, string> = {
  st: "Fuerza", co: "Constitución", in: "Inteligencia", dx: "Destreza",
  ch: "Carisma", ag: "Agilidad", pe: "Percepción", wi: "Voluntad",
  ATK: "Ataque", DEF: "Defensa", MATK: "Ataque Mágico", MDEF: "Defensa Mágica",
  healHp: "Curación HP", healMp: "Curación MP",
  critChance: "Crítico %", critDmg: "Daño Crítico %",
  speed: "Velocidad", dodge: "Esquiva", block: "Bloqueo",
}

export interface TooltipItem {
  id: number | string
  name: string
  icon: string
  rarity: string
  category: string
  slot?: string | null
  levelReq: number
  description: string
  stats?: Record<string, number> | null
  runeSlots?: number
  runesIn?: { slotIndex: number; itemId: number }[]
  runeItems?: { id: number; name: string; icon: string; stats: Record<string, number> }[]
  upgradeLevel?: number
  classReq?: number[]
  attrReq?: Record<string, number> | null
}

interface ComparisonItem {
  item: TooltipItem
  upgradeLevel?: number
  stats: Record<string, number>
}

function statDiff(a: number, b: number): { value: number; positive: boolean } {
  const diff = a - b
  return { value: Math.abs(diff), positive: diff > 0 }
}

export default function ItemTooltip({ item, equipped, anchorRef }: Readonly<{
  item: TooltipItem
  equipped?: ComparisonItem | null
  anchorRef?: React.RefObject<HTMLElement | null>
}>) {
  const tipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useEffect(() => {
    if (!anchorRef?.current || !tipRef.current) return
    const anchor = anchorRef.current.getBoundingClientRect()
    const tip = tipRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = anchor.right + 8
    let top = anchor.top

    if (left + tip.width > vw - 8) left = anchor.left - tip.width - 8
    if (top + tip.height > vh - 8) top = vh - tip.height - 8
    if (top < 8) top = 8

    setPos({ top, left })
  }, [anchorRef])

  const stats = item.stats ?? {}
  const equippedStats = equipped?.stats ?? {}
  const allStatKeys = [...new Set([...Object.keys(stats), ...Object.keys(equippedStats)])]
    .filter(k => k !== 'healHp' && k !== 'healMp')
  const healHp = stats.healHp
  const healMp = stats.healMp

  return (
    <div ref={tipRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className={`pointer-events-none w-72 bg-gradient-to-b ${RARITY_BG[item.rarity] ?? 'from-gray-900 to-gray-950'} border ${RARITY_COLORS[item.rarity]?.split(' ')[1] ?? 'border-gray-600'} rounded-xl shadow-2xl p-4 space-y-3`}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-3xl">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${RARITY_COLORS[item.rarity]?.split(' ')[0] ?? 'text-gray-300'}`}>
            {item.name}
            {item.upgradeLevel ? <span className="text-orange-400 ml-1">+{item.upgradeLevel}</span> : null}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
            {item.rarity} · {item.category}
            {item.slot ? ` · ${item.slot}` : ""}
          </p>
        </div>
      </div>

      {/* Level requirement */}
      {item.levelReq > 1 && (
        <p className="text-xs text-gray-400">Requisito: Nv. {item.levelReq}</p>
      )}

      {/* Stats */}
      {allStatKeys.length > 0 && (
        <div className="space-y-1">
          {allStatKeys.map(k => {
            const newVal = stats[k] ?? 0
            const oldVal = equippedStats[k] ?? 0
            const diff = equipped ? statDiff(newVal, oldVal) : null
            const label = STAT_LABELS[k] ?? k.toUpperCase()

            return (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{label}</span>
                <div className="flex items-center gap-2">
                  {equipped && diff && diff.value > 0 && (
                    <span className={`text-[10px] font-bold ${diff.positive ? 'text-green-400' : 'text-red-400'}`}>
                      {diff.positive ? `+${diff.value}` : `-${diff.value}`}
                    </span>
                  )}
                  {equipped && oldVal > 0 && (
                    <span className="text-gray-600 text-[10px]">{oldVal} → </span>
                  )}
                  <span className="text-gray-200 font-medium">
                    {newVal > 0 ? `+${newVal}` : newVal}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Heal stats */}
      {Boolean(healHp || healMp) && (
        <div className="space-y-1 border-t border-gray-800 pt-2">
          {Boolean(healHp) && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Curación HP</span>
              <span className="text-green-400 font-medium">+{healHp}</span>
            </div>
          )}
          {Boolean(healMp) && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Curación MP</span>
              <span className="text-blue-400 font-medium">+{healMp}</span>
            </div>
          )}
        </div>
      )}

      {/* Rune slots */}
      {item.runeSlots ? (
        <div className="space-y-1 border-t border-gray-800 pt-2">
          <p className="text-xs text-gray-400">Ranuras de runa:</p>
          <div className="flex gap-1.5">
            {Array.from({ length: item.runeSlots }).map((_, i) => {
              const rune = item.runeItems?.find(r => {
                const entry = item.runesIn?.find(rx => rx.slotIndex === i)
                return r.id === entry?.itemId
              })
              return (
                <div key={"rune-slot-" + i} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${rune ? "bg-purple-900/40 text-purple-300" : "bg-gray-800 text-gray-600"}`}>
                  {rune ? <>{rune.icon} {rune.name}</> : "vacía"}
                </div>
              )
            })}
          </div>
          {item.runeItems && item.runeItems.length > 0 && (
            <div className="space-y-0.5 mt-1">
              {item.runeItems.map(r => (
                Object.entries(r.stats).map(([k, v]) => (
                  <div key={`${r.id}-${k}`} className="flex items-center justify-between text-[10px]">
                    <span className="text-purple-400">{r.icon} {STAT_LABELS[k] ?? k.toUpperCase()}</span>
                    <span className="text-purple-300">+{v}</span>
                  </div>
                ))
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Description */}
      {item.description && (
        <p className="text-[11px] text-gray-500 italic border-t border-gray-800 pt-2 leading-relaxed">
          {item.description}
        </p>
      )}
    </div>
  )
}
