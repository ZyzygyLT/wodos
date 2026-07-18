const store = new Map<string, { count: number; resetAt: number }>()

const DEFAULT_MAX = 30
const DEFAULT_WINDOW_MS = 60_000

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 120_000)

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: Date
}

export function checkRateLimit(key: string, max = DEFAULT_MAX, windowMs = DEFAULT_WINDOW_MS): RateLimitResult {
  const now = Date.now()
  let entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs }
    store.set(key, entry)
    return { ok: true, remaining: max - 1, resetAt: new Date(entry.resetAt) }
  }

  entry.count++
  const remaining = Math.max(0, max - entry.count)
  return { ok: entry.count <= max, remaining, resetAt: new Date(entry.resetAt) }
}

export function ipKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return '127.0.0.1'
}
