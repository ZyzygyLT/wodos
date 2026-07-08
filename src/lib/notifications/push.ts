const ONESIGNAL_URL = "https://onesignal.com/api/v1/notifications"

interface PushPayload {
  heroId: string
  title: string
  body: string
  url?: string
  data?: Record<string, unknown>
}

export async function sendPush({ heroId, title, body, url, data }: PushPayload) {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_API_KEY) return

  try {
    const response = await fetch(ONESIGNAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        filters: [{ field: "tag", key: "hero_id", relation: "=", value: heroId }],
        headings: { en: title, es: title },
        contents: { en: body, es: body },
        url: url || `${process.env.NEXTAUTH_URL}/dashboard`,
        data,
        buttons: [
          { id: "view", text: "Ver resultado" },
          { id: "dungeon", text: "Siguiente dungeon" },
        ],
      }),
    })

    if (!response.ok) {
      console.error("OneSignal error:", await response.text())
    }
  } catch (e) {
    console.error("OneSignal send failed:", e)
  }
}
