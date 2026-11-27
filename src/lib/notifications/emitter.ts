import db from "@/lib/db"
import { sendPush } from "@/lib/notifications/push"
import logger from "@/lib/logger"

type NotificationInput = {
  heroId: string
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
  dedupeKey?: string
}

export async function notify(input: NotificationInput) {
  try {
    await db.notification.create({
      data: {
        heroId: input.heroId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as any,
        ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
      },
    })
  } catch (error) {
    if (input.dedupeKey && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return
    throw error
  }

  sendPush({
    heroId: input.heroId,
    title: input.title,
    body: input.body,
    data: input.data,
  }).catch(e => logger.error("notifications", "Failed to send notification", e))
}
