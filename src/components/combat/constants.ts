export const DAMAGE_ICONS: Record<string, string> = {
  physical: '⚔️', fire: '🔥', ice: '❄️', lightning: '⚡',
  poison: '☠️', holy: '✨', dark: '🌑', psychological: '🧠',
  piercing: '🗡️', arcane: '🔮', healing: '💚',
}

export const DAMAGE_LABELS: Record<string, string> = {
  physical: 'Físico', fire: 'Fuego', ice: 'Hielo', lightning: 'Rayo',
  poison: 'Veneno', holy: 'Sagrado', dark: 'Oscuridad', psychological: 'Mental',
  piercing: 'Perforante', arcane: 'Arcano',
}

export const RESULT_ICONS: Record<string, string> = {
  failed: '❌', success: '✓', good_success: '✓✓', critical_success: '★',
  dodge: '💨', block: '🛡️', barrier: '🔮',
}

export const RESULT_COLORS: Record<string, string> = {
  failed: 'text-red-400', success: 'text-green-400',
  good_success: 'text-yellow-400', critical_success: 'text-purple-400',
  dodge: 'text-cyan-400', block: 'text-yellow-400', barrier: 'text-blue-400',
}

export const STATUS_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  poison: { icon: '☠️', color: 'text-green-400', label: 'Veneno' },
  burn: { icon: '🔥', color: 'text-orange-400', label: 'Quemadura' },
  bleed: { icon: '🩸', color: 'text-red-400', label: 'Sangrado' },
  stun: { icon: '💫', color: 'text-yellow-300', label: 'Aturdimiento' },
  freeze: { icon: '❄️', color: 'text-cyan-300', label: 'Congelamiento' },
  atk_up: { icon: '⚔️', color: 'text-amber-400', label: 'Ataque+' },
  def_up: { icon: '🛡️', color: 'text-blue-400', label: 'Defensa+' },
  shield: { icon: '🔮', color: 'text-purple-400', label: 'Escudo' },
  regen: { icon: '💚', color: 'text-green-400', label: 'Regeneración' },
}

export const POSITION_LABELS: Record<string, string> = {
  front: 'Frontal', center: 'Centro', rear: 'Trasera',
  left_flank: 'Flanco izq.', right_flank: 'Flanco der.',
}
