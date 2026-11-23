import db from '@/lib/db'
import logger from '@/lib/logger'

const EXECUTION_STALE_AFTER_MS = 15 * 60 * 1000

/**
 * Reconcile claims abandoned by a crashed worker. We finalize instead of
 * replaying because the previous worker's settlement outcome may be uncertain.
 */
export async function recoverStaleDungeonRuns() {
  const cutoff = new Date(Date.now() - EXECUTION_STALE_AFTER_MS)
  const staleRuns = await db.dungeonRun.findMany({
    where: {
      status: 'running',
      OR: [
        { executionStartedAt: { lt: cutoff } },
        { executionStartedAt: null, startedAt: { lt: cutoff } },
      ],
    },
    include: { participants: { select: { heroId: true } } },
  })

  for (const run of staleRuns) {
    const participantIds = [...new Set([
      run.heroId,
      ...run.participants.map((participant: { heroId: string }) => participant.heroId),
    ])]
    await db.$transaction(async tx => {
      const finalized = await tx.dungeonRun.updateMany({
        where: {
          id: run.id,
          status: 'running',
          OR: [
            { executionStartedAt: { lt: cutoff } },
            { executionStartedAt: null, startedAt: { lt: cutoff } },
          ],
        },
        data: {
          status: 'failed',
          result: 'defeat',
          completesAt: new Date(),
        },
      })
      if (finalized.count !== 1) return
      await tx.hero.updateMany({
        where: { id: { in: participantIds }, dungeonRegisteredId: run.id },
        data: { dungeonRegisteredId: null },
      })
      logger.warn('dungeon-recovery', `Expedición ${run.id} finalizada por expiración de ejecución`)
    })
  }
}
