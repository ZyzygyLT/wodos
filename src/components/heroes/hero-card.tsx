interface HeroCardProps {
  id: string
  name: string
  className: string
  raceName: string
  level: number
  classIcon: string
  raceIcon: string
}

export default function HeroCard({ id, name, className, raceName, level, classIcon, raceIcon }: Readonly<HeroCardProps>) {
  return (
    <a href={`/heroes/${id}`} className="block border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="text-2xl">{raceIcon} {classIcon}</div>
        <div>
          <div className="font-semibold text-lg">{name}</div>
          <div className="text-sm text-gray-500">{raceName} · {className} · Lv.{level}</div>
        </div>
      </div>
    </a>
  )
}
