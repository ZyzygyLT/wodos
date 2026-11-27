CREATE TABLE "dungeon_run_post_processing" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dungeon_run_post_processing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dungeon_run_post_processing_runId_key"
  ON "dungeon_run_post_processing"("runId");
CREATE INDEX "dungeon_run_post_processing_status_nextAttemptAt_idx"
  ON "dungeon_run_post_processing"("status", "nextAttemptAt");

ALTER TABLE "dungeon_run_post_processing"
  ADD CONSTRAINT "dungeon_run_post_processing_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "dungeon_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");