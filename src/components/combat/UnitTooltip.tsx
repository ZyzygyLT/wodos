"use client"

import { useState, useRef, useEffect } from "react"
import type { UnitState } from "@/lib/combat-engine/dungeon-runner"
import { STATUS_ICONS, POSITION_LABELS } from "./constants"

const FACTION_LABELS: Record<string, { icon: string; label: string }> = {
  trap: { icon: '🗜️', label: 'Trampa' },
  arachnid: { icon: '🕷️', label: 'Arácnido' },
  undead: { icon: '💀', label: 'No-muerto' },
  fire: { icon: '🔥', label: 'Ígneo' },
  darkness: { icon: '🌑', label: 'Oscuridad' },
  elemental: { icon: '🧱', label: 'Elemental' },
  slime: { icon: '🟢', label: 'Slime' },
  goblin: { icon: '👺', label: 'Goblin' },
}

function hpBarClass(pct: number): string {
  if (pct > 50) return 'bg-green-600'
  if (pct > 20) return 'bg-yellow-600'
  return 'bg-red-600'
}

function buffIconAndLabel(type: string): { icon: string; label: string } {
  if (type === 'atk') return { icon: '⚔️', label: 'ATK' }
  if (type === 'def') return { icon: '🛡️', label: 'DEF' }
  return { icon: '✨', label: type }
}

function hasGroupOrFactionBonuses(u: UnitState): boolean {
  return !!(
    (u.groupAtkBonus != null && u.groupAtkBonus > 0) ||
    (u.groupDefBonus != null && u.groupDefBonus > 0) ||
    (u.factionBonuses?.atk != null && u.factionBonuses.atk > 0) ||
    (u.factionBonuses?.def != null && u.factionBonuses.def > 0) ||
    u.factionBonuses?.combustion ||
    u.factionBonuses?.darknessHeal
  )
}

function hasNoEffects(u: UnitState): boolean {
  return (
    (!u.statusEffects || u.statusEffects.length === 0) &&
    (!u.activeBuffs || u.activeBuffs.length === 0) &&
    !hasGroupOrFactionBonuses(u) &&
    (!u.resistances || Object.keys(u.resistances).length === 0)
  )
}

function renderGroupBonuses(u: UnitState) {
  if (!hasGroupOrFactionBonuses(u)) return null
  return (
    <div>
      <p className="text-[10px] font-semibold text-purple-400/80 font-mono tracking-widest uppercase mb-1">🏴 Bonificaciones de grupo</p>
      <div className="space-y-0.5">
        {u.groupAtkBonus != null && u.groupAtkBonus > 0 && (
          <p className="text-xs text-purple-300 flex items-center gap-1.5">
            <span>⚔️</span><span>+{u.groupAtkBonus}% ATK grupal</span>
          </p>
        )}
        {u.groupDefBonus != null && u.groupDefBonus > 0 && (
          <p className="text-xs text-purple-300 flex items-center gap-1.5">
            <span>🛡️</span><span>+{u.groupDefBonus}% DEF grupal</span>
          </p>
        )}
        {u.factionBonuses?.atk != null && u.factionBonuses.atk > 0 && (
          <p className="text-xs text-purple-300 flex items-center gap-1.5">
            <span>⚔️</span> <span>+{u.factionBonuses.atk}% ATK por facción</span>
          </p>
        )}
        {u.factionBonuses?.def != null && u.factionBonuses.def > 0 && (
          <p className="text-xs text-purple-300 flex items-center gap-1.5">
            <span>🛡️</span> <span>+{u.factionBonuses.def}% DEF por facción</span>
          </p>
        )}
        {u.factionBonuses?.combustion && (
          <p className="text-xs text-orange-300 flex items-center gap-1.5">
            <span>🔥</span> <span>Ataques aplican quemadura</span>
          </p>
        )}
        {u.factionBonuses?.darknessHeal && (
          <p className="text-xs text-indigo-300 flex items-center gap-1.5">
            <span>🌑</span> <span>Oscuridad regenera 8% HP/ronda</span>
          </p>
        )}
      </div>
    </div>
  )
}

export function UnitTooltip({ u, children }: Readonly<{ u: UnitState; children: React.ReactNode }>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (tipRef.current && !tipRef.current.contains(e.target as Node) && ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const hpPct = u.maxHp > 0 ? Math.round((u.hp / u.maxHp) * 100) : 0
  const mpPct = u.maxMp > 0 ? Math.round((u.mp / u.maxMp) * 100) : 0
  let hpColor: string
  if (hpPct > 50) hpColor = 'text-green-400'
  else if (hpPct > 20) hpColor = 'text-yellow-400'
  else hpColor = 'text-red-400'
  const posLabel = POSITION_LABELS[u.position] ?? u.position
  let badge: { icon: string; label: string } | null
  if (u.trap) badge = FACTION_LABELS.trap
  else if (u.faction) badge = FACTION_LABELS[u.faction]
  else badge = null

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { /* click toggle handles close */ }}
        onClick={() => setOpen(!open)}
        className="cursor-pointer"
      >
        {children}
      </button>
      {open && (
        <button type="button"
          ref={tipRef}
          className="absolute z-50 left-0 top-full mt-1 w-72 bg-gray-950 border border-amber-900/40 rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-amber-900/5 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />

          <div className="relative p-3 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="text-lg">{u.icon ?? (u.isHero ? '🧙' : '👹')}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-200 truncate">{u.name}</p>
                <p className="text-[10px] text-gray-500 font-mono">
                  Lv{u.level} {posLabel}
                  {u.armorName ? <span className="ml-1">[{u.armorName}]</span> : null}
                </p>
              </div>
              {badge && (
                <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-medium bg-gray-800/80 text-gray-300 border border-gray-700/50 shrink-0">
                  {badge.icon} {badge.label}
                </span>
              )}
            </div>

            {/* HP/MP bars */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-gray-500 w-3">❤️</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${hpBarClass(hpPct)}`}
                    style={{ width: `${hpPct}%` }} />
                </div>
                <span className={`${hpColor} shrink-0`}>{u.hp}/{u.maxHp}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-gray-500 w-3">💙</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${mpPct}%` }} />
                </div>
                <span className="text-blue-300 shrink-0">{u.mp}/{u.maxMp}</span>
              </div>
            </div>

            {/* Status effects */}
            {u.statusEffects && u.statusEffects.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-red-400/80 font-mono tracking-widest uppercase mb-1">⚔️ Efectos activos</p>
                <div className="space-y-0.5">
                  {u.statusEffects.map((se, i) => {
                    const info = STATUS_ICONS[se.type]
                    if (!info) return <p key={`${se.type}-oob`} className="text-xs text-gray-400">{se.type}</p>
                    return (
                      <p key={`${se.type}-${se.remainingRounds}`} className={`text-xs ${info.color} flex items-center gap-1.5`}>
                        <span>{info.icon}</span>
                        <span>{info.label}</span>
                        {se.remainingRounds > 0 && <span className="text-gray-500 ml-auto">({se.remainingRounds}r)</span>}
                      </p>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Active buffs */}
            {u.activeBuffs && u.activeBuffs.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-amber-400/80 font-mono tracking-widest uppercase mb-1">✨ Bonificaciones activas</p>
                <div className="space-y-0.5">
                  {u.activeBuffs.map((b, i) => {
                    const { icon, label } = buffIconAndLabel(b.type)
                    return (
                      <p key={`${b.type}-${b.sourceName}-${b.remainingRounds ?? 'inf'}`} className="text-xs text-amber-300 flex items-center gap-1.5">
                        <span>{icon}</span>
                        <span>+{b.value}% {label}</span>
                        {b.sourceName !== label && <span className="text-gray-500 text-[10px]">({b.sourceName})</span>}
                        <span className="text-gray-600 ml-auto">
                          {b.remainingRounds == null ? '∞' : `${b.remainingRounds}r`}
                        </span>
                      </p>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Group / Faction bonuses */}
            {renderGroupBonuses(u)}

            {/* Resistances */}
            {u.resistances && Object.keys(u.resistances).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-yellow-400/80 font-mono tracking-widest uppercase mb-1">🛡️ Resistencias</p>
                <div className="space-y-0.5">
                  {Object.entries(u.resistances).map(([dt, pct]) =>
                    pct != null && pct !== 0 ? (
                      <p key={dt} className={`text-xs flex items-center gap-1.5 ${pct > 0 ? 'text-green-300' : 'text-red-300'}`}>
                        <span>{pct > 0 ? '✅' : '⚠️'}</span>
                        <span>{dt}: {pct > 0 ? '+' : ''}{pct}%</span>
                      </p>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {hasNoEffects(u) && <p className="text-xs text-gray-600 text-center py-1">Sin efectos activos</p>}
          </div>
        </button>
      )}
    </div>
  )
}
