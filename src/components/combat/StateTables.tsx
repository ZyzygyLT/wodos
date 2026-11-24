"use client"

import type { UnitState, StateSnapshot } from "@/lib/combat-engine/dungeon-runner"
import { POSITION_LABELS, STATUS_ICONS } from "./constants"
import { UnitTooltip } from "./UnitTooltip"

const FACTION_BADGE: Record<string, { icon: string; label: string; color: string }> = {
  trap: { icon: '🗜️', label: 'Trampa', color: 'bg-red-800/60 text-red-200' },
  arachnid: { icon: '🕷️', label: 'Arácnido', color: 'bg-purple-800/60 text-purple-200' },
  undead: { icon: '💀', label: 'No-muerto', color: 'bg-gray-700/60 text-gray-300' },
  fire: { icon: '🔥', label: 'Ígneo', color: 'bg-orange-800/60 text-orange-200' },
  darkness: { icon: '🌑', label: 'Oscuridad', color: 'bg-indigo-900/60 text-indigo-200' },
  elemental: { icon: '🧱', label: 'Elemental', color: 'bg-teal-800/60 text-teal-200' },
  slime: { icon: '🟢', label: 'Slime', color: 'bg-green-800/60 text-green-200' },
  goblin: { icon: '👺', label: 'Goblin', color: 'bg-yellow-800/60 text-yellow-200' },
}

function hpColorClass(hpPct: number): string {
  if (hpPct > 50) return 'text-green-400'
  if (hpPct > 20) return 'text-yellow-400'
  return 'text-red-400'
}

function barColorClass(hpPct: number): string {
  if (hpPct > 50) return 'bg-green-500'
  if (hpPct > 20) return 'bg-yellow-500'
  return 'bg-red-500'
}

function factionBadge(u: UnitState): { icon: string; label: string; color: string } | null {
  if (u.trap) return FACTION_BADGE.trap
  if (u.faction) return FACTION_BADGE[u.faction] ?? null
  return null
}

function UnitRow({ u, isDead }: Readonly<{ u: UnitState; isDead: boolean }>) {
  const hpPct = u.maxHp > 0 ? (u.hp / u.maxHp) * 100 : 0
  const mpPct = u.maxMp > 0 ? (u.mp / u.maxMp) * 100 : 0
  const hpColor = hpColorClass(hpPct)
  const barBgColor = barColorClass(hpPct)
  const posLabel = POSITION_LABELS[u.position] ?? u.position
  const badge = factionBadge(u)

  if (isDead) {
    return (
      <tr className="border-t border-gray-700/50 text-xs opacity-50">
        <td className="py-2 px-3 whitespace-nowrap">{u.icon ?? '👹'} {u.name} <span className="text-gray-500">({posLabel})</span></td>
        <td className="py-2 px-3 font-mono text-red-600" colSpan={2}>💀 Derribado</td>
        <td className="py-2 px-3 text-red-600">dead</td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-gray-700/50 text-xs hover:bg-white/5">
      <td className="py-2 px-3 whitespace-nowrap">
        <UnitTooltip u={u}>
          <span className="cursor-help border-b border-dotted border-gray-600/40">
            {u.icon ?? (u.isHero ? '🧙' : '👹')} {u.name}
          </span>
        </UnitTooltip>
        {badge ? <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>{badge.icon} {badge.label}</span> : null}
        <span className="text-yellow-500 ml-1">Lv{u.level}</span>
        {u.armorName ? <span className="text-gray-500 ml-1">[{u.armorName}]</span> : ''}
        <span className="text-gray-600 ml-1">({posLabel})</span>
      </td>
      <td className={`py-2 px-3 font-mono ${hpColor}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-16 bg-gray-700 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${barBgColor}`}
              style={{ width: `${hpPct}%` }} />
          </div>
          {u.hp}/{u.maxHp}
        </div>
        {u.statusEffects && u.statusEffects.length > 0 && (
          <div className="flex gap-1 mt-1">
            {u.statusEffects.map((se, i) => {
              const info = STATUS_ICONS[se.type]
              if (!info) return null
              return (
                <span key={`${se.type}-${se.remainingRounds}`} className={`text-xs ${info.color}`} title={`${info.label} (${se.remainingRounds}r)`}>
                  {info.icon}{se.remainingRounds}
                </span>
              )
            })}
          </div>
        )}
      </td>
      <td className="py-2 px-3 font-mono text-blue-300">
        <div className="flex items-center gap-1">
          <div className="w-12 bg-gray-700 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${mpPct}%` }} />
          </div>
          {u.mp}/{u.maxMp}
        </div>
      </td>
      <td className="py-2 px-3">{u.condition !== 'normal' && u.condition !== 'ready' ? <span className="text-orange-400">{u.condition}</span> : <span className="text-gray-500">—</span>}</td>
    </tr>
  )
}

function FactionTable({ units, label, bgColor }: Readonly<{ units: UnitState[]; label: string; bgColor: string }>) {
  if (units.length === 0) return null
  const alive = units.filter(u => u.hp > 0)
  const dead = units.filter(u => u.hp <= 0)
  return (
    <div className={`${bgColor} rounded-lg overflow-hidden`}>
      <div className="text-xs font-semibold px-3 py-1.5 bg-black/20">{label} ({alive.length > 0 ? `${alive.length} en pie` : ''}{dead.length > 0 ? `, ${dead.length} caídos` : ''})</div>
      <div className="overflow-x-auto" role="region" aria-label={`${label} estado de unidades`} tabIndex={0}>
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-left py-1.5 px-3 font-medium">Unidad</th>
              <th className="text-left py-1.5 px-3 font-medium">HP</th>
              <th className="text-left py-1.5 px-3 font-medium">MP</th>
              <th className="text-left py-1.5 px-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {alive.map(u => <UnitRow key={u.id} u={u} isDead={false} />)}
            {dead.map(u => <UnitRow key={u.id} u={u} isDead={true} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StateTables({ snapshot }: Readonly<{ snapshot: StateSnapshot }>) {
  return (
    <div className="flex flex-col gap-2">
      <FactionTable units={snapshot.heroes} label="🛡️ Aliados" bgColor="bg-blue-950/40" />
      <FactionTable units={snapshot.enemies} label="👹 Enemigos" bgColor="bg-red-950/30" />
    </div>
  )
}
