import db from "@/lib/db"
import { notify } from "@/lib/notifications/emitter"

export type FactionSlug = "guardia" | "mercaderes" | "gremio" | "iglesia" | "sabios" | "sombra"

export const FACTION_TITLES: Record<number, { min: number; title: string }[]> = {
  1: [ // Guardia
    { min: 0, title: "Desconocido" },
    { min: 20, title: "Simpatizante" },
    { min: 50, title: "Ciudadano Leal" },
    { min: 80, title: "Guardián Honorario" },
    { min: 100, title: "Héroe de la Guardia" },
  ],
  2: [ // Mercaderes
    { min: 0, title: "Forastero" },
    { min: 20, title: "Cliente Frecuente" },
    { min: 50, title: "Socio Comercial" },
    { min: 80, title: "Mercader de Confianza" },
    { min: 100, title: "Maestro Mercader" },
  ],
  3: [ // Gremio
    { min: 0, title: "Aprendiz" },
    { min: 20, title: "Oficial Novato" },
    { min: 50, title: "Artesano Viajero" },
    { min: 80, title: "Maestro Artesano" },
    { min: 100, title: "Señor del Gremio" },
  ],
  4: [ // Iglesia
    { min: 0, title: "Peregrino" },
    { min: 20, title: "Devoto" },
    { min: 50, title: "Acólito" },
    { min: 80, title: "Sacerdote" },
    { min: 100, title: "Sancto" },
  ],
  5: [ // Sabios
    { min: 0, title: "Curioso" },
    { min: 20, title: "Estudiante" },
    { min: 50, title: "Erudito" },
    { min: 80, title: "Sabio" },
    { min: 100, title: "Archimago" },
  ],
  6: [ // Sombra
    { min: 0, title: "Extraño" },
    { min: 20, title: "Contacto" },
    { min: 50, title: "Agente" },
    { min: 80, title: "Maestro de Sombras" },
    { min: 100, title: "Señor de la Noche" },
  ],
}

export function getTitleForRep(factionId: number, rep: number): string {
  const titles = FACTION_TITLES[factionId] ?? FACTION_TITLES[1]
  let best = titles[0].title
  for (const t of titles) {
    if (rep >= t.min) best = t.title
  }
  return best
}

export async function getHeroFactionReps(heroId: string) {
  const reps = await db.heroFactionRep.findMany({
    where: { heroId },
    include: { faction: true },
  })

  const allFactions = await db.faction.findMany({
    include: { shops: true },
  })

  return allFactions.map(f => {
    const existing = reps.find(r => r.factionId === f.id)
    const rep = existing?.rep ?? 0
    return {
      id: f.id,
      slug: f.slug,
      name: f.name,
      description: f.description,
      icon: f.icon,
      color: f.color,
      rep,
      title: existing?.title ?? getTitleForRep(f.id, rep),
      shops: f.shops.map(s => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        minRep: s.minRep,
        unlocked: rep >= s.minRep,
      })),
    }
  })
}

export async function adjustRep(heroId: string, factionId: number, amount: number, reason?: string) {
  const rep = await db.heroFactionRep.upsert({
    where: { heroId_factionId: { heroId, factionId } },
    update: { rep: { increment: amount } },
    create: { heroId, factionId, rep: amount },
  })

  const newTitle = getTitleForRep(factionId, rep.rep)
  if (newTitle !== rep.title) {
    await db.heroFactionRep.update({
      where: { heroId_factionId: { heroId, factionId } },
      data: { title: newTitle },
    })

    const faction = await db.faction.findUnique({ where: { id: factionId } })
    await notify({
      heroId,
      type: "faction",
      title: "¡Nuevo título de facción!",
      body: `Ahora sos "${newTitle}" en la facción ${faction?.name ?? "#" + factionId}.`,
      data: { factionId },
    })
  }

  return rep
}
