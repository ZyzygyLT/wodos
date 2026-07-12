"use client"

import { computeDefenseFromFormula } from "@/lib/combat-engine/hero-stats"
import { useTactics, type PrelimRule, type RoundRule } from "@/hooks/useTactics"

const CONDITION_TYPES = [
  { value: 'always', label: 'Siempre' },
  { value: 'hp_self_lt', label: 'HP propio < %' },
  { value: 'hp_self_gt', label: 'HP propio > %' },
  { value: 'hp_enemy_lt', label: 'HP enemigo < %' },
  { value: 'round_gt', label: 'Ronda > N' },
  { value: 'mana_lt', label: 'MP propio < %' },
  { value: 'ally_down', label: 'Aliado caído' },
  { value: 'damaged_this_round', label: 'Recibió daño esta ronda' },
]

const TARGET_TYPES = [
  { value: 'weakest', label: 'Más débil' },
  { value: 'strongest', label: 'Más fuerte' },
  { value: 'most_injured_ally', label: 'Alíado más herido' },
  { value: 'random', label: 'Aleatorio' },
]

const TARGET_POSITIONS = [
  { value: 'front', label: 'Frontal' },
  { value: 'center', label: 'Centro' },
  { value: 'rear', label: 'Trasera' },
  { value: 'auto', label: 'Automático' },
]

const POSITION_LABELS: Record<string, string> = {
  front: 'Frontal', center: 'Centro', rear: 'Trasera',
  left_flank: 'Flanco izq.', right_flank: 'Flanco der.', flexible: 'Flexible',
}

const PRELIM_TIMINGS = new Set(['both', 'pre_round'])
const ROUND_TIMINGS = new Set(['both', 'round'])

function getPrelimCombinedId(rule: PrelimRule): string {
  if (rule.itemId) return `item:${rule.itemId}`
  return `skill:${rule.skillId ?? 1}`
}

function getRoundCombinedId(rule: RoundRule): string {
  if (rule.action.itemId) return `item:${rule.action.itemId}`
  return `skill:${rule.action.skillId ?? 1}`
}

export default function TacticsEditor() {
  const t = useTactics()
  const {
    profiles, selectedDungeonLevel, setSelectedDungeonLevel, saving,
    heroSkills, consumableItems, heroAttrs, defenseSkillDetails,
    unlockedSkills, profile,
    updateProfile, updateRoundRule, addRoundRule, removeRoundRule,
    addPrelimRule, updatePrelimRuleAction, removePrelimRule,
    updateRoundRuleActionSkill, save,
  } = t

  const preRoundSkills = heroSkills.filter(s => s.unlocked && PRELIM_TIMINGS.has(s.timing))
  const roundSkills = heroSkills.filter(s => s.unlocked && ROUND_TIMINGS.has(s.timing))

  function getDefenseValue(skillId: number | null): number {
    if (!skillId) return 0
    const detail = defenseSkillDetails.find(s => s.id === skillId)
    if (!detail) return 0
    return computeDefenseFromFormula(detail.formula, heroAttrs, detail.rank ?? 1)
  }

  function defenseBreakdown(skillId: number | null): string[] {
    if (!skillId) return []
    const detail = defenseSkillDetails.find(s => s.id === skillId)
    if (!detail?.formula?.attrCoeffs) return []
    const lines: string[] = []
    for (const [attr, coeff] of Object.entries(detail.formula.attrCoeffs)) {
      const val = heroAttrs[attr] ?? 0
      lines.push(`${attr}=${val} × ${coeff} = ${Math.round(val * (coeff as number))}`)
    }
    const rankTerm = (detail.formula.skillRankCoeff ?? 0) * (detail.rank ?? 1)
    if (rankTerm > 0) lines.push(`rango × ${detail.formula.skillRankCoeff} = ${rankTerm}`)
    const flat = detail.formula.flatBonus ?? 0
    if (flat > 0) lines.push(`base +${flat}`)
    return lines
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => setSelectedDungeonLevel(null)}
          className={`px-3 py-1.5 rounded-lg transition ${selectedDungeonLevel === null ? 'bg-yellow-600 text-black font-bold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
          General
        </button>
        {profiles.filter(p => p.dungeonLevel !== null).map(p => (
          <button key={p.dungeonLevel} onClick={() => setSelectedDungeonLevel(p.dungeonLevel)}
            className={`px-3 py-1.5 rounded-lg transition ${selectedDungeonLevel === p.dungeonLevel ? 'bg-yellow-600 text-black font-bold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            Nivel {p.dungeonLevel}
          </button>
        ))}
      </div>

      {!profile && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
          <p className="text-gray-400">Seleccioná un perfil de la barra de arriba</p>
          <p className="text-sm text-gray-500 mt-2">El perfil General aplica a todos los niveles que no tengan override</p>
        </div>
      )}

      {profile && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">
              ⚙️ Config general — {profile.dungeonLevel ? `Nivel ${profile.dungeonLevel}` : 'Todas las rondas'}
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label htmlFor="tactics-position" className="text-gray-500 text-xs">Posición</label>
                <select id="tactics-position" value={profile.position} onChange={e => updateProfile('position', e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 mt-1 outline-none focus:ring-1 focus:ring-yellow-500">
                  {Object.entries(POSITION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="p-3 rounded-lg bg-gray-800/50">
                <p className="text-xs text-gray-400">⚡ La iniciativa se calcula automáticamente: <strong className="text-gray-200">AG + PE/2</strong></p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">🛡️ Defensa por categoría</h2>
            <p className="text-xs text-gray-500 mb-3">Elegí qué habilidad defensiva usar contra cada tipo de ataque.</p>
            {(['melee', 'ranged', 'magic'] as const).map(cat => {
              const catLabel = { melee: 'Cuerpo a cuerpo', ranged: 'A distancia', magic: 'Mágico' }[cat]
              const defSkills = unlockedSkills.filter(s => s.defenseCategory && (s.defenseCategory === cat || s.defenseCategory === 'all'))
              return (
                <div key={cat} className="mb-2">
                  <label htmlFor={`tactics-defense-${cat}`} className="text-xs text-gray-500 block mb-1">{catLabel}</label>
                  <select id={`tactics-defense-${cat}`} value={profile.defenseSkills?.[cat] ?? ''} onChange={e => updateProfile('defenseSkills', { ...profile.defenseSkills, [cat]: e.target.value ? Number(e.target.value) : null })}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-yellow-500 text-sm">
                    <option value="">— Sin defensa —</option>
                    {defSkills.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.icon} {s.name} (= {computeDefenseFromFormula(s.formula, heroAttrs, s.rank ?? 1)})
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
            <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400 flex gap-4">
              {(['melee', 'ranged', 'magic'] as const).map(cat => {
                const sid = profile.defenseSkills?.[cat] ?? null
                const val = getDefenseValue(sid)
                const detail = sid ? defenseSkillDetails.find(s => s.id === sid) : null
                const breakdown = sid ? defenseBreakdown(sid) : []
                const tooltip = detail
                  ? `🧮 ${detail.name}\n${breakdown.join('\n')}\n───\nTotal: ${val}`
                  : ''
                return (
                  <span key={cat} title={tooltip}>
                    {cat}: <strong className={val > 0 ? 'text-blue-400' : 'text-gray-500'}>{val || '—'}</strong>
                  </span>
                )
              })}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400">🌀 Preparación (efectos pre-ronda)</h2>
              <button onClick={() => addPrelimRule(preRoundSkills[0]?.id ?? 1)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
                + Agregar efecto
              </button>
            </div>

            <div className="space-y-2">
              {profile.prelimRules.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-3">
                  Sin efectos de preparación. Se ejecutan al inicio de la mazmorra.
                </p>
              )}
              {profile.prelimRules.map((rule, i) => (
                <div key={"prelim-" + i} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3 text-sm">
                  <span className="text-xs text-gray-500 w-20">Acción</span>
                  <select value={getPrelimCombinedId(rule)} onChange={e => updatePrelimRuleAction(i, e.target.value)} aria-label="Acción preparación"
                    className="bg-gray-700 rounded px-2 py-1.5 outline-none flex-1">
                    <optgroup label="⚔️ Habilidades">
                      {preRoundSkills.length === 0 && <option value="skill:1">Sin skills</option>}
                      {preRoundSkills.map(s => (
                        <option key={`skill:${s.id}`} value={`skill:${s.id}`}>
                          {s.icon} {s.name} R{s.rank ?? 1}{s.manaCost > 0 ? ` (${s.manaCost}💧)` : ''}
                        </option>
                      ))}
                    </optgroup>
                    {consumableItems.length > 0 && (
                      <optgroup label="🧪 Consumibles">
                        {consumableItems.map(c => (
                          <option key={`item:${c.itemId}`} value={`item:${c.itemId}`}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button onClick={() => removePrelimRule(i)}
                    className="text-xs px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-red-300 transition">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400">⚔️ Ronda (reglas IF/THEN)</h2>
              <button onClick={() => addRoundRule(roundSkills[0]?.id ?? 1)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
                + Agregar regla
              </button>
            </div>

            <div className="space-y-3">
              {profile.roundRules.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-3">
                  Sin reglas de ronda. Se usará ataque básico siempre.
                </p>
              )}
              {profile.roundRules.map((rule, i) => (
                <div key={"round-rule-" + i} className="bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-mono">Prio: {rule.priority}</span>
                    <button onClick={() => removeRoundRule(i)}
                      className="text-xs px-2 py-0.5 rounded bg-red-900 hover:bg-red-800 text-red-300 transition">
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label htmlFor="tactic-condición" className="text-gray-500">Condición</label>
                      <select id="tactic-condición" value={rule.condition.type} onChange={e => updateRoundRule(i, 'condition.type', e.target.value)}
                        className="w-full bg-gray-700 rounded px-2 py-1.5 mt-0.5 outline-none">
                        {CONDITION_TYPES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    {rule.condition.type !== 'always' && rule.condition.type !== 'ally_down' && rule.condition.type !== 'damaged_this_round' && (
                      <div>
                        <label htmlFor="tactic-valor" className="text-gray-500">Valor</label>
                        <input id="tactic-valor" type="number" value={rule.condition.value ?? 50} onChange={e => updateRoundRule(i, 'condition.value', Number(e.target.value))}
                          className="w-full bg-gray-700 rounded px-2 py-1.5 mt-0.5 outline-none" />
                      </div>
                    )}
                    <div>
                      <label htmlFor="tactic-target" className="text-gray-500">Target</label>
                      <select id="tactic-target" value={rule.action.targetType} onChange={e => updateRoundRule(i, 'action.targetType', e.target.value)}
                        className="w-full bg-gray-700 rounded px-2 py-1.5 mt-0.5 outline-none">
                        {TARGET_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tactic-posición" className="text-gray-500">Posición</label>
                      <select id="tactic-posición" value={rule.action.targetPos} onChange={e => updateRoundRule(i, 'action.targetPos', e.target.value)}
                        className="w-full bg-gray-700 rounded px-2 py-1.5 mt-0.5 outline-none">
                        {TARGET_POSITIONS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tactic-acción" className="text-gray-500">Acción</label>
                      <select id="tactic-acción" value={getRoundCombinedId(rule)} onChange={e => updateRoundRuleActionSkill(i, e.target.value)}
                        className="w-full bg-gray-700 rounded px-2 py-1.5 mt-0.5 outline-none">
                        <optgroup label="⚔️ Habilidades">
                          {roundSkills.length === 0 && <option value="skill:1">Sin skills</option>}
                          {roundSkills.map(s => (
                            <option key={`skill:${s.id}`} value={`skill:${s.id}`}>
                              {s.icon} {s.name} R{s.rank ?? 1}{s.manaCost > 0 ? ` (${s.manaCost}💧)` : ''}
                            </option>
                          ))}
                        </optgroup>
                        {consumableItems.length > 0 && (
                          <optgroup label="🧪 Consumibles">
                            {consumableItems.map(c => (
                              <option key={`item:${c.itemId}`} value={`item:${c.itemId}`}>
                                {c.icon} {c.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition disabled:opacity-50">
            {saving ? 'Guardando...' : '💾 Guardar tácticas'}
          </button>
        </div>
      )}
    </div>
  )
}
