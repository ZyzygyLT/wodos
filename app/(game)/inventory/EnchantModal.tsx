"use client"

interface Props {
  item: any
  enchanting: boolean
  onEnchant: (id: string) => void
  onClose: () => void
}

export default function EnchantModal({ item, enchanting, onEnchant, onClose }: Readonly<Props>) {
  const level = item.upgradeLevel ?? 0

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
        <span className="text-4xl block mb-2">{item.item.icon}</span>
        <p className="font-bold text-lg">{item.item.name}</p>
        <p className="text-sm text-gray-400 mb-2">Nivel +{level}</p>
        <div className="text-xs text-gray-500 space-y-1 mb-4">
          <p>💰 {level >= 10 ? "—" : 100 + level * 50}</p>
          <p>💎 Esencia Mágica: {level >= 10 ? "—" : 1 + Math.floor(level / 2)}</p>
          <p>Probabilidad: {level >= 10 ? "—" : [100,100,90,80,70,50,40,30,20,10][level]}%</p>
        </div>
        {level < 10 && (
          <button onClick={() => onEnchant(item.id)} disabled={enchanting}
            className="w-full py-2 rounded-lg text-sm bg-orange-700 hover:bg-orange-600 disabled:opacity-50 transition">
            {enchanting ? "..." : "⬆ Mejorar"}
          </button>
        )}
        {level >= 10 && <p className="text-yellow-400 text-sm">¡Item al máximo nivel!</p>}
        <button onClick={onClose}
          className="mt-2 w-full py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 transition">
          Cerrar
        </button>
      </div>
    </div>
  )
}
