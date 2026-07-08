"use client"

import { useEffect, useState, useCallback } from "react"

interface EnemyInfo { id: number; name: string; icon: string; hp: number; level: number; position: string }

interface FloorEnemy { id: number; count: number; position?: string }

interface Floor { number: number; enemies: FloorEnemy[]; epReward: number; goldReward: number }

const POSITIONS = ['front', 'center', 'rear', 'left_flank', 'right_flank', 'flexible']

const EMPTY_FLOOR = (num: number): Floor => ({ number: num, enemies: [], epReward: 10, goldReward: 50 })

export default function AdminDungeonsPage() {
  const [dungeons, setDungeons] = useState<any[]>([])
  const [allEnemies, setAllEnemies] = useState<EnemyInfo[]>([])
  const [selectedDungeon, setSelectedDungeon] = useState<any>(null)
  const [floors, setFloors] = useState<Floor[]>([])
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null)
  const [editingDungeon, setEditingDungeon] = useState<any>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    fetch("/api/admin/dungeons").then(r => r.json()).then(d => { setDungeons(Array.isArray(d) ? d : []) }).catch(() => {})
    fetch("/api/admin/enemies").then(r => r.json()).then(setAllEnemies).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  function selectDungeon(d: any) {
    setSelectedDungeon(d)
    const raw = Array.isArray(d.levels) ? d.levels : []
    setFloors(raw.map((l: any) => ({
      number: l.number,
      enemies: Array.isArray(l.enemies) ? l.enemies.map((e: any) => ({ id: e.id, count: e.count ?? 1, position: e.position })) : [],
      epReward: l.epReward ?? d.epReward,
      goldReward: l.goldReward ?? d.goldReward,
    })))
  }

  function addFloor() {
    const maxNum = floors.length > 0 ? Math.max(...floors.map(f => f.number)) : 0
    setEditingFloor(EMPTY_FLOOR(maxNum + 1))
  }

  function enemyCount(eid: number): number {
    if (!editingFloor) return 0
    return editingFloor.enemies.find(e => e.id === eid)?.count ?? 0
  }

  function setEnemyCount(eid: number, count: number) {
    if (!editingFloor) return
    let enemies
    if (count <= 0) {
      enemies = editingFloor.enemies.filter(e => e.id !== eid)
    } else if (editingFloor.enemies.some(e => e.id === eid)) {
      enemies = editingFloor.enemies.map(e => e.id === eid ? { ...e, count } : e)
    } else {
      enemies = [...editingFloor.enemies, { id: eid, count }]
    }
    setEditingFloor({ ...editingFloor, enemies })
  }

  function enemyPosition(eid: number): string | undefined {
    if (!editingFloor) return undefined
    return editingFloor.enemies.find(e => e.id === eid)?.position
  }

  function setEnemyPosition(eid: number, position: string) {
    if (!editingFloor) return
    const enemies = editingFloor.enemies.map(e => e.id === eid ? { ...e, position } : e)
    setEditingFloor({ ...editingFloor, enemies })
  }

  async function saveFloors() {
    if (!selectedDungeon) return
    setSaving(true)
    const res = await fetch("/api/admin/dungeons", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedDungeon.id, levels: floors }),
    })
    if (res.ok) {
      setMessage("✅ Niveles guardados")
      setEditingFloor(null)
      load()
      const updated = await fetch(`/api/admin/dungeons`).then(r => r.json())
      const d = (Array.isArray(updated) ? updated : []).find((x: any) => x.id === selectedDungeon.id)
      if (d) selectDungeon(d)
    } else {
      const d = await res.json()
      setMessage(`❌ ${d.error || "Error"}`)
    }
    setSaving(false)
  }

  async function saveDungeon() {
    if (!editingDungeon) return
    const body = { ...editingDungeon }
    if (!body.name || !body.slug) { setMessage("❌ Nombre y slug requeridos"); return }
    const isNew = !body.id
    const method = isNew ? "POST" : "PUT"
    body.difficulty = Number.parseInt(body.difficulty) || 1
    body.levelReq = Number.parseInt(body.levelReq) || 1
    body.recommendedLevel = Number.parseInt(body.recommendedLevel) || 1
    body.epReward = Number.parseInt(body.epReward) || 0
    body.goldReward = Number.parseInt(body.goldReward) || 0
    body.fameReward = Number.parseInt(body.fameReward) || 5
    try { body.scheduledTimes = JSON.parse(body.scheduledTimes) } catch {}
    const res = await fetch("/api/admin/dungeons", {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setMessage(isNew ? "✅ Dungeon creado" : "✅ Dungeon actualizado")
      setEditingDungeon(null)
      load()
    } else {
      const d = await res.json()
      setMessage(`❌ ${d.error || "Error"}`)
    }
  }

  async function removeDungeon(id: number) {
    if (!confirm("¿Borrar dungeon?")) return
    await fetch(`/api/admin/dungeons?id=${id}`, { method: "DELETE" })
    setMessage("🗑️ Dungeon borrado")
    setSelectedDungeon(null)
    load()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {message && <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer" onClick={() => setMessage(null)}>{message}</button>}

      {/* Left panel: dungeon list */}
      <div className="lg:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">🗺️ Dungeons</h1>
          <button onClick={() => setEditingDungeon({ name: '', slug: '', icon: '🗺️', description: '', region: '', difficulty: 1, difficultyLabel: 'Normal', levelReq: 1, recommendedLevel: 1, epReward: 10, goldReward: 50, fameReward: 5, levels: [], lootTable: [], scheduledTimes: '[]', isInstant: false })}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-xs font-bold transition">+ Nuevo</button>
        </div>
        <div className="space-y-2">
          {dungeons.map(d => (
            <button key={d.id} onClick={() => selectDungeon(d)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${selectedDungeon?.id === d.id ? 'bg-red-800 text-red-200' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
              <span className="mr-2">{d.icon}</span>
              <span className="font-medium">{d.name}</span>
              <span className="text-xs text-gray-500 ml-2">{d.difficultyLabel}</span>
            </button>
          ))}
          {dungeons.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No hay dungeons.</p>}
        </div>
      </div>

      {/* Right panel: floor editor */}
      <div className="lg:col-span-2">
        {selectedDungeon ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{selectedDungeon.icon} {selectedDungeon.name}</h2>
                <p className="text-xs text-gray-500">{selectedDungeon.region} · {selectedDungeon.difficultyLabel} · Lv{selectedDungeon.levelReq}+</p>
              </div>
              <div className="flex gap-2">
                <button onClick={addFloor} className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs font-bold transition">+ Piso</button>
                <button onClick={saveFloors} disabled={saving}
                  className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 rounded text-xs font-bold transition">
                  {saving ? "Guardando..." : "Guardar pisos"}
                </button>
                <button onClick={() => { setEditingDungeon(selectedDungeon); setEditingFloor(null) }}
                  className="px-3 py-1.5 bg-blue-800 hover:bg-blue-700 rounded text-xs transition">Editar datos</button>
              </div>
            </div>

            {floors.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8 bg-gray-900 rounded-xl border border-gray-800">
                Este dungeon no tiene pisos. Haz clic en "+ Piso" para agregar.
              </p>
            )}

            <div className="space-y-2">
              {floors.toSorted((a, b) => a.number - b.number).map((floor, idx) => (
                <div key={floor.number} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm">Nivel {floor.number}</h3>
                    <div className="flex gap-2 text-xs">
                      <span className="text-gray-500">🏅 {floor.epReward} EP</span>
                      <span className="text-gray-500">💰 {floor.goldReward} Oro</span>
                      <button onClick={() => setEditingFloor({ ...floor })}
                        className="text-blue-400 hover:text-blue-300 ml-2">Editar</button>
                      <button onClick={() => {
                        setFloors(floors.filter(f => f.number !== floor.number))
                      }} className="text-red-400 hover:text-red-300">Quitar</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {floor.enemies.map(e => {
                      const info = allEnemies.find(a => a.id === e.id)
                      const posLabel = e.position ?? info?.position
                      return (
                        <span key={e.id} className="text-xs bg-gray-800 rounded px-2 py-0.5">
                          {info?.icon ?? '👹'} {info?.name ?? `#${e.id}`} ×{e.count}
                          {posLabel && <span className="text-gray-500 ml-1">[{posLabel}]</span>}
                        </span>
                      )
                    })}
                    {floor.enemies.length === 0 && <span className="text-xs text-gray-600">Sin enemigos</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-gray-500">Selecciona un dungeon de la lista</p>
          </div>
        )}
      </div>

      {/* Floor edit modal */}
      {editingFloor && (
        <button type="button" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditingFloor(null)}>
          <button type="button" className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}>
            <h3 className="text-lg font-bold mb-4">Editar Nivel {editingFloor.number}</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1" htmlFor="floor-ep-reward">EP Reward</label>
                <input id="floor-ep-reward" type="number" value={editingFloor.epReward} onChange={e => setEditingFloor({ ...editingFloor, epReward: Number.parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1" htmlFor="floor-gold-reward">Gold Reward</label>
                <input id="floor-gold-reward" type="number" value={editingFloor.goldReward} onChange={e => setEditingFloor({ ...editingFloor, goldReward: Number.parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="block text-xs text-gray-400 mb-2">Enemigos en este piso</div>
            {allEnemies.length === 0 ? (
              <p className="text-xs text-gray-500">Crea enemigos primero en la sección Enemies.</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {allEnemies.map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-1.5 text-xs">
                    <div className="flex-1 min-w-0">
                      <span>{e.icon} {e.name} <span className="text-gray-600">(Lv{e.level})</span></span>
                      <select value={enemyPosition(e.id) ?? e.position} aria-label="Posición"
                        onChange={v => setEnemyPosition(e.id, v.target.value)}
                        className="ml-2 bg-gray-700 border border-gray-600 rounded text-[10px] px-1 py-0.5">
                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setEnemyCount(e.id, Math.max(0, enemyCount(e.id) - 1))}
                        className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center">−</button>
                      <span className="w-6 text-center font-mono">{enemyCount(e.id)}</span>
                      <button onClick={() => setEnemyCount(e.id, enemyCount(e.id) + 1)}
                        className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditingFloor(null)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">Cerrar</button>
              <button onClick={() => {
                setFloors(prev => {
                  const exists = prev.findIndex(f => f.number === editingFloor.number)
                  if (exists >= 0) {
                    const copy = [...prev]
                    copy[exists] = editingFloor
                    return copy
                  }
                  return [...prev, editingFloor]
                })
                setEditingFloor(null)
              }}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold transition">Aplicar</button>
            </div>
          </button>
        </button>
      )}

      {/* Dungeon edit/create modal */}
      {editingDungeon && (
        <button type="button" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditingDungeon(null)}>
          <button type="button" className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}>
            <h3 className="text-lg font-bold mb-4">{editingDungeon.id ? "Editar" : "Nuevo"} Dungeon</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="dungeon-nombre">Nombre</label>
                  <input id="dungeon-nombre" value={editingDungeon.name} onChange={e => setEditingDungeon({ ...editingDungeon, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="dungeon-slug">Slug</label>
                  <input id="dungeon-slug" value={editingDungeon.slug} onChange={e => setEditingDungeon({ ...editingDungeon, slug: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1" htmlFor="dungeon-icono">Icono</label>
                  <input id="dungeon-icono" value={editingDungeon.icon} onChange={e => setEditingDungeon({ ...editingDungeon, icon: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1" htmlFor="dungeon-región">Región</label>
                    <input id="dungeon-región" value={editingDungeon.region} onChange={e => setEditingDungeon({ ...editingDungeon, region: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1" htmlFor="dungeon-dificultad">Dificultad</label>
                    <input id="dungeon-dificultad" value={editingDungeon.difficultyLabel} onChange={e => setEditingDungeon({ ...editingDungeon, difficultyLabel: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['levelReq','recommendedLevel','epReward','goldReward','fameReward','difficulty'].map(f => (
                  <div key={f}>
                    <label className="block text-xs text-gray-400 mb-1" htmlFor={`dungeon-${f.toLowerCase()}`}>{f}</label>
                    <input id={`dungeon-${f.toLowerCase()}`} type="number" value={editingDungeon[f] ?? 0} onChange={e => setEditingDungeon({ ...editingDungeon, [f]: Number.parseInt(e.target.value) || 0 })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1" htmlFor="dungeon-descripción">Descripción</label>
                <textarea id="dungeon-descripción" value={editingDungeon.description} onChange={e => setEditingDungeon({ ...editingDungeon, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1" htmlFor="dungeon-loot-table-json">Loot Table (JSON)</label>
                <textarea id="dungeon-loot-table-json" value={JSON.stringify(editingDungeon.lootTable, null, 2)} onChange={e => { try { setEditingDungeon({ ...editingDungeon, lootTable: JSON.parse(e.target.value) }) } catch {} }}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-xs" rows={3} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1" htmlFor="dungeon-horarios-programados-json-array">Horarios programados (JSON array)</label>
                <input id="dungeon-horarios-programados-json-array" value={editingDungeon.scheduledTimes} onChange={e => setEditingDungeon({ ...editingDungeon, scheduledTimes: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-xs" placeholder='["02:00","06:00","10:00"]' />
                <div className="flex gap-1 mt-1">
                  {[['2h','["00:00","02:00","04:00","06:00","08:00","10:00","12:00","14:00","16:00","18:00","20:00","22:00"]'],
                    ['4h','["02:00","06:00","10:00","14:00","18:00","22:00"]'],
                    ['6h','["02:00","08:00","14:00","20:00"]'],
                    ['8h','["00:00","08:00","16:00"]']].map(([label, val]) => (
                    <button key={label} onClick={() => setEditingDungeon({ ...editingDungeon, scheduledTimes: val })}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded">{label}</button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editingDungeon.isInstant} onChange={e => setEditingDungeon({ ...editingDungeon, isInstant: e.target.checked })} />{' '}Instant (abierto siempre)
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditingDungeon(null)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">Cancelar</button>
              <button onClick={saveDungeon}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold transition">Guardar</button>
            </div>
          </button>
        </button>
      )}
    </div>
  )
}
