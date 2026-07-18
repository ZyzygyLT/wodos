"use client"

export default function ConfirmModal({ message, onConfirm, onCancel }: Readonly<{
  message: string
  onConfirm: () => void
  onCancel: () => void
}>) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <p className="text-gray-200 text-sm mb-6">{message}</p>
        <div className="flex gap-2">
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded bg-red-700 hover:bg-red-600 text-sm transition">
            Confirmar
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
