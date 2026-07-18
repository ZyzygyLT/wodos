"use client"

import { useState, useRef } from "react"
import { useInventory } from "@/hooks/useInventory"
import EnchantModal from "./EnchantModal"
import SocketModal from "./SocketModal"
import ItemTooltip, { type TooltipItem } from "@/components/game/ItemTooltip"

const RARITY_COLORS: Record<string, string> = {
  common: "border-gray-500 text-gray-300",
  uncommon: "border-green-600 text-green-400",
  rare: "border-blue-600 text-blue-400",
  epic: "border-purple-600 text-purple-400",
  unique: "border-orange-500 text-orange-300",
}

const SLOT_INFO: Record<string, { label: string; icon: string }> = {
  head: { label: 'Cabeza', icon: '⛑️' },
  face: { label: 'Cara', icon: '🎭' },
  neck: { label: 'Cuello', icon: '📿' },
  shoulders: { label: 'Hombros', icon: '🛡️' },
  back: { label: 'Capa', icon: '🧣' },
  chest: { label: 'Torso', icon: '👕' },
  arms: { label: 'Brazos', icon: '💪' },
  hands: { label: 'Guantes', icon: '🧤' },
  mainHand: { label: 'Mano Der', icon: '⚔️' },
  offHand: { label: 'Mano Izq', icon: '🛡️' },
  belt: { label: 'Cinto', icon: '🔗' },
  legs: { label: 'Piernas', icon: '👖' },
  feet: { label: 'Calzado', icon: '👢' },
  backpack: { label: 'Mochila', icon: '🎒' },
}

const PAPERDOLL: (string | [string, string] | [string, string, string])[] = [
  'head',
  'face',
  'neck',
  ['shoulders', 'back'],
  'chest',
  ['arms', 'hands'],
  ['mainHand', 'offHand'],
  'belt',
  'legs',
  'feet',
]

function SlotCell({ slot, ei, isTwoHanded, onUnequip, onEnchant, onSocket, toggling, onHover, onLeave }: Readonly<{
  slot: string; ei: any; isTwoHanded: boolean
  onUnequip: (id: string) => void; onEnchant: (id: string) => void
  onSocket: (id: string) => void; toggling: string | null
  onHover?: (ei: any) => void; onLeave?: () => void
}>) {
  const info = SLOT_INFO[slot]
  const occupiedBy2H = slot === 'offHand' && isTwoHanded

  if (occupiedBy2H) {
    return (
      <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-2 flex items-center gap-2 opacity-60">
        <span className="text-base opacity-40">{info.icon}</span>
        <span className="text-xs text-gray-500 italic">2M</span>
      </div>
    )
  }

  if (ei) {
    return (
      <button type="button" className="bg-gray-900 rounded-lg border border-yellow-700/60 p-2 flex items-center gap-2 hover:border-yellow-600 transition cursor-default"
        onMouseEnter={() => onHover?.(ei)} onMouseLeave={onLeave}
        onFocus={() => onHover?.(ei)} onBlur={onLeave}>
        <span className="text-lg">{ei.item.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{ei.item.name}</p>
          <p className="text-[10px] text-gray-500">{info.label}</p>
          {(ei.upgradeLevel ?? 0) > 0 && <p className="text-[10px] text-orange-400">⬆ +{ei.upgradeLevel}</p>}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => onUnequip(ei.id)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-800 hover:bg-yellow-700 transition"
            disabled={toggling === ei.id}>{toggling === ei.id ? "..." : "✕"}
          </button>
          <button onClick={() => onEnchant(ei.id)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-orange-800 hover:bg-orange-700 transition">
            +{ei.upgradeLevel ?? 0}
          </button>
          {ei.item.runeSlots > 0 && (
            <button onClick={() => onSocket(ei.id)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-purple-800 hover:bg-purple-700 transition">
              💎
            </button>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="bg-gray-900/30 rounded-lg border border-gray-800/50 p-2 flex items-center gap-2">
      <span className="text-base opacity-30">{info.icon}</span>
      <span className="text-xs text-gray-600">{info.label}</span>
    </div>
  )
}

const STORAGE_BONUS: Record<number, number> = { 1: 500, 2: 1500, 3: 5000 }

export default function InventoryPage() {
  const inv = useInventory()
  const { hero, items, clan, message, dismiss, toggling, sellingItem, socketItem, setSocketItem, enchantItem, setEnchantItem, enchanting, runes, socketing, usingItem, toggleEquip, socketRune, unsocketRune, doEnchant, consumeItem, startSell, confirmSell, cancelSell } = inv
  const [hoveredItem, setHoveredItem] = useState<{ item: TooltipItem; equipped?: any } | null>(null)
  const [sellPrice, setSellPrice] = useState("")
  const anchorRefs = useRef<Map<string, HTMLElement>>(new Map())

  function toTooltipItem(ei: any): TooltipItem {
    const runesIn = (ei.runesIn as any[] ?? [])
    const runeItems = runesIn.map((r: any) => {
      const runeItem = runes.find((run: any) => run.item?.id === r.itemId)
      return runeItem ? { id: runeItem.item.id, name: runeItem.item.name, icon: runeItem.item.icon, stats: (runeItem.item.stats ?? {}) as Record<string, number> } : null
    }).filter(Boolean)
    return {
      id: ei.item.id,
      name: ei.item.name,
      icon: ei.item.icon,
      rarity: ei.item.rarity,
      category: ei.item.category,
      slot: ei.item.slot,
      levelReq: ei.item.levelReq,
      description: ei.item.description ?? '',
      stats: ei.item.stats,
      runeSlots: ei.item.runeSlots,
      runesIn,
      runeItems: runeItems as any,
      upgradeLevel: ei.upgradeLevel,
      classReq: ei.item.classReq,
      attrReq: ei.item.attrReq,
    }
  }

  function setAnchor(id: string, el: HTMLElement | null) {
    if (el) anchorRefs.current.set(id, el)
    else anchorRefs.current.delete(id)
  }

  function showTooltip(inventoryItem: any) {
    const slot = inventoryItem.item.slot
    const equippedInSlot = slot ? equippedBySlot[slot] : null
    const hasUpgrade = (inventoryItem.upgradeLevel ?? 0) > 0
    const equippedHasUpgrade = (equippedInSlot?.upgradeLevel ?? 0) > 0
    setHoveredItem({
      item: { ...toTooltipItem(inventoryItem), upgradeLevel: hasUpgrade ? inventoryItem.upgradeLevel : undefined },
      equipped: equippedInSlot && slot ? {
        item: { ...toTooltipItem(equippedInSlot), upgradeLevel: equippedHasUpgrade ? equippedInSlot.upgradeLevel : undefined },
        upgradeLevel: equippedInSlot.upgradeLevel,
        stats: mergeStats(equippedInSlot),
      } : null,
    })
  }

  function mergeStats(ei: any): Record<string, number> {
    const base = (ei.item.stats ?? {}) as Record<string, number>
    return { ...base }
  }

  function hideTooltip() { setHoveredItem(null) }

  const equipped = items.filter(i => i.equipped)
  const equippedBySlot: Record<string, any> = {}
  for (const ei of equipped) if (ei.slot) equippedBySlot[ei.slot] = ei
  const accessoryCount = equipped.filter(ei => ei.item.category === 'accessory').length
  const isTwoHanded = equippedBySlot['mainHand']?.item?.twoHanded
  const hasBackpack = equippedBySlot['backpack'] != null
  const clanStorageUpgrade = clan?.upgrades?.find((u: any) => u.upgradeId === "storage")
  const storageBonus = clanStorageUpgrade ? (STORAGE_BONUS[clanStorageUpgrade.tier] ?? 0) : 0
  const invMax = (hero?.inventoryMaxSize ?? 20) + storageBonus
  const unequipped = items.filter(i => !i.equipped)
  const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, unique: 4 }

  if (!hero) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.2s]" /><div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:0.4s]" /></div></div>

  return (
    <>
      {message && (
        <button type="button" className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
          onClick={() => dismiss()}>{message}</button>
      )}

      <div className="max-w-6xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">

        <div>
          <h2 className="font-bold text-lg mb-3">⚡ Equipamiento</h2>
          <div className="space-y-2">
            {PAPERDOLL.map(row => {
              if (typeof row === 'string') {
                return <SlotCell key={row} slot={row} ei={equippedBySlot[row]} isTwoHanded={isTwoHanded}
                  onUnequip={(id) => toggleEquip(id, true)} onEnchant={setEnchantItem} onSocket={setSocketItem} toggling={toggling}
                  onHover={(ei) => setHoveredItem({ item: { ...toTooltipItem(ei), upgradeLevel: (ei.upgradeLevel ?? 0) > 0 ? ei.upgradeLevel : undefined }, equipped: null })}
                  onLeave={hideTooltip} />
              }
              if (row.length === 2) {
                const [l, r] = row
                return (
                  <div key={l + r} className="grid grid-cols-2 gap-2">
                    <SlotCell slot={l} ei={equippedBySlot[l]} isTwoHanded={false}
                      onUnequip={(id) => toggleEquip(id, true)} onEnchant={setEnchantItem} onSocket={setSocketItem} toggling={toggling}
                      onHover={(ei) => setHoveredItem({ item: { ...toTooltipItem(ei), upgradeLevel: (ei.upgradeLevel ?? 0) > 0 ? ei.upgradeLevel : undefined }, equipped: null })}
                      onLeave={hideTooltip} />
                    <SlotCell slot={r} ei={equippedBySlot[r]} isTwoHanded={isTwoHanded}
                      onUnequip={(id) => toggleEquip(id, true)} onEnchant={setEnchantItem} onSocket={setSocketItem} toggling={toggling}
                      onHover={(ei) => setHoveredItem({ item: { ...toTooltipItem(ei), upgradeLevel: (ei.upgradeLevel ?? 0) > 0 ? ei.upgradeLevel : undefined }, equipped: null })}
                      onLeave={hideTooltip} />
                  </div>
                )
              }
              return null
            })}
          </div>

          <div className="mt-4 space-y-1 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <span>💍 Accesorios:</span>
              <span className="text-yellow-400 font-bold">{accessoryCount}/4</span>
              {accessoryCount >= 4 && <span className="text-xs text-red-400">(máximo)</span>}
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <span>🎒 Mochila:</span>
              <span className={`font-bold ${hasBackpack ? 'text-green-400' : 'text-gray-500'}`}>
                {hasBackpack ? '+15 espacios' : 'No equipada'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-bold text-lg mb-3">🎒 Inventario <span className="text-sm text-gray-500 font-normal">({unequipped.length}/{invMax})</span></h2>

          {unequipped.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">🎒</p>
              <p className="text-gray-400">Inventario vacío</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unequipped.toSorted((a, b) => (rarityOrder[b.item.rarity] ?? 0) - (rarityOrder[a.item.rarity] ?? 0)).map(ei => {
                const slotInfo = ei.item.slot ? SLOT_INFO[ei.item.slot] : null
                const isConsumable = ei.item.category === 'consumable'
                return (
                  <button type="button" key={ei.id}
                    ref={el => setAnchor(`inv-${ei.id}`, el)}
                    onMouseEnter={() => showTooltip(ei)}
                    onMouseLeave={hideTooltip}
                    onFocus={() => showTooltip(ei)}
                    onBlur={hideTooltip}
                    className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex items-start gap-3 hover:border-gray-700 transition cursor-default">
                    <span className="text-2xl">{ei.item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{ei.item.name}</p>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${RARITY_COLORS[ei.item.rarity] ?? 'border-gray-500 text-gray-300'}`}>{ei.item.rarity}</span>
                      </div>
                      <p className="text-xs text-gray-500 capitalize">{ei.item.category} · Nv.{ei.item.levelReq}</p>
                      {slotInfo && <p className="text-[10px] text-gray-500">{slotInfo.icon} {slotInfo.label}</p>}
                      {(ei.upgradeLevel ?? 0) > 0 && <p className="text-[10px] text-orange-400">⬆ +{ei.upgradeLevel}</p>}
                      {ei.item.stats && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-400 mt-1">
                          {Object.entries(ei.item.stats as Record<string, number>).filter(([k]) => k !== 'healHp' && k !== 'healMp').map(([k, v]) => (
                            <span key={k}>{k.toUpperCase()}+{v}</span>
                          ))}
                        </div>
                      )}
                      {ei.item.runeSlots > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                          {Array.from({ length: ei.item.runeSlots }).map((_, i) => {
                            const runeIn = (ei.runesIn as any[] ?? []).find((r: any) => r.slotIndex === i)
                            return <span key={"rune-dot-" + i} className={`w-3 h-3 rounded-full ${runeIn ? 'bg-purple-500' : 'bg-gray-700'}`} />
                          })}
                          <span className="ml-1">{(ei.runesIn as any[] ?? []).length}/{ei.item.runeSlots}</span>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        {isConsumable ? (
                          <button onClick={() => consumeItem(ei.id)}
                            className="text-xs px-2.5 py-1 rounded bg-blue-800 hover:bg-blue-700 disabled:opacity-50 transition"
                            disabled={usingItem === ei.id}>
                            {usingItem === ei.id ? "..." : "Usar"}
                          </button>
                        ) : (
                          <>
                            <button onClick={() => toggleEquip(ei.id, false)}
                              className="text-xs px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition"
                              disabled={toggling === ei.id}>
                              {toggling === ei.id ? "..." : "Equipar"}
                            </button>
                            <button onClick={() => setEnchantItem(ei)}
                              className="text-xs px-2 py-1 rounded bg-orange-800 hover:bg-orange-700 transition">
                              +{ei.upgradeLevel ?? 0}
                            </button>
                            {ei.item.runeSlots > 0 && (
                              <button onClick={() => setSocketItem(ei)}
                                className="text-xs px-2 py-1 rounded bg-purple-800 hover:bg-purple-700 transition">
                                💎
                              </button>
                            )}
                            <button onClick={() => startSell(ei.id)}
                              className="text-xs px-2 py-1 rounded bg-green-800 hover:bg-green-700 transition">
                              Vender
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    </button>
                  )
                })}
            </div>
          )}

          {runes.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold text-sm mb-2">💎 Runas ({runes.length})</h3>
              <div className="flex flex-wrap gap-2">
                {runes.map((r: any) => (
                  <span key={r.id} className="px-2.5 py-1 rounded bg-gray-800 border border-gray-700 text-xs flex items-center gap-1">
                    {r.item.icon} {r.item.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {socketItem && (
        <SocketModal
          item={socketItem}
          runes={runes}
          socketing={socketing}
          onSocket={socketRune}
          onUnsocket={unsocketRune}
          onClose={() => setSocketItem(null)}
        />
      )}

      {enchantItem && (
        <EnchantModal
          item={enchantItem}
          enchanting={enchanting}
          onEnchant={doEnchant}
          onClose={() => setEnchantItem(null)}
        />
      )}

      {hoveredItem && (
        <ItemTooltip item={hoveredItem.item} equipped={hoveredItem.equipped} />
      )}

      {sellingItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { cancelSell(); setSellPrice("") }} role="dialog" aria-modal="true">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">💰 Vender en bazar</h3>
            <p className="text-gray-400 text-sm mb-4">
              Precio de venta (oro):
            </p>
            <input type="number" min="1" autoFocus placeholder="Precio" value={sellPrice}
              onChange={e => setSellPrice(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && Number(sellPrice) >= 1) { confirmSell(sellingItem, Number(sellPrice)); setSellPrice("") } }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-4" />
            <div className="flex gap-2">
              <button onClick={() => { if (Number(sellPrice) >= 1) { confirmSell(sellingItem, Number(sellPrice)); setSellPrice("") } }}
                disabled={!sellPrice || Number(sellPrice) < 1}
                className="flex-1 px-4 py-2 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm transition">
                Vender
              </button>
              <button onClick={() => { cancelSell(); setSellPrice("") }}
                className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
