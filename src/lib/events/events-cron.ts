import db from "@/lib/db"
import { notify } from "@/lib/notifications/emitter"

export async function tickEvents() {
  const now = new Date()

  // ── Close expired events ──────────────────────────
  const expired = await db.weeklyEvent.findMany({
    where: { isActive: true, endsAt: { lte: now } },
    include: {
      participations: {
        include: { clan: { select: { id: true, name: true } } },
        orderBy: { score: "desc" },
      },
    },
  })

  for (const ev of expired) {
    await db.weeklyEvent.update({
      where: { id: ev.id },
      data: { isActive: false },
    })

    for (const p of ev.participations) {
      const leader = await db.clanMember.findFirst({
        where: { clanId: p.clanId, role: "leader" },
        select: { heroId: true },
      })
      if (leader) {
        notify({
          heroId: leader.heroId,
          type: "event_ended",
          title: `📊 Evento finalizado: ${ev.name}`,
          body: `Tu clan quedó con ${p.score} puntos. Reclamá las recompensas en la página de eventos.`,
        }).catch(e => logger.error("events-cron", "Background event processing failed", e))
      }
    }
  }

  // ── Create next event if none scheduled ────────────
  const futureEvent = await db.weeklyEvent.findFirst({
    where: { startsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
  })

  if (!futureEvent) {
    const eventCount = await db.weeklyEvent.count()
    const dungeonIds = [1, 2, 3, 4, 5, 13, 14]
    const dungeonId = dungeonIds[eventCount % dungeonIds.length]
    const eventNames = [
      { name: "Cacería de sombras", desc: "Eliminá espectros y sombras en las ruinas. El clan con más muertes gana." },
      { name: "Furia elemental", desc: "Los elementales atacan desde todos los frentes. Derrotá la mayor cantidad posible." },
      { name: "Noche de los no-muertos", desc: "Los muertos vivientes emergen de las criptas. Tu clan debe contener la amenaza." },
      { name: "Invasión del Vacío", desc: "Criaturas del Vacío atraviesan el portal. Cada kill cuenta para la gloria de tu clan." },
    ]
    const ev = eventNames[eventCount % eventNames.length]

    await db.weeklyEvent.create({
      data: {
        id: `event-auto-${Date.now()}`,
        name: ev.name,
        description: ev.desc,
        type: "invasion",
        dungeonId,
        startsAt: now,
        endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        isActive: true,
        rewards: [
          { rank: "1", fame: 300, gold: 500 },
          { rank: "2-3", fame: 150, gold: 200 },
          { rank: "top10pct", fame: 50, gold: 80 },
          { rank: "participant", fame: 10, gold: 20 },
        ],
      },
    })
  }
}

export function startEventsCron() {
  tickEvents().catch(e => console.error('[events-cron] Error:', e))
  setInterval(() => tickEvents().catch(e => console.error('[events-cron] Error:', e)), 5 * 60 * 1000)
}
