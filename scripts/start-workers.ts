import 'dotenv/config'

async function main() {
  console.log('[workers] Iniciando procesos de background...')

  try {
    const { startDungeonCron } = await import('@/lib/dungeon-cron')
    startDungeonCron()
    console.log('[workers] Dungeon cron — OK')
  } catch (e) {
    console.error('[workers] Error starting dungeon cron:', e)
  }

  try {
    const { startWorker } = await import('@/lib/dungeon-queue')
    startWorker()
  } catch (e) {
    console.error('[workers] Error starting queue worker:', e)
  }

  try {
    const { startEventsCron } = await import('@/lib/events/events-cron')
    startEventsCron()
    console.log('[workers] Events cron — OK')
  } catch (e) {
    console.error('[workers] Error starting events cron:', e)
  }
}

main().catch((e) => {
  console.error('[workers] Fatal error:', e)
  process.exit(1)
})
