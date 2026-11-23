"use client"

import type { DetailedAction } from "@/lib/combat-engine/dungeon-runner"
import { DAMAGE_ICONS, RESULT_ICONS, RESULT_COLORS } from "./constants"

function targetLabel(multiTarget: boolean, targetName: string | undefined) {
  if (multiTarget) return <span className="text-gray-500"> contra todos los enemigos</span>
  if (targetName) return <span className="text-gray-500"> contra {targetName}</span>
  return null
}

function targetResultBadge(resultType: string | undefined, defEffect: string | undefined) {
  if (resultType === 'critical_success') {
    return { cls: 'bg-purple-900/50 text-purple-300 border-purple-600/50 shadow-[0_0_6px_rgba(168,85,247,0.3)]', icon: '🌟', label: '¡CRÍTICO!' }
  }
  if (resultType === 'failed' && defEffect) {
    const labels: Record<string, string> = { dodge: 'Esquivó', block: 'Bloqueó', barrier: 'Barrera' }
    return { cls: `${RESULT_COLORS[defEffect]} bg-gray-800/60 border-current/30`, icon: RESULT_ICONS[defEffect], label: `¡${labels[defEffect] ?? 'Defensa'}!` }
  }
  if (resultType === 'success' || resultType === 'good_success') {
    return { cls: 'bg-green-900/30 text-green-400 border-green-700/40', icon: RESULT_ICONS[resultType], label: 'Acertó' }
  }
  if (resultType === 'failed') {
    return { cls: 'bg-red-900/30 text-red-400 border-red-700/40', icon: '❌', label: 'Falló' }
  }
  return null
}

function RightSide({
  targetName, defStr, resultType, defenseEffect, defenseSkill, defenseRoll,
  damageBreakdown, defVal, absorbed, isEnemy,
}: Readonly<{
  targetName?: string
  defStr: string
  resultType?: string
  defenseEffect?: string
  defenseSkill?: string
  defenseRoll?: number
  damageBreakdown?: NonNullable<DetailedAction['damageBreakdown']>
  defVal: number
  absorbed?: number
  isEnemy?: boolean
}>) {
  const badge = resultType ? targetResultBadge(resultType, defenseEffect) : null
  const dmgCls = isEnemy ? 'text-orange-300' : 'text-green-300'

  return (
    <div className="space-y-1">
      {/* Defender narrative */}
      <div className="text-xs">
        → <span className="text-gray-300">{targetName}</span>
        {resultType != null && (
          <span className="text-gray-500">
            {' '}
            {(() => {
              if (defenseEffect === 'dodge') return 'intenta esquivar'
              if (defenseEffect === 'block') return 'intenta bloquear'
              if (defenseEffect === 'barrier') return 'levanta una barrera'
              return 'intenta defenderse'
            })()}
          </span>
        )}
      </div>
      {(defenseSkill || defVal > 0) && (
        <div className="text-[11px] text-blue-400 font-mono ml-1">
          {defenseSkill && <span className="font-semibold text-amber-300">"{defenseSkill}"</span>}
          {defenseSkill && <span> — </span>}
          <span>defensa {defVal}</span>
        </div>
      )}
      {/* Result badge */}
      {badge && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
            {badge.icon} {badge.label}
          </span>
          {absorbed != null && absorbed > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 text-[10px] border border-blue-700/40">
              🛡️ {absorbed} absorbido
            </span>
          )}
        </div>
      )}
      {/* Damage */}
      {damageBreakdown?.map((d, i) => (
        <div key={`${d.type}-${d.value}`} className="flex items-baseline gap-1 text-xs">
          <span className={`font-bold ${dmgCls}`}>{d.value}</span>
          <span>{DAMAGE_ICONS[d.type] ?? '💥'}</span>
          <span className="text-gray-400">{d.type}</span>
        </div>
      ))}
    </div>
  )
}

function TargetRow({ t, isEnemy }: Readonly<{ t: NonNullable<DetailedAction['targetResults']>[number]; isEnemy?: boolean }>) {
  const defStr = t.defenseSkill ? `${t.defenseSkill}/${t.defenseValue}` : `${t.defenseValue ?? ''}`
  const badge = targetResultBadge(t.resultType, t.defenseEffect)
  const dmgCls = isEnemy ? 'text-orange-300' : 'text-green-300'
  return (
    <div className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-gray-800/40 border border-gray-700/30">
      <span className="text-gray-300 font-medium min-w-[80px] truncate">{t.targetName}</span>
      {defStr && <span className="text-blue-400 font-mono shrink-0">({defStr})</span>}
      <span className="ml-auto flex items-center gap-1.5 shrink-0">
        {badge && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
            {badge.icon} {badge.label}
          </span>
        )}
        {t.damageBreakdown?.map((d, i) => (
          <span key={`${d.type}-${d.value}`} className={`font-bold text-xs ${dmgCls}`}>{d.value}{DAMAGE_ICONS[d.type] ?? '💥'}</span>
        ))}
        {t.absorbed != null && t.absorbed > 0 && (
          <span className="text-blue-300 text-[10px]">🛡️ {t.absorbed}</span>
        )}
      </span>
    </div>
  )
}

/** Build a narrative description for the left column */
function Narrative({ a, isEnemy }: Readonly<{ a: DetailedAction; isEnemy?: boolean }>) {
  const nameCls = isEnemy ? 'text-orange-300' : 'text-green-300'
  const skillCls = isEnemy ? 'text-amber-400' : 'text-amber-300'
  const isAttack = a.damageBreakdown != null && a.damageBreakdown.length > 0
  const isHeal = a.healAmount != null
  const isBuff = a.buffName != null
  const isItem = a.itemName != null
  const isCrit = a.resultType === 'critical_success'
  const isMiss = a.resultType === 'failed' && !isHeal && !isBuff && !isItem
  const roll = a.attackRollTotal == null ? null : Math.round(a.attackRollTotal)
  const multiTarget = a.targetResults != null && a.targetResults.length > 0

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none">{a.actorIcon ?? '🧙'}</span>
        <span className={`font-bold text-sm ${nameCls}`}>{a.actorName}</span>
      </div>
      {a.skillFallback && (
        <p className="text-[10px] text-amber-300 ml-1">
          {a.skillFallback === 'free_basic'
            ? `Sin maná: ataque básico gratuito (seleccionada: ${a.selectedSkillName})`
            : a.skillFallback === 'basic'
              ? `Sin maná: sustituida por ataque básico (seleccionada: ${a.selectedSkillName})`
              : `Sin maná ni ataque básico disponible: se fuerza "${a.selectedSkillName}"`}
        </p>
      )}
      <div className="text-xs text-gray-300 ml-1 space-y-0.5">

        {isAttack && (
          <p>
            <span className="text-gray-500">lanza </span>
            <span className={`font-semibold ${skillCls}`}>"{a.skillName}"</span>
            {roll != null && (
              <span> con una fuerza de <span className="font-bold text-violet-400">{roll}</span></span>
            )}
            {isCrit && <span className="text-purple-400 font-bold ml-1">★ CRÍTICO</span>}
            {targetLabel(multiTarget, a.targetName)}
          </p>
        )}

        {isHeal && (
          <p>
            <span className="text-gray-500">invoca </span>
            <span className={`font-semibold ${skillCls}`}>"{a.skillName}"</span>
            <span className="text-green-400 font-bold"> +{a.healAmount} {a.healType === 'mp' ? 'MP' : 'HP'}</span>
            {a.targetName && <span className="text-gray-500"> sobre {a.targetName}</span>}
          </p>
        )}

        {isBuff && (
          <p>
            <span className="text-gray-500">entona </span>
            <span className={`font-semibold ${skillCls}`}>"{a.skillName}"</span>
            <span className="text-blue-400 font-bold"> +{a.buffValue}% {a.buffName}</span>
            {a.targetName && <span className="text-gray-500"> para {a.targetName}</span>}
            {!a.targetName && <span className="text-gray-500"> para todo el grupo</span>}
          </p>
        )}

        {isItem && (
          <p>
            <span className="text-gray-500">usa </span>
            <span className="font-semibold text-purple-400">{a.itemName}</span>
            {a.healAmount != null && (
              <span className="text-green-400 font-bold"> +{a.healAmount} HP</span>
            )}
          </p>
        )}

        {isMiss && !multiTarget && (
          <p>
            <span className="text-gray-500">intenta </span>
            <span className={`font-semibold ${skillCls}`}>"{a.skillName}"</span>
            {roll != null && (
              <span> con una fuerza de <span className="font-bold text-violet-400">{roll}</span></span>
            )}
            {a.targetName && <span className="text-gray-500"> contra {a.targetName}</span>}
            <span className="text-red-400 ml-1">— ¡Falló!</span>
          </p>
        )}

        {a.fled && (
          <p className="text-yellow-400">🏃 Huyó del combate</p>
        )}

      </div>
    </div>
  )
}

export function ActionCard({ a, isEnemy }: Readonly<{ a: DetailedAction; isEnemy?: boolean }>) {
  const isBuff = a.buffName != null
  const defVal = a.defenseValue ?? 0
  const multiTarget = a.targetResults != null && a.targetResults.length > 0

  const iniCls = isEnemy ? 'bg-orange-900/50 text-orange-300 border-orange-700/50' : 'bg-green-900/50 text-green-300 border-green-700/50'
  const defStr = a.defenseSkill ? `${a.defenseSkill}/${a.defenseValue}` : `${a.defenseValue ?? ''}`

  return (
    <div className="animate-fade-in bg-gray-800/30 rounded-lg border border-gray-700/40 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/40 border-b border-gray-700/30">
        <span className={`inline-flex items-center justify-center w-10 h-5 rounded text-[10px] font-bold border ${iniCls}`}>
          Init {a.initiative}
        </span>
        <span className="text-[10px] text-gray-500">Action {a.actionNumber} of {a.totalActions}</span>
        {a.defenseEffect === 'dodge' && (
          <span className="text-[10px] text-cyan-400">🦅</span>
        )}
        {(a.absorbed ?? 0) > 0 && (
          <span className="text-[10px] text-blue-400">🛡️</span>
        )}
        {a.message?.includes('DERRIBADO') && (
          <span className="text-[10px] text-red-400">💀</span>
        )}
        {a.mpCost != null && a.mpCost > 0 && (
          <span className="text-[10px] text-blue-400 ml-auto">💙 {a.mpCost} MP</span>
        )}
      </div>

      {/* Body — two columns */}
      <div className="p-3">
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          {/* LEFT: narrative */}
          <div className="space-y-1 min-w-0">
            <Narrative a={a} isEnemy={isEnemy} />
          </div>

          {/* RIGHT: target / defense / result / damage */}
          <div className="min-w-0">
            {multiTarget ? (
              <div className="space-y-1">
                {(a.targetResults ?? []).map((t, i) => (
                  <TargetRow key={t.targetId} t={t} isEnemy={isEnemy} />
                ))}
              </div>
            ) : (
              <RightSide
                targetName={isBuff ? 'Todos los aliados' : a.targetName}
                defStr={defStr}
                resultType={a.resultType}
                defenseEffect={a.defenseEffect}
                defenseSkill={a.defenseSkill}
                defenseRoll={a.defenseRoll}
                damageBreakdown={a.damageBreakdown}
                defVal={defVal}
                absorbed={a.absorbed}
                isEnemy={isEnemy}
              />
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
