/** The six fixed UTC departure slots shared by every scheduled dungeon. */
export const DUNGEON_SCHEDULE_TIMES = ["02:00", "06:00", "10:00", "14:00", "18:00", "22:00"]

/**
 * Returns whether at least one daily scheduled slot has occurred since the
 * registration became eligible. Looking only at today and yesterday strands
 * runs when the cron worker is unavailable for more than 24 hours.
 *
 * Schedule times are stored and evaluated as UTC clock times, matching the
 * dungeon schedule representation used by the cron.
 */
export function hasScheduledTimePassed(
  scheduledTimes: string[],
  since: Date,
  timerReductionHours = 0,
  now = new Date(),
): boolean {
  if (scheduledTimes.length === 0) return false

  const effectiveSince = new Date(since.getTime() + timerReductionHours * 60 * 60 * 1000)
  if (effectiveSince >= now) return false

  const today = now.toISOString().slice(0, 10)
  for (const time of scheduledTimes) {
    const scheduledAt = new Date(`${today}T${time}:00Z`)
    if (!Number.isFinite(scheduledAt.getTime())) continue

    // If today's slot is still in the future, the latest occurrence is yesterday.
    if (scheduledAt > now) {
      scheduledAt.setUTCDate(scheduledAt.getUTCDate() - 1)
    }

    if (scheduledAt > effectiveSince && scheduledAt <= now) return true
  }

  return false
}
