"use client"

import { useRef } from "react"

interface Props {
  item: any
  runes: any[]
  socketing: string | null
  onSocket: (slotIndex: number, runeHeroItemId: string) => void
  onUnsocket: (slotIndex: number) => void
  onClose: () => void
}

export default function SocketModal({ item, runes, socketing, onSocket, onUnsocket, onClose }: Readonly<Props>) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{item.item.icon}</span>
          <div>
            <p className="font-bold">{item.item.name}</p>
            <p className="text-xs text-gray-400">{item.item.runeSlots} slots de runa</p>
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: item.item.runeSlots }).map((_, i) => {
            const runeIn = (item.runesIn as any[] ?? []).find((r: any) => r.slotIndex === i)
            const unsocketKey = `unsocket-${i}`
            const socketKey = `${i}-${runeIn?.itemId ?? 'undefined'}`
            return (
              <div key={"slot-" + i} className="bg-gray-800 rounded-lg border border-gray-700 p-3 flex items-center justify-between">
                <span className="text-sm text-gray-400">Slot {i + 1}</span>
                {runeIn ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">#{runeIn.itemId}</span>
                    <button onClick={() => onUnsocket(i)} disabled={socketing === unsocketKey}
                      className="text-xs px-2 py-1 rounded bg-red-800 hover:bg-red-700 disabled:opacity-50">
                      {socketing === unsocketKey ? "..." : "Remover"}
                    </button>
                  </div>
                ) : (
                  <SocketSlot
                    index={i}
                    runes={runes}
                    loading={socketing === socketKey}
                    onSocket={onSocket}
                  />
                )}
              </div>
            )
          })}
        </div>
        <button onClick={onClose}
          className="mt-4 w-full py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 transition">
          Cerrar
        </button>
      </div>
    </div>
  )
}

function SocketSlot({ index, runes, loading, onSocket }: Readonly<{
  index: number
  runes: any[]
  loading: boolean
  onSocket: (slotIndex: number, runeHeroItemId: string) => void
}>) {
  const selectRef = useRef<HTMLSelectElement>(null)

  return (
    <div className="flex items-center gap-2">
      <select ref={selectRef}
        className="bg-gray-700 text-xs rounded px-2 py-1 border border-gray-600">
        <option value="">Seleccionar runa</option>
        {runes.map(r => (
          <option key={r.id} value={r.id}>{r.item.icon} {r.item.name}</option>
        ))}
      </select>
      <button onClick={() => {
        if (selectRef.current?.value) onSocket(index, selectRef.current.value)
      }} disabled={loading}
        className="text-xs px-2 py-1 rounded bg-blue-800 hover:bg-blue-700 disabled:opacity-50">
        {loading ? "..." : "Socketear"}
      </button>
    </div>
  )
}
