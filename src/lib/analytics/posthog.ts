import { PostHog } from "posthog-node"

const apiKey = process.env.POSTHOG_API_KEY

export const posthog = apiKey
  ? new PostHog(apiKey, {
      host: "https://app.posthog.com",
      flushAt: 1,
    })
  : null
