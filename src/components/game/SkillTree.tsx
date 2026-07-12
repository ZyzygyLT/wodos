"use client"

import { useState, useMemo } from "react"
import { skillUpgradeCost } from "@/lib/skill-cost"

interface SkillNode {
  id: number; name: string; icon: string
  tier: number; epCost: number; goldCost: number
  type: string; description: string
  requiresSkills: number[]
  unlocked: boolean; rank: number
  manaCost: number; multiplier: number
  tags: string[]; formula?: any
}

interface Props {
  skills: SkillNode[]
  epAvailable: number
  gold: number
  classId: number
  onUnlock: (skillId: number) => Promise<void>
  onUpgrade: (skillId: number) => Promise<void>
}

const TIER_H = 140
const NODE_W = 100
const NODE_H = 56

function skillColors(unlocked: boolean, available: boolean): { bg: string; border: string } {
  if (unlocked) return { bg: "#064E3B", border: "#34D399" }
  if (available) return { bg: "#1E3A5F", border: "#3B82F6" }
  return { bg: "#1F2937", border: "#4B5563" }
}

export default function SkillTree({ skills, epAvailable, gold, classId, onUnlock, onUpgrade }: Readonly<Props>) {
  const [selected, setSelected] = useState<SkillNode | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const unlockedIds = useMemo(() => new Set(skills.filter(s => s.unlocked).map(s => s.id)), [skills])

  const maxTier = Math.max(...skills.map(s => s.tier), 0)

  const skillsByTier = useMemo(() => {
    const map: Record<number, SkillNode[]> = {}
    for (const s of skills) {
      if (!map[s.tier]) map[s.tier] = []
      map[s.tier].push(s)
    }
    return map
  }, [skills])

  const maxCols = Math.max(...Object.values(skillsByTier).map(arr => arr.length), 1)
  const svgW = maxCols * (NODE_W + 20) + 40
  const svgH = (maxTier + 1) * TIER_H + 60

  function getPos(skill: SkillNode) {
    const arr = skillsByTier[skill.tier] || []
    const idx = arr.indexOf(skill)
    return {
      x: 20 + idx * (NODE_W + 20) + (svgW - arr.length * (NODE_W + 20)) / 2,
      y: 20 + skill.tier * TIER_H,
    }
  }

  function isUnlocked(id: number) { return unlockedIds.has(id) }

  function isAvailableToUnlock(s: SkillNode): boolean {
    if (s.unlocked) return false
    if (epAvailable < s.epCost) return false
    if (s.goldCost > 0 && gold < s.goldCost) return false
    if (s.requiresSkills.length > 0 && !s.requiresSkills.every(r => isUnlocked(r))) return false
    return true
  }

  async function handleAction(skill: SkillNode) {
    setActionLoading(true)
    if (skill.unlocked) {
      await onUpgrade(skill.id)
    } else {
      await onUnlock(skill.id)
    }
    setActionLoading(false)
  }

  function renderActionButton(skill: SkillNode) {
    if (skill.unlocked) {
      return (
        <button onClick={() => handleAction(skill)} disabled={actionLoading}
          className="w-full py-2 rounded-lg text-sm font-medium bg-blue-700 hover:bg-blue-600 text-white transition disabled:opacity-50">
          {actionLoading ? "..." : `Mejorar (+${skillUpgradeCost(skill.goldCost, skill.rank)}💰 +${skillUpgradeCost(skill.epCost, skill.rank)} EXP)`}
        </button>
      )
    }
    if (isAvailableToUnlock(skill)) {
      return (
        <button onClick={() => handleAction(skill)} disabled={actionLoading}
          className="w-full py-2 rounded-lg text-sm font-medium bg-yellow-600 hover:bg-yellow-500 text-black transition disabled:opacity-50">
          {actionLoading ? "..." : `Desbloquear (${skill.goldCost}💰 ${skill.epCost} EXP)`}
        </button>
      )
    }
    let msg: string
    if (skill.requiresSkills.length > 0 && !skill.requiresSkills.every(r => isUnlocked(r))) {
      msg = "Requiere desbloquear habilidades previas"
    } else if (skill.epCost > epAvailable) {
      msg = `Faltan ${skill.epCost - epAvailable} EXP`
    } else {
      msg = `Faltan ${skill.goldCost - gold}💰`
    }
    return <p className="text-xs text-gray-500 text-center">{msg}</p>
  }

  return (
    <div className="overflow-auto">
      <div className="inline-block min-w-full">
        <svg width={svgW} height={svgH} className="block mx-auto">
          {skills.map(skill =>
            skill.requiresSkills.map(reqId => {
              const req = skills.find(s => s.id === reqId)
              if (!req) return null
              const from = getPos(req)
              const to = getPos(skill)
              const connected = isUnlocked(skill.id) && isUnlocked(reqId)
              return (
                <line
                  key={`${reqId}-${skill.id}`}
                  x1={from.x + NODE_W / 2}
                  y1={from.y + NODE_H}
                  x2={to.x + NODE_W / 2}
                  y2={to.y}
                  stroke={connected ? "#0F6E56" : "#374151"}
                  strokeWidth={connected ? 2 : 1}
                  strokeDasharray={connected ? "none" : "4 3"}
                />
              )
            })
          )}

          {skills.map(skill => {
            const pos = getPos(skill)
            const unlocked = skill.unlocked
            const available = isAvailableToUnlock(skill)
            const { bg, border } = skillColors(unlocked, available)
            const isSelected = selected?.id === skill.id

            return (
              <g
                key={skill.id}
                transform={`translate(${pos.x},${pos.y})`}
                onClick={() => setSelected(skill)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  width={NODE_W} height={NODE_H} rx={10}
                  fill={isSelected ? "#111827" : bg}
                  stroke={isSelected ? "#F59E0B" : border}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <text x={NODE_W / 2} y={20} textAnchor="middle" fontSize={18}>
                  {skill.icon}
                </text>
                <text x={NODE_W / 2} y={36} textAnchor="middle" fontSize={9} fill="#D1D5DB">
                  {skill.name.length > 12 ? skill.name.slice(0, 11) + "…" : skill.name}
                </text>
                {unlocked && (
                  <>
                    <rect x={NODE_W - 22} y={4} width={18} height={14} rx={4} fill="#34D399" />
                    <text x={NODE_W - 13} y={15} textAnchor="middle" fontSize={9} fill="black" fontWeight="bold">
                      R{skill.rank}
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {selected && (
        <div className="mt-4 bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{selected.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-100">{selected.name}</h3>
              <p className="text-xs text-gray-400 capitalize">{selected.type} · Tier {selected.tier}</p>
            </div>
            {selected.unlocked && (
              <span className="ml-auto text-xs bg-green-900 text-green-300 rounded-full px-3 py-1">
                Rango {selected.rank}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-400 mb-3">{selected.description}</p>

          <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
            {selected.manaCost > 0 && <span className="bg-gray-700 rounded px-2 py-1">💧 {selected.manaCost}</span>}
            {selected.multiplier > 0 && <span className="bg-gray-700 rounded px-2 py-1">×{selected.multiplier}</span>}
            {selected.tags?.map(t => (
              <span key={t} className="bg-gray-700 rounded px-2 py-1">{t}</span>
            ))}
          </div>

          {selected.formula && (
            <div className="text-xs text-gray-500 bg-gray-900 rounded-lg p-3 mb-3 font-mono">
              {Object.entries(selected.formula.attrCoeffs || {}).map(([k, v]) => `${v}×${k.toUpperCase()}`).join(" + ")}
              {selected.formula.skillRankCoeff > 0 ? ` + ${selected.formula.skillRankCoeff}×rango` : ""}
              {selected.formula.diceSides > 0 ? ` + ${selected.formula.diceCount}d${selected.formula.diceSides}` : ""}
              {selected.formula.flatBonus > 0 ? ` + ${selected.formula.flatBonus}` : ""}
            </div>
          )}

          {renderActionButton(selected)}
        </div>
      )}
    </div>
  )
}
