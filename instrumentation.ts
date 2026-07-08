export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.ENABLE_BACKGROUND_WORKERS === 'true') {
    try {
      const { startDungeonCron } = await import('@/lib/dungeon-cron')
      startDungeonCron()
    } catch (e) {
      console.error('[instrumentation] Error starting dungeon cron:', e)
    }

    try {
      const { startWorker } = await import('@/lib/dungeon-queue')
      startWorker()
    } catch (e) {
      console.error('[instrumentation] Error starting queue worker:', e)
    }

    try {
      const { startEventsCron } = await import('@/lib/events/events-cron')
      startEventsCron()
    } catch (e) {
      console.error('[instrumentation] Error starting events cron:', e)
    }
  }
}
