'use client'
import { useState } from 'react'

interface AttributeFormProps {
  initialData?: {
    name: string
    abbreviation: string
    description: string | null
    minValue: number
    maxValue: number
  }
  onSubmit: (data: {
    name: string
    abbreviation: string
    description: string | null
    minValue: number
    maxValue: number
  }) => Promise<void>
}

export default function AttributeForm({ initialData, onSubmit }: Readonly<AttributeFormProps>) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [abbreviation, setAbbreviation] = useState(initialData?.abbreviation ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [minValue, setMinValue] = useState(initialData?.minValue ?? 1)
  const [maxValue, setMaxValue] = useState(initialData?.maxValue ?? 100)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ name, abbreviation, description: description || null, minValue, maxValue })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label htmlFor="attr-name" className="block font-medium mb-1">Name</label>
        <input id="attr-name" type="text" value={name} onChange={e => setName(e.target.value)} required
          className="w-full border rounded px-3 py-2" maxLength={50} />
      </div>
      <div>
        <label htmlFor="attr-abbreviation" className="block font-medium mb-1">Abbreviation</label>
        <input id="attr-abbreviation" type="text" value={abbreviation} onChange={e => setAbbreviation(e.target.value)} required
          className="w-full border rounded px-3 py-2" maxLength={10} />
      </div>
      <div>
        <label htmlFor="attr-description" className="block font-medium mb-1">Description</label>
        <textarea id="attr-description" value={description} onChange={e => setDescription(e.target.value)}
          className="w-full border rounded px-3 py-2" rows={3} maxLength={300} />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="attr-min-value" className="block font-medium mb-1">Min Value</label>
          <input id="attr-min-value" type="number" value={minValue} onChange={e => setMinValue(Number(e.target.value))}
            className="w-full border rounded px-3 py-2" min={0} />
        </div>
        <div className="flex-1">
          <label htmlFor="attr-max-value" className="block font-medium mb-1">Max Value</label>
          <input id="attr-max-value" type="number" value={maxValue} onChange={e => setMaxValue(Number(e.target.value))}
            className="w-full border rounded px-3 py-2" min={1} />
        </div>
      </div>
      <button type="submit" disabled={saving}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Attribute'}
      </button>
    </form>
  )
}
