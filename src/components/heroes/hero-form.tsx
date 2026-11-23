'use client'
import { useState } from 'react'
import type { AttributeDefinition } from '@/generated/prisma'

interface HeroFormProps {
  attributes: AttributeDefinition[]
  classes: { id: number; name: string; icon: string }[]
  races: { id: number; name: string; icon: string }[]
  initialData?: {
    name: string
    classId: number
    raceId: number
    attrs: Record<string, number>
  }
  onSubmit: (data: {
    name: string
    classId: number
    raceId: number
    attrs: Record<string, number>
  }) => Promise<string | undefined>
}

export default function HeroForm({ attributes, classes, races, initialData, onSubmit }: Readonly<HeroFormProps>) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [classId, setClassId] = useState(initialData?.classId ?? classes[0]?.id ?? 0)
  const [raceId, setRaceId] = useState(initialData?.raceId ?? races[0]?.id ?? 0)
  const [attrValues, setAttrValues] = useState<Record<string, number>>(initialData?.attrs ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const result = await onSubmit({ name, classId, raceId, attrs: attrValues })
      if (result) setError(result)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label htmlFor="hero-name" className="block font-medium mb-1">Hero Name</label>
        <input
          id="hero-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
          maxLength={100}
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="hero-class" className="block font-medium mb-1">Class</label>
          <select id="hero-class" value={classId} onChange={e => setClassId(Number(e.target.value))} className="w-full border rounded px-3 py-2">
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="hero-race" className="block font-medium mb-1">Race</label>
          <select id="hero-race" value={raceId} onChange={e => setRaceId(Number(e.target.value))} className="w-full border rounded px-3 py-2">
            {races.map(r => (
              <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="block font-medium mb-2">Attributes</div>
        <div className="grid grid-cols-2 gap-3">
          {attributes.map(attr => (
            <div key={attr.id}>
              <label htmlFor={`hero-${attr.abbreviation}`} className="text-sm text-gray-600">{attr.name} ({attr.abbreviation})</label>
              <input
                id={`hero-${attr.abbreviation}`}
                type="number"
                value={attrValues[attr.abbreviation] ?? attr.minValue}
                onChange={e => setAttrValues(prev => ({ ...prev, [attr.abbreviation]: Number(e.target.value) }))}
                min={attr.minValue}
                max={attr.maxValue}
                className="w-full border rounded px-2 py-1"
              />
              <span className="text-xs text-gray-400">{attr.minValue}–{attr.maxValue}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Hero'}
      </button>
    </form>
  )
}
