"use client"
import { useState } from "react"

type Race = {
  id: number; name: string; icon: string; flavor: string
  attrMods: Record<string, number>; racialTraits: { name: string; desc: string }[]
  lore: string
}

type Props = { races: Race[]; classAttrs: Record<string, number>; onSelect: (raceId: number) => void; defaultSelectedRaceId?: number | null }

const ATTR_NAMES: Record<string, string> = {
  st: "Fuerza", co: "Constitución", in: "Inteligencia", dx: "Destreza",
  ch: "Carisma", ag: "Agilidad", pe: "Percepción", wi: "Voluntad",
}

function modColor(val: number) {
  if (val > 0) return "text-green-400"
  if (val < 0) return "text-red-400"
  return "text-gray-400"
}

export default function RaceSelector({ races, classAttrs, onSelect, defaultSelectedRaceId = null }: Readonly<Props>) {
  const [selected, setSelected] = useState<Race | null>(
    () => races.find(race => race.id === defaultSelectedRaceId) ?? null,
  )

  function finalAttr(attr: string) {
    return (classAttrs[attr] || 0) + (selected?.attrMods[attr] || 0)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {races.map(race => (
          <button key={race.id}
            aria-pressed={selected?.id === race.id}
            onClick={() => { setSelected(race); onSelect(race.id) }}
            className={`p-3 border rounded-xl text-left transition-all bg-gray-900
              ${selected?.id === race.id
                ? "border-blue-500 bg-gray-800 border-2"
                : "border-gray-700 hover:border-blue-500 hover:bg-gray-800"}`}>
            <div className="text-2xl mb-1">{race.icon}</div>
            <div className="font-medium text-sm text-gray-100">{race.name}</div>
            <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{race.flavor}</div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(race.attrMods).filter(([, v]) => v !== 0).map(([attr, val]) => (
                <span key={attr} className={`text-xs font-medium ${modColor(val)}`}>
                  {ATTR_NAMES[attr]} {val > 0 ? `+${val}` : val}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="border border-gray-700 rounded-xl p-4 bg-gray-900 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{selected.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-100">{selected.name}</h3>
              <p className="text-xs text-gray-400">{selected.flavor}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Stats finales (clase + raza)
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.keys(ATTR_NAMES).map(attr => {
                const mod = selected.attrMods[attr] || 0
                return (
                  <div key={attr} className="text-center bg-gray-800 rounded-lg p-1.5">
                    <div className="text-xs text-gray-400">{ATTR_NAMES[attr].slice(0, 3)}</div>
                    <div className="font-semibold text-sm text-gray-100">{finalAttr(attr)}</div>
                    {mod !== 0 && (
                      <div className={`text-xs ${modColor(mod)}`}>
                        {mod > 0 ? `+${mod}` : mod}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Habilidades raciales
            </p>
            {selected.racialTraits.map((t, i) => (
              <div key={"trait-" + i} className="flex gap-2 py-1.5 border-b border-gray-700 last:border-0">
                <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <span className="font-medium text-sm text-gray-200">{t.name}: </span>
                  <span className="text-sm text-gray-400">{t.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
