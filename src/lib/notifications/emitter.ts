import db from "@/lib/db"
import { sendPush } from "@/lib/notifications/push"

type NotificationInput = {
  heroId: string
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export async function notify(input: NotificationInput) {
  await db.notification.create({
    data: {
      heroId: input.heroId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: (input.data ?? {}) as any,
    },
  })

  sendPush({
    heroId: input.heroId,
    title: input.title,
    body: input.body,
    data: input.data,
  }).catch(() => {})
}
