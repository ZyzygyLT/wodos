"use client"

type HeroClass = {
  name: string
  icon: string
  baseAttrs: Record<string, number>
  primaryAttr: string
  secondaryAttr: string
}

type HeroRace = {
  name: string
  icon: string
  attrMods: Record<string, number>
  racialTraits: { name: string; desc: string }[]
}

type Props = {
  heroClass: HeroClass | null
  race: HeroRace | null
}

const ATTRIBUTES: Record<string, string> = {
  st: "Fuerza",
  co: "Constitución",
  in: "Inteligencia",
  dx: "Destreza",
  ch: "Carisma",
  ag: "Agilidad",
  pe: "Percepción",
  wi: "Voluntad",
}

export default function HeroCreationSummary({ heroClass, race }: Readonly<Props>) {
  if (!heroClass || !race) return null

  return (
    <section aria-label="Resumen del héroe" className="mb-5 rounded-lg border border-gray-700 bg-gray-950/70 p-4">
      <div className="mb-3 text-center">
        <span className="text-3xl" aria-hidden="true">{heroClass.icon} {race.icon}</span>
        <h2 className="mt-1 text-lg font-semibold text-gray-100">{heroClass.name} · {race.name}</h2>
        <p className="text-xs text-gray-400">Así comenzará tu héroe</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Atributos iniciales definitivos</p>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(ATTRIBUTES).map(([key, label]) => {
            const base = heroClass.baseAttrs[key] ?? 0
            const racial = race.attrMods[key] ?? 0
            const total = base + racial
            const specialty = key === heroClass.primaryAttr || key === heroClass.secondaryAttr
            return (
              <div key={key} className="rounded bg-gray-800 p-2 text-center">
                <div className="text-[10px] text-gray-400">{label}</div>
                <div className={`text-sm font-bold tabular-nums ${specialty ? "text-amber-300" : "text-gray-100"}`}>
                  {total}
                </div>
                <div className="text-[10px] text-gray-500">
                  {base}{racial === 0 ? "" : ` ${racial > 0 ? "+" : "−"} ${Math.abs(racial)}`}
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">El valor destacado corresponde a una de las especialidades de tu clase. El desglose muestra la base de clase y el modificador racial.</p>
      </div>

      {race.racialTraits.length > 0 && (
        <div className="mt-4 border-t border-gray-800 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Rasgos raciales</p>
          <ul className="space-y-1.5">
            {race.racialTraits.map((trait, index) => (
              <li key={`${trait.name}-${index}`} className="text-sm">
                <span className="font-medium text-green-300">{trait.name}</span>
                <span className="text-gray-400"> — {trait.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
