"use client"

import { useState, useMemo } from "react"

interface DungeonNode {
  id: number; slug: string; name: string; icon: string
  description?: string; lore?: string
  levelReq: number; recommendedLevel: number
  difficultyLabel: string; difficulty: number; isInstant: boolean
  isRegistered: boolean; nextScheduledTime: string | null
  activeRunDungeonId?: number | null; activeRunDungeonName?: string | null
  epReward?: number; goldReward?: number; fameReward?: number
  lootTable?: { itemId: number; chance: number; minQty: number; maxQty: number; name?: string }[]
  levels?: { number: number; enemies: { id: number; name: string; count: number; pos: string; isBoss?: boolean }[]; epReward: number; goldReward: number }[]
}

interface Profile {
  id: string; name: string; position: string
}

interface Props {
  dungeons: (DungeonNode & { profiles: Profile[] })[]
  heroLevel: number
  heroHp: number
  selectedProfiles: Record<number, string>
  onSelectProfile: (dungeonId: number, profileId: string) => void
  onRegister: (dungeonId: number, isInstant: boolean, groupId?: string) => void
  clanUpgrades?: { upgradeId: string; tier: number }[]
  groups?: { id: string; name: string; members: { heroId: string; name: string }[]; groupMembers?: { heroId: string; name: string }[] }[]
  selectedGroupId?: string
  onSelectGroup?: (groupId: string) => void
  onCreateGroup?: () => void
  questSlugs?: Set<string>
}

const POSITION_LABELS: Record<string, string> = {
  front: "Frontal", center: "Centro", rear: "Trasera",
  left_flank: "Flanco izq.", right_flank: "Flanco der.", flexible: "Flexible",
}

function computePositions(dungeons: any[]): Record<string, { x: number; y: number }> {
  const sorted = [...dungeons].sort((a, b) => (a.levelReq ?? 1) - (b.levelReq ?? 1))
  const positions: Record<string, { x: number; y: number }> = {}
  const count = sorted.length
  if (count === 0) return positions

  const regionCenters = [
    { x: 240, y: 340 },
    { x: 240, y: 420 },
    { x: 480, y: 240 },
    { x: 560, y: 340 },
    { x: 560, y: 500 },
  ]

  sorted.forEach((d, i) => {
    if (d.slug.startsWith("clan-dungeon-")) {
      positions[d.slug] = { x: 420, y: 70 }
      return
    }
    const regionIdx = Math.min(Math.floor(i / Math.ceil(count / regionCenters.length)), regionCenters.length - 1)
    const rc = regionCenters[regionIdx]
    const inRegion = i % Math.ceil(count / regionCenters.length)
    const regionSize = Math.ceil(count / regionCenters.length)
    const angle = (inRegion / Math.max(regionSize - 1, 1)) * Math.PI * 0.6 - Math.PI * 0.3
    const radius = 80 + inRegion * 15
    positions[d.slug] = {
      x: Math.round(rc.x + Math.sin(angle) * radius),
      y: Math.round(rc.y + Math.cos(angle) * radius * 0.5),
    }
  })
  return positions
}

function computePaths(dungeons: any[]): [string, string][] {
  const sorted = [...dungeons]
    .filter(d => !d.slug.startsWith("clan-dungeon-"))
    .sort((a, b) => (a.levelReq ?? 1) - (b.levelReq ?? 1))
  const paths: [string, string][] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    paths.push([sorted[i].slug, sorted[i + 1].slug])
  }
  return paths
}

const REGIONS = [
  { x: 100, y: 260, w: 280, h: 160, label: "Valdheim", color: "#EAF3DE", textColor: "#4a7a18" },
  { x: 420, y: 140, w: 160, h: 200, label: "Mystara", color: "#EEF6FD", textColor: "#2a6ca8" },
  { x: 480, y: 450, w: 200, h: 160, label: "Drakkar", color: "#FAEEDA", textColor: "#854F0B" },
  { x: 340, y: 30, w: 160, h: 80, label: "Territorio del clan", color: "#FEF9C3", textColor: "#854D0E" },
]

const DIFFICULTY_FILTERS = [
  { key: "all", label: "Todos", color: "gray" },
  { key: "easy", label: "Fácil", color: "green" },
  { key: "medium", label: "Medio", color: "yellow" },
  { key: "hard", label: "Difícil", color: "red" },
  { key: "expert", label: "Experto", color: "purple" },
]

function difficultyTier(d: number): string {
  if (d <= 1) return "easy"
  if (d <= 3) return "medium"
  if (d <= 4) return "hard"
  return "expert"
}

function nodeOpacity(locked: boolean, visible: boolean): number {
  if (locked) return 0.3
  if (visible) return 1
  return 0.15
}

function strokeWidth(selected: boolean, clanOnly: boolean, registered: boolean): number {
  if (selected) return 2.5
  if (clanOnly) return 2
  if (registered) return 1.5
  return 1
}

function buttonLabel(loading: boolean | string | null, isInstant: boolean, isRegistered: boolean, activeRunElsewhere: boolean): string {
  if (loading) return "..."
  if (isRegistered) return "Ya registrado"
  if (activeRunElsewhere) return "Comprometido"
  if (isInstant) return "Entrar ahora"
  return "Registrarse"
}

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  easy:   { fill: "#064E3B", stroke: "#059669" },
  medium: { fill: "#713F12", stroke: "#CA8A04" },
  hard:   { fill: "#7F1D1D", stroke: "#DC2626" },
  expert: { fill: "#4C1D95", stroke: "#7C3AED" },
}

function hasBonus(upgrades: { upgradeId: string; tier: number }[] | undefined, id: string, minTier: number): boolean {
  const u = upgrades?.find(u => u.upgradeId === id)
  return u != null && u.tier >= minTier
}

export default function DungeonMap({ dungeons, heroLevel, heroHp, selectedProfiles, onSelectProfile, onRegister, clanUpgrades, groups, selectedGroupId, onSelectGroup, onCreateGroup, questSlugs }: Readonly<Props>) {
  const [selected, setSelected] = useState<(DungeonNode & { profiles: Profile[] }) | null>(null)
  const [profileDropdown, setProfileDropdown] = useState<number | null>(null)
  const [groupDropdown, setGroupDropdown] = useState(false)
  const [enterLoading, setEnterLoading] = useState<number | null>(null)
  const [diffFilter, setDiffFilter] = useState("all")
  const [levelMin, setLevelMin] = useState("")
  const [levelMax, setLevelMax] = useState("")

  const POSITIONS = useMemo(() => computePositions(dungeons), [dungeons])
  const PATHS = useMemo(() => computePaths(dungeons), [dungeons])

  const dungeonMap = new Map(dungeons.map(d => [d.id, d]))
  const showLootPreview = hasBonus(clanUpgrades, "cartography", 2)
  const showBossReveal = hasBonus(clanUpgrades, "cartography", 3)

  const filteredSlugs = useMemo(() => {
    const min = levelMin ? Number(levelMin) : 0
    const max = levelMax ? Number(levelMax) : 999
    const visible = new Set<string>()
    for (const d of dungeons) {
      if (d.slug.startsWith("clan-dungeon-")) { visible.add(d.slug); continue }
      if (diffFilter !== "all" && difficultyTier(d.difficulty) !== diffFilter) continue
      if (d.recommendedLevel < min || d.recommendedLevel > max) continue
      visible.add(d.slug)
    }
    return visible
  }, [dungeons, diffFilter, levelMin, levelMax])

  async function handleEnter(d: DungeonNode & { profiles: Profile[] }) {
    setEnterLoading(d.id)
    onRegister(d.id, d.isInstant, selectedGroupId)
    setEnterLoading(null)
  }

  const selectedDungeon = selected ? dungeonMap.get(selected.id) : null

  return (
    <div className="flex flex-col gap-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {DIFFICULTY_FILTERS.map(f => (
            <button key={f.key} onClick={() => setDiffFilter(f.key)}
              className={`px-3 py-1 text-xs rounded-md transition font-medium ${
                (() => {
                  if (diffFilter !== f.key) return "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                  if (f.key === "all") return "bg-gray-700 text-white"
                  if (f.key === "easy") return "bg-green-800 text-green-200"
                  if (f.key === "medium") return "bg-yellow-800 text-yellow-200"
                  if (f.key === "hard") return "bg-red-800 text-red-200"
                  return "bg-purple-800 text-purple-200"
                })()
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>Nv.</span>
          <input type="number" min={1} value={levelMin} onChange={e => setLevelMin(e.target.value)}
            placeholder="min" className="w-12 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-300 text-center" />
          <span>—</span>
          <input type="number" min={1} value={levelMax} onChange={e => setLevelMax(e.target.value)}
            placeholder="max" className="w-12 bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-300 text-center" />
        </div>
        <span className="text-[10px] text-gray-600">{filteredSlugs.size} mazmorras</span>
      </div>

      <div className="flex gap-4">
        {/* Map */}
        <div className="flex-1 overflow-auto border border-gray-700 rounded-xl bg-gray-900">
          <svg width={800} height={650} viewBox="0 0 800 650" className="block">
            {REGIONS.map(r => (
              <g key={r.label}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={16}
                  fill={r.color} stroke={r.textColor} strokeWidth={1.5} opacity={0.15} />
                <text x={r.x + r.w / 2} y={r.y + r.h + 20}
                  textAnchor="middle" fontSize={11} fill={r.textColor} fontWeight={500}>
                  {r.label}
                </text>
              </g>
            ))}

            {PATHS.map(([a, b]) => {
              const pa = POSITIONS[a], pb = POSITIONS[b]
              if (!pa || !pb) return null
              const bothVisible = filteredSlugs.has(a) && filteredSlugs.has(b)
              return (
                <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke={bothVisible ? "#4B5563" : "#1F2937"} strokeWidth={1.5} strokeDasharray="4 3" />
              )
            })}

            {dungeons.map(d => {
              const isClanOnly = d.slug.startsWith("clan-dungeon-")
              const pos = POSITIONS[d.slug]
              if (!pos) return null
              const locked = !isClanOnly && d.levelReq > heroLevel
              const isSelected = selected?.id === d.id
              const isRegistered = d.isRegistered
              const visible = filteredSlugs.has(d.slug)
              const tier = difficultyTier(d.difficulty)
              const nc = isClanOnly ? { fill: "#422006", stroke: "#F59E0B" } : NODE_COLORS[tier] ?? NODE_COLORS.easy

              return (
                <g key={d.id}
                  transform={`translate(${pos.x - 36},${pos.y - 24})`}
                  onClick={() => visible && setSelected(d)}
                  style={{ cursor: visible ? "pointer" : "default", opacity: nodeOpacity(locked, visible) }}
                >
                  <rect width={72} height={48} rx={8}
                    fill={isSelected ? "#1E3A5F" : nc.fill}
                    stroke={isSelected ? "#3B82F6" : nc.stroke}
                    strokeWidth={strokeWidth(isSelected, isClanOnly, isRegistered)}
                  />
                  {isClanOnly && <rect width={72} height={48} rx={8} fill="none" stroke="#FBBF24" strokeWidth={1} strokeDasharray="3 2" />}
                  <text x={36} y={22} textAnchor="middle" fontSize={20}>{d.icon}</text>
                  <text x={36} y={38} textAnchor="middle" fontSize={8} fill="#D1D5DB">
                    {d.name.length > 10 ? d.name.slice(0, 9) + "…" : d.name}
                  </text>
                  {locked && <text x={64} y={12} textAnchor="middle" fontSize={14}>🔒</text>}
                  {isRegistered && (
                    <circle cx={64} cy={10} r={5} fill="#F59E0B" />
                  )}
                  {questSlugs?.has(d.slug) && !locked && (
                    <text x={8} y={14} textAnchor="middle" fontSize={12}>📜</text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 shrink-0 border border-gray-700 rounded-xl bg-gray-900 p-4 space-y-3 max-h-[680px] overflow-y-auto">
            <div className="text-3xl text-center">{selected.icon}</div>
            <h2 className="font-semibold text-gray-100 text-center">{selected.name}</h2>
            <p className="text-xs text-center">
              <span               className={`inline-block px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider font-bold ${
                (() => {
                  if (difficultyTier(selected.difficulty) === "easy") return "border-green-600 text-green-400"
                  if (difficultyTier(selected.difficulty) === "medium") return "border-yellow-600 text-yellow-400"
                  if (difficultyTier(selected.difficulty) === "hard") return "border-red-600 text-red-400"
                  return "border-purple-600 text-purple-400"
                })()
              }`}>
                {selected.difficultyLabel}
              </span>
            </p>
            {selected.slug.startsWith("clan-dungeon-") && (
              <p className="text-xs text-yellow-400 text-center font-semibold">🏰 Mazmorra exclusiva del clan</p>
            )}
            {selected.description && <p className="text-xs text-gray-400 text-center italic">{selected.description}</p>}
            {selected.lore && <p className="text-xs text-gray-600 text-center">"{selected.lore}"</p>}
            {questSlugs?.has(selected.slug) && (
              <p className="text-xs text-amber-400 text-center font-semibold">📜 Quest activa</p>
            )}

            {/* Info */}
            <div className="text-sm space-y-1 text-gray-400">
              <div className="flex justify-between">
                <span>🎯 Nivel mín</span>
                <span>{selected.levelReq}</span>
              </div>
              <div className="flex justify-between">
                <span>✅ Recomendado</span>
                <span>Nv.{selected.recommendedLevel}</span>
              </div>
              <div className="flex justify-between">
                <span>⚡ Tipo</span>
                <span>{selected.isInstant ? "Instantáneo" : "Programado"}</span>
              </div>
              {!selected.isInstant && selected.nextScheduledTime && (
                <div className="flex justify-between">
                  <span>⏰ Próximo</span>
                  <span>{new Date(selected.nextScheduledTime).toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            {/* Rewards preview */}
            {(selected.epReward || selected.goldReward || selected.fameReward) && (
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-amber-400 font-semibold mb-1">💰 Recompensas</p>
                {selected.epReward && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">⭐ Experiencia</span>
                    <span className="text-yellow-400 font-medium">+{selected.epReward} EP</span>
                  </div>
                )}
                {selected.goldReward && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">🪙 Oro</span>
                    <span className="text-yellow-300 font-medium">+{selected.goldReward}</span>
                  </div>
                )}
                {selected.fameReward && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">🏆 Fama</span>
                    <span className="text-amber-400 font-medium">+{selected.fameReward}</span>
                  </div>
                )}
              </div>
            )}

            {/* Enemy count preview */}
            {selected.levels && (
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-red-400 font-semibold mb-1">⚔️ Enemigos</p>
                {(selected.levels as any[]).map((lv: any) => {
                  const total = (lv.enemies ?? []).reduce((s: number, e: any) => s + e.count, 0)
                  const bosses = (lv.enemies ?? []).filter((e: any) => e.isBoss)
                  return (
                    <div key={lv.number} className="flex justify-between text-xs">
                      <span className="text-gray-400">Nv{lv.number} · {lv.locationName}</span>
                      <span className="text-gray-300">
                        {total} enemigos
                        {bosses.length > 0 && <span className="text-red-400 ml-1">👑</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Boss reveal */}
            {showBossReveal && selectedDungeon?.levels && (
              <div className="bg-gray-800/50 rounded-lg p-2 space-y-1">
                <p className="text-xs text-purple-400 font-semibold">👁️ Revelación del boss</p>
                {(selectedDungeon.levels as any[]).map((lv: any) => {
                  const bosses = (lv.enemies ?? []).filter((e: any) => e.isBoss)
                  return bosses.length > 0 ? (
                    <p key={lv.number} className="text-xs text-gray-300">
                      Nv{lv.number}: {bosses.map((b: any) => `${b.name} ×${b.count}`).join(", ")}
                    </p>
                  ) : null
                })}
              </div>
            )}

            {/* Loot preview */}
            {showLootPreview && selectedDungeon?.lootTable && (
              <div className="bg-gray-800/50 rounded-lg p-2 space-y-1">
                <p className="text-xs text-yellow-400 font-semibold">👁️ Preview de loot</p>
                {(selectedDungeon.lootTable as any[]).map((loot: any, i: number) => (
                  <p key={"loot-preview-" + i} className="text-xs text-gray-300">
                    {loot.name ?? `Item #${loot.itemId}`} · {Math.round(loot.chance * 100)}% · {loot.minQty}-{loot.maxQty}x
                  </p>
                ))}
              </div>
            )}

            {/* Profile selector */}
            <div className="relative">
              <button onClick={() => setProfileDropdown(profileDropdown === selected.id ? null : selected.id)}
                className="flex items-center justify-between w-full bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition">
                <span>⚔️ {selected.profiles.find(p => p.id === selectedProfiles[selected.id])?.name ?? selected.profiles[0]?.name ?? "Perfil"}</span>
                <span className="text-gray-500">▼</span>
              </button>

              {profileDropdown === selected.id && (
                <>
                  <button type="button" className="fixed inset-0 z-10" onClick={() => setProfileDropdown(null)} />
                  <div className="absolute bottom-full left-0 mb-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[180px]">
                    {selected.profiles.map(p => (
                      <button key={p.id} onClick={() => { onSelectProfile(selected.id, p.id); setProfileDropdown(null) }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition ${selectedProfiles[selected.id] === p.id ? "text-yellow-400" : "text-gray-200"}`}>
                        {p.name}
                        <span className="text-gray-500 ml-2">{POSITION_LABELS[p.position] ?? p.position}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Group selector */}
            {groups && groups.length > 0 && (
              <div className="relative">
                <button onClick={() => setGroupDropdown(!groupDropdown)}
                  className="flex items-center justify-between w-full bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition">
                  <span>👥 {groups.find(g => g.id === selectedGroupId)?.name ?? "Seleccionar grupo"}</span>
                  <span className="text-gray-500">▼</span>
                </button>
                {groupDropdown && (
                  <>
                    <button type="button" className="fixed inset-0 z-10" onClick={() => setGroupDropdown(false)} />
                    <div className="absolute bottom-full left-0 mb-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[200px]">
                      {groups.map(g => (
                        <div key={g.id} className={`flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-700 transition ${selectedGroupId === g.id ? "text-yellow-400" : "text-gray-200"}`}>
                          <button onClick={() => { onSelectGroup?.(g.id); setGroupDropdown(false) }} className="flex-1 text-left">
                            {g.name}
                            <span className="text-gray-500 ml-2">({g.members?.length ?? g.groupMembers?.length ?? 0})</span>
                          </button>
                          <a href={`/groups/${g.id}`} onClick={e => e.stopPropagation()}
                            className="text-gray-500 hover:text-amber-400 ml-2 shrink-0" title="Administrar grupo">
                            ⚙️
                          </a>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {!groups || groups.length === 0 && (
              <div className="flex gap-2">
                <div className="flex-1 text-xs text-gray-500 text-center py-1">👤 Modo individual</div>
                {onCreateGroup && (
                  <button onClick={onCreateGroup}
                    className="text-xs px-3 py-1 rounded bg-green-800 hover:bg-green-700 transition">
                    + Crear grupo
                  </button>
                )}
              </div>
            )}

            {selected.activeRunDungeonId != null && selected.activeRunDungeonId !== selected.id && (
              <p className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                Tu héroe ya participa en <strong>{selected.activeRunDungeonName ?? "otra expedición"}</strong>. Debe terminar antes de entrar en otra mazmorra.
              </p>
            )}
            <button onClick={() => handleEnter(selected)}
              disabled={heroHp <= 0 || selected.isRegistered || (selected.activeRunDungeonId != null && selected.activeRunDungeonId !== selected.id) || enterLoading === selected.id || !filteredSlugs.has(selected.slug)}
              className="w-full py-2 rounded-lg text-sm font-medium transition bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
              {buttonLabel(enterLoading === selected.id, selected.isInstant, selected.isRegistered, selected.activeRunDungeonId != null && selected.activeRunDungeonId !== selected.id)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
